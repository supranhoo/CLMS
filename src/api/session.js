import api from "./axios";

/**
 * Ask the local API to revoke the current session token. Best effort: the browser session is cleared by the caller
 * either way, and a token the server no longer knows is already unusable. The token is read up front because the
 * stored user is removed straight after this call.
 */
export function revokeServerSession() {
  let token;
  try {
    token = JSON.parse(localStorage.getItem("user") || "null")?.token;
  } catch {
    token = undefined;
  }
  if (!token) return Promise.resolve();
  return api.post("/api/users/logout", {}, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
}
