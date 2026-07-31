# Gitea Sync（Logseq 插件）

**[English](README.en.md) | 简体中文**

自动将你的 Logseq 图谱通过 git **提交并推送到 Gitea**（或任意 Git 远程仓库）。

## 截图 Screenshots

![工具栏状态图标 Toolbar status icon](docs/screenshots/screenshot-toolbar.png)

![设置面板 Settings panel](docs/screenshots/screenshot-settings.png)

- ✅ 纯插件实现 —— 无需外部脚本或服务，直接使用 Logseq 内置的 git 代理（`logseq.Git.execCommand`）
- 🔐 双认证模式：**HTTPS + 访问令牌**（推荐）和 **SSH**
- 🔁 多设备友好：每次推送前可选自动 `pull --rebase`
- ⚙️ 全部功能可在插件设置面板中配置
- 🔒 保护你的令牌：自动确保 `.logseq/` 被 git 排除

## 工作原理

1. 通过 Logseq 编辑事件 + 定时轮询 `git status` 检测变更
2. 变更停止后等待可配置的延迟（默认 30 秒），执行 `git add -A && git commit`
3. 可选：先拉取远程变更并 rebase 本地提交（默认开启）
4. 推送到你配置的远程仓库
5. 推送失败自动重试（20 秒 / 40 秒 / 80 秒指数退避），并在工具栏图标上显示状态

## 安装（开发模式 / 手动）

1. 克隆或下载本仓库
2. `npm install && npm run build`
3. Logseq 中开启：**Settings → Advanced → Developer mode**，重启 Logseq
4. **Plugins → Load unpacked plugin**，选择 `dist/` 目录
5. 配置插件：**Settings → Plugins → Gitea Sync**

## 配置项

| 设置项 | 默认值 | 说明 |
| --- | --- | --- |
| Repository URL（仓库地址） | — | 如 `https://gitea.example.com/user/logseq.git` 或 `git@gitea.example.com:user/logseq.git` |
| Authentication mode（认证方式） | `https-token` | `https-token`（HTTPS+令牌）/ `ssh` / `none`（无需认证） |
| Username（用户名） | `oauth2` | Gitea 令牌认证的用户名填 `oauth2` 即可；若登录失败请填你的 Gitea 用户名 |
| Access token（访问令牌） | — | Gitea 中生成：**Settings → Applications → Generate New Token**（需要 `repo` 权限） |
| Branch（分支） | `master` | 仅用于初始化全新仓库；已有分支保持不变 |
| Auto sync（自动同步） | 开 | 自动提交 + 推送 |
| Sync delay（同步延迟） | 30 秒 | 最后一次变更后等待多久再提交推送 |
| Fallback poll（兜底轮询） | 60 秒 | 定期执行 `git status` 检查变更 |
| Pull --rebase | 开 | 推送前先拉取（多设备必需） |
| Commit message（提交信息） | `chore(logseq): auto sync` | 自动提交使用的信息模板 |

工具栏按钮：点击立即同步。命令面板：`Gitea Sync: ...` 可执行立即同步、查看状态、测试连接、查看日志、打开设置。

## Gitea 创建访问令牌

1. 打开 Gitea → 头像 → **Settings → Applications**
2. 在 **Manage Access Tokens** 下点击 **Generate New Token**
3. 命名如 `logseq-sync`，勾选 `repo` 权限，生成
4. 将令牌粘贴到插件的 **Access token** 字段

## 认证说明

- **HTTPS + 令牌**：插件会把远程地址配置为 `https://oauth2:<令牌>@host/...`。令牌以明文存放在 `.logseq/settings/logseq-gitea-sync.json` 和 `.git/config` 中——两者都被 git 排除（见安全说明）
- **SSH**：插件直接走 SSH 推送，你需要自行配置好密钥
  - *无密码*的密钥开箱即用（macOS：`~/.ssh/id_ed25519`）
  - *有密码*的密钥需要 ssh-agent；macOS 上 GUI 应用需额外加载（如配置 LaunchAgent 或使用钥匙串），否则 `push` 会报认证失败
- **none**：仅适用于允许匿名推送的仓库（少见）

## 安全说明

- 访问令牌以**明文**存储在图谱的 `.logseq/settings/` 目录中，切勿分享该目录
- 首次同步时插件会自动把 `.logseq/`、`.recycle/`、`.DS_Store` 加入 `.gitignore`，确保 Logseq 内部文件（以及你的令牌）不会进入仓库
- 含令牌的推送地址会明文显示在 `.git/config` 中。建议使用仅含 `repo` 权限的专用令牌；如机器失窃请立即吊销
- 本插件**不加密**你的笔记，远程仓库请设置为私有

## 在新设备上使用（初始化）

插件负责日常的提交与推送，但**无法把远程仓库的数据还原成 Logseq 笔记**——Logseq 内置 git 使用独立的镜像仓库，插件拉取的文件不会自动出现在笔记目录中。因此新设备首次使用需要手动初始化一次：

1. 安装 Git（Windows: https://git-scm.com/download/win）
2. 克隆你的仓库（把地址中的 `你的令牌` 替换为你的访问令牌）：
   ```
   git clone https://oauth2:你的令牌@git.example.com/用户名/logseq.git D:\LogseqData\logseq
   ```
   （Mac / Linux 换成你喜欢的路径即可）
3. 在 Logseq 中 **Add new graph**，选择克隆出来的文件夹
4. 配置插件（仓库地址 + 令牌），并开启 Logseq 内置 **Git auto commit**

初始化完成后，插件即可正常进行双向同步。

## 冲突处理（多设备）

开启 `Pull --rebase` 后，插件在推送前执行 `git pull --rebase origin <分支>`。若远程与本地修改重叠，rebase 会被**自动中止**以保护数据，并显示错误提示。请手动解决冲突，例如：

```
cd <图谱git目录>
git pull --rebase
# 解决冲突后：
git rebase --continue
```

> **重要**：Logseq 内置的 **Git auto commit**（Settings → Version control）与本插件操作同一个 git 仓库，会互相抢锁。使用本插件时请**关闭内置自动提交**。

## 开发

```
npm install
npm run dev       # vite 开发服务器（可选）
npm run build     # 构建 dist/
npm run typecheck # 类型检查
```

插件仅依赖 `@logseq/libs`。本地类型定义镜像自 SDK 的 `LSPlugin.d.ts`（发布包未暴露 TS 类型入口）。

## 许可证

MIT
