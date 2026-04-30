import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuthScreen from "./components/AuthScreen";
import CommentsPanel from "./components/CommentsPanel";
import { Icon, WaveMark } from "./components/Icons";
import NotificationsPanel from "./components/NotificationsPanel";
import PostCard from "./components/PostCard";
import RightRail from "./components/RightRail";
import Sidebar from "./components/Sidebar";
import {
  DEV_ACCOUNT,
  REGISTER_MAX_INTERESTS,
  REGISTER_ROLE_OPTIONS,
  navItems,
  suggestions,
  trends,
} from "./constants/uiData";
import {
  emailToInitials,
  formatCount,
  mapApiComment,
  mapApiNotification,
  mapApiPost,
  truncateText,
} from "./utils/formatters";
import "./App.css";

// Endereco base da API.
// Em producao, isso pode vir da variavel VITE_API_URL; localmente cai no backend da porta 3000.
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const VIEWED_POSTS_STORAGE_KEY = "eureca_viewed_posts";
const THEME_STORAGE_KEY = "eureca_theme_preference";
const COMMENT_MAX_LENGTH = 280;
const COMMENT_ROOT_PAGE_SIZE = 10;
const COMMENT_REPLY_PAGE_SIZE = 5;
const COMMENT_PREVIEW_PAGE_SIZE = 2;
const COMMENT_PREVIEW_POST_LIMIT = 6;
const THEME_OPTIONS = [
  { value: "system", label: "Sistema" },
  { value: "dark", label: "Escuro" },
  { value: "light", label: "Claro" },
];
const COMPOSER_PROMPTS = [
  { label: "Pedir feedback", text: "O que vocês acham desta ideia? " },
  { label: "Mostrar progresso", text: "Atualização rápida: " },
  { label: "Fazer pergunta", text: "Alguém já passou por isso? " },
];
const COMPOSER_TOOLS = [
  { icon: "image", label: "Imagem" },
  { icon: "smile", label: "Humor" },
  { icon: "calendar", label: "Evento" },
];
const EXPLORE_FILTERS = [
  { value: "all", label: "Tudo" },
  { value: "discussions", label: "Discussões" },
  { value: "popular", label: "Populares" },
  { value: "recent", label: "Recentes" },
  { value: "people", label: "Pessoas" },
];
const COMMUNITY_LEVELS = [
  { min: 0, label: "Explorador" },
  { min: 80, label: "Participante" },
  { min: 220, label: "Colaborador" },
  { min: 520, label: "Referência" },
  { min: 1000, label: "Mentor" },
];
const REGISTER_PROFILE_INITIAL = {
  name: "",
  username: "",
  role: REGISTER_ROLE_OPTIONS[0],
  bio: "",
  interests: [],
  acceptedTerms: false,
};

// Contato ficticio usado para preencher a tela de conversas enquanto o chat real nao existe.
const CHAT_BOT_CONTACT = {
  id: "eureca-bot",
  name: "Eureca Bot",
  handle: "@eureca_bot",
  initials: "EB",
  status: "online",
  preview: "Olá! Este é o chat de teste da Eureca.",
};

// Mensagens mockadas para simular uma conversa pronta.
const CHAT_BOT_MESSAGES = [
  {
    id: "bot-1",
    sender: "bot",
    text: "Olá! Eu sou o bot de teste da Eureca.",
    time: "09:41",
  },
  {
    id: "bot-2",
    sender: "bot",
    text: "Aqui vai aparecer o chat em tempo real no futuro. Por agora, esta tela já simula a experiência de conversa.",
    time: "09:42",
  },
];

