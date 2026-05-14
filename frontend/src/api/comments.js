import { apiRequest, authHeaders } from "../config/api";

export function fetchPostComments(postId, params) {
  const query = params ? `?${params.toString()}` : "";
  return apiRequest(`/posts/${postId}/comments${query}`);
}

export function createPostComment(postId, token, payload) {
  return apiRequest(`/posts/${postId}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(payload),
  });
}

export function deleteComment(commentId, token) {
  return apiRequest(`/comments/${commentId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}
