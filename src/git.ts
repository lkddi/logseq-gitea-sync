import type { IGitResult } from './types'
import type { SyncSettings } from './settings'

/**
 * Minimal in-memory logger. Keeps the last N lines so the UI can show them.
 */
const MAX_LOG = 200
const buffer: string[] = []
const listeners = new Set<() => void>()

export function log(level: 'info' | 'warn' | 'error', msg: string): void {
  const line = `[${new Date().toLocaleTimeString()}] [${level}] ${msg}`
  buffer.push(line)
  if (buffer.length > MAX_LOG) buffer.splice(0, buffer.length - MAX_LOG)
  if (level === 'error') {
    console.error('[gitea-sync]', msg)
  } else {
    console.log('[gitea-sync]', msg)
  }
  listeners.forEach((l) => l())
}

export function onLog(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function getLogs(): string[] {
  return [...buffer]
}

/** Run a git command through Logseq's built-in git proxy (dugite). */
export async function runGit(args: string[]): Promise<IGitResult> {
  log('info', `$ git ${args.join(' ')}`)
  let result: IGitResult | null | undefined
  try {
    result = await logseq.Git.execCommand(args)
  } catch (e) {
    log('error', `git ${args.join(' ')} threw: ${String(e)}`)
    return { stdout: '', stderr: String(e), exitCode: 1 }
  }
  if (!result) {
    log(
      'error',
      `git ${args.join(' ')} -> Logseq git service returned null. ` +
        `Is Logseq built-in "Git auto commit" enabled? (Settings > Version control)`,
    )
    return {
      stdout: '',
      stderr:
        'Logseq git service returned null. Enable "Git auto commit" in Settings > Version control, or check Logseq developer console for git errors.',
      exitCode: 1,
    }
  }
  const stdout = result.stdout.trim()
  const stderr = result.stderr.trim()
  if (result.exitCode !== 0) {
    log('warn', `git ${args.join(' ')} -> exit ${result.exitCode}${stderr ? `\n${stderr}` : ''}`)
  } else if (stdout) {
    log('info', stdout)
  }
  return result
}

export function isSuccess(r: IGitResult): boolean {
  return r.exitCode === 0
}

/** True when the output mentions a merge conflict. */
export function hasConflict(r: IGitResult): boolean {
  return /CONFLICT|conflict/i.test(`${r.stderr} ${r.stdout}`)
}

/** Build the remote URL to configure, depending on the auth mode. */
export function buildRemoteUrl(s: SyncSettings): string {
  const url = s.repoUrl.trim()
  if (s.authMode !== 'https-token' || !s.token) {
    return url
  }
  try {
    const u = new URL(url)
    if (u.username || u.password) return url // user already embedded credentials
    u.username = s.username || 'oauth2'
    u.password = s.token
    return u.toString()
  } catch {
    return url
  }
}

/** Ensure the repo's origin remote points at the desired URL. */
export async function ensureRemote(s: SyncSettings): Promise<void> {
  const target = buildRemoteUrl(s)
  const existing = await runGit(['remote', 'get-url', 'origin'])
  if (isSuccess(existing) && existing.stdout.trim() === target) {
    return
  }
  if (isSuccess(existing)) {
    await runGit(['remote', 'set-url', 'origin', target])
    log('info', 'origin URL updated')
  } else {
    await runGit(['remote', 'add', 'origin', target])
    log('info', 'origin remote added')
  }
}

/** Whether the repo has at least one commit. */
export async function hasCommits(): Promise<boolean> {
  const r = await runGit(['rev-parse', '--verify', 'HEAD'])
  return isSuccess(r)
}

/** Current checked-out branch name ('' when unborn). */
export async function currentBranch(): Promise<string> {
  const r = await runGit(['branch', '--show-current'])
  return isSuccess(r) ? r.stdout.trim() : ''
}

/** True when the remote has the given branch. */
export async function remoteHasBranch(branch: string): Promise<boolean> {
  const r = await runGit(['ls-remote', '--heads', 'origin', branch])
  return isSuccess(r) && r.stdout.trim().length > 0
}

/**
 * Number of local commits not yet pushed to origin/<branch>.
 * -1 when there are no commits at all yet.
 */
export async function countAhead(branch: string): Promise<number> {
  const head = await runGit(['rev-list', '--count', 'HEAD'])
  if (!isSuccess(head) || head.stdout.trim() === '0') return -1
  const remote = await runGit(['rev-list', '--count', `origin/${branch}`])
  if (!isSuccess(remote)) {
    // remote branch does not exist yet: everything local is ahead
    return parseInt(head.stdout.trim(), 10)
  }
  const ahead = await runGit(['rev-list', '--count', `origin/${branch}..HEAD`])
  if (!isSuccess(ahead)) return 0
  return parseInt(ahead.stdout.trim(), 10)
}

/**
 * Pull remote changes and rebase local commits on top.
 * Skips silently when the remote branch does not exist yet (first push).
 * Throws on conflict.
 */
export async function pullRebase(branch: string): Promise<void> {
  if (!(await remoteHasBranch(branch))) {
    log('info', 'remote branch does not exist yet, skipping pull')
    return
  }
  const r = await runGit(['pull', '--rebase', 'origin', branch])
  if (isSuccess(r)) return
  if (hasConflict(r)) {
    await runGit(['rebase', '--abort'])
    throw new Error(
      `CONFLICT: remote and local changes overlap. Rebase was aborted to protect your data. ` +
        `Resolve manually (e.g. git pull --rebase in a terminal) or disable "Pull --rebase".`,
    )
  }
  throw new Error(`git pull --rebase failed: ${r.stderr}`)
}

/** Push the current branch. */
export async function push(branch: string): Promise<void> {
  const r = await runGit(['push', '-u', 'origin', branch])
  if (!isSuccess(r)) {
    throw new Error(`git push failed: ${r.stderr || r.stdout}`)
  }
}

/** Verify connectivity to the remote. Returns a human-readable result. */
export async function testConnection(): Promise<{ ok: boolean; detail: string }> {
  const r = await runGit(['ls-remote', '--heads', 'origin'])
  if (isSuccess(r)) {
    const heads = r.stdout
      .split('\n')
      .filter(Boolean)
      .map((l) => l.split('\t')[1]?.replace('refs/heads/', ''))
      .filter((l): l is string => Boolean(l))
    return {
      ok: true,
      detail: `Connected. Remote branches: ${heads.length ? heads.join(', ') : '(none yet)'}`,
    }
  }
  return { ok: false, detail: r.stderr || r.stdout || 'connection failed' }
}
