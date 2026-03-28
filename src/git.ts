import { spawn } from "child_process";

export interface GitStepResult {
  readonly step: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
}

export interface RunGitSequenceOptions {
  readonly cwd: string;
  readonly onStepStart?: (step: string) => void;
  readonly onStepComplete?: (result: GitStepResult) => void;
}

function runGit(
  cwd: string,
  args: string[],
): Promise<GitStepResult> {
  return new Promise((resolve) => {
    const child = spawn("git", args, {
      cwd,
      shell: false,
      env: { ...process.env },
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      resolve({
        step: `git ${args.join(" ")}`,
        stdout: stdout.trimEnd(),
        stderr: stderr.trimEnd(),
        exitCode: code,
      });
    });
    child.on("error", (err: NodeJS.ErrnoException) => {
      resolve({
        step: `git ${args.join(" ")}`,
        stdout,
        stderr: stderr || err.message,
        exitCode: -1,
      });
    });
  });
}

export async function isGitRepository(cwd: string): Promise<boolean> {
  const result = await runGit(cwd, ["rev-parse", "--is-inside-work-tree"]);
  return result.exitCode === 0 && result.stdout.trim() === "true";
}

function formatError(result: GitStepResult): string {
  return [result.stderr, result.stdout].filter(Boolean).join("\n").trim() ||
    `Git exited with code ${result.exitCode}`;
}

export async function gitInit(cwd: string): Promise<{ ok: boolean; error?: string }> {
  const result = await runGit(cwd, ["init"]);
  if (result.exitCode === 0) return { ok: true };
  return { ok: false, error: formatError(result) };
}

export async function getRemoteUrl(
  cwd: string,
  remoteName: string,
): Promise<string | null> {
  const result = await runGit(cwd, ["remote", "get-url", remoteName]);
  if (result.exitCode !== 0) return null;
  const url = result.stdout.trim();
  return url || null;
}

export async function listRemoteNames(cwd: string): Promise<string[]> {
  const result = await runGit(cwd, ["remote"]);
  if (result.exitCode !== 0) return [];
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function addOrSetRemote(
  cwd: string,
  remoteName: string,
  url: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = url.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a repository URL (HTTPS or SSH)." };
  }

  const addResult = await runGit(cwd, ["remote", "add", remoteName, trimmed]);
  if (addResult.exitCode === 0) return { ok: true };

  const errText = addResult.stderr + addResult.stdout;
  if (/already exists/i.test(errText)) {
    const setResult = await runGit(cwd, ["remote", "set-url", remoteName, trimmed]);
    if (setResult.exitCode === 0) return { ok: true };
    return { ok: false, error: formatError(setResult) };
  }

  return { ok: false, error: formatError(addResult) };
}

export async function getLocalGitIdentity(cwd: string): Promise<{
  name: string | null;
  email: string | null;
}> {
  const nameResult = await runGit(cwd, ["config", "--local", "user.name"]);
  const emailResult = await runGit(cwd, ["config", "--local", "user.email"]);
  return {
    name:
      nameResult.exitCode === 0 ? nameResult.stdout.trim() || null : null,
    email:
      emailResult.exitCode === 0 ? emailResult.stdout.trim() || null : null,
  };
}

export async function setLocalGitIdentity(
  cwd: string,
  name: string,
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const n = name.trim();
  const e = email.trim();
  if (!n || !e) {
    return { ok: false, error: "Enter both your name and email." };
  }
  const nameRes = await runGit(cwd, ["config", "--local", "user.name", n]);
  if (nameRes.exitCode !== 0) return { ok: false, error: formatError(nameRes) };
  const emailRes = await runGit(cwd, ["config", "--local", "user.email", e]);
  if (emailRes.exitCode !== 0) return { ok: false, error: formatError(emailRes) };
  return { ok: true };
}

export interface CommitAndPushParams {
  readonly cwd: string;
  readonly remote: string;
  readonly commitMessage: string;
  readonly onStepStart?: (step: string) => void;
  readonly onStepComplete?: (result: GitStepResult) => void;
}

export async function commitAndPush(
  params: CommitAndPushParams,
): Promise<{ ok: boolean; error?: string; lastResult?: GitStepResult }> {
  const { cwd, remote, commitMessage, onStepStart, onStepComplete } = params;

  // Push HEAD so it works whether the branch is main, master, or anything else.
  const steps: Array<{ label: string; args: string[] }> = [
    { label: "Stage all changes", args: ["add", "."] },
    { label: "Create commit", args: ["commit", "-m", commitMessage] },
    { label: "Push current branch", args: ["push", "-u", remote, "HEAD"] },
  ];

  for (const { label, args } of steps) {
    onStepStart?.(label);
    const result = await runGit(cwd, args);
    onStepComplete?.({ ...result, step: label });

    const isCommitStep = args[0] === "commit";
    const nothingToCommit =
      isCommitStep &&
      result.exitCode !== 0 &&
      /nothing to commit/i.test(result.stdout + result.stderr);

    if (result.exitCode !== 0 && !nothingToCommit) {
      const detail = [result.stderr, result.stdout]
        .filter(Boolean)
        .join("\n")
        .trim();
      return {
        ok: false,
        error: detail || `Git exited with code ${result.exitCode}`,
        lastResult: { ...result, step: label },
      };
    }
  }

  return { ok: true };
}
