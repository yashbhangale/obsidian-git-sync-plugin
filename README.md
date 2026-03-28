# Vault Git Sync

An [Obsidian](https://obsidian.md/) plugin that syncs your vault to Git: **one click** on the ribbon runs `git add`, `git commit`, and `git push`. It also includes a **settings panel** to initialize a repo, set your commit identity, and add a remote—without using the terminal.

**Desktop only.** The plugin runs Git through your system (Obsidian desktop app). It does not run on mobile Obsidian.

## Features

- **Commit & push in one action** — Click the cloud icon in the left ribbon (or use the command palette). No pop-up window; results show as Obsidian notifications.
- **Guided Git setup** — Under **Settings → Vault Git Sync**, you can:
  - Initialize Git in the vault folder (`git init`)
  - Set your name and email for commits (stored in this vault only)
  - Add or update a remote URL (HTTPS or SSH)
- **Sensible defaults** — Pushes the **current branch** (`git push -u <remote> HEAD`) so it works whether your default branch is `main`, `master`, or something else.
- **Commands** — `Commit & push to Git` and `Open Git setup (settings)` from the command palette.

## Requirements

- Obsidian **desktop** on a **local** vault (not restricted remote-only vaults).
- [Git](https://git-scm.com/) installed and available on your system `PATH`.
- For the first push to GitHub/GitLab/etc., your usual authentication (HTTPS token, SSH key, or credential helper) must already work from a terminal for that remote.

## Installation

### From GitHub (manual)

1. Clone or download this repository.
2. In the project folder, run:
   ```bash
   npm install
   npm run build
   ```
3. Copy the plugin folder into your vault:
   ```
   <YourVault>/.obsidian/plugins/vault-git-sync/
   ```
   Include at least: `main.js`, `manifest.json`, and `styles.css`.
4. Restart Obsidian or reload plugins, then enable **Vault Git Sync** under **Settings → Community plugins**.

> Note: The folder name should match the plugin id (`vault-git-sync` as in `manifest.json`), or rename consistently with how you reference the plugin.

### Development

```bash
npm install
npm run dev    # watch mode — rebuilds main.js on change
npm run build  # production bundle
```

## First-time use

1. Open **Settings → Vault Git Sync** and follow the steps: initialize Git if needed, set author name/email, paste your repository URL and connect the remote.
2. Use the ribbon button or **Commit & push to Git** whenever you want to save and upload your vault.

Commit messages and remote name (usually `origin`) are configurable in the same settings panel.

## License

MIT
