import { REGISTER_MAX_INTERESTS } from "../../constants/uiData";
import { formatCount } from "../../utils/formatters";
import {
  COMMUNITY_LEVELS,
  POST_IMAGE_ALLOWED_TYPES,
  POST_IMAGE_MAX_SIZE_BYTES,
  THEME_OPTIONS,
  THEME_STORAGE_KEY,
  VIEWED_POSTS_STORAGE_KEY,
} from "./appConstants";

export function loadViewedPostIds() {
  try {
    const raw = sessionStorage.getItem(VIEWED_POSTS_STORAGE_KEY);
    const parsed = JSON.parse(raw ?? "[]");
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((id) => typeof id === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

export function saveViewedPostIds(ids) {
  try {
    sessionStorage.setItem(VIEWED_POSTS_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Se o navegador bloquear sessionStorage, a API continua a funcionar sem dedupe local.
  }
}

export function getSystemTheme() {
  if (typeof window === "undefined" || !window.matchMedia) {
    return "dark";
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function isThemePreference(value) {
  return THEME_OPTIONS.some((option) => option.value === value);
}

export function loadThemePreference() {
  try {
    const savedPreference = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(savedPreference) ? savedPreference : "dark";
  } catch {
    return "dark";
  }
}

export function saveThemePreference(preference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // O tema continua funcionando em memoria se o navegador bloquear localStorage.
  }
}

export function getPostImageValidationError(file) {
  if (!POST_IMAGE_ALLOWED_TYPES.includes(file.type)) {
    return "Envie uma imagem JPG, PNG ou WebP.";
  }

  if (file.size > POST_IMAGE_MAX_SIZE_BYTES) {
    return "A imagem precisa ter até 5 MB.";
  }

  return "";
}

export function getPostFeedContext(post, index) {
  const replies = Number(post?.counts?.replies ?? 0);
  const likes = Number(post?.counts?.likes ?? 0);
  const views = Number(post?.counts?.views ?? 0);

  if (replies > 0) {
    return {
      label: replies >= 3 ? "Discussão movimentada" : "Conversa acontecendo",
      meta: `${formatCount(replies)} ${replies === 1 ? "comentário" : "comentários"}`,
    };
  }

  if (views >= 50) {
    return {
      label: "Popular na comunidade",
      meta: `${formatCount(views)} views`,
    };
  }

  if (likes > 0) {
    return {
      label: "Recebendo reações",
      meta: `${formatCount(likes)} ${likes === 1 ? "curtida" : "curtidas"}`,
    };
  }

  if (index === 0) {
    return {
      label: "Mais recente",
      meta: `Publicado ${post?.time ?? "agora"}`,
    };
  }

  return {
    label: "Publicação do feed",
    meta: `${post?.name ?? "Alguém"} · ${post?.time ?? "agora"}`,
  };
}

export function getDiscoveryScore(post) {
  return (
    Number(post?.counts?.replies ?? 0) * 8 +
    Number(post?.counts?.likes ?? 0) * 4 +
    Number(post?.counts?.views ?? 0)
  );
}

export function normalizeExploreText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function getCommunityProgress(user, userPosts) {
  const safePosts = Array.isArray(userPosts) ? userPosts : [];
  const interestsCount = Array.isArray(user?.interests)
    ? user.interests.length
    : 0;
  const postsCount = safePosts.length;
  const commentsCount = safePosts.reduce(
    (total, post) => total + Number(post.counts?.replies ?? 0),
    0,
  );
  const likesCount = safePosts.reduce(
    (total, post) => total + Number(post.counts?.likes ?? 0),
    0,
  );
  const viewsCount = safePosts.reduce(
    (total, post) => total + Number(post.counts?.views ?? 0),
    0,
  );
  const profileChecks = [
    Boolean(user?.name?.trim()),
    Boolean(user?.username?.trim()),
    Boolean(user?.role?.trim()),
    Boolean(user?.bio?.trim()),
    interestsCount > 0,
    postsCount > 0,
  ];
  const profileCompletion = Math.round(
    (profileChecks.filter(Boolean).length / profileChecks.length) * 100,
  );
  const score =
    postsCount * 16 +
    commentsCount * 9 +
    likesCount * 5 +
    Math.floor(viewsCount / 5) +
    Math.min(interestsCount, REGISTER_MAX_INTERESTS) * 3 +
    Math.floor(profileCompletion / 10);
  const currentLevel =
    [...COMMUNITY_LEVELS].reverse().find((level) => score >= level.min) ??
    COMMUNITY_LEVELS[0];
  const currentLevelIndex = COMMUNITY_LEVELS.findIndex(
    (level) => level.label === currentLevel.label,
  );
  const nextLevel = COMMUNITY_LEVELS[currentLevelIndex + 1] ?? null;
  const levelProgress = nextLevel
    ? Math.min(
        100,
        Math.round(
          ((score - currentLevel.min) / (nextLevel.min - currentLevel.min)) *
            100,
        ),
      )
    : 100;
  const remainingScore = nextLevel ? Math.max(0, nextLevel.min - score) : 0;
  const achievements = [
    {
      label: "Primeiro post",
      meta: "Publicou na comunidade",
      unlocked: postsCount > 0,
    },
    {
      label: "Conversa aberta",
      meta: "Recebeu comentários",
      unlocked: commentsCount > 0,
    },
    {
      label: "Perfil confiável",
      meta: "Completou 80% do perfil",
      unlocked: profileCompletion >= 80,
    },
    {
      label: "Alcance inicial",
      meta: "Chegou a 100 views",
      unlocked: viewsCount >= 100,
    },
  ];
  const nextAction =
    postsCount === 0
      ? "Publique seu primeiro post para começar a ganhar score."
      : profileCompletion < 80
        ? "Complete seu perfil para aumentar confiança."
        : commentsCount === 0
          ? "Crie posts que puxem respostas da comunidade."
          : nextLevel
            ? `Faltam ${formatCount(remainingScore)} pontos para ${nextLevel.label}.`
            : "Você já chegou ao nível mais alto desta etapa.";

  return {
    score,
    postsCount,
    commentsCount,
    likesCount,
    viewsCount,
    interestsCount,
    profileCompletion,
    currentLevel,
    nextLevel,
    levelProgress,
    remainingScore,
    achievements,
    nextAction,
  };
}

export function normalizeUsername(value) {
  return String(value ?? "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
}

export function removeCommentBranch(items, commentId) {
  const idsToRemove = new Set([commentId]);
  let changed = true;

  while (changed) {
    changed = false;
    items.forEach((comment) => {
      if (comment.parentCommentId && idsToRemove.has(comment.parentCommentId)) {
        if (!idsToRemove.has(comment.id)) {
          idsToRemove.add(comment.id);
          changed = true;
        }
      }
    });
  }

  return items.filter((comment) => !idsToRemove.has(comment.id));
}

export function mergeCommentItems(currentItems, incomingItems) {
  const byId = new Map();
  const allItems = [...(currentItems ?? []), ...(incomingItems ?? [])];

  allItems.forEach((comment) => {
    if (comment?.id) {
      byId.set(comment.id, { ...(byId.get(comment.id) ?? {}), ...comment });
    }
  });

  return [...byId.values()].sort((left, right) => {
    const leftTime = new Date(left.createdAt ?? 0).getTime();
    const rightTime = new Date(right.createdAt ?? 0).getTime();

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return String(left.id).localeCompare(String(right.id));
  });
}

export function adjustCommentRepliesCount(items, parentCommentId, delta) {
  if (!parentCommentId) return items;

  return items.map((comment) => {
    if (comment.id !== parentCommentId) return comment;

    return {
      ...comment,
      repliesCount: Math.max(0, Number(comment.repliesCount ?? 0) + delta),
    };
  });
}
