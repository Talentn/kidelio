/** Super-ops dashboard — must match SUPER_OPS_EMAIL on the Rails API. */
export const SUPER_OPS_EMAIL = "alaghabi98@gmail.com";

export function isSuperOps(email?: string | null): boolean {
  return email?.trim().toLowerCase() === SUPER_OPS_EMAIL;
}
