/** Shape returned by GET /api/me. Checkout and the storefront import this; never redeclare it. */
export interface User {
  id: string;
  email: string;
  name: string;
}
