import { runHook } from "../hook/run";
import { type PhaseTimer, startTimer, type TimedOutcome, writeTiming } from "../hook/timing";

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

function writeAndExit(text: string, beforeExit: () => void): void {
  if (!text) {
    beforeExit();
    process.exit(0);
  }
  // stdout to a pipe is async on macOS, so exit only once the write has flushed.
  process.stdout.write(text, () => {
    beforeExit();
    process.exit(0);
  });
}

/** Claude Code hook entry. Exit code is always 0 and stdout is either valid hook JSON or empty. */
export async function hookCommand(event: string): Promise<void> {
  const timingFile = process.env.LB_TIMING_FILE;
  const timer: PhaseTimer | undefined = timingFile ? startTimer() : undefined;
  let raw = "";
  const record = (o: Omit<TimedOutcome, "raw">): void => {
    if (timingFile && timer) writeTiming(timingFile, event, timer, { raw, ...o });
  };
  setTimeout(() => {
    record({ output: null, delivered: false, timedOut: true });
    process.exit(0);
  }, WATCHDOG_MS).unref();
  try {
    raw = await readStdin();
    timer?.mark("stdin");
    const result = await runHook(event, raw, { background: true, timer });
    if (process.env.LB_DEBUG && result.error) process.stderr.write(`lb hook: ${result.error}\n`);
    writeAndExit(result.output == null ? "" : JSON.stringify(result.output), () => {
      timer?.mark("stdout");
      record({ ...result, timedOut: false });
    });
  } catch (e) {
    record({ output: null, delivered: false, timedOut: false, error: String(e) });
    process.exit(0);
  }
}
