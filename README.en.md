# Gitea Sync (Logseq Plugin)

**[简体中文](README.md) | English**

Automatically commit and push your Logseq graph to **Gitea** or any Git remote.

## Screenshots

![Toolbar status icon](docs/screenshots/screenshot-toolbar.png)

![Settings panel](docs/screenshots/screenshot-settings.png)

- ✅ Pure plugin — no external scripts or services. Uses Logseq's built-in git proxy (`logseq.Git.execCommand`).
- 🔐 Two authentication modes: **HTTPS + access token** (recommended) and **SSH**.
- 🔁 Multi-device friendly: optional `pull --rebase` before every push.
- ⚙️ Fully configurable from the plugin settings panel.
- 🔒 Protects your token: ensures `.logseq/` is excluded from git.

## How it works

1. Detects changes via Logseq edit events plus a fallback poll of `git status`.
2. After a configurable delay (default 30s), stages and commits everything (`git add -A && git commit`).
3. Optionally pulls remote changes and rebases local commits on top (default on).
4. Pushes to your configured remote.
5. Failed pushes are retried with backoff (20s / 40s / 80s) and surfaced in the toolbar icon.

## Installation (development / manual)

1. Clone or download this repo.
2. `npm install && npm run build`
3. In Logseq: enable **Settings → Advanced → Developer mode**, restart Logseq.
4. **Plugins → Load unpacked plugin**, select the `dist/` folder.
5. Configure the plugin: **Settings → Plugins → Gitea Sync**.

## Configuration

| Setting | Default | Description |
| --- | --- | --- |
| Repository URL | — | `https://gitea.example.com/user/logseq.git` or `git@gitea.example.com:user/logseq.git` |
| Authentication mode | `https-token` | `https-token` / `ssh` / `none` |
| Username | `oauth2` | Gitea accepts `oauth2` as username for token auth; use your username if login fails |
| Access token | — | Gitea: **Settings → Applications → Generate New Token** (needs `repo` scope) |
| Branch | `master` | Only used when initializing a brand-new repo; existing branches are kept |
| Auto sync | on | Automatically commit + push |
| Sync delay | 30s | Debounce after the last change |
| Fallback poll | 60s | Periodic `git status` check |
| Pull --rebase | on | Pull before push (required for multi-device) |
| Commit message | `chore(logseq): auto sync` | Message template for commits |

Toolbar button: click to sync immediately. Command palette: `Gitea Sync: ...` for sync now, status, connection test, logs and settings.

## Gitea: creating an access token

1. Open Gitea → your avatar → **Settings → Applications**.
2. Under **Manage Access Tokens**, click **Generate New Token**.
3. Name it `logseq-sync`, grant the `repo` scope, generate.
4. Paste the token into the plugin's **Access token** field.

## Authentication notes

- **HTTPS + token**: the plugin configures the remote URL as `https://oauth2:<token>@host/...`. The token lives in `.logseq/settings/logseq-gitea-sync.json` (plain text) and in `.git/config` — both are excluded from the repo (see security notes).
- **SSH**: the plugin just pushes over SSH; you must set up your own key.
  - A key *without* a passphrase works out of the box (macOS: `~/.ssh/id_ed25519`).
  - A passphrase-protected key needs an ssh-agent, and on macOS the GUI app must load it (e.g. a LaunchAgent, or use the keychain). Otherwise `push` will fail with an authentication error.
- **none**: only for repos that allow anonymous pushes (rare).

## Security notes

- The access token is **stored in plain text** in the graph's `.logseq/settings/` directory. Never share that directory.
- On first sync the plugin adds `.logseq/`, `.recycle/` and `.DS_Store` to `.gitignore` so Logseq internals — and your token — never enter the repository.
- Push URLs containing the token are visible in `.git/config`. Consider using a dedicated token with only `repo` scope, and revoke it if the machine is compromised.
- This plugin **does not encrypt** your notes. The remote repository should be private.

## First-time setup on a new device

The plugin handles daily commits and pushes, but it **cannot restore remote data into Logseq notes** — Logseq's built-in git uses a separate mirror repository, and files pulled by the plugin will not show up in your notes directory. So a new device needs a one-time manual initialization:

1. Install Git (Windows: https://git-scm.com/download/win).
2. Clone your repository (replace `your-token` with your access token):
   ```
   git clone https://oauth2:your-token@git.example.com/user/logseq.git D:\LogseqData\logseq
   ```
   (Use any path you like on macOS/Linux.)
3. In Logseq, **Add new graph** and select the cloned folder.
4. Configure the plugin (repository URL + token) and enable Logseq's built-in **Git auto commit**.

After initialization, the plugin handles bidirectional sync as usual.

## Conflict handling (multi-device)

When `Pull --rebase` is enabled, the plugin runs `git pull --rebase origin <branch>` before pushing. If remote and local changes overlap, the rebase is **aborted automatically** to protect your data, and an error is shown. Resolve the conflict manually, e.g.:

```
cd <your-graph>/../<git-dir>
git pull --rebase
# resolve conflicts, then:
git rebase --continue
```

> **Important**: Logseq's built-in **Git auto commit** (Settings → Version control) and this plugin both write to the same git repo and can lock each other. If you use this plugin, **disable the built-in auto commit**.

## Development

```
npm install
npm run dev     # vite dev server (optional)
npm run build   # build dist/
npm run typecheck
```

The plugin uses only `@logseq/libs`. Local type definitions mirror the SDK's `LSPlugin.d.ts` (the published package does not expose types).

## License

MIT
