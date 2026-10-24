/**
 * Summary lines that only a failing test or build prints. Kept to runner summaries (vitest, jest, pytest,
 * mocha, tsc) so a grep or cat that merely mentions "failed" does not turn into a failure.
 */
const FAILURE_LINES: RegExp[] = [
  /^\s*(Tests?|Test Files|Test Suites|Suites):?\s+.*\b[1-9]\d* failed\b/m,
  /\(\d+ tests? \| [1-9]\d* failed\)/,
  /^\s*Errors\s+[1-9]\d* errors?\b/m,
  /^\s*FAIL\s+\S/m,
  /^=+ .*\b[1-9]\d* (failed|errors?)\b.* =+$/m,
  /^\s*[1-9]\d* failing\b/m,
  /\berror TS\d+:/,
  /^Found [1-9]\d* errors?\b/m,
  /^npm (ERR!|error) /m,
];

/** Whether a test run's output shows a failure, whatever its exit code. */
export function testOutputFailed(output: string | undefined): boolean {
  return !!output && FAILURE_LINES.some((re) => re.test(output));
}

export type CommandResult = {
  hookFailed: boolean;
  exitCode?: number;
  verb: string;
  output?: string;
};

/**
 * A command failed when the hook says so, it exited non-zero, or it was a test run whose output shows a
 * failure. The last case matters because agents pipe tests through `tail`, and the pipe's exit code is
 * tail's: `npm test | tail -30` exits 0 with every test red.
 */
export function commandFailed(r: CommandResult): boolean {
  if (r.hookFailed || (r.exitCode !== undefined && r.exitCode !== 0)) return true;
  return r.verb === "TEST" && testOutputFailed(r.output);
}
