import { runHook } from "../hook/run";

const WATCHDOG_MS = 1900;

function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return Promise.resolve("");
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (c: Buffer) => chunks.push(c));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", () => resolve(""));
  });
}

function writeAndExit(text: string): void {
  if (!text) process.exit(0);
  // stdout to a pipe is async on macOS, so exit only once the write has flushed.
  process.stdout.write(text, () => process.exit(0));
}

/** Claude Code hook entry. Exit code is always 0 and stdout is either valid hook JSON or empty. */
export async function hookCommand(event: string): Promise<void> {
  setTimeout(() => process.exit(0), WATCHDOG_MS).unref();
  try {
    const result = await runHook(event, await readStdin(), { background: true });
    if (process.env.LB_DEBUG && result.error) process.stderr.write(`lb hook: ${result.error}\n`);
    writeAndExit(result.output == null ? "" : JSON.stringify(result.output));
  } catch {
    process.exit(0);
  }
}
