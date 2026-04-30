// Transforma uma data em um formato mais curto e humano,
// como "agora", "12m", "3h" ou uma data completa.
export function formatTimeAgo(value) {
  if (!value) return "agora";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "agora";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}m`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d`;

  return date.toLocaleDateString("pt-BR");
}

// Gera as iniciais de um email para usar em avatares visuais.
// Exemplo: "joao.silva@eureca.com" vira "JS".
export function emailToInitials(email) {
  const normalized = (email ?? "").trim();
  if (!normalized) return "U";

  const [localPart = ""] = normalized.split("@");
  const chunks = localPart
    .split(/[._\-\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (chunks.length >= 2) {
    return `${chunks[0][0]}${chunks[1][0]}`.toUpperCase();
  }

  return normalized[0].toUpperCase();
}

// Formata numeros grandes para a interface.
// Exemplo: 1200 pode virar "1,2 mil" dependendo do idioma do navegador.
export function formatCount(value) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0";
  return new Intl.NumberFormat("pt-BR", {
    notation: num >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(num);
}

// Encurta um texto longo sem cortar o layout do card ou da sidebar.
export function truncateText(text, max = 110) {
  const normalized = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trimEnd()}...`;
}

function getAuthorBadge(role) {
  const normalizedRole = String(role ?? "").trim();
  const lowerRole = normalizedRole.toLowerCase();

  if (!normalizedRole) {
    return { label: "Membro", tone: "muted" };
  }

  if (
    lowerRole.includes("design") ||
    lowerRole.includes("produto") ||
    lowerRole.includes("product")
  ) {
    return { label: normalizedRole, tone: "purple" };
  }

  if (
    lowerRole.includes("software") ||
    lowerRole.includes("desenvol") ||
    lowerRole.includes("program") ||
    lowerRole.includes("engineering")
  ) {
    return { label: normalizedRole, tone: "accent" };
  }

  if (
    lowerRole.includes("fundador") ||
    lowerRole.includes("founder") ||
    lowerRole.includes("admin")
  ) {
    return { label: normalizedRole, tone: "gold" };
  }

  return { label: normalizedRole, tone: "muted" };
}

function getActivityStatus(createdAt) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "Membro ativo";

  const diffHour = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 3600000),
  );
  if (diffHour < 2) return "Online agora";
  if (diffHour < 24) return "Ativo hoje";
  if (diffHour < 24 * 7) return "Ativo esta semana";
  return "Membro ativo";
}

// Converte o formato cru que vem da API em um formato pronto para a interface.
// Aqui o frontend prepara nome, handle, contadores e estado de curtida.
export function mapApiPost(post) {
  const authorEmail = post?.author?.email ?? "anonimo@eureca";
  const authorId = post?.author?.id ?? "";
  const authorName = post?.author?.name?.trim();
  const authorUsername = post?.author?.username?.trim();
  const authorRole = post?.author?.role?.trim() || "";
  const local = authorEmail.split("@")[0] || "anonimo";
  const label = local
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .map((piece) => piece[0].toUpperCase() + piece.slice(1))
    .join(" ");

  return {
    id: post.id,
    authorId,
    authorEmail,
    authorRole,
    authorBadge: getAuthorBadge(authorRole),
    activityStatus: getActivityStatus(post.createdAt),
    initials: emailToInitials(authorName || authorEmail),
    name: authorName || label || "Anônimo",
    handle: `@${(authorUsername || local).toLowerCase()}`,
    time: formatTimeAgo(post.createdAt),
    text: post.content,
    stats: {
      replies: formatCount(post?.commentsCount ?? 0),
      reposts: formatCount(post?.sharesCount ?? 0),
      likes: formatCount(post?.likesCount ?? 0),
      views: formatCount(post?.viewCount ?? 0),
    },
    counts: {
      replies: Number(post?.commentsCount ?? 0),
      reposts: Number(post?.sharesCount ?? 0),
      likes: Number(post?.likesCount ?? 0),
      views: Number(post?.viewCount ?? 0),
    },
    liked: Boolean(post?.viewerLiked),
    createdAt: post.createdAt,
  };
}

// Converte um comentario da API para o formato usado pelo painel do feed.
export function mapApiComment(comment) {
  const authorEmail = comment?.author?.email ?? "anonimo@eureca";
  const authorId = comment?.author?.id ?? "";
  const authorName = comment?.author?.name?.trim();
  const authorUsername = comment?.author?.username?.trim();
  const authorRole = comment?.author?.role?.trim() || "";
  const local = authorEmail.split("@")[0] || "anonimo";
  const label = local
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .map((piece) => piece[0].toUpperCase() + piece.slice(1))
    .join(" ");

  return {
    id: comment.id,
    postId: comment.postId,
    parentCommentId: comment.parentCommentId ?? null,
    repliesCount: Number(comment?.repliesCount ?? 0),
    authorId,
    authorEmail,
    authorRole,
    authorBadge: getAuthorBadge(authorRole),
    activityStatus: getActivityStatus(comment.createdAt),
    initials: emailToInitials(authorName || authorEmail),
    name: authorName || label || "Anônimo",
    handle: `@${(authorUsername || local).toLowerCase()}`,
    time: formatTimeAgo(comment.createdAt),
    text: comment.content,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}

// Converte uma notificacao da API para o card de alertas.
export function mapApiNotification(notification) {
  const actorEmail = notification?.actor?.email ?? "anonimo@eureca";
  const actorId = notification?.actor?.id ?? "";
  const actorName = notification?.actor?.name?.trim();
  const actorUsername = notification?.actor?.username?.trim();
  const local = actorEmail.split("@")[0] || "anonimo";
  const label = local
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .map((piece) => piece[0].toUpperCase() + piece.slice(1))
    .join(" ");

  return {
    id: notification.id,
    type: notification.type,
    readAt: notification.readAt ?? null,
    createdAt: notification.createdAt,
    time: formatTimeAgo(notification.createdAt),
    postId: notification.postId,
    commentId: notification.commentId,
    actorId,
    actorEmail,
    actorInitials: emailToInitials(actorName || actorEmail),
    actorName: actorName || label || "Anônimo",
    actorHandle: `@${(actorUsername || local).toLowerCase()}`,
    postText: notification?.post?.content ?? "",
    commentText: notification?.comment?.content ?? "",
    parentCommentId: notification?.comment?.parentCommentId ?? null,
  };
}
