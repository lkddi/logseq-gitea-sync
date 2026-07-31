import '@logseq/libs'
import { getSettings, settingsSchema } from './settings'
import { repoInfo, SyncEngine, type SyncStatus } from './sync'
import { getLogs, log, testConnection } from './git'

const BAR_KEY = 'gitea-sync'

const ICONS: Record<SyncStatus, string> = {
  idle: '🔄',
  syncing: '⏳',
  success: '✅',
  error: '⚠️',
}

function renderButton(status: SyncStatus, detail?: string): void {
  const icon = ICONS[status]
  const safeDetail = (detail ?? '').replace(/"/g, '&quot;').slice(0, 120)
  const title = `Gitea Sync: ${status}${safeDetail ? ` — ${safeDetail}` : ''}`
  const template = `<a class="button" data-on-click="giteaSyncClick" title="${title}" style="display:flex;justify-content:center;align-items:center;width:100%;height:100%;font-size:13px;line-height:1;">${icon}</a>`
  try {
    logseq.App.registerUIItem('toolbar', { key: BAR_KEY, template })
  } catch (e) {
    log('warn', `could not render toolbar button: ${String(e)}`)
  }
}

function showLogs(): void {
  const lines = getLogs().slice(-30)
  const text = lines.length ? lines.join('\n') : '(no logs yet)'
  logseq.UI.showMsg(text, 'info', { timeout: 10_000 })
}

/** Warn once if Logseq's built-in git auto commit may fight with this plugin. */
async function checkBuiltinGitAutoCommit(): Promise<void> {
  try {
    const v = await logseq.App.getCurrentGraphConfigs('gitAutoCommitEnabled')
    const enabled = v === true || (typeof v === 'object' && v !== null && (v as Record<string, unknown>).gitAutoCommitEnabled === true)
    if (enabled) {
      log(
        'warn',
        'Logseq built-in "Git auto commit" is enabled. Disable it (Settings > Version control) to avoid git lock conflicts with this plugin.',
      )
    }
  } catch {
    // config key unknown on this version; nothing to do
  }
}

function main(): void {
  const engine = new SyncEngine({ onStatus: renderButton })

  try {
    logseq.useSettingsSchema(settingsSchema)
  } catch (e) {
    log('warn', `useSettingsSchema unavailable: ${String(e)}`)
  }

  logseq.provideModel({
    giteaSyncClick: () => engine.syncNow(),
  })

  logseq.App.registerCommandPalette(
    { key: 'gitea-sync-now', label: 'Gitea Sync: sync now' },
    () => engine.syncNow(),
  )

  logseq.App.registerCommandPalette(
    { key: 'gitea-sync-status', label: 'Gitea Sync: show status' },
    async () => {
      const { status, detail } = engine.getStatus()
      const info = await repoInfo()
      logseq.UI.showMsg(`Status: ${status}${detail ? ` (${detail})` : ''}\n${info}`, 'info', {
        timeout: 10_000,
      })
    },
  )

  logseq.App.registerCommandPalette(
    { key: 'gitea-sync-test', label: 'Gitea Sync: test connection' },
    async () => {
      const result = await testConnection()
      logseq.UI.showMsg(
        result.ok ? `✅ ${result.detail}` : `❌ ${result.detail}`,
        result.ok ? 'success' : 'error',
        { timeout: 10_000 },
      )
    },
  )

  logseq.App.registerCommandPalette(
    { key: 'gitea-sync-logs', label: 'Gitea Sync: show logs' },
    () => showLogs(),
  )

  logseq.App.registerCommandPalette(
    { key: 'gitea-sync-settings', label: 'Gitea Sync: open settings' },
    () => logseq.showSettingsUI(),
  )

  logseq.on('settings:changed', () => {
    engine.settingsChanged()
  })

  logseq
    .ready(() => {
      log('info', 'Gitea Sync loaded')
      renderButton('idle', 'ready')
      engine.start()
      void checkBuiltinGitAutoCommit()
      if (!getSettings().repoUrl) {
        logseq.UI.showMsg(
          'Gitea Sync: configure your repository in plugin settings to enable auto sync.',
          'warning',
          { timeout: 8000 },
        )
      }
    })
    .catch((e: unknown) => log('error', `plugin ready failed: ${String(e)}`))
}

main()
