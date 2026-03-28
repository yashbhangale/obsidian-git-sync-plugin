import { App, Notice, Plugin } from "obsidian";
import { commitAndPush, isGitRepository } from "./git";
import {
  DEFAULT_SETTINGS,
  VaultGitSyncSettingTab,
  type VaultGitSyncSettings,
} from "./settings";
import { getVaultRootPath } from "./vault-path";

function openVaultGitSettings(app: App, pluginId: string): void {
  const setting = (
    app as unknown as {
      setting?: { open: () => void; openTabById?: (id: string) => void };
    }
  ).setting;
  setting?.open();
  setting?.openTabById?.(pluginId);
}

async function runCommitAndPush(plugin: VaultGitSyncPlugin): Promise<void> {
  if (plugin.isPushing) return;

  const vaultPath = getVaultRootPath(plugin.app);
  if (!vaultPath) {
    new Notice("This vault is not on local disk — Git only works for local vaults.");
    return;
  }

  if (!(await isGitRepository(vaultPath))) {
    new Notice(
      "Git is not set up yet. Use Settings → Vault Git Sync, or the command \"Open Git setup (settings)\".",
      14000,
    );
    return;
  }

  plugin.isPushing = true;
  const s = plugin.settings;
  const result = await commitAndPush({
    cwd: vaultPath,
    remote: s.remote,
    commitMessage: s.commitMessage,
  });
  plugin.isPushing = false;

  if (result.ok) {
    new Notice("Done — your vault was committed and pushed to Git.", 6000);
    return;
  }

  const err = result.error ?? "Git command failed.";
  new Notice(`Push failed: ${err}`, 16000);
}

class VaultGitSyncPlugin extends Plugin {
  settings: VaultGitSyncSettings = { ...DEFAULT_SETTINGS };
  isPushing = false;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new VaultGitSyncSettingTab(this.app, this));

    this.addRibbonIcon("upload-cloud", "Commit & push to Git", () => {
      void runCommitAndPush(this);
    });

    this.addCommand({
      id: "commit-and-push",
      name: "Commit & push to Git",
      callback: () => {
        void runCommitAndPush(this);
      },
    });

    this.addCommand({
      id: "open-git-setup",
      name: "Open Git setup (settings)",
      callback: () => {
        openVaultGitSettings(this.app, this.manifest.id);
      },
    });
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}

export default VaultGitSyncPlugin;