function loadViewedPostIds() {
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

function saveViewedPostIds(ids) {
  try {
    sessionStorage.setItem(VIEWED_POSTS_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Se o navegador bloquear sessionStorage, a API continua a funcionar sem dedupe local.
  }
}

function getSystemTheme() {
  if (typeof window === "undefined" || !window.matchMedia) {
    return "dark";
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function isThemePreference(value) {
  return THEME_OPTIONS.some((option) => option.value === value);
}

function loadThemePreference() {
  try {
    const savedPreference = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(savedPreference) ? savedPreference : "dark";
  } catch {
    return "dark";
  }
}

function saveThemePreference(preference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // O tema continua funcionando em memoria se o navegador bloquear localStorage.
  }
}

function getPostFeedContext(post, index) {
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

function getDiscoveryScore(post) {
  return (
    Number(post?.counts?.replies ?? 0) * 8 +
    Number(post?.counts?.likes ?? 0) * 4 +
    Number(post?.counts?.views ?? 0)
  );
}

function normalizeExploreText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function getCommunityProgress(user, userPosts) {
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

function normalizeUsername(value) {
  return String(value ?? "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
}

function removeCommentBranch(items, commentId) {
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

function mergeCommentItems(currentItems, incomingItems) {
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

function adjustCommentRepliesCount(items, parentCommentId, delta) {
  if (!parentCommentId) return items;

  return items.map((comment) => {
    if (comment.id !== parentCommentId) return comment;

    return {
      ...comment,
      repliesCount: Math.max(0, Number(comment.repliesCount ?? 0) + delta),
    };
  });
}

function App() {
  // Estados principais da autenticacao e dos campos do formulario.
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registerProfile, setRegisterProfile] = useState(
    REGISTER_PROFILE_INITIAL,
  );
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Estados ligados a sessao atual e navegacao interna da interface.
  const [token, setToken] = useState(
    () => localStorage.getItem("eureca_token") ?? "",
  );
  const [me, setMe] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [currentView, setCurrentView] = useState("home");
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [themePreference, setThemePreference] = useState(loadThemePreference);
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);

  // Estados do feed, criacao de posts e feedbacks visuais para o usuario.
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [content, setContent] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [composerError, setComposerError] = useState("");
  const [composerNotice, setComposerNotice] = useState("");
  const [activeCommentsPostId, setActiveCommentsPostId] = useState("");
  const [commentsByPost, setCommentsByPost] = useState({});
  const [exploreQuery, setExploreQuery] = useState("");
  const [exploreFilter, setExploreFilter] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [notificationsNotice, setNotificationsNotice] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState(
    CHAT_BOT_CONTACT.id,
  );
  const userMenuRef = useRef(null);
  const composerInputRef = useRef(null);
  const viewedPostIdsRef = useRef(null);

  if (viewedPostIdsRef.current === null) {
    viewedPostIdsRef.current = loadViewedPostIds();
  }

  // Valores derivados: nao sao digitados pelo usuario, mas calculados a partir do estado atual.
  const isLoggedIn = Boolean(token);
  const sessionEmail = me?.email ?? email;
  const sessionName = me?.name?.trim() || sessionEmail || "Usuário";
  const sessionHandle = me?.username
    ? `@${me.username}`
    : `@${(sessionEmail.split("@")[0] || "usuario").toLowerCase()}`;
  const profileUser = selectedProfile ?? me;
  const isOwnProfile = !selectedProfile || selectedProfile.id === me?.id;
  const profileEmail = profileUser?.email ?? sessionEmail;
  const profileName = profileUser?.name?.trim() || profileEmail || "Usuário";
  const profileHandle = profileUser?.username
    ? `@${profileUser.username}`
    : `@${(profileEmail.split("@")[0] || "usuario").toLowerCase()}`;
  const profileBio =
    profileUser?.bio?.trim() ||
    "Conta da Eureca. Aqui você pode ver informações básicas da sessão e seus posts publicados.";
  const composerHasContent = content.trim().length > 0;
  const resolvedTheme =
    themePreference === "system" ? systemTheme : themePreference;
  const selectedThemeLabel =
    THEME_OPTIONS.find((option) => option.value === themePreference)?.label ??
    "Escuro";
  const themeSummary =
    themePreference === "system"
      ? `Sistema (${systemTheme === "light" ? "claro" : "escuro"})`
      : selectedThemeLabel;

  // Gera as iniciais do usuario ativo para avatar e pequenos badges.
  const userInitial = useMemo(
    () => emailToInitials(sessionName),
    [sessionName],
  );
  const profileInitial = useMemo(
    () => emailToInitials(profileName),
    [profileName],
  );

  // Filtra os posts do usuario atual usando identidade real do autor.
  // Se o perfil ainda nao carregou, cai para comparacao por email do autor.
  const myPosts = useMemo(() => {
    const activeUserId = me?.id ?? "";
    const normalizedEmail = sessionEmail.trim().toLowerCase();

    if (!activeUserId && !normalizedEmail) return [];

    return posts.filter((post) => {
      if (activeUserId && post.authorId) {
        return post.authorId === activeUserId;
      }

      return (post.authorEmail ?? "").trim().toLowerCase() === normalizedEmail;
    });
  }, [posts, me?.id, sessionEmail]);
  const profilePosts = useMemo(() => {
    const profileUserId = profileUser?.id ?? "";
    const normalizedEmail = profileEmail.trim().toLowerCase();

    if (!profileUserId && !normalizedEmail) return [];

    return posts.filter((post) => {
      if (profileUserId && post.authorId) {
        return post.authorId === profileUserId;
      }

      return (post.authorEmail ?? "").trim().toLowerCase() === normalizedEmail;
    });
  }, [posts, profileUser?.id, profileEmail]);
  const latestMyPost = myPosts[0] ?? null;
  const latestMyPostPreview = latestMyPost
    ? truncateText(latestMyPost.text, 110)
    : "Você ainda não publicou nenhum post. Crie seu primeiro post para aparecer aqui.";
  const totalProfileLikes = profilePosts.reduce(
    (total, post) => total + Number(post.counts?.likes ?? 0),
    0,
  );
  const totalProfileViews = profilePosts.reduce(
    (total, post) => total + Number(post.counts?.views ?? 0),
    0,
  );
  const profileCreatedAt = profileUser?.createdAt
    ? new Date(profileUser.createdAt).toLocaleDateString("pt-BR")
    : "Sessão ativa";
  const unreadNotificationsCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications],
  );
  const feedOverview = useMemo(() => {
    const comments = posts.reduce(
      (total, post) => total + Number(post.counts?.replies ?? 0),
      0,
    );
    const views = posts.reduce(
      (total, post) => total + Number(post.counts?.views ?? 0),
      0,
    );
    const activeDiscussions = posts.filter(
      (post) => Number(post.counts?.replies ?? 0) > 0,
    ).length;
    const topPost = posts.reduce((top, post) => {
      if (!top) return post;

      const topScore =
        Number(top.counts?.replies ?? 0) * 8 +
        Number(top.counts?.likes ?? 0) * 3 +
        Number(top.counts?.views ?? 0);
      const postScore =
        Number(post.counts?.replies ?? 0) * 8 +
        Number(post.counts?.likes ?? 0) * 3 +
        Number(post.counts?.views ?? 0);

      return postScore > topScore ? post : top;
    }, null);

    return {
      activeDiscussions,
      comments,
      views,
      topPost,
      firstDiscussionIndex: posts.findIndex(
        (post) => Number(post.counts?.replies ?? 0) > 0,
      ),
      continueIndex: posts.length > 4 ? Math.min(3, posts.length - 1) : -1,
    };
  }, [posts]);
  const exploreData = useMemo(() => {
    const query = normalizeExploreText(exploreQuery);
    const matchesQuery = (...values) =>
      !query ||
      values.some((value) => normalizeExploreText(value).includes(query));
    const scoredPosts = posts
      .map((post, index) => ({
        post,
        index,
        score: getDiscoveryScore(post),
      }))
      .filter(({ post, score }) => {
        const replies = Number(post.counts?.replies ?? 0);
        const views = Number(post.counts?.views ?? 0);
        const likes = Number(post.counts?.likes ?? 0);
        const matchesPost = matchesQuery(
          post.text,
          post.name,
          post.handle,
          post.authorRole,
          post.authorBadge?.label,
        );
        const matchesFilter =
          exploreFilter === "all" ||
          exploreFilter === "recent" ||
          (exploreFilter === "discussions" && replies > 0) ||
          (exploreFilter === "popular" &&
            (score >= 25 || views >= 50 || likes > 0));

        return exploreFilter !== "people" && matchesPost && matchesFilter;
      })
      .sort((left, right) => {
        if (exploreFilter !== "recent" && left.score !== right.score) {
          return right.score - left.score;
        }

        return (
          new Date(right.post.createdAt ?? 0).getTime() -
          new Date(left.post.createdAt ?? 0).getTime()
        );
      });
    const topicMatches = trends.filter((trend) =>
      matchesQuery(trend.title, trend.category, trend.posts),
    );
    const authorMap = new Map();

    posts.forEach((post) => {
      const key = post.authorId || post.handle;
      if (!key) return;

      const current = authorMap.get(key) ?? {
        initials: post.initials,
        name: post.name,
        handle: post.handle,
        badge: post.authorBadge?.label ?? "Membro",
        context: "",
        status: "active",
        score: 0,
        postsCount: 0,
        post,
      };

      current.score += getDiscoveryScore(post);
      current.postsCount += 1;
      current.context = `${formatCount(current.postsCount)} posts · ${formatCount(current.score)} score`;
      authorMap.set(key, current);
    });

    const peopleByHandle = new Map();

    [...authorMap.values(), ...suggestions].forEach((person) => {
      const handle = person.handle ?? "";
      if (!handle || peopleByHandle.has(handle)) return;

      peopleByHandle.set(handle, {
        initials: person.initials,
        name: person.name,
        handle,
        badge: person.badge,
        context: person.context,
        mutual: person.mutual,
        status: person.status ?? "active",
        score: Number(person.score ?? 0),
        postsCount: Number(person.postsCount ?? 0),
        post: person.post ?? null,
      });
    });

    const people = [...peopleByHandle.values()]
      .filter((person) =>
        matchesQuery(
          person.name,
          person.handle,
          person.badge,
          person.context,
          person.mutual,
        ),
      )
      .sort((left, right) => {
        if (Boolean(right.post) !== Boolean(left.post)) {
          return right.post ? 1 : -1;
        }

        return right.score - left.score;
      });

    return {
      posts: scoredPosts.map(({ post, score }) => ({ ...post, score })),
      topics: topicMatches,
      people,
      totalMatches: scoredPosts.length + topicMatches.length + people.length,
    };
  }, [exploreFilter, exploreQuery, posts]);
  const communityProgress = useMemo(
    () => getCommunityProgress(me, myPosts),
    [me, myPosts],
  );
  const profileCommunityProgress = useMemo(
    () => getCommunityProgress(profileUser, profilePosts),
    [profileUser, profilePosts],
  );

  // Busca a lista de posts e converte o formato da API para o formato esperado pela interface.
  const fetchPosts = useCallback(
    async (authToken = token) => {
      const safeToken = typeof authToken === "string" ? authToken : token;
      setPostsLoading(true);
      setFeedError("");

      try {
        const endpoint = safeToken
          ? `${API_BASE}/posts/me/feed`
          : `${API_BASE}/posts`;
        const res = await fetch(endpoint, {
          headers: safeToken
            ? { Authorization: `Bearer ${safeToken}` }
            : undefined,
        });
        const data = await res.json();

        if (!res.ok) {
          setFeedError(data?.message ?? "Não foi possível carregar o feed.");
          setPosts([]);
          return;
        }

        setPosts(Array.isArray(data) ? data.map(mapApiPost) : []);
      } catch {
        setFeedError("Backend indisponível. Inicie a API para carregar posts.");
        setPosts([]);
      } finally {
        setPostsLoading(false);
      }
    },
    [token],
  );

  const fetchNotifications = useCallback(
    async (authToken = token) => {
      const safeToken = typeof authToken === "string" ? authToken : token;

      if (!safeToken) {
        setNotifications([]);
        return;
      }

      setNotificationsLoading(true);
      setNotificationsError("");

      try {
        const res = await fetch(`${API_BASE}/notifications`, {
          headers: { Authorization: `Bearer ${safeToken}` },
        });
        const data = await res.json().catch(() => []);

        if (!res.ok) {
          if (res.status === 401) {
            setToken("");
            setNotifications([]);
            setNotificationsError("Sua sessão expirou. Faça login novamente.");
            return;
          }

          throw new Error(
            data?.message ?? "Não foi possível carregar os alertas.",
          );
        }

        setNotifications(
          Array.isArray(data) ? data.map(mapApiNotification) : [],
        );
      } catch (error) {
        setNotificationsError(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os alertas.",
        );
      } finally {
        setNotificationsLoading(false);
      }
    },
    [token],
  );

  // Consulta a rota protegida /users/me para descobrir quem esta autenticado.
  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 401) {
          setToken("");
        }
        setMe(null);
        setSelectedProfile(null);
        return;
      }

      const data = await res.json();
      const user = data?.user ?? null;
      setMe(user);
      if (user?.email) {
        setEmail(user.email);
      }
    } catch {
      setMe(null);
      setSelectedProfile(null);
    }
  }, [token]);

  // Mantem o token salvo no navegador para que o login persista ao recarregar a pagina.
  useEffect(() => {
    if (token) {
      localStorage.setItem("eureca_token", token);
    } else {
      localStorage.removeItem("eureca_token");
    }
  }, [token]);

  // Guarda a preferencia de tema para preservar a escolha ao recarregar a pagina.
  useEffect(() => {
    saveThemePreference(themePreference);
  }, [themePreference]);

  // Mantem a opcao "Sistema" alinhada com o tema do navegador enquanto a aba esta aberta.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const updateSystemTheme = (event) => {
      setSystemTheme(event.matches ? "light" : "dark");
    };

    setSystemTheme(mediaQuery.matches ? "light" : "dark");
    mediaQuery.addEventListener("change", updateSystemTheme);

    return () => mediaQuery.removeEventListener("change", updateSystemTheme);
  }, []);

  // Fecha o menu do usuario quando a pessoa clica fora dele.
  useEffect(() => {
    if (!userMenuOpen) return undefined;

    const handleClickOutside = (event) => {
      if (!userMenuRef.current?.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  // Sempre que o token muda, recarrega o feed.
  // Sem token, busca o feed publico; com token, busca o feed personalizado.
  useEffect(() => {
    fetchPosts(token);
  }, [fetchPosts, token]);

  useEffect(() => {
    if (!token) {
      setNotifications([]);
      return;
    }

    fetchNotifications(token);
  }, [fetchNotifications, token]);

  // Quando existe token, busca os dados do usuario autenticado.
  useEffect(() => {
    if (!token) {
      setMe(null);
      return;
    }

    fetchMe();
  }, [fetchMe, token]);

  // Fluxo de curtida com atualizacao otimista:
  // a interface muda na hora para parecer rapida e depois confirma com o backend.
  const handleToggleLike = async (postId, isCurrentlyLiked) => {
    if (!token) {
      setComposerError("Faça login para curtir posts.");
      return;
    }

    const method = isCurrentlyLiked ? "DELETE" : "POST";

    // Atualiza a interface antes da resposta do servidor.
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post;
        const nextLikes = Math.max(
          0,
          (post.counts?.likes ?? 0) + (isCurrentlyLiked ? -1 : 1),
        );
        return {
          ...post,
          liked: !isCurrentlyLiked,
          counts: { ...(post.counts ?? {}), likes: nextLikes },
          stats: { ...post.stats, likes: formatCount(nextLikes) },
        };
      }),
    );

    try {
      // Sincroniza a curtida real com o backend.
      const res = await fetch(`${API_BASE}/posts/${postId}/like`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          setToken("");
          setComposerError("Sua sessão expirou. Faça login novamente.");
          return;
        }
        throw new Error(data?.message ?? "Erro ao curtir post.");
      }

      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post;
          const likesCount = Number(
            data?.likesCount ?? post.counts?.likes ?? 0,
          );
          return {
            ...post,
            liked: Boolean(data?.viewerLiked),
            counts: { ...(post.counts ?? {}), likes: likesCount },
            stats: { ...post.stats, likes: formatCount(likesCount) },
          };
        }),
      );
    } catch (error) {
      // Se algo falhar, desfaz a mudanca visual para nao deixar a tela mentindo.
      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post;
          const rolledBackLikes = Math.max(
            0,
            (post.counts?.likes ?? 0) + (isCurrentlyLiked ? 1 : -1),
          );
          return {
            ...post,
            liked: isCurrentlyLiked,
            counts: { ...(post.counts ?? {}), likes: rolledBackLikes },
            stats: { ...post.stats, likes: formatCount(rolledBackLikes) },
          };
        }),
      );
      setComposerError(
        error instanceof Error ? error.message : "Erro ao curtir post.",
      );
    }
  };

  // Registra uma visualizacao automaticamente quando o post entra na tela.
  // O sessionStorage evita somar varias views do mesmo post na mesma sessao do navegador.
  const handlePostViewed = useCallback(async (postId) => {
    if (!postId || viewedPostIdsRef.current?.has(postId)) {
      return;
    }

    const viewedPostIds = viewedPostIdsRef.current ?? new Set();
    viewedPostIds.add(postId);
    viewedPostIdsRef.current = viewedPostIds;
    saveViewedPostIds(viewedPostIds);

    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post;
        const nextViews = Math.max(0, (post.counts?.views ?? 0) + 1);
        return {
          ...post,
          counts: { ...(post.counts ?? {}), views: nextViews },
          stats: { ...post.stats, views: formatCount(nextViews) },
        };
      }),
    );

    try {
      const res = await fetch(`${API_BASE}/posts/${postId}/view`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message ?? "Erro ao registrar visualização.");
      }

      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post;
          const viewCount = Number(data?.viewCount ?? post.counts?.views ?? 0);
          return {
            ...post,
            counts: { ...(post.counts ?? {}), views: viewCount },
            stats: { ...post.stats, views: formatCount(viewCount) },
          };
        }),
      );
    } catch {
      viewedPostIds.delete(postId);
      saveViewedPostIds(viewedPostIds);

      // Em caso de erro, volta a contagem para evitar inflar os numeros na interface.
      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post;
          const rolledBackViews = Math.max(0, (post.counts?.views ?? 0) - 1);
          return {
            ...post,
            counts: { ...(post.counts ?? {}), views: rolledBackViews },
            stats: { ...post.stats, views: formatCount(rolledBackViews) },
          };
        }),
      );
    }
  }, []);

  const setPostCommentsCount = useCallback((postId, commentsCount) => {
    const nextCount = Math.max(0, Number(commentsCount ?? 0));

    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post;
        return {
          ...post,
          counts: { ...(post.counts ?? {}), replies: nextCount },
          stats: { ...post.stats, replies: formatCount(nextCount) },
        };
      }),
    );
  }, []);

  const updateCommentDraft = (postId, draft) => {
    const safeDraft = String(draft ?? "").slice(0, COMMENT_MAX_LENGTH);

    setCommentsByPost((prev) => {
      const current = prev[postId] ?? {};
      return {
        ...prev,
        [postId]: {
          ...current,
          items: current.items ?? [],
          loaded: Boolean(current.loaded),
          loading: Boolean(current.loading),
          loadingMore: Boolean(current.loadingMore),
          previewLoaded: Boolean(current.previewLoaded),
          previewLoading: Boolean(current.previewLoading),
          submitting: Boolean(current.submitting),
          deletingIds: current.deletingIds ?? [],
          replyPages: current.replyPages ?? {},
          hasMore: Boolean(current.hasMore),
          nextCursor: current.nextCursor ?? null,
          replyToId: current.replyToId ?? "",
          error: "",
          notice: "",
          draft: safeDraft,
        },
      };
    });
  };

  const loadCommentsForPost = useCallback(
    async (postId, options = {}) => {
      if (!postId) return;

      const append = Boolean(options.append);
      const preview = Boolean(options.preview);
      const currentPage = commentsByPost[postId] ?? {};
      const cursor = append ? currentPage.nextCursor : null;

      if (
        preview &&
        (currentPage.previewLoading || currentPage.previewLoaded)
      ) {
        return;
      }

      if (append && (!currentPage.hasMore || !cursor)) {
        return;
      }

      setCommentsByPost((prev) => {
        const current = prev[postId] ?? {};
        return {
          ...prev,
          [postId]: {
            ...current,
            items: current.items ?? [],
            draft: current.draft ?? "",
            replyToId: current.replyToId ?? "",
            deletingIds: current.deletingIds ?? [],
            replyPages: current.replyPages ?? {},
            loaded: Boolean(current.loaded),
            previewLoaded: Boolean(current.previewLoaded),
            submitting: Boolean(current.submitting),
            hasMore: Boolean(current.hasMore),
            nextCursor: current.nextCursor ?? null,
            loading: preview
              ? Boolean(current.loading)
              : append
                ? Boolean(current.loading)
                : true,
            loadingMore: preview ? Boolean(current.loadingMore) : append,
            previewLoading: preview ? true : Boolean(current.previewLoading),
            error: "",
          },
        };
      });

      try {
        const params = new URLSearchParams({
          limit: String(
            preview ? COMMENT_PREVIEW_PAGE_SIZE : COMMENT_ROOT_PAGE_SIZE,
          ),
        });
        if (cursor) params.set("cursor", cursor);

        const res = await fetch(
          `${API_BASE}/posts/${postId}/comments?${params.toString()}`,
        );
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data?.message ?? "Não foi possível carregar os comentários.",
          );
        }

        const rawItems = Array.isArray(data) ? data : data?.items;
        const items = Array.isArray(rawItems)
          ? rawItems.map(mapApiComment)
          : [];
        const commentsCount = Number(data?.commentsCount ?? items.length);
        setPostCommentsCount(postId, commentsCount);
        setCommentsByPost((prev) => {
          const current = prev[postId] ?? {};
          const pendingItems = (current.items ?? []).filter(
            (comment) => comment.pending,
          );
          const nextItems = append
            ? mergeCommentItems(current.items ?? [], items)
            : preview
              ? mergeCommentItems(current.items ?? [], items)
              : mergeCommentItems(pendingItems, items);

          return {
            ...prev,
            [postId]: {
              ...current,
              items: nextItems,
              loading: preview ? Boolean(current.loading) : false,
              loadingMore: preview ? Boolean(current.loadingMore) : false,
              previewLoading: false,
              previewLoaded: preview ? true : Boolean(current.previewLoaded),
              loaded: preview ? Boolean(current.loaded) : true,
              hasMore: preview
                ? Boolean(current.hasMore)
                : Boolean(data?.hasMore),
              nextCursor: preview
                ? (current.nextCursor ?? null)
                : (data?.nextCursor ?? null),
              replyPages: append || preview ? (current.replyPages ?? {}) : {},
              error: "",
              notice: "",
            },
          };
        });
      } catch (error) {
        setCommentsByPost((prev) => {
          const current = prev[postId] ?? {};
          return {
            ...prev,
            [postId]: {
              ...current,
              items: current.items ?? [],
              loading: preview ? Boolean(current.loading) : false,
              loadingMore: preview ? Boolean(current.loadingMore) : false,
              previewLoading: false,
              loaded: Boolean(current.loaded),
              previewLoaded: Boolean(current.previewLoaded),
              hasMore: Boolean(current.hasMore),
              nextCursor: current.nextCursor ?? null,
              replyPages: current.replyPages ?? {},
              error:
                error instanceof Error
                  ? error.message
                  : "Não foi possível carregar os comentários.",
            },
          };
        });
      }
    },
    [commentsByPost, setPostCommentsCount],
  );

  // Carrega uma amostra curta de comentarios para enriquecer os cards do feed
  // sem abrir o painel completo nem buscar todas as discussoes de uma vez.
  useEffect(() => {
    if (!isLoggedIn || currentView !== "home" || postsLoading) return;

    const previewTargets = posts
      .filter(
        (post) =>
          post.id &&
          Number(post.counts?.replies ?? 0) > 0 &&
          !commentsByPost[post.id]?.loaded &&
          !commentsByPost[post.id]?.loading &&
          !commentsByPost[post.id]?.previewLoaded &&
          !commentsByPost[post.id]?.previewLoading,
      )
      .slice(0, COMMENT_PREVIEW_POST_LIMIT);

    previewTargets.forEach((post) => {
      void loadCommentsForPost(post.id, { preview: true });
    });
  }, [
    commentsByPost,
    currentView,
    isLoggedIn,
    loadCommentsForPost,
    posts,
    postsLoading,
  ]);

  const loadRepliesForComment = useCallback(
    async (postId, parentCommentId) => {
      if (!postId || !parentCommentId) return;

      const current = commentsByPost[postId] ?? {};
      const replyPage = current.replyPages?.[parentCommentId] ?? {};
      const cursor = replyPage.nextCursor ?? null;
      const parentComment = (current.items ?? []).find(
        (comment) => comment.id === parentCommentId,
      );
      const loadedRepliesCount = (current.items ?? []).filter(
        (comment) => comment.parentCommentId === parentCommentId,
      ).length;
      const directRepliesCount = Number(parentComment?.repliesCount ?? 0);

      if (
        replyPage.loading ||
        (replyPage.loaded &&
          !replyPage.hasMore &&
          loadedRepliesCount >= directRepliesCount)
      ) {
        return;
      }

      setCommentsByPost((prev) => {
        const existing = prev[postId] ?? {};
        return {
          ...prev,
          [postId]: {
            ...existing,
            items: existing.items ?? [],
            draft: existing.draft ?? "",
            replyToId: existing.replyToId ?? "",
            deletingIds: existing.deletingIds ?? [],
            replyPages: {
              ...(existing.replyPages ?? {}),
              [parentCommentId]: {
                ...(existing.replyPages?.[parentCommentId] ?? {}),
                loading: true,
                error: "",
              },
            },
            error: "",
          },
        };
      });

      try {
        const params = new URLSearchParams({
          parentCommentId,
          limit: String(COMMENT_REPLY_PAGE_SIZE),
        });
        if (cursor) params.set("cursor", cursor);

        const res = await fetch(
          `${API_BASE}/posts/${postId}/comments?${params.toString()}`,
        );
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data?.message ?? "Não foi possível carregar as respostas.",
          );
        }

        const rawItems = Array.isArray(data) ? data : data?.items;
        const items = Array.isArray(rawItems)
          ? rawItems.map(mapApiComment)
          : [];
        const currentPost = posts.find((post) => post.id === postId);
        const commentsCount = Number(
          data?.commentsCount ?? currentPost?.counts?.replies ?? items.length,
        );
        setPostCommentsCount(postId, commentsCount);
        setCommentsByPost((prev) => {
          const existing = prev[postId] ?? {};
          return {
            ...prev,
            [postId]: {
              ...existing,
              items: mergeCommentItems(existing.items ?? [], items),
              replyPages: {
                ...(existing.replyPages ?? {}),
                [parentCommentId]: {
                  loaded: true,
                  loading: false,
                  hasMore: Boolean(data?.hasMore),
                  nextCursor: data?.nextCursor ?? null,
                  error: "",
                },
              },
            },
          };
        });
      } catch (error) {
        setCommentsByPost((prev) => {
          const existing = prev[postId] ?? {};
          return {
            ...prev,
            [postId]: {
              ...existing,
              items: existing.items ?? [],
              replyPages: {
                ...(existing.replyPages ?? {}),
                [parentCommentId]: {
                  ...(existing.replyPages?.[parentCommentId] ?? {}),
                  loading: false,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Não foi possível carregar as respostas.",
                },
              },
            },
          };
        });
      }
    },
    [commentsByPost, posts, setPostCommentsCount],
  );

  const handleToggleComments = (postId) => {
    if (!postId) return;

    if (activeCommentsPostId === postId) {
      setActiveCommentsPostId("");
      return;
    }

    setActiveCommentsPostId(postId);

    const current = commentsByPost[postId];
    if (!current?.loaded && !current?.loading) {
      void loadCommentsForPost(postId);
    }
  };

  const handleReplyToComment = (postId, commentId) => {
    setActiveCommentsPostId(postId);
    setCommentsByPost((prev) => {
      const current = prev[postId] ?? {};
      return {
        ...prev,
        [postId]: {
          ...current,
          items: current.items ?? [],
          draft: current.draft ?? "",
          replyToId: commentId,
          error: "",
          notice: "",
        },
      };
    });
  };

  const handleCancelReply = (postId) => {
    setCommentsByPost((prev) => {
      const current = prev[postId] ?? {};
      return {
        ...prev,
        [postId]: {
          ...current,
          items: current.items ?? [],
          replyToId: "",
          error: "",
        },
      };
    });
  };

  const handleCreateComment = async (postId) => {
    const current = commentsByPost[postId] ?? {};
    const draft = String(current.draft ?? "");
    const text = draft.trim();
    const parentCommentId = current.replyToId || undefined;

    if (current.loading || current.submitting) return;

    if (!text) {
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: {
          ...(prev[postId] ?? {}),
          items: prev[postId]?.items ?? [],
          draft,
          submitting: false,
          error: "Escreva algo antes de comentar.",
          notice: "",
        },
      }));
      return;
    }

    if (draft.length > COMMENT_MAX_LENGTH) {
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: {
          ...(prev[postId] ?? {}),
          items: prev[postId]?.items ?? [],
          draft,
          submitting: false,
          error: `O comentário deve ter no máximo ${COMMENT_MAX_LENGTH} caracteres.`,
          notice: "",
        },
      }));
      return;
    }

    if (!token) {
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: {
          ...(prev[postId] ?? {}),
          items: prev[postId]?.items ?? [],
          draft: text,
          submitting: false,
          error: "Faça login para comentar.",
          notice: "",
        },
      }));
      return;
    }

    const previousItems = current.items ?? [];
    const previousPost = posts.find((post) => post.id === postId);
    const previousCount = Number(
      previousPost?.counts?.replies ?? previousItems.length,
    );
    const optimisticId = `temp-comment-${postId}-${Date.now()}`;
    const now = new Date().toISOString();
    const optimisticComment = {
      id: optimisticId,
      postId,
      authorId: me?.id ?? "",
      authorEmail: me?.email ?? sessionEmail,
      initials: userInitial,
      name: sessionName,
      handle: sessionHandle,
      time: "agora",
      text,
      parentCommentId: parentCommentId ?? null,
      repliesCount: 0,
      createdAt: now,
      updatedAt: now,
      pending: true,
    };

    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: {
        ...(prev[postId] ?? {}),
        items: mergeCommentItems(
          parentCommentId
            ? adjustCommentRepliesCount(
                prev[postId]?.items ?? [],
                parentCommentId,
                1,
              )
            : (prev[postId]?.items ?? []),
          [optimisticComment],
        ),
        draft: "",
        replyToId: current.replyToId ?? "",
        submitting: true,
        loaded: true,
        loading: false,
        loadingMore: false,
        replyPages: parentCommentId
          ? {
              ...(prev[postId]?.replyPages ?? {}),
              [parentCommentId]: {
                ...(prev[postId]?.replyPages?.[parentCommentId] ?? {}),
                loaded: true,
              },
            }
          : (prev[postId]?.replyPages ?? {}),
        error: "",
        notice: "",
      },
    }));
    setPostCommentsCount(postId, previousCount + 1);

    try {
      const res = await fetch(`${API_BASE}/posts/${postId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: text,
          ...(parentCommentId ? { parentCommentId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          setToken("");
          throw new Error("Sua sessão expirou. Faça login novamente.");
        }

        throw new Error(data?.message ?? "Não foi possível comentar.");
      }

      const created = data?.comment ? mapApiComment(data.comment) : null;
      const commentsCount = Number(
        data?.commentsCount ?? (current.items?.length ?? 0) + 1,
      );

      setCommentsByPost((prev) => {
        const existing = prev[postId] ?? {};
        const items = existing.items ?? [];
        const nextItems = created
          ? items.map((comment) =>
              comment.id === optimisticId ? created : comment,
            )
          : items.filter((comment) => comment.id !== optimisticId);

        return {
          ...prev,
          [postId]: {
            ...existing,
            items: nextItems,
            draft: "",
            replyToId: "",
            submitting: false,
            loaded: true,
            loading: false,
            error: "",
            notice: parentCommentId
              ? "Resposta publicada."
              : "Comentário publicado.",
          },
        };
      });
      setPostCommentsCount(postId, commentsCount);
    } catch (error) {
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: {
          ...(prev[postId] ?? {}),
          items: parentCommentId
            ? adjustCommentRepliesCount(
                (prev[postId]?.items ?? []).filter(
                  (comment) => comment.id !== optimisticId,
                ),
                parentCommentId,
                -1,
              )
            : (prev[postId]?.items ?? []).filter(
                (comment) => comment.id !== optimisticId,
              ),
          draft: text,
          replyToId: parentCommentId ?? "",
          submitting: false,
          loaded: Boolean(prev[postId]?.loaded),
          loading: false,
          loadingMore: false,
          replyPages: prev[postId]?.replyPages ?? {},
          error:
            error instanceof Error
              ? error.message
              : "Não foi possível comentar.",
          notice: "",
        },
      }));
      setPostCommentsCount(postId, previousCount);
    }
  };

  const handleDeleteComment = async (postId, commentId) => {
    const current = commentsByPost[postId] ?? {};
    const target = (current.items ?? []).find(
      (comment) => comment.id === commentId,
    );

    if (!target || target.pending || current.deletingIds?.includes(commentId)) {
      return;
    }

    if (!token) {
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: {
          ...(prev[postId] ?? {}),
          items: prev[postId]?.items ?? [],
          error: "Faça login para apagar comentários.",
          notice: "",
        },
      }));
      return;
    }

    const previousPost = posts.find((post) => post.id === postId);
    const previousCount = Number(
      previousPost?.counts?.replies ?? current.items?.length ?? 0,
    );

    setCommentsByPost((prev) => {
      const existing = prev[postId] ?? {};
      const deletingIds = new Set(existing.deletingIds ?? []);
      deletingIds.add(commentId);

      return {
        ...prev,
        [postId]: {
          ...existing,
          items: existing.items ?? [],
          deletingIds: [...deletingIds],
          error: "",
          notice: "",
        },
      };
    });

    try {
      const res = await fetch(`${API_BASE}/comments/${commentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          setToken("");
          throw new Error("Sua sessão expirou. Faça login novamente.");
        }

        throw new Error(
          data?.message ?? "Não foi possível apagar o comentário.",
        );
      }

      const commentsCount = Number(
        data?.commentsCount ?? Math.max(0, previousCount - 1),
      );

      setCommentsByPost((prev) => {
        const existing = prev[postId] ?? {};
        const nextItems = removeCommentBranch(existing.items ?? [], commentId);
        return {
          ...prev,
          [postId]: {
            ...existing,
            items: target.parentCommentId
              ? adjustCommentRepliesCount(nextItems, target.parentCommentId, -1)
              : nextItems,
            deletingIds: (existing.deletingIds ?? []).filter(
              (id) => id !== commentId,
            ),
            error: "",
            notice: "Comentário apagado.",
          },
        };
      });
      setPostCommentsCount(postId, commentsCount);
    } catch (error) {
      setCommentsByPost((prev) => {
        const existing = prev[postId] ?? {};
        return {
          ...prev,
          [postId]: {
            ...existing,
            items: existing.items ?? [],
            deletingIds: (existing.deletingIds ?? []).filter(
              (id) => id !== commentId,
            ),
            error:
              error instanceof Error
                ? error.message
                : "Não foi possível apagar o comentário.",
            notice: "",
          },
        };
      });
      setPostCommentsCount(postId, previousCount);
    }
  };

  // Envia login ou cadastro para o backend, dependendo do modo atual da tela.
  const handleAuth = async (event) => {
    event.preventDefault();
    setAuthError("");
    setComposerNotice("");

    // Validacoes simples antes de chamar a API.
    if (!email.trim() || !password.trim()) {
      setAuthError(
        authMode === "login"
          ? "Preencha e-mail ou usuário e senha para entrar."
          : "Preencha e-mail e senha para criar a conta.",
      );
      return;
    }

    if (authMode === "register") {
      const name = registerProfile.name.trim();
      const username = normalizeUsername(registerProfile.username);
      const bio = registerProfile.bio.trim();

      if (!name || !username) {
        setAuthError("Preencha nome e usuário para criar a conta.");
        return;
      }

      if (!/^[a-z0-9_]{3,24}$/.test(username)) {
        setAuthError(
          "O usuário deve ter 3 a 24 caracteres, usando letras, números ou _.",
        );
        return;
      }

      if (!registerProfile.role) {
        setAuthError("Escolha sua área principal.");
        return;
      }

      if (registerProfile.interests.length === 0) {
        setAuthError("Escolha pelo menos um interesse.");
        return;
      }

      if (registerProfile.interests.length > REGISTER_MAX_INTERESTS) {
        setAuthError(`Escolha no máximo ${REGISTER_MAX_INTERESTS} interesses.`);
        return;
      }

      if (bio.length > 160) {
        setAuthError("A bio deve ter no máximo 160 caracteres.");
        return;
      }

      if (!registerProfile.acceptedTerms) {
        setAuthError("Confirme a criação do perfil público básico.");
        return;
      }

      if (password.length < 6) {
        setAuthError("A senha precisa ter pelo menos 6 caracteres.");
        return;
      }

      if (password !== confirmPassword) {
        setAuthError("As senhas não conferem.");
        return;
      }
    }

    setAuthLoading(true);

    try {
      // A mesma estrutura de formulario serve para duas rotas diferentes.
      const endpoint = authMode === "login" ? "login" : "register";
      const registerPayload = {
        email: email.trim(),
        password,
        name: registerProfile.name.trim(),
        username: normalizeUsername(registerProfile.username),
        role: registerProfile.role,
        bio: registerProfile.bio.trim(),
        interests: registerProfile.interests,
      };
      const payload =
        authMode === "login"
          ? { email: email.trim(), password }
          : registerPayload;
      const res = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setAuthError(data?.message ?? "Falha na autenticação.");
        return;
      }

      setToken(data?.access_token ?? "");
      setMe(data?.user ?? null);
      setPassword("");
      setConfirmPassword("");
      setRegisterProfile(REGISTER_PROFILE_INITIAL);
      setSelectedProfile(null);
      setProfileError("");
      setAuthMode("login");
      setCurrentView("home");
      await fetchPosts(data?.access_token ?? "");
    } catch {
      setAuthError("Não foi possível conectar ao backend.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Atalho de desenvolvimento:
  // 1. tenta entrar com a conta Dev,
  // 2. se nao existir, tenta cadastrar,
  // 3. se o cadastro disser que ja existe, tenta login novamente.
  const handleDevLogin = async () => {
    setAuthLoading(true);
    setAuthError("");
    setComposerNotice("");
    setEmail(DEV_ACCOUNT.email);
    setPassword(DEV_ACCOUNT.password);

    // Pequena funcao auxiliar para evitar repetir a mesma chamada de autenticacao.
    const tryAuth = async (endpoint) => {
      const res = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(DEV_ACCOUNT),
      });
      const data = await res.json().catch(() => ({}));
      return { res, data };
    };

    try {
      let { res, data } = await tryAuth("login");

      if (!res.ok) {
        const loginMessage = String(data?.message ?? "");
        const shouldTryRegister =
          res.status === 401 || /inv[aá]lid|credenciais/i.test(loginMessage);

        if (shouldTryRegister) {
          // Se a conta nao existe, tenta criacao automatica.
          const registerAttempt = await tryAuth("register");
          res = registerAttempt.res;
          data = registerAttempt.data;

          if (!res.ok) {
            // Se o cadastro falhar por duplicidade, significa que a conta ja existe e vale tentar login de novo.
            const duplicate = /já está em uso|already/i.test(
              String(data?.message ?? ""),
            );
            if (duplicate) {
              const secondLogin = await tryAuth("login");
              res = secondLogin.res;
              data = secondLogin.data;
            }
          }
        }
      }

      if (!res.ok) {
        setAuthError(
          data?.message ?? "Não foi possível entrar com a conta Dev.",
        );
        return;
      }

      setToken(data?.access_token ?? "");
      setMe(data?.user ?? null);
      setConfirmPassword("");
      setSelectedProfile(null);
      setProfileError("");
      setAuthMode("login");
      setCurrentView("home");
      await fetchPosts(data?.access_token ?? "");
    } catch {
      setAuthError("Não foi possível conectar ao backend para o login Dev.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Limpa os dados de sessao local e volta a interface ao estado inicial.
  const handleLogout = () => {
    setToken("");
    setMe(null);
    setPassword("");
    setConfirmPassword("");
    setRegisterProfile(REGISTER_PROFILE_INITIAL);
    setUserMenuOpen(false);
    setContent("");
    setComposerError("");
    setComposerNotice("");
    setSelectedProfile(null);
    setProfileError("");
    setActiveCommentsPostId("");
    setCommentsByPost({});
    setNotifications([]);
    setNotificationsError("");
    setNotificationsNotice("");
    setCurrentView("home");
  };

  // Funcoes pequenas para trocar de tela sem espalhar strings pela renderizacao.
  const openProfile = () => {
    setSelectedProfile(null);
    setProfileError("");
    setProfileLoading(false);
    setCurrentView("profile");
    setUserMenuOpen(false);
  };

  const openHome = () => {
    setSelectedProfile(null);
    setProfileError("");
    setCurrentView("home");
    setUserMenuOpen(false);
  };

  const openExplore = () => {
    setSelectedProfile(null);
    setProfileError("");
    setCurrentView("explore");
    setUserMenuOpen(false);
  };

  const openAlerts = () => {
    setSelectedProfile(null);
    setProfileError("");
    setCurrentView("alerts");
    setUserMenuOpen(false);
    setNotificationsNotice("");
    void fetchNotifications();
  };

  const openConversations = () => {
    setSelectedProfile(null);
    setProfileError("");
    setCurrentView("conversations");
    setUserMenuOpen(false);
  };

  const openSettings = () => {
    setSelectedProfile(null);
    setProfileError("");
    setCurrentView("settings");
    setUserMenuOpen(false);
  };

  const openPostDiscussion = (postId) => {
    if (!postId) return;

    setSelectedProfile(null);
    setProfileError("");
    setCurrentView("home");
    setActiveCommentsPostId(postId);
    setUserMenuOpen(false);

    const current = commentsByPost[postId];
    if (!current?.loaded && !current?.loading) {
      void loadCommentsForPost(postId);
    }
  };

  const handleUseComposerPrompt = (prompt) => {
    setSelectedProfile(null);
    setProfileError("");
    setCurrentView("home");
    setContent(prompt);
    setComposerError("");
    setComposerNotice("");
    window.requestAnimationFrame(() => composerInputRef.current?.focus());
  };

  const handleMarkNotificationRead = async (notificationId, quiet = false) => {
    if (!token || !notificationId) return;

    setNotificationsError("");
    if (!quiet) setNotificationsNotice("");

    try {
      const res = await fetch(
        `${API_BASE}/notifications/${notificationId}/read`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          setToken("");
          throw new Error("Sua sessão expirou. Faça login novamente.");
        }

        throw new Error(
          data?.message ?? "Não foi possível atualizar o alerta.",
        );
      }

      const updated = mapApiNotification(data);
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId ? updated : notification,
        ),
      );
      if (!quiet) setNotificationsNotice("Alerta marcado como lido.");
    } catch (error) {
      setNotificationsError(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o alerta.",
      );
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    if (!token || unreadNotificationsCount === 0) return;

    setNotificationsError("");
    setNotificationsNotice("");

    try {
      const res = await fetch(`${API_BASE}/notifications/read-all`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          setToken("");
          throw new Error("Sua sessão expirou. Faça login novamente.");
        }

        throw new Error(
          data?.message ?? "Não foi possível atualizar os alertas.",
        );
      }

      const readAt = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((notification) => ({
          ...notification,
          readAt: notification.readAt ?? readAt,
        })),
      );
      setNotificationsNotice("Todos os alertas foram marcados como lidos.");
    } catch (error) {
      setNotificationsError(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar os alertas.",
      );
    }
  };

  const handleOpenNotificationPost = (notification) => {
    if (!notification?.postId) return;

    setSelectedProfile(null);
    setProfileError("");
    setCurrentView("home");
    setActiveCommentsPostId(notification.postId);

    const current = commentsByPost[notification.postId];
    if (!current?.loaded && !current?.loading) {
      void loadCommentsForPost(notification.postId);
    }

    if (!notification.readAt) {
      void handleMarkNotificationRead(notification.id, true);
    }
  };

  const openUserProfile = async (post) => {
    const authorId = post?.authorId;
    if (!authorId) return;

    if (authorId === me?.id) {
      openProfile();
      return;
    }

    setCurrentView("profile");
    setUserMenuOpen(false);
    setSelectedProfile({
      id: authorId,
      email: post.authorEmail,
      name: post.name,
      username: post.handle?.replace(/^@/, ""),
      role: post.authorRole,
      createdAt: post.createdAt,
    });
    setProfileLoading(true);
    setProfileError("");

    try {
      const res = await fetch(`${API_BASE}/users/${authorId}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setProfileError(
          data?.message ?? "Não foi possível carregar este perfil.",
        );
        setSelectedProfile({
          id: authorId,
          email: post.authorEmail,
          name: post.name,
          username: post.handle?.replace(/^@/, ""),
          role: post.authorRole,
          createdAt: post.createdAt,
        });
        return;
      }

      setSelectedProfile(data?.user ?? null);
    } catch {
      setProfileError(
        "Backend indisponível. Não foi possível carregar este perfil.",
      );
      setSelectedProfile({
        id: authorId,
        email: post.authorEmail,
        name: post.name,
        username: post.handle?.replace(/^@/, ""),
        role: post.authorRole,
        createdAt: post.createdAt,
      });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleNotificationAuthorClick = (notification) => {
    openUserProfile({
      authorId: notification.actorId,
      authorEmail: notification.actorEmail,
      name: notification.actorName,
      handle: notification.actorHandle,
      createdAt: notification.createdAt,
    });
  };

  const switchAuthMode = (mode) => {
    setAuthMode(mode);
    setAuthError("");
    setPassword("");
    setConfirmPassword("");
  };

  const updateRegisterProfile = (field, value) => {
    setRegisterProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Publica um novo post no backend e adiciona o resultado ao topo do feed.
  const handleCreatePost = async () => {
    const text = content.trim();
    if (!text) {
      setComposerError("Escreva algo antes de postar.");
      setComposerNotice("");
      return;
    }

    if (!token) {
      setComposerError("Faça login para publicar.");
      setComposerNotice("");
      return;
    }

    setCreateLoading(true);
    setComposerError("");
    setComposerNotice("");

    try {
      // Envia apenas o conteudo digitado. O autor vem do token.
      const res = await fetch(`${API_BASE}/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          setToken("");
          setComposerError("Sua sessão expirou. Faça login novamente.");
          return;
        }

        setComposerError(data?.message ?? "Não foi possível publicar o post.");
        return;
      }

      setPosts((prev) => [mapApiPost(data), ...prev]);
      setContent("");
      setComposerNotice("Post publicado.");
    } catch {
      setComposerError("Backend indisponível. Não foi possível publicar.");
    } finally {
      setCreateLoading(false);
    }
  };

  // Atalho de teclado para publicar mais rapido com Cmd/Ctrl + Enter.
  const handleComposerKeyDown = (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      handleCreatePost();
    }
  };

  // Antes do login, o app inteiro mostra apenas a tela de autenticacao.
  if (!isLoggedIn) {
    return (
      <AuthScreen
        authMode={authMode}
        email={email}
        password={password}
        confirmPassword={confirmPassword}
        registerProfile={registerProfile}
        authError={authError}
        authLoading={authLoading}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onConfirmPasswordChange={setConfirmPassword}
        onRegisterProfileChange={updateRegisterProfile}
        onSubmit={handleAuth}
        onSwitchMode={switchAuthMode}
        onDevLogin={handleDevLogin}
        theme={resolvedTheme}
      />
    );
  }

  return (
    <div className="eureca-app" data-theme={resolvedTheme}>
      <div className="eureca-shell">
        {/* Barra superior com marca, navegacao principal e menu da conta. */}
        <header className="eureca-topbar">
          <div className="brand">
            <div className="brand-mark">
              <WaveMark />
            </div>
            <span className="brand-name">Eureca</span>
          </div>

          {/* Os itens de navegacao sao montados a partir de uma lista fixa. */}
          <nav className="main-nav" aria-label="Navegação principal">
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`nav-item ${item.view && currentView === item.view ? "is-active" : ""}`}
                onClick={() => {
                  if (item.view === "profile") openProfile();
                  if (item.view === "home") openHome();
                  if (item.view === "explore") openExplore();
                  if (item.view === "alerts") openAlerts();
                  if (item.view === "conversations") openConversations();
                  if (item.view === "settings") openSettings();
                }}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
                {item.view === "alerts" && unreadNotificationsCount > 0 ? (
                  <strong className="nav-badge">
                    {formatCount(unreadNotificationsCount)}
                  </strong>
                ) : null}
              </button>
            ))}
          </nav>

          {/* Menu da conta com acoes de perfil e logout. */}
          <div className="topbar-actions">
            <button
              type="button"
              className="new-wave-btn"
              title="Assinatura premium (visual)"
            >
              Eureca+
            </button>
            <div className="user-menu" ref={userMenuRef}>
              <button
                type="button"
                className="user-chip"
                aria-label="Abrir menu do perfil"
                aria-expanded={userMenuOpen}
                onClick={() => setUserMenuOpen((prev) => !prev)}
              >
                {userInitial}
              </button>

              {userMenuOpen ? (
                <div className="user-dropdown" role="menu">
                  <div className="user-dropdown-head">
                    <span className="user-dropdown-initial">{userInitial}</span>
                    <div>
                      <strong>{sessionName}</strong>
                      <small>{sessionHandle}</small>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="user-dropdown-item"
                    role="menuitem"
                    onClick={openProfile}
                  >
                    Perfil
                  </button>
                  <button
                    type="button"
                    className="user-dropdown-item danger"
                    role="menuitem"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="eureca-layout">
          {/* Coluna lateral com resumo do usuario, tendencias e sugestoes. */}
          <Sidebar
            latestMyPost={latestMyPost}
            latestMyPostPreview={latestMyPostPreview}
            me={me}
            trends={trends}
            suggestions={suggestions}
            onNewPost={openHome}
          />

          <section className="feed-column">
            {/* A coluna principal troca de conteudo conforme a "view" selecionada. */}
            {currentView === "profile" ? (
              <>
                {/* Tela de perfil: mostra dados basicos da conta e lista de posts do usuario. */}
                <div className="feed-head">
                  <h1>{isOwnProfile ? "Perfil" : "Perfil público"}</h1>
                </div>

                <section className="panel profile-page-card">
                  <div className="profile-cover" aria-hidden="true" />
                  <div className="profile-page-hero">
                    <div className="profile-page-avatar">
                      {profileInitial}
                      <span
                        className="profile-presence-dot"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="profile-page-meta">
                      <div className="profile-social-row">
                        <span className="profile-role-pill">
                          {profileUser?.role ?? "Membro da comunidade"}
                        </span>
                        <span className="profile-presence-pill">
                          {isOwnProfile ? "Online agora" : "Membro ativo"}
                        </span>
                      </div>
                      <h2>{profileName}</h2>
                      <p>{profileHandle}</p>
                      <div className="profile-meta-grid">
                        <span>
                          {isOwnProfile ? profileEmail : "Perfil público"}
                        </span>
                        <span>Criada em {profileCreatedAt}</span>
                        <span>
                          {profileUser?.id
                            ? `ID ${profileUser.id.slice(0, 8)}`
                            : "Conta autenticada"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="follow-btn profile-edit-btn"
                      onClick={openHome}
                    >
                      Voltar ao feed
                    </button>
                  </div>

                  <div className="profile-stats">
                    <div className="profile-stat">
                      <span>{profilePosts.length}</span>
                      <small>Posts</small>
                    </div>
                    <div className="profile-stat">
                      <span>{formatCount(totalProfileLikes)}</span>
                      <small>Curtidas</small>
                    </div>
                    <div className="profile-stat">
                      <span>{formatCount(totalProfileViews)}</span>
                      <small>Views</small>
                    </div>
                  </div>

                  <div className="profile-reputation">
                    <div className="profile-reputation-main">
                      <span className="profile-reputation-kicker">
                        Reputação
                      </span>
                      <h3>{profileCommunityProgress.currentLevel.label}</h3>
                      <p>{profileCommunityProgress.nextAction}</p>
                      <div
                        className="profile-level-track"
                        aria-label={`Progresso de nível: ${profileCommunityProgress.levelProgress}%`}
                      >
                        <span
                          style={{
                            width: `${profileCommunityProgress.levelProgress}%`,
                          }}
                        />
                      </div>
                      <small>
                        {profileCommunityProgress.nextLevel
                          ? `${formatCount(profileCommunityProgress.remainingScore)} pontos até ${profileCommunityProgress.nextLevel.label}`
                          : "Nível máximo desta etapa"}
                      </small>
                    </div>

                    <div className="profile-score-stack">
                      <div>
                        <strong>
                          {formatCount(profileCommunityProgress.score)}
                        </strong>
                        <span>score</span>
                      </div>
                      <div>
                        <strong>
                          {profileCommunityProgress.profileCompletion}%
                        </strong>
                        <span>perfil</span>
                      </div>
                    </div>

                    <div className="achievement-list">
                      {profileCommunityProgress.achievements.map(
                        (achievement) => (
                          <span
                            key={achievement.label}
                            className={
                              achievement.unlocked ? "is-unlocked" : ""
                            }
                          >
                            <strong>{achievement.label}</strong>
                            <small>{achievement.meta}</small>
                          </span>
                        ),
                      )}
                    </div>
                  </div>

                  {profileLoading ? (
                    <p className="profile-feedback">Carregando perfil...</p>
                  ) : null}
                  {profileError ? (
                    <p className="profile-feedback is-error">{profileError}</p>
                  ) : null}

                  <div className="profile-bio panel">
                    <div>
                      <h3>Sobre</h3>
                      <p>{profileBio}</p>
                    </div>
                    <div>
                      <h3>Interesses</h3>
                      {profileUser?.interests?.length ? (
                        <div className="profile-interest-list">
                          {profileUser.interests.map((interest) => (
                            <span key={interest}>{interest}</span>
                          ))}
                        </div>
                      ) : (
                        <p>Nenhum interesse adicionado ainda.</p>
                      )}
                    </div>
                  </div>
                </section>

                <div className="section-title-row">
                  <h3>
                    {isOwnProfile ? "Seus posts" : `Posts de ${profileName}`}
                  </h3>
                  <button
                    type="button"
                    className="mini-link-btn"
                    onClick={() => fetchPosts()}
                  >
                    Atualizar
                  </button>
                </div>

                <div className="post-list">
                  {postsLoading ? (
                    <div className="panel post-card empty-state">
                      Carregando posts...
                    </div>
                  ) : null}

                  {!postsLoading && profilePosts.length === 0 ? (
                    <div className="panel post-card empty-state">
                      {isOwnProfile
                        ? "Você ainda não publicou nada. Volte ao feed e faça seu primeiro post."
                        : "Este usuário ainda não tem posts visíveis no feed carregado."}
                    </div>
                  ) : null}

                  {profilePosts.map((post) => (
                    <PostCard
                      key={post.id ?? `${post.handle}-${post.time}`}
                      post={post}
                      onAuthorClick={openUserProfile}
                    />
                  ))}
                </div>
              </>
            ) : currentView === "explore" ? (
              <>
                <div className="feed-head">
                  <h1>Explorar</h1>
                </div>

                <section className="panel explore-hero">
                  <div className="explore-hero-main">
                    <span className="explore-kicker">Descoberta</span>
                    <h2>
                      {exploreQuery
                        ? `Resultados para "${exploreQuery}"`
                        : "Encontre conversas, tópicos e pessoas"}
                    </h2>
                    <p>
                      {exploreData.totalMatches > 0
                        ? `${formatCount(exploreData.totalMatches)} itens encontrados no feed atual.`
                        : "Nenhum resultado encontrado no feed atual."}
                    </p>
                  </div>

                  <div className="explore-search-panel">
                    <label className="explore-search">
                      <Icon name="compass" />
                      <input
                        type="search"
                        value={exploreQuery}
                        onChange={(event) =>
                          setExploreQuery(event.target.value)
                        }
                        placeholder="Buscar posts, tópicos ou pessoas"
                        aria-label="Buscar no Explorar"
                      />
                      {exploreQuery ? (
                        <button
                          type="button"
                          onClick={() => setExploreQuery("")}
                        >
                          Limpar
                        </button>
                      ) : null}
                    </label>

                    <div
                      className="explore-filter-row"
                      aria-label="Filtros do Explorar"
                    >
                      {EXPLORE_FILTERS.map((filter) => (
                        <button
                          key={filter.value}
                          type="button"
                          className={
                            exploreFilter === filter.value ? "is-active" : ""
                          }
                          aria-pressed={exploreFilter === filter.value}
                          onClick={() => setExploreFilter(filter.value)}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="explore-metrics">
                    <div>
                      <strong>{formatCount(exploreData.posts.length)}</strong>
                      <span>posts</span>
                    </div>
                    <div>
                      <strong>{formatCount(exploreData.topics.length)}</strong>
                      <span>tópicos</span>
                    </div>
                    <div>
                      <strong>{formatCount(exploreData.people.length)}</strong>
                      <span>pessoas</span>
                    </div>
                  </div>
                </section>

                <div className="explore-grid">
                  {exploreFilter !== "people" ? (
                    <section className="panel explore-section-card is-wide">
                      <div className="section-title-row">
                        <h3>Posts em destaque</h3>
                        <button
                          type="button"
                          className="mini-link-btn"
                          onClick={() => fetchPosts()}
                        >
                          Atualizar
                        </button>
                      </div>

                      <div className="explore-post-list">
                        {postsLoading ? (
                          <div className="explore-empty">
                            Carregando posts...
                          </div>
                        ) : null}

                        {!postsLoading && exploreData.posts.length === 0 ? (
                          <div className="explore-empty">
                            Nenhum post encontrado.
                          </div>
                        ) : null}

                        {exploreData.posts.slice(0, 8).map((post, index) => (
                          <button
                            key={post.id ?? `${post.handle}-${post.createdAt}`}
                            type="button"
                            className="explore-post-item"
                            onClick={() => openPostDiscussion(post.id)}
                          >
                            <span className="explore-post-rank">
                              {index + 1}
                            </span>
                            <div className="explore-post-body">
                              <div className="explore-post-line">
                                <strong>{post.name}</strong>
                                <span>{post.handle}</span>
                                {post.authorBadge ? (
                                  <em>{post.authorBadge.label}</em>
                                ) : null}
                              </div>
                              <p>{truncateText(post.text, 140)}</p>
                              <div className="explore-post-stats">
                                <span>
                                  {formatCount(post.counts?.replies)}{" "}
                                  comentários
                                </span>
                                <span>
                                  {formatCount(post.counts?.likes)} curtidas
                                </span>
                                <span>
                                  {formatCount(post.counts?.views)} views
                                </span>
                                <strong>{formatCount(post.score)} score</strong>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  <section className="panel explore-section-card">
                    <div className="section-title-row">
                      <h3>Tópicos</h3>
                      <span className="explore-count-pill">
                        {formatCount(exploreData.topics.length)}
                      </span>
                    </div>

                    <div className="explore-topic-list">
                      {exploreData.topics.length === 0 ? (
                        <div className="explore-empty">
                          Nenhum tópico encontrado.
                        </div>
                      ) : null}

                      {exploreData.topics.map((trend, index) => (
                        <button
                          key={trend.title}
                          type="button"
                          className="explore-topic-item"
                          onClick={() => {
                            setExploreQuery(trend.title.replace(/^#/, ""));
                            setExploreFilter("all");
                          }}
                        >
                          <span>{index + 1}</span>
                          <div>
                            <strong>{trend.title}</strong>
                            <small>{trend.category}</small>
                          </div>
                          <em>{trend.posts}</em>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="panel explore-section-card">
                    <div className="section-title-row">
                      <h3>Pessoas</h3>
                      <span className="explore-count-pill">
                        {formatCount(exploreData.people.length)}
                      </span>
                    </div>

                    <div className="explore-people-list">
                      {exploreData.people.length === 0 ? (
                        <div className="explore-empty">
                          Nenhuma pessoa encontrada.
                        </div>
                      ) : null}

                      {exploreData.people.slice(0, 8).map((person) => (
                        <div key={person.handle} className="explore-person">
                          <div className="explore-person-avatar">
                            {person.initials}
                            <span
                              className={`follow-status-dot is-${person.status}`}
                              aria-hidden="true"
                            />
                          </div>
                          <div className="explore-person-meta">
                            <div className="follow-name-row">
                              <strong>{person.name}</strong>
                              <span className="follow-badge">
                                {person.badge}
                              </span>
                            </div>
                            <span>{person.handle}</span>
                            <small>{person.context}</small>
                          </div>
                          <button
                            type="button"
                            className="mini-link-btn"
                            onClick={() =>
                              person.post ? openUserProfile(person.post) : null
                            }
                            disabled={!person.post}
                          >
                            {person.post ? "Ver perfil" : "Em breve"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </>
            ) : currentView === "alerts" ? (
              <>
                <div className="feed-head">
                  <h1>Alertas</h1>
                </div>

                <NotificationsPanel
                  notifications={notifications}
                  loading={notificationsLoading}
                  error={notificationsError}
                  notice={notificationsNotice}
                  unreadCount={unreadNotificationsCount}
                  onRefresh={() => fetchNotifications()}
                  onMarkAllRead={handleMarkAllNotificationsRead}
                  onMarkRead={handleMarkNotificationRead}
                  onOpenPost={handleOpenNotificationPost}
                  onAuthorClick={handleNotificationAuthorClick}
                />
              </>
            ) : currentView === "conversations" ? (
              <>
                {/* Tela de conversas: ainda mockada, mas ja organizada em lista + conversa ativa. */}
                <div className="feed-head">
                  <h1>Conversas</h1>
                </div>

                <section className="panel chat-page-card">
                  <aside
                    className="chat-list-panel"
                    aria-label="Lista de conversas"
                  >
                    <div className="chat-list-head">
                      <h2>Pessoas</h2>
                      <small>1 conversa disponível</small>
                    </div>

                    <div className="chat-list">
                      <button
                        type="button"
                        className={`chat-list-item ${
                          selectedConversationId === CHAT_BOT_CONTACT.id
                            ? "is-active"
                            : ""
                        }`}
                        onClick={() =>
                          setSelectedConversationId(CHAT_BOT_CONTACT.id)
                        }
                      >
                        <div className="chat-avatar">
                          {CHAT_BOT_CONTACT.initials}
                        </div>
                        <div className="chat-item-meta">
                          <div className="chat-item-row">
                            <strong>{CHAT_BOT_CONTACT.name}</strong>
                            <span>
                              {CHAT_BOT_MESSAGES.at(-1)?.time ?? "--:--"}
                            </span>
                          </div>
                          <div className="chat-item-row muted">
                            <span>{CHAT_BOT_CONTACT.handle}</span>
                            <p>{CHAT_BOT_CONTACT.preview}</p>
                          </div>
                        </div>
                      </button>
                    </div>
                  </aside>

                  <section
                    className="chat-thread-panel"
                    aria-label="Conversa ativa"
                  >
                    {selectedConversationId === CHAT_BOT_CONTACT.id ? (
                      <>
                        <header className="chat-thread-head">
                          <div className="chat-avatar is-large">
                            {CHAT_BOT_CONTACT.initials}
                          </div>
                          <div>
                            <strong>{CHAT_BOT_CONTACT.name}</strong>
                            <p>
                              {CHAT_BOT_CONTACT.status === "online"
                                ? "Online"
                                : "Offline"}
                            </p>
                          </div>
                        </header>

                        <div className="chat-thread-body">
                          {CHAT_BOT_MESSAGES.map((message) => (
                            <div
                              key={message.id}
                              className={`chat-bubble-row ${
                                message.sender === "me" ? "is-me" : "is-bot"
                              }`}
                            >
                              <div className="chat-bubble">
                                <p>{message.text}</p>
                                <span>{message.time}</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="chat-thread-composer">
                          <input
                            type="text"
                            placeholder="Escreva uma mensagem (mock por enquanto)"
                            disabled
                          />
                          <button type="button" disabled>
                            Enviar
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="chat-thread-empty">
                        <p>Selecione uma conversa para começar.</p>
                      </div>
                    )}
                  </section>
                </section>
              </>
            ) : currentView === "settings" ? (
              <>
                <div className="feed-head">
                  <h1>Ajustes</h1>
                </div>

                <section className="settings-page">
                  <div className="panel settings-account-card">
                    <div className="settings-account-main">
                      <div className="settings-account-avatar">
                        {userInitial}
                      </div>
                      <div>
                        <div className="profile-social-row">
                          <span className="profile-role-pill">
                            {me?.role ?? "Membro da comunidade"}
                          </span>
                          <span className="profile-presence-pill">
                            Online agora
                          </span>
                        </div>
                        <h2>{sessionName}</h2>
                        <p>{sessionHandle}</p>
                      </div>
                    </div>
                    <div className="settings-account-actions">
                      <button
                        type="button"
                        className="follow-btn"
                        onClick={openProfile}
                      >
                        Abrir perfil
                      </button>
                      <button
                        type="button"
                        className="settings-danger-btn"
                        onClick={handleLogout}
                      >
                        Sair
                      </button>
                    </div>
                  </div>

                  <div className="settings-grid">
                    <section className="panel settings-section-card">
                      <div className="settings-section-head">
                        <h2>Conta</h2>
                        <span>Perfil público</span>
                      </div>
                      <div className="settings-list">
                        <div className="settings-row">
                          <div>
                            <strong>E-mail</strong>
                            <span>{me?.email ?? sessionEmail}</span>
                          </div>
                        </div>
                        <div className="settings-row">
                          <div>
                            <strong>Usuário</strong>
                            <span>{sessionHandle}</span>
                          </div>
                        </div>
                        <div className="settings-row">
                          <div>
                            <strong>Interesses</strong>
                            <span>
                              {me?.interests?.length
                                ? `${me.interests.length} selecionados`
                                : "Nenhum selecionado"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="panel settings-section-card">
                      <div className="settings-section-head">
                        <h2>Preferências</h2>
                        <span>Experiência</span>
                      </div>
                      <div className="settings-list">
                        <div className="settings-row">
                          <div>
                            <strong>Aparência</strong>
                            <span>{themeSummary}</span>
                          </div>
                          <div
                            className="settings-choice-group"
                            aria-label="Selecionar aparência"
                          >
                            {THEME_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                className={
                                  themePreference === option.value
                                    ? "is-selected"
                                    : ""
                                }
                                aria-pressed={themePreference === option.value}
                                onClick={() => setThemePreference(option.value)}
                              >
                                <span
                                  className={`theme-option-dot is-${option.value}`}
                                  aria-hidden="true"
                                />
                                <span>{option.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="settings-row">
                          <div>
                            <strong>Alertas</strong>
                            <span>
                              {formatCount(unreadNotificationsCount)} não lidos
                            </span>
                          </div>
                          <button
                            type="button"
                            className="mini-link-btn"
                            onClick={openAlerts}
                          >
                            Ver alertas
                          </button>
                        </div>
                      </div>
                    </section>

                    <section className="panel settings-section-card">
                      <div className="settings-section-head">
                        <h2>Reputação</h2>
                        <span>Progresso</span>
                      </div>
                      <div className="settings-list">
                        <div className="settings-row">
                          <div>
                            <strong>Score da comunidade</strong>
                            <span>
                              {communityProgress.currentLevel.label} ·{" "}
                              {formatCount(communityProgress.score)} pontos
                            </span>
                          </div>
                          <span className="settings-status-pill">
                            {communityProgress.profileCompletion}% perfil
                          </span>
                        </div>
                        <div className="settings-row">
                          <div>
                            <strong>Próximo passo</strong>
                            <span>{communityProgress.nextAction}</span>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="panel settings-section-card is-wide">
                      <div className="settings-section-head">
                        <h2>Sessão</h2>
                        <span>Dispositivo atual</span>
                      </div>
                      <div className="settings-list">
                        <div className="settings-row">
                          <div>
                            <strong>Status</strong>
                            <span>Conectado como {sessionHandle}</span>
                          </div>
                          <span className="settings-status-pill">Ativa</span>
                        </div>
                        <div className="settings-row">
                          <div>
                            <strong>Conta</strong>
                            <span>
                              Criada em{" "}
                              {me?.createdAt
                                ? new Date(me.createdAt).toLocaleDateString(
                                    "pt-BR",
                                  )
                                : "Sessão atual"}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="settings-danger-btn"
                            onClick={handleLogout}
                          >
                            Encerrar sessão
                          </button>
                        </div>
                      </div>
                    </section>
                  </div>
                </section>
              </>
            ) : (
              <>
                {/* Tela principal do feed com composer e lista de posts. */}
                <div className="feed-head">
                  <h1>Início</h1>
                  <div className="feed-tabs">
                    <button type="button" className="feed-tab is-active">
                      Pra você
                    </button>
                    <button type="button" className="feed-tab">
                      Seguindo
                    </button>
                  </div>
                </div>

                <section
                  className={`panel composer-card ${composerHasContent ? "has-content" : ""}`}
                >
                  {/* Area onde o usuario escreve um novo post. */}
                  <div className="composer-head">
                    <div>
                      <span className="composer-kicker">Novo post</span>
                      <h2>Compartilhe com a comunidade</h2>
                    </div>
                    <span className="composer-shortcut">Ctrl + Enter</span>
                  </div>
                  <div className="composer-top">
                    <div className="composer-avatar">{userInitial}</div>
                    <div className="composer-main">
                      <textarea
                        ref={composerInputRef}
                        className="composer-input"
                        placeholder="Escreva uma ideia, pergunta ou progresso..."
                        value={content}
                        onChange={(event) => {
                          setContent(event.target.value);
                          if (composerError) setComposerError("");
                          if (composerNotice) setComposerNotice("");
                        }}
                        onKeyDown={handleComposerKeyDown}
                        maxLength={280}
                      />
                      <div
                        className="composer-prompts"
                        aria-label="Sugestões rápidas"
                      >
                        {COMPOSER_PROMPTS.map((prompt) => (
                          <button
                            key={prompt.label}
                            type="button"
                            onClick={() => handleUseComposerPrompt(prompt.text)}
                          >
                            {prompt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="composer-bottom">
                    <div className="composer-tools">
                      {COMPOSER_TOOLS.map((tool) => (
                        <button
                          key={tool.label}
                          type="button"
                          title={`${tool.label} em breve`}
                          disabled
                        >
                          <Icon name={tool.icon} />
                          <span>{tool.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="composer-actions">
                      <span
                        className={`composer-counter ${
                          content.length >= 260
                            ? "is-max"
                            : content.length >= 230
                              ? "is-warn"
                              : ""
                        }`}
                      >
                        {content.length}/280
                      </span>
                      <button
                        type="button"
                        className={`post-btn ${composerHasContent ? "is-ready" : ""}`}
                        onClick={handleCreatePost}
                        disabled={createLoading || !composerHasContent}
                      >
                        {createLoading ? "Postando..." : "Postar agora"}
                      </button>
                    </div>
                  </div>
                  {composerError ? (
                    <p className="composer-feedback is-error">
                      {composerError}
                    </p>
                  ) : null}
                  {composerNotice ? (
                    <p className="composer-feedback is-success">
                      {composerNotice}
                    </p>
                  ) : null}
                </section>

                {feedError ? (
                  <p className="feed-feedback is-error">{feedError}</p>
                ) : null}

                <section className="panel feed-context-card">
                  <div className="feed-context-main">
                    <span className="feed-context-kicker">Feed contextual</span>
                    <h2>
                      {feedOverview.activeDiscussions > 0
                        ? "Há discussões para entrar agora"
                        : "Novas publicações para descobrir"}
                    </h2>
                    <p>
                      {feedOverview.topPost
                        ? `Em destaque: ${truncateText(feedOverview.topPost.text, 92)}`
                        : "Quando houver mais atividade, este bloco destaca conversas e temas relevantes."}
                    </p>
                  </div>
                  <div className="feed-context-metrics">
                    <div>
                      <strong>{formatCount(posts.length)}</strong>
                      <span>posts</span>
                    </div>
                    <div>
                      <strong>
                        {formatCount(feedOverview.activeDiscussions)}
                      </strong>
                      <span>discussões</span>
                    </div>
                    <div>
                      <strong>{formatCount(feedOverview.views)}</strong>
                      <span>views</span>
                    </div>
                  </div>
                </section>

                {/* Lista do feed, incluindo estados de carregamento e vazio. */}
                <div className="post-list">
                  {postsLoading ? (
                    <div className="panel post-card empty-state">
                      Carregando posts...
                    </div>
                  ) : null}

                  {!postsLoading && posts.length === 0 ? (
                    <div className="panel post-card empty-state">
                      Nenhum post ainda. Seja o primeiro a publicar.
                    </div>
                  ) : null}

                  {posts.map((post, index) => (
                    <div
                      key={post.id ?? `${post.handle}-${post.time}`}
                      className="feed-item-block"
                    >
                      {index === 0 ? (
                        <div className="feed-separator">
                          <span>Mais recentes</span>
                          <strong>Atualizado pelo feed da comunidade</strong>
                        </div>
                      ) : null}

                      {index === feedOverview.firstDiscussionIndex &&
                      feedOverview.firstDiscussionIndex > 0 ? (
                        <div className="feed-separator is-accent">
                          <span>Discussões em andamento</span>
                          <strong>Posts com comentários para participar</strong>
                        </div>
                      ) : null}

                      {index === feedOverview.continueIndex &&
                      index !== feedOverview.firstDiscussionIndex ? (
                        <div className="feed-separator">
                          <span>Continue explorando</span>
                          <strong>Mais publicações da rede</strong>
                        </div>
                      ) : null}

                      <PostCard
                        post={post}
                        interactive
                        feedContext={getPostFeedContext(post, index)}
                        onToggleLike={handleToggleLike}
                        onToggleComments={handleToggleComments}
                        onViewed={handlePostViewed}
                        onAuthorClick={openUserProfile}
                        commentsOpen={activeCommentsPostId === post.id}
                        commentPreviewLoading={Boolean(
                          commentsByPost[post.id]?.previewLoading,
                        )}
                        commentPreview={(commentsByPost[post.id]?.items ?? [])
                          .filter((comment) => !comment.parentCommentId)
                          .slice(0, 2)}
                      >
                        {activeCommentsPostId === post.id ? (
                          <CommentsPanel
                            post={post}
                            state={commentsByPost[post.id]}
                            draft={commentsByPost[post.id]?.draft ?? ""}
                            userInitial={userInitial}
                            maxLength={COMMENT_MAX_LENGTH}
                            currentUserId={me?.id ?? ""}
                            onDraftChange={(draft) =>
                              updateCommentDraft(post.id, draft)
                            }
                            onSubmit={() => handleCreateComment(post.id)}
                            onRefresh={() => loadCommentsForPost(post.id)}
                            onLoadMore={() =>
                              loadCommentsForPost(post.id, { append: true })
                            }
                            onLoadReplies={(commentId) =>
                              loadRepliesForComment(post.id, commentId)
                            }
                            onAuthorClick={openUserProfile}
                            onReply={(commentId) =>
                              handleReplyToComment(post.id, commentId)
                            }
                            onCancelReply={() => handleCancelReply(post.id)}
                            onDelete={(commentId) =>
                              handleDeleteComment(post.id, commentId)
                            }
                          />
                        ) : null}
                      </PostCard>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <RightRail
            posts={posts}
            trends={trends}
            communityProgress={communityProgress}
            unreadNotificationsCount={unreadNotificationsCount}
            onOpenDiscussion={openPostDiscussion}
            onUsePrompt={handleUseComposerPrompt}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
