import { App, FileSystemAdapter } from "obsidian";

export function getVaultRootPath(app: App): string | null {
  const adapter = app.vault.adapter;
  if (adapter instanceof FileSystemAdapter) {
    return adapter.getBasePath();
  }
  return null;
}
