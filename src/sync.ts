import {
  countAhead,
  currentBranch,
  ensureRemote,
  hasCommits,
  isSuccess,
  log,
  pullRebase,
  push,
  runGit,
} from './git'
import { getSettings, hasCredentials, isConfigured } from './settings'

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

interface SyncCallbacks {
  onStatus: (status: SyncStatus, detail?: string) => void
}

const RETRY_DELAYS = [20_000, 40_000, 80_000]

/**
 * Sync engine.
 *
 * Design note: Logseq's built-in git auto-commit (Settings > Version control)
 * owns the local repository — it commits through its own index handling that a
 * plugin cannot replicate with plain `git add`. This plugin therefore NEVER
 * stages or commits; it only pushes local commits to the configured remote
 * (and optionally pulls --rebase first for multi-device use).
 */
export class SyncEngine {
  private status: SyncStatus = 'idle'
  private dirty = false
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private retryCount = 0
  private syncing = false
  private lastDetail = ''

  constructor(private callbacks: SyncCallbacks) {}

  start(): void {
    this.setStatus('idle', 'plugin ready')
    // React to edits inside Logseq
    logseq.DB.onChanged(() => this.onChange())
    // Fallback polling for changes made outside Logseq
    const pollMs = Math.max(15, getSettings().pollInterval || 60) * 1000
    this.pollTimer = setInterval(() => this.onPoll(), pollMs)
    log('info', `sync engine started (poll every ${pollMs / 1000}s)`)
  }

  stop(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    if (this.pollTimer) clearInterval(this.pollTimer)
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.debounceTimer = null
    this.pollTimer = null
    this.retryTimer = null
  }

  /** Called by settings change handler to re-read config. */
  settingsChanged(): void {
    const s = getSettings()
    const pollMs = Math.max(15, s.pollInterval || 60) * 1000
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = setInterval(() => this.onPoll(), pollMs)
    this.dirty = true
    if (s.autoSync) {
      this.scheduleSync()
    }
  }

  /** Immediate manual sync (toolbar button / command). */
  async syncNow(): Promise<void> {
    this.dirty = true
    await this.syncOnce()
  }

  /** Expose current status for UI. */
  getStatus(): { status: SyncStatus; detail: string } {
    return { status: this.status, detail: this.lastDetail }
  }

  private onChange(): void {
    this.dirty = true
    if (getSettings().autoSync) {
      this.scheduleSync()
    }
  }

  private onPoll(): void {
    void (async () => {
      if (this.syncing) return
      const s = getSettings()
      if (!isConfigured(s) || !s.autoSync) return
      const branch = await currentBranch()
      if (!branch) return
      const ahead = await countAhead(branch)
      if (ahead > 0) {
        this.dirty = true
        this.scheduleSync()
      }
    })()
  }

  private scheduleSync(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    const delay = Math.max(5, getSettings().syncDelay || 30) * 1000
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      void this.syncOnce()
    }, delay)
  }

  private async syncOnce(): Promise<void> {
    if (this.syncing) return
    const s = getSettings()
    if (!isConfigured(s)) {
      this.setStatus('error', 'Repository URL not configured. Open plugin settings.')
      return
    }
    if (!hasCredentials(s)) {
      this.setStatus('error', 'No access token configured. Open plugin settings.')
      return
    }

    this.syncing = true
    this.setStatus('syncing')
    try {
      await ensureRemote(s)

      let branch = await currentBranch()
      if (!branch) {
        if (!(await hasCommits())) {
          this.dirty = false
          this.setStatus('idle', 'no commits yet — Logseq auto-commit will create the first one')
          return
        }
        branch = s.branch || 'master'
      }

      const ahead = await countAhead(branch)
      if (ahead <= 0) {
        this.dirty = false
        this.retryCount = 0
        this.setStatus('idle', 'up to date')
        return
      }

      if (s.pullRebase) {
        await pullRebase(branch)
      }
      await push(branch)

      this.dirty = false
      this.retryCount = 0
      this.setStatus('success', `pushed ${ahead} commit(s)`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      log('error', msg)
      if (this.retryCount < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[this.retryCount]
        this.retryCount += 1
        this.setStatus('error', `${msg} — retrying in ${delay / 1000}s`)
        if (this.retryTimer) clearTimeout(this.retryTimer)
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null
          void this.syncOnce()
        }, delay)
      } else {
        this.retryCount = 0
        this.setStatus('error', msg)
      }
    } finally {
      this.syncing = false
    }
  }

  private setStatus(status: SyncStatus, detail?: string): void {
    this.status = status
    if (detail !== undefined) this.lastDetail = detail
    this.callbacks.onStatus(status, this.lastDetail)
  }
}

/** Helper: check git repo state (used by the status command). */
export async function repoInfo(): Promise<string> {
  const branch = await currentBranch()
  const head = await runGit(['log', '-1', '--oneline'])
  const lines = [`branch: ${branch || '(unborn)'}`]
  lines.push(`HEAD: ${isSuccess(head) ? head.stdout.trim() || '(empty)' : '(none)'}`)
  if (branch) {
    const ahead = await countAhead(branch)
    lines.push(`unpushed commits: ${ahead < 0 ? 0 : ahead}`)
  }
  return lines.join('\n')
}
