// The installer is a static file published at build time; this keeps the shorter URL working.
export function GET(request: Request): Response {
  return Response.redirect(new URL("/install.sh", request.url), 307);
}
