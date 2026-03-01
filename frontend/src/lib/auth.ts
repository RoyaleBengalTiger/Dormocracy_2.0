/**
 * Returns the current access token from localStorage.
 *
 * This is intentionally tiny and framework-agnostic so it can be reused
 * by REST and Socket.IO helpers.
 */
export function getAccessToken(): string | null {
  return localStorage.getItem("accessToken");
}
