import type { SettingSchemaDesc } from './types'

export type AuthMode = 'https-token' | 'ssh' | 'none'

export interface SyncSettings {
  repoUrl: string
  authMode: AuthMode
  username: string
  token: string
  branch: string
  autoSync: boolean
  syncDelay: number
  pollInterval: number
  pullRebase: boolean
}

const DEFAULTS: SyncSettings = {
  repoUrl: '',
  authMode: 'https-token',
  username: 'oauth2',
  token: '',
  branch: 'master',
  autoSync: true,
  syncDelay: 30,
  pollInterval: 60,
  pullRebase: true,
}

/**
 * Bilingual (English / 中文) settings. Logseq has no plugin i18n API, so each
 * title and description carries both languages.
 */
export const settingsSchema: SettingSchemaDesc[] = [
  {
    key: 'requirements',
    title: 'Prerequisite（使用前提）',
    description:
      'This plugin only PUSHES commits — Logseq builds them. Please ENABLE Logseq built-in "Git auto commit" (Settings > Version control) and set the same remote repository there.（本插件只负责推送提交，提交由 Logseq 生成。请开启 Logseq 内置的 "Git auto commit"（设置 > 版本控制），并关闭其中的自动推送选项如有）',
    type: 'heading',
    default: '',
  },
  {
    key: 'repoUrl',
    title: 'Repository URL（仓库地址）',
    description:
      'Git remote URL, e.g. https://gitea.example.com/user/logseq.git or git@gitea.example.com:user/logseq.git（Git 远程仓库地址，支持 HTTPS 或 SSH 格式）',
    type: 'string',
    default: DEFAULTS.repoUrl,
  },
  {
    key: 'authMode',
    title: 'Authentication mode（认证方式）',
    description:
      'https-token: HTTPS + access token (recommended / 推荐). ssh: use your SSH key（使用你的 SSH 密钥）. none: no auth（无需认证，仅限公开仓库）',
    type: 'enum',
    default: DEFAULTS.authMode,
    enumChoices: ['https-token', 'ssh', 'none'],
  },
  {
    key: 'username',
    title: 'Username（用户名）',
    description:
      "Gitea accepts 'oauth2' as username for token auth. Use your Gitea username if token login fails.（Gitea 令牌认证的用户名填 oauth2 即可；登录失败时请改为你的 Gitea 用户名）",
    type: 'string',
    default: DEFAULTS.username,
  },
  {
    key: 'token',
    title: 'Access token（访问令牌）',
    description:
      'WARNING: stored in plain text in .logseq/settings/. The plugin excludes .logseq/ from git, but protect your machine. Create a token in Gitea: Settings > Applications > Generate New Token.（警告：令牌以明文存储于 .logseq/settings/，插件会将其排除在 git 之外，但仍请保护你的电脑。Gitea 中创建：设置 > 应用 > 生成新令牌）',
    type: 'string',
    default: DEFAULTS.token,
  },
  {
    key: 'branch',
    title: 'Branch（分支）',
    description:
      'Branch used when initializing a brand-new repository. Existing branches are kept as-is.（仅用于初始化全新仓库，已有分支保持不变）',
    type: 'string',
    default: DEFAULTS.branch,
  },
  {
    key: 'autoSync',
    title: 'Auto sync（自动同步）',
    description:
      'Automatically commit and push when changes are detected.（检测到变更后自动提交并推送）',
    type: 'boolean',
    default: DEFAULTS.autoSync,
  },
  {
    key: 'syncDelay',
    title: 'Sync delay in seconds（同步延迟，秒）',
    description:
      'Wait this long after the last change before committing and pushing.（最后一次变更后等待多久再提交推送）',
    type: 'number',
    default: DEFAULTS.syncDelay,
  },
  {
    key: 'pollInterval',
    title: 'Fallback poll interval in seconds（兜底轮询间隔，秒）',
    description:
      'Fallback check for changes even if no edit event was received.（即使未收到编辑事件，也定期检查变更）',
    type: 'number',
    default: DEFAULTS.pollInterval,
  },
  {
    key: 'pullRebase',
    title: 'Pull --rebase before push（推送前自动拉取变基）',
    description:
      'Pull remote changes and rebase local commits on top before pushing. Required for multi-device use. Conflicts are aborted and reported, never auto-merged.（推送前先拉取远程变更并将本地提交变基到其上，多设备使用必需。冲突时自动中止并报告，绝不自动合并）',
    type: 'boolean',
    default: DEFAULTS.pullRebase,
  },
]

export function getSettings(): SyncSettings {
  const s = (logseq.settings ?? {}) as Record<string, unknown>
  const out = { ...DEFAULTS } as SyncSettings
  for (const key of Object.keys(DEFAULTS) as Array<keyof SyncSettings>) {
    const v = s[key]
    if (v !== undefined && v !== null && v !== '') {
      ;(out as unknown as Record<string, unknown>)[key] = v
    }
  }
  return out
}

export function isConfigured(s: SyncSettings): boolean {
  return s.repoUrl.trim().length > 0
}

export function hasCredentials(s: SyncSettings): boolean {
  if (s.authMode === 'https-token') {
    return s.token.trim().length > 0
  }
  // ssh and none rely on the environment / repository config
  return true
}
