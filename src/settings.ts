import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import {
  addOrSetRemote,
  getLocalGitIdentity,
  getRemoteUrl,
  gitInit,
  isGitRepository,
  listRemoteNames,
  setLocalGitIdentity,
} from "./git";
import type VaultGitSyncPlugin from "./main";
import { getVaultRootPath } from "./vault-path";

export interface VaultGitSyncSettings {
  remote: string;
  commitMessage: string;
}

export const DEFAULT_SETTINGS: VaultGitSyncSettings = {
  remote: "origin",
  commitMessage: "auto commit",
};

export class VaultGitSyncSettingTab extends PluginSettingTab {
  private readonly plugin: VaultGitSyncPlugin;

  constructor(app: App, plugin: VaultGitSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("p", { text: "Loading…", cls: "setting-item-description" });
    void this.renderPanel(containerEl);
  }

  private async renderPanel(containerEl: HTMLElement): Promise<void> {
    const path = getVaultRootPath(this.app);
    const isRepo = path ? await isGitRepository(path) : false;
    const remoteName = this.plugin.settings.remote;
    const remoteInitial =
      path && isRepo ? (await getRemoteUrl(path, remoteName)) ?? "" : "";
    const identity =
      path && isRepo ? await getLocalGitIdentity(path) : { name: null, email: null };
    const remotes = path && isRepo ? await listRemoteNames(path) : [];

    containerEl.empty();
    containerEl.addClass("vault-git-sync-settings");

    containerEl.createEl("h2", { text: "Vault Git Sync" });
    containerEl.createEl("p", {
      text: "Set up Git for this vault without using the terminal. When the checklist below looks good, use the ribbon or command palette to commit and push.",
      cls: "setting-item-description vault-git-sync-settings__intro",
    });

    this.renderStatusCardSync(
      containerEl,
      path,
      isRepo,
      remoteName,
      remoteInitial,
      identity,
      remotes,
    );

    containerEl.createEl("h3", {
      cls: "vault-git-sync-settings__heading",
      text: "Step 1 — Turn this folder into a Git repo",
    });
    containerEl.createEl("p", {
      text: "Only needed once per vault. Safe if this folder is not yet using Git.",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("Initialize Git here")
      .setDesc("Runs git init in your vault folder.")
      .addButton((btn) =>
        btn
          .setButtonText("Initialize Git in this vault")
          .setCta()
          .onClick(async () => {
            const p = getVaultRootPath(this.app);
            if (!p) {
              new Notice("This vault is not stored on disk.");
              return;
            }
            if (await isGitRepository(p)) {
              new Notice("This vault is already a Git repository.");
              this.display();
              return;
            }
            btn.setDisabled(true);
            const result = await gitInit(p);
            btn.setDisabled(false);
            if (result.ok) {
              new Notice("Git initialized. Add your name and remote below.");
              this.display();
            } else {
              new Notice(result.error ?? "git init failed", 10000);
            }
          }),
      );

    containerEl.createEl("h3", {
      cls: "vault-git-sync-settings__heading",
      text: "Step 2 — Who is making commits?",
    });
    containerEl.createEl("p", {
      text: "Git needs a name and email. This saves them only inside this vault (not your whole computer).",
      cls: "setting-item-description",
    });

    if (!path || !isRepo) {
      containerEl.createEl("p", {
        text: "Complete Step 1 first, then set your name and email here.",
        cls: "setting-item-description",
      });
    } else {
      const nameInput = containerEl.createEl("input", {
        type: "text",
        cls: "vault-git-sync-settings__input",
        attr: { placeholder: "Your name" },
        value: identity.name ?? "",
      });
      const emailInput = containerEl.createEl("input", {
        type: "email",
        cls: "vault-git-sync-settings__input",
        attr: { placeholder: "you@example.com" },
        value: identity.email ?? "",
      });
      const authorActions = containerEl.createDiv({
        cls: "vault-git-sync-settings__author-actions",
      });
      authorActions
        .createEl("button", { text: "Save for this vault", cls: "mod-cta" })
        .addEventListener("click", async () => {
          const result = await setLocalGitIdentity(path, nameInput.value, emailInput.value);
          if (result.ok) {
            new Notice("Saved name and email for this vault.");
            this.display();
          } else {
            new Notice(result.error ?? "Could not save", 8000);
          }
        });
    }

    containerEl.createEl("h3", {
      cls: "vault-git-sync-settings__heading",
      text: "Step 3 — Connect to GitHub / GitLab / etc.",
    });
    containerEl.createEl("p", {
      text: "Paste the HTTPS URL from your empty repository page (for example https://github.com/you/vault.git). If this remote name already exists, the URL is updated.",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("Remote short name")
      .setDesc("Usually origin — leave as is unless you use multiple remotes.")
      .addText((text) =>
        text
          .setPlaceholder("origin")
          .setValue(this.plugin.settings.remote)
          .onChange(async (value) => {
            this.plugin.settings.remote = value.trim() || "origin";
            await this.plugin.saveSettings();
          }),
      );

    let remoteUrlInput: HTMLInputElement | undefined;
    new Setting(containerEl)
      .setName("Repository URL")
      .setDesc("HTTPS or SSH clone URL.")
      .addText((text) => {
        text.inputEl.addClass("vault-git-sync-settings__url-input");
        text.setPlaceholder("https://github.com/username/repo.git");
        text.setValue(remoteInitial);
        remoteUrlInput = text.inputEl;
      })
      .addButton((btn) =>
        btn
          .setButtonText("Add or update remote")
          .setCta()
          .onClick(async () => {
            const p = getVaultRootPath(this.app);
            if (!p) {
              new Notice("Vault path unavailable.");
              return;
            }
            if (!(await isGitRepository(p))) {
              new Notice("Initialize Git (Step 1) first.");
              return;
            }
            const url = remoteUrlInput?.value ?? "";
            btn.setDisabled(true);
            const result = await addOrSetRemote(p, this.plugin.settings.remote, url);
            btn.setDisabled(false);
            if (result.ok) {
              new Notice("Remote saved. You can use Commit & push when ready.");
              this.display();
            } else {
              new Notice(result.error ?? "Could not set remote", 10000);
            }
          }),
      );

    containerEl.createEl("h3", {
      cls: "vault-git-sync-settings__heading",
      text: "When you sync",
    });

    new Setting(containerEl)
      .setName("Commit message")
      .setDesc("Used for each automatic commit from Commit & push.")
      .addText((text) =>
        text
          .setPlaceholder("auto commit")
          .setValue(this.plugin.settings.commitMessage)
          .onChange(async (value) => {
            this.plugin.settings.commitMessage = value.trim() || "auto commit";
            await this.plugin.saveSettings();
          }),
      );

    const refreshFooter = containerEl.createDiv({
      cls: "vault-git-sync-settings__footer",
    });
    refreshFooter.createSpan({ text: "Status not updating? " });
    refreshFooter
      .createEl("a", {
        text: "Reload this panel",
        href: "#",
      })
      .addEventListener("click", (e) => {
        e.preventDefault();
        this.display();
      });
  }

  private renderStatusCardSync(
    containerEl: HTMLElement,
    path: string | null,
    isRepo: boolean,
    remoteName: string,
    remoteUrl: string,
    identity: { name: string | null; email: string | null },
    remotes: string[],
  ): void {
    const card = containerEl.createDiv({ cls: "vault-git-sync-settings__card" });

    if (!path) {
      card.createEl("p", {
        text: "This vault is not on local disk — Git setup is not available.",
        cls: "vault-git-sync-settings__warn",
      });
      return;
    }

    card.createEl("div", {
      text: "Vault folder",
      cls: "vault-git-sync-settings__card-label",
    });
    card.createEl("div", {
      text: path,
      cls: "vault-git-sync-settings__card-path",
    });

    const list = card.createDiv({ cls: "vault-git-sync-settings__checklist" });

    const row = (ok: boolean, label: string, detail?: string): void => {
      const line = list.createDiv({ cls: "vault-git-sync-settings__check-row" });
      const icon = line.createSpan({ cls: "vault-git-sync-settings__check-icon" });
      icon.textContent = ok ? "✓" : "○";
      line.addClass(ok ? "is-ok" : "is-pending");
      const text = line.createDiv({ cls: "vault-git-sync-settings__check-text" });
      text.createSpan({ text: label });
      if (detail) {
        text.createEl("div", {
          text: detail,
          cls: "vault-git-sync-settings__check-detail",
        });
      }
    };

    row(isRepo, "Git repository", isRepo ? "This folder is a Git repo" : "Use Step 1 to initialize");
    row(
      Boolean(identity.name && identity.email),
      "Author name & email",
      identity.name && identity.email
        ? `${identity.name} <${identity.email}>`
        : "Fill Step 2 so commits work",
    );
    row(
      Boolean(remoteUrl),
      `Remote "${remoteName}"`,
      remoteUrl || (remotes.length ? `Remotes: ${remotes.join(", ")}` : "Add URL in Step 3"),
    );
  }
}
