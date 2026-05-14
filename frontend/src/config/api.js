// Endereco base da API.
// Em producao, isso pode vir da variavel VITE_API_URL; localmente cai no backend da porta 3000.
export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  const fallback = options.fallbackData ?? {};
  const data = await res.json().catch(() => fallback);

  return {
    ok: res.ok,
    status: res.status,
    data,
  };
}

export function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}
