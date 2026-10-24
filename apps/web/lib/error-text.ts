/** ConvexError carries the user-facing message in `data`. */
export function errorText(err: unknown): string {
  if (err && typeof err === "object" && "data" in err && typeof err.data === "string") return err.data;
  return "Something went wrong. Try again.";
}
