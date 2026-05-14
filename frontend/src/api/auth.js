import { apiRequest } from "../config/api";

export function authenticate(endpoint, payload) {
  return apiRequest(`/auth/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
