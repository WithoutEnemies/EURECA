import { apiRequest, authHeaders } from "../config/api";

export function fetchConversationsApi(token) {
  return apiRequest("/conversations", {
    headers: authHeaders(token),
    fallbackData: [],
  });
}

export function createConversationApi(token, participantId) {
  return apiRequest("/conversations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ participantId }),
  });
}

export function fetchConversationMessagesApi(token, conversationId, options = {}) {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  if (options.cursor) params.set("cursor", options.cursor);
  const query = params.toString();

  return apiRequest(
    `/conversations/${conversationId}/messages${query ? `?${query}` : ""}`,
    {
      headers: authHeaders(token),
      fallbackData: { items: [], hasMore: false, nextCursor: null },
    },
  );
}

export function sendConversationMessageApi(token, conversationId, content) {
  return apiRequest(`/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ content }),
  });
}

export function markConversationReadApi(token, conversationId) {
  return apiRequest(`/conversations/${conversationId}/read`, {
    method: "PATCH",
    headers: authHeaders(token),
  });
}
