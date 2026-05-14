import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppTopbar from "./components/AppTopbar";
import AuthScreen from "./components/AuthScreen";
import RightRail from "./components/RightRail";
import Sidebar from "./components/Sidebar";
import { authenticate } from "./api/auth";
import {
  createPostComment,
  deleteComment,
  fetchPostComments,
} from "./api/comments";
import {
  createConversationApi,
  fetchConversationMessagesApi,
  fetchConversationsApi,
  markConversationReadApi,
  sendConversationMessageApi,
} from "./api/conversations";
import {
  fetchNotificationsApi,
  markAllNotificationsRead,
  markNotificationRead,
} from "./api/notifications";
import {
  createPost,
  deletePostApi,
  fetchFeedPosts,
  fetchTrendsApi,
  registerPostView,
  reportPostApi,
  togglePostLike,
} from "./api/posts";
import { connectConversationsSocket } from "./api/realtime";
import { uploadImage } from "./api/uploads";
import {
  activateEurecaPlus,
  cancelEurecaPlus,
  fetchFollowSuggestionsApi,
  fetchMeApi,
  fetchUser,
  fetchUserFollowersApi,
  fetchUserFollowingApi,
  toggleUserFollowApi,
} from "./api/users";
import { DEV_ACCOUNT, REGISTER_MAX_INTERESTS } from "./constants/uiData";
import {
  COMMENT_MAX_LENGTH,
  COMMENT_PREVIEW_PAGE_SIZE,
  COMMENT_PREVIEW_POST_LIMIT,
  COMMENT_REPLY_PAGE_SIZE,
  COMMENT_ROOT_PAGE_SIZE,
  REGISTER_PROFILE_INITIAL,
} from "./features/app/appConstants";
import {
  adjustCommentRepliesCount,
  getCommunityProgress,
  getDiscoveryScore,
  getPostImageValidationError,
  loadViewedPostIds,
  mergeCommentItems,
  normalizeExploreText,
  normalizeUsername,
  removeCommentBranch,
  saveViewedPostIds,
} from "./features/app/appHelpers";
import { useThemePreference } from "./hooks/useThemePreference";
import AlertsView from "./views/AlertsView";
import ConversationsView from "./views/ConversationsView";
import ExploreView from "./views/ExploreView";
import EurecaPlusView from "./views/EurecaPlusView";
import HomeView from "./views/HomeView";
import ProfileView from "./views/ProfileView";
import SettingsView from "./views/SettingsView";
import {
  emailToInitials,
  formatCount,
  mapApiConversation,
  mapApiComment,
  mapApiMessage,
  mapApiNotification,
  mapApiPost,
  mapApiSuggestion,
  mapApiTrend,
  truncateText,
} from "./utils/formatters";
import "./App.css";

const CONVERSATION_LIST_POLL_MS = 12000;
const ACTIVE_CONVERSATION_POLL_MS = 5000;
const REPORT_REASONS = [
  {
    value: "Conteúdo impróprio no contexto acadêmico",
    description: "Linguagem, imagem ou abordagem inadequada para a comunidade.",
  },
  {
    value: "Conteúdo sexual sem fundamento acadêmico",
    description:
      "Material sexualizado sem relevância para estudo, pesquisa ou debate.",
  },
  {
    value: "Assédio, humilhação ou ataque pessoal",
    description: "Ataques a estudantes, docentes, investigadores ou grupos.",
  },
  {
    value: "Plágio ou uso indevido de trabalho acadêmico",
    description: "Apropriação de texto, imagem, dados ou autoria sem crédito.",
  },
  {
    value: "Desinformação científica ou acadêmica",
    description:
      "Afirmações enganosas apresentadas como conhecimento validado.",
  },
  {
    value: "Spam, autopromoção ou conteúdo fora do tema",
    description: "Publicação repetitiva, irrelevante ou puramente promocional.",
  },
];
const TREND_STOP_WORDS = new Set([
  "a",
  "agora",
  "ao",
  "as",
  "com",
  "da",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "eu",
  "mais",
  "meu",
  "minha",
  "no",
  "nos",
  "o",
  "os",
  "para",
  "por",
  "que",
  "se",
  "um",
  "uma",
]);

function normalizeTopicLabel(value) {
  return String(value ?? "")
    .replace(/^#/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildFeedTrends(posts) {
  const topics = new Map();

  posts.forEach((post) => {
    const text = post.text ?? "";
    const foundInPost = new Set();
    const addTopic = (rawTitle, category = "Feed") => {
      const label = normalizeTopicLabel(rawTitle);
      if (label.length < 3) return;

      const key = label.toLowerCase();
      if (foundInPost.has(key)) return;
      foundInPost.add(key);

      const current = topics.get(key) ?? {
        title: `#${label.replace(/\s+/g, "")}`,
        category,
        postsCount: 0,
        score: 0,
        latestAt: post.createdAt,
      };
      const score =
        Number(post.counts?.replies ?? 0) * 6 +
        Number(post.counts?.likes ?? 0) * 3 +
        Number(post.counts?.views ?? 0) +
        1;

      current.postsCount += 1;
      current.score += score;
      if (String(post.createdAt ?? "") > String(current.latestAt ?? "")) {
        current.latestAt = post.createdAt;
      }
      topics.set(key, current);
    };

    for (const match of text.matchAll(/#[\p{L}\p{N}_-]+/gu)) {
      addTopic(match[0], "Hashtag");
    }

    if (post.authorBadge?.label && post.authorBadge.label !== "Membro") {
      addTopic(post.authorBadge.label, "Perfil");
    }

    text
      .match(/[\p{L}\p{N}][\p{L}\p{N}_-]{3,}/gu)
      ?.slice(0, 18)
      .forEach((word) => {
        const normalized = word.toLowerCase();
        if (!TREND_STOP_WORDS.has(normalized)) {
          addTopic(word, "Conversa");
        }
      });
  });

  return [...topics.values()]
    .filter((topic) => topic.postsCount > 1 || topic.category !== "Conversa")
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return String(right.latestAt ?? "").localeCompare(
        String(left.latestAt ?? ""),
      );
    })
    .slice(0, 4)
    .map((topic) => ({
      ...topic,
      posts: `${formatCount(topic.postsCount)} ${
        topic.postsCount === 1 ? "post" : "posts"
      }`,
    }));
}

function mergeMessagesById(items, message) {
  const byId = new Map();
  [...(items ?? []), message].forEach((item) => {
    if (item?.id) byId.set(item.id, item);
  });

  return [...byId.values()].sort(
    (left, right) =>
      new Date(left.createdAt ?? 0).getTime() -
      new Date(right.createdAt ?? 0).getTime(),
  );
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
  const [profileSocial, setProfileSocial] = useState({
    followers: [],
    following: [],
    loading: false,
    error: "",
  });
  const { resolvedTheme, themePreference, themeSummary, setThemePreference } =
    useThemePreference();

  // Estados do feed, criacao de posts e feedbacks visuais para o usuario.
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [feedMode, setFeedMode] = useState("for-you");
  const [content, setContent] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [composerImage, setComposerImage] = useState(null);
  const [imageUploadLoading, setImageUploadLoading] = useState(false);
  const [composerError, setComposerError] = useState("");
  const [composerNotice, setComposerNotice] = useState("");
  const [activeCommentsPostId, setActiveCommentsPostId] = useState("");
  const [commentsByPost, setCommentsByPost] = useState({});
  const [reportDialog, setReportDialog] = useState({
    postId: "",
    selectedReason: REPORT_REASONS[0].value,
    loading: false,
    error: "",
  });
  const [exploreQuery, setExploreQuery] = useState("");
  const [exploreFilter, setExploreFilter] = useState("all");
  const [liveTrends, setLiveTrends] = useState([]);
  const [followSuggestions, setFollowSuggestions] = useState([]);
  const [followActionUserId, setFollowActionUserId] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [notificationsNotice, setNotificationsNotice] = useState("");
  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [conversationsError, setConversationsError] = useState("");
  const [activeConversationId, setActiveConversationId] = useState("");
  const [conversationMessagesById, setConversationMessagesById] = useState({});
  const [conversationStarting, setConversationStarting] = useState(false);
  const [conversationSocketConnected, setConversationSocketConnected] =
    useState(false);
  const userMenuRef = useRef(null);
  const composerInputRef = useRef(null);
  const composerImageInputRef = useRef(null);
  const imageUploadIdRef = useRef(0);
  const viewedPostIdsRef = useRef(null);
  const conversationsPollInFlightRef = useRef(false);
  const activeMessagesPollInFlightRef = useRef(false);
  const activeConversationIdRef = useRef("");
  const currentUserIdRef = useRef("");

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
  const composerHasImage = Boolean(composerImage);
  const composerCanPost =
    composerHasContent &&
    !imageUploadLoading &&
    (!composerImage || Boolean(composerImage.imageUrl));
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
  const resolvedTrends = useMemo(() => {
    if (liveTrends.length) return liveTrends;
    return buildFeedTrends(posts);
  }, [liveTrends, posts]);
  const resolvedFollowSuggestions = useMemo(() => {
    const byId = new Map();

    posts.forEach((post) => {
      if (!post.authorId || post.authorId === me?.id) return;

      const current = byId.get(post.authorId) ?? {
        id: post.authorId,
        initials: post.initials,
        name: post.name,
        handle: post.handle,
        badge: post.authorBadge?.label ?? post.authorRole ?? "Membro",
        context: "",
        mutual: "",
        status: "active",
        followersCount: 0,
        postsCount: 0,
        following: false,
        score: 0,
        post,
        user: {
          id: post.authorId,
          email: post.authorEmail,
          name: post.name,
          username: post.handle?.replace(/^@/, ""),
          role: post.authorRole,
          createdAt: post.createdAt,
        },
      };

      current.postsCount += 1;
      current.score += getDiscoveryScore(post);
      current.context = truncateText(post.text, 72);
      current.mutual = `${formatCount(current.postsCount)} ${
        current.postsCount === 1 ? "post" : "posts"
      } no feed`;
      byId.set(post.authorId, current);
    });

    followSuggestions.forEach((person) => {
      if (!person.id || person.id === me?.id) return;

      const current = byId.get(person.id);
      byId.set(person.id, {
        ...person,
        post: current?.post ?? person.post ?? null,
        score: Number(current?.score ?? person.score ?? 0),
        postsCount: Number(current?.postsCount ?? person.postsCount ?? 0),
        context: current?.context || person.context,
        mutual: current?.mutual || person.mutual,
      });
    });

    return [...byId.values()]
      .sort((left, right) => {
        if (Boolean(right.post) !== Boolean(left.post)) {
          return right.post ? 1 : -1;
        }

        return Number(right.score ?? 0) - Number(left.score ?? 0);
      })
      .slice(0, 3);
  }, [followSuggestions, me?.id, posts]);
  const unreadNotificationsCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications],
  );
  const activeConversation =
    conversations.find(
      (conversation) => conversation.id === activeConversationId,
    ) ?? null;
  const activeConversationState =
    conversationMessagesById[activeConversationId] ?? {};
  const conversationCandidates = useMemo(() => {
    const byAuthorId = new Map();

    posts.forEach((post) => {
      if (!post.authorId || post.authorId === me?.id) return;

      const current = byAuthorId.get(post.authorId);
      if (current) {
        current.postsCount += 1;
        current.latestPost = current.latestPost ?? post;
        return;
      }

      byAuthorId.set(post.authorId, {
        id: post.authorId,
        name: post.name,
        handle: post.handle,
        email: post.authorEmail,
        initials: post.initials,
        role: post.authorRole || post.authorBadge?.label || "Membro",
        context: truncateText(post.text, 72),
        postsCount: 1,
        latestPost: post,
      });
    });

    return [...byAuthorId.values()].sort((left, right) =>
      String(right.latestPost?.createdAt ?? "").localeCompare(
        String(left.latestPost?.createdAt ?? ""),
      ),
    );
  }, [me?.id, posts]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    currentUserIdRef.current = me?.id ?? "";
  }, [me?.id]);

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
    const topicMatches = resolvedTrends.filter((trend) =>
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

    [...authorMap.values(), ...resolvedFollowSuggestions].forEach((person) => {
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
  }, [
    exploreFilter,
    exploreQuery,
    posts,
    resolvedFollowSuggestions,
    resolvedTrends,
  ]);
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
    async (authToken = token, mode = feedMode) => {
      const safeToken = typeof authToken === "string" ? authToken : token;
      const safeMode =
        mode === "following" && safeToken ? "following" : "for-you";
      setPostsLoading(true);
      setFeedError("");

      try {
        const result = await fetchFeedPosts(safeToken, safeMode);

        if (!result.ok) {
          setFeedError(
            result.data?.message ?? "Não foi possível carregar o feed.",
          );
          setPosts([]);
          return;
        }

        setPosts(Array.isArray(result.data) ? result.data.map(mapApiPost) : []);
      } catch {
        setFeedError("Backend indisponível. Inicie a API para carregar posts.");
        setPosts([]);
      } finally {
        setPostsLoading(false);
      }
    },
    [feedMode, token],
  );

  const fetchTrends = useCallback(async () => {
    try {
      const result = await fetchTrendsApi();

      if (!result.ok) {
        setLiveTrends([]);
        return;
      }

      const nextTrends = Array.isArray(result.data)
        ? result.data.map(mapApiTrend)
        : [];
      setLiveTrends(nextTrends);
    } catch {
      setLiveTrends([]);
    }
  }, []);

  const fetchFollowSuggestions = useCallback(
    async (authToken = token) => {
      const safeToken = typeof authToken === "string" ? authToken : token;

      if (!safeToken) {
        setFollowSuggestions([]);
        return;
      }

      try {
        const result = await fetchFollowSuggestionsApi(safeToken);

        if (!result.ok) {
          setFollowSuggestions([]);
          return;
        }

        const nextSuggestions = Array.isArray(result.data)
          ? result.data.map(mapApiSuggestion)
          : [];
        setFollowSuggestions(nextSuggestions);
      } catch {
        setFollowSuggestions([]);
      }
    },
    [token],
  );

  const fetchProfileSocial = useCallback(async (userId) => {
    if (!userId) {
      setProfileSocial({
        followers: [],
        following: [],
        loading: false,
        error: "",
      });
      return;
    }

    setProfileSocial((prev) => ({ ...prev, loading: true, error: "" }));

    try {
      const [followersResult, followingResult] = await Promise.all([
        fetchUserFollowersApi(userId),
        fetchUserFollowingApi(userId),
      ]);

      if (!followersResult.ok || !followingResult.ok) {
        throw new Error("Não foi possível carregar conexões do perfil.");
      }

      setProfileSocial({
        followers: Array.isArray(followersResult.data)
          ? followersResult.data
          : [],
        following: Array.isArray(followingResult.data)
          ? followingResult.data
          : [],
        loading: false,
        error: "",
      });
    } catch (error) {
      setProfileSocial({
        followers: [],
        following: [],
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar conexões do perfil.",
      });
    }
  }, []);

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
        const result = await fetchNotificationsApi(safeToken);

        if (!result.ok) {
          if (result.status === 401) {
            setToken("");
            setNotifications([]);
            setNotificationsError("Sua sessão expirou. Faça login novamente.");
            return;
          }

          throw new Error(
            result.data?.message ??
              "Não foi possível carregar as notificações.",
          );
        }

        setNotifications(
          Array.isArray(result.data) ? result.data.map(mapApiNotification) : [],
        );
      } catch (error) {
        setNotificationsError(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar as notificações.",
        );
      } finally {
        setNotificationsLoading(false);
      }
    },
    [token],
  );

  const fetchConversations = useCallback(
    async (safeToken = token, options = {}) => {
      const silent = Boolean(options.silent);

      if (!safeToken) {
        setConversations([]);
        setActiveConversationId("");
        return [];
      }

      if (!silent) {
        setConversationsLoading(true);
        setConversationsError("");
      }

      try {
        const result = await fetchConversationsApi(safeToken);

        if (!result.ok) {
          if (result.status === 401) {
            setToken("");
            throw new Error("Sua sessão expirou. Faça login novamente.");
          }

          throw new Error(
            result.data?.message ?? "Não foi possível carregar as conversas.",
          );
        }

        const mapped = Array.isArray(result.data)
          ? result.data.map((conversation) => mapApiConversation(conversation))
          : [];
        setConversations(mapped);
        setActiveConversationId((current) => {
          if (
            current &&
            mapped.some((conversation) => conversation.id === current)
          ) {
            return current;
          }

          return mapped[0]?.id ?? "";
        });
        setConversationsError("");
        return mapped;
      } catch (error) {
        if (!silent) {
          setConversationsError(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar as conversas.",
          );
        }
        return [];
      } finally {
        if (!silent) setConversationsLoading(false);
      }
    },
    [token],
  );

  const loadConversationMessages = useCallback(
    async (conversationId, options = {}) => {
      if (!token || !conversationId) return false;

      const append = Boolean(options.append);
      const silent = Boolean(options.silent);
      const mergeLatest = Boolean(options.mergeLatest);
      const current = conversationMessagesById[conversationId] ?? {};
      const cursor = append ? current.nextCursor : null;

      if (append && (!current.hasMore || !cursor)) return false;

      setConversationMessagesById((prev) => {
        const existing = prev[conversationId] ?? {};
        return {
          ...prev,
          [conversationId]: {
            ...existing,
            items: existing.items ?? [],
            draft: existing.draft ?? "",
            hasMore: Boolean(existing.hasMore),
            nextCursor: existing.nextCursor ?? null,
            sending: Boolean(existing.sending),
            loading: append || silent ? Boolean(existing.loading) : true,
            loadingMore: append,
            error: silent ? (existing.error ?? "") : "",
          },
        };
      });

      try {
        const result = await fetchConversationMessagesApi(
          token,
          conversationId,
          {
            cursor,
            limit: 30,
          },
        );

        if (!result.ok) {
          if (result.status === 401) {
            setToken("");
            throw new Error("Sua sessão expirou. Faça login novamente.");
          }

          throw new Error(
            result.data?.message ?? "Não foi possível carregar as mensagens.",
          );
        }

        const incoming = Array.isArray(result.data?.items)
          ? result.data.items.map((message) => mapApiMessage(message))
          : [];

        setConversationMessagesById((prev) => {
          const existing = prev[conversationId] ?? {};
          let nextItems = incoming;

          if (append) {
            nextItems = [...incoming, ...(existing.items ?? [])];
          } else if (mergeLatest) {
            const byId = new Map();
            [...(existing.items ?? []), ...incoming].forEach((message) => {
              if (message?.id) byId.set(message.id, message);
            });
            nextItems = [...byId.values()].sort(
              (left, right) =>
                new Date(left.createdAt ?? 0).getTime() -
                new Date(right.createdAt ?? 0).getTime(),
            );
          }

          return {
            ...prev,
            [conversationId]: {
              ...existing,
              items: nextItems,
              draft: existing.draft ?? "",
              hasMore: mergeLatest
                ? Boolean(existing.hasMore || result.data?.hasMore)
                : Boolean(result.data?.hasMore),
              nextCursor: mergeLatest
                ? (existing.nextCursor ?? result.data?.nextCursor ?? null)
                : (result.data?.nextCursor ?? null),
              loading: false,
              loadingMore: false,
              sending: Boolean(existing.sending),
              error: "",
            },
          };
        });
        return true;
      } catch (error) {
        setConversationMessagesById((prev) => {
          const existing = prev[conversationId] ?? {};
          return {
            ...prev,
            [conversationId]: {
              ...existing,
              items: existing.items ?? [],
              draft: existing.draft ?? "",
              hasMore: Boolean(existing.hasMore),
              nextCursor: existing.nextCursor ?? null,
              loading: false,
              loadingMore: false,
              sending: silent ? Boolean(existing.sending) : false,
              error:
                silent && existing.error
                  ? existing.error
                  : error instanceof Error
                    ? error.message
                    : "Não foi possível carregar as mensagens.",
            },
          };
        });
        return false;
      }
    },
    [conversationMessagesById, token],
  );

  const markConversationAsRead = useCallback(
    async (conversationId) => {
      if (!token || !conversationId) return false;

      const result = await markConversationReadApi(token, conversationId);
      if (!result.ok) return false;

      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, unreadCount: 0 }
            : conversation,
        ),
      );
      return true;
    },
    [token],
  );

  // Consulta a rota protegida /users/me para descobrir quem esta autenticado.
  const fetchMe = useCallback(async () => {
    try {
      const result = await fetchMeApi(token);

      if (!result.ok) {
        if (result.status === 401) {
          setToken("");
        }
        setMe(null);
        setSelectedProfile(null);
        return;
      }

      const user = result.data?.user ?? null;
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
      setFeedMode("for-you");
    }
  }, [token]);

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

  useEffect(() => {
    const previewUrl = composerImage?.previewUrl;

    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [composerImage?.previewUrl]);

  // Sempre que o token muda, recarrega o feed.
  // Sem token, busca o feed publico; com token, busca o feed personalizado.
  useEffect(() => {
    fetchPosts(token, feedMode);
  }, [feedMode, fetchPosts, token]);

  useEffect(() => {
    void fetchTrends();
  }, [fetchTrends, posts.length]);

  useEffect(() => {
    void fetchFollowSuggestions(token);
  }, [fetchFollowSuggestions, token, posts.length]);

  useEffect(() => {
    if (currentView !== "profile" || !profileUser?.id) {
      setProfileSocial({
        followers: [],
        following: [],
        loading: false,
        error: "",
      });
      return;
    }

    void fetchProfileSocial(profileUser.id);
  }, [currentView, fetchProfileSocial, profileUser?.id]);

  useEffect(() => {
    if (!token) {
      setNotifications([]);
      setConversations([]);
      setActiveConversationId("");
      setConversationMessagesById({});
      return;
    }

    fetchNotifications(token);
  }, [fetchNotifications, token]);

  useEffect(() => {
    if (!token || currentView !== "conversations") return;

    fetchConversations(token);
  }, [currentView, fetchConversations, token]);

  useEffect(() => {
    if (!token) {
      setConversationSocketConnected(false);
      return undefined;
    }

    const socket = connectConversationsSocket(token);

    socket.on("connect", () => setConversationSocketConnected(true));
    socket.on("disconnect", () => setConversationSocketConnected(false));
    socket.on("connect_error", () => setConversationSocketConnected(false));
    socket.on("conversation:message", (payload) => {
      const message = mapApiMessage(payload?.message ?? payload);
      if (!message.id || !message.conversationId) return;

      const isActive =
        activeConversationIdRef.current === message.conversationId;
      const isMine = message.senderId === currentUserIdRef.current;

      setConversationMessagesById((prev) => {
        const existing = prev[message.conversationId];
        if (!existing && !isActive) return prev;

        return {
          ...prev,
          [message.conversationId]: {
            ...existing,
            items: mergeMessagesById(existing?.items ?? [], message),
            draft: existing?.draft ?? "",
            hasMore: Boolean(existing?.hasMore),
            nextCursor: existing?.nextCursor ?? null,
            loading: false,
            loadingMore: false,
            sending: Boolean(existing?.sending),
            error: "",
          },
        };
      });

      let conversationExists = false;
      setConversations((prev) => {
        conversationExists = prev.some(
          (conversation) => conversation.id === message.conversationId,
        );

        return prev
          .map((conversation) =>
            conversation.id === message.conversationId
              ? {
                  ...conversation,
                  lastMessage: message,
                  preview: message.text,
                  time: message.time,
                  updatedAt: message.createdAt,
                  unreadCount:
                    isActive || isMine
                      ? 0
                      : Number(conversation.unreadCount ?? 0) + 1,
                }
              : conversation,
          )
          .sort((left, right) =>
            String(right.updatedAt).localeCompare(String(left.updatedAt)),
          );
      });

      if (!conversationExists) {
        void fetchConversations(token, { silent: true });
      }

      if (!isMine) {
        void fetchNotifications(token);
      }

      if (isActive) {
        void markConversationAsRead(message.conversationId);
      }
    });

    return () => {
      socket.disconnect();
      setConversationSocketConnected(false);
    };
  }, [fetchConversations, fetchNotifications, markConversationAsRead, token]);

  useEffect(() => {
    if (!token || currentView !== "conversations") return undefined;

    const intervalId = window.setInterval(async () => {
      if (
        document.visibilityState === "hidden" ||
        conversationsPollInFlightRef.current
      ) {
        return;
      }

      conversationsPollInFlightRef.current = true;
      try {
        await fetchConversations(token, { silent: true });
      } finally {
        conversationsPollInFlightRef.current = false;
      }
    }, CONVERSATION_LIST_POLL_MS);

    return () => window.clearInterval(intervalId);
  }, [currentView, fetchConversations, token]);

  useEffect(() => {
    if (!token || currentView !== "conversations" || !activeConversationId) {
      return;
    }

    const state = conversationMessagesById[activeConversationId];
    if (!state?.items?.length && !state?.loading) {
      void loadConversationMessages(activeConversationId);
    }
  }, [
    activeConversationId,
    conversationMessagesById,
    currentView,
    loadConversationMessages,
    token,
  ]);

  useEffect(() => {
    if (!token || currentView !== "conversations" || !activeConversationId) {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      if (
        document.visibilityState === "hidden" ||
        activeMessagesPollInFlightRef.current
      ) {
        return;
      }

      activeMessagesPollInFlightRef.current = true;
      try {
        const refreshed = await loadConversationMessages(activeConversationId, {
          mergeLatest: true,
          silent: true,
        });

        if (refreshed) {
          await markConversationAsRead(activeConversationId);
        }
      } finally {
        activeMessagesPollInFlightRef.current = false;
      }
    }, ACTIVE_CONVERSATION_POLL_MS);

    return () => window.clearInterval(intervalId);
  }, [
    activeConversationId,
    currentView,
    loadConversationMessages,
    markConversationAsRead,
    token,
  ]);

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
      const result = await togglePostLike(postId, token, isCurrentlyLiked);

      if (!result.ok) {
        if (result.status === 401) {
          setToken("");
          setComposerError("Sua sessão expirou. Faça login novamente.");
          return;
        }
        throw new Error(result.data?.message ?? "Erro ao curtir post.");
      }

      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post;
          const likesCount = Number(
            result.data?.likesCount ?? post.counts?.likes ?? 0,
          );
          return {
            ...post,
            liked: Boolean(result.data?.viewerLiked),
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
      const result = await registerPostView(postId);

      if (!result.ok) {
        throw new Error(
          result.data?.message ?? "Erro ao registrar visualização.",
        );
      }

      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post;
          const viewCount = Number(
            result.data?.viewCount ?? post.counts?.views ?? 0,
          );
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

  const handleDeletePost = async (postId) => {
    if (!postId) return;

    const post = posts.find((item) => item.id === postId);
    if (!post) return;

    if (!token) {
      setComposerError("Faça login para apagar posts.");
      return;
    }

    if (post.authorId !== me?.id) {
      setComposerError("Você só pode apagar seus próprios posts.");
      return;
    }

    const confirmed = window.confirm("Apagar este post?");
    if (!confirmed) return;

    const previousPosts = posts;
    const previousCommentsByPost = commentsByPost;

    setPosts((prev) => prev.filter((item) => item.id !== postId));
    setActiveCommentsPostId((current) => (current === postId ? "" : current));
    setCommentsByPost((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
    setComposerError("");

    try {
      const result = await deletePostApi(postId, token);

      if (!result.ok) {
        if (result.status === 401) {
          setToken("");
          throw new Error("Sua sessão expirou. Faça login novamente.");
        }

        throw new Error(
          result.data?.message ?? "Não foi possível apagar o post.",
        );
      }
    } catch (error) {
      setPosts(previousPosts);
      setCommentsByPost(previousCommentsByPost);
      setComposerError(
        error instanceof Error
          ? error.message
          : "Não foi possível apagar o post.",
      );
    }
  };

  const openReportDialog = (postId) => {
    if (!postId) return;

    const post = posts.find((item) => item.id === postId);
    if (!post) return;

    if (!token) {
      setComposerError("Faça login para denunciar posts.");
      return;
    }

    if (post.authorId === me?.id) {
      setComposerError("Você não pode denunciar seu próprio post.");
      return;
    }

    setReportDialog({
      postId,
      selectedReason: REPORT_REASONS[0].value,
      loading: false,
      error: "",
    });
    setComposerError("");
  };

  const closeReportDialog = () => {
    if (reportDialog.loading) return;
    setReportDialog({
      postId: "",
      selectedReason: REPORT_REASONS[0].value,
      loading: false,
      error: "",
    });
  };

  const selectReportReason = (reason) => {
    setReportDialog((prev) => ({
      ...prev,
      selectedReason: reason,
      error: "",
    }));
  };

  const submitReportPost = async () => {
    const postId = reportDialog.postId;
    if (!postId || reportDialog.loading) return;

    const reason = reportDialog.selectedReason || REPORT_REASONS[0].value;

    setReportDialog((prev) => ({ ...prev, loading: true, error: "" }));
    setComposerNotice("");

    try {
      const result = await reportPostApi(postId, token, reason);

      if (!result.ok) {
        if (result.status === 401) {
          setToken("");
          throw new Error("Sua sessão expirou. Faça login novamente.");
        }

        throw new Error(
          result.data?.message ?? "Não foi possível denunciar o post.",
        );
      }

      setComposerNotice("Denúncia enviada para revisão.");
      setReportDialog({
        postId: "",
        selectedReason: REPORT_REASONS[0].value,
        loading: false,
        error: "",
      });
    } catch (error) {
      setReportDialog((prev) => ({
        ...prev,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível denunciar o post.",
      }));
    }
  };

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

        const result = await fetchPostComments(postId, params);

        if (!result.ok) {
          throw new Error(
            result.data?.message ?? "Não foi possível carregar os comentários.",
          );
        }

        const data = result.data;
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

        const result = await fetchPostComments(postId, params);

        if (!result.ok) {
          throw new Error(
            result.data?.message ?? "Não foi possível carregar as respostas.",
          );
        }

        const data = result.data;
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
      const result = await createPostComment(postId, token, {
        content: text,
        ...(parentCommentId ? { parentCommentId } : {}),
      });

      if (!result.ok) {
        if (result.status === 401) {
          setToken("");
          throw new Error("Sua sessão expirou. Faça login novamente.");
        }

        throw new Error(result.data?.message ?? "Não foi possível comentar.");
      }

      const data = result.data;
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
      const result = await deleteComment(commentId, token);

      if (!result.ok) {
        if (result.status === 401) {
          setToken("");
          throw new Error("Sua sessão expirou. Faça login novamente.");
        }

        throw new Error(
          result.data?.message ?? "Não foi possível apagar o comentário.",
        );
      }

      const commentsCount = Number(
        result.data?.commentsCount ?? Math.max(0, previousCount - 1),
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
      const result = await authenticate(endpoint, payload);

      if (!result.ok) {
        setAuthError(result.data?.message ?? "Falha na autenticação.");
        return;
      }

      const data = result.data;
      setToken(data?.access_token ?? "");
      setMe(data?.user ?? null);
      setFeedMode("for-you");
      setPassword("");
      setConfirmPassword("");
      setRegisterProfile(REGISTER_PROFILE_INITIAL);
      setSelectedProfile(null);
      setProfileError("");
      setAuthMode("login");
      setCurrentView("home");
      await fetchPosts(data?.access_token ?? "", "for-you");
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
      const result = await authenticate(endpoint, DEV_ACCOUNT);
      return { res: result, data: result.data };
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
      setFeedMode("for-you");
      setConfirmPassword("");
      setSelectedProfile(null);
      setProfileError("");
      setAuthMode("login");
      setCurrentView("home");
      await fetchPosts(data?.access_token ?? "", "for-you");
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
    imageUploadIdRef.current += 1;
    setComposerImage(null);
    setImageUploadLoading(false);
    setComposerError("");
    setComposerNotice("");
    setSelectedProfile(null);
    setProfileError("");
    setActiveCommentsPostId("");
    setCommentsByPost({});
    setLiveTrends([]);
    setFollowSuggestions([]);
    setFollowActionUserId("");
    setNotifications([]);
    setNotificationsError("");
    setNotificationsNotice("");
    setConversations([]);
    setConversationsError("");
    setActiveConversationId("");
    setConversationMessagesById({});
    setConversationStarting(false);
    setFeedMode("for-you");
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

  const handleFeedModeChange = (mode) => {
    const nextMode = mode === "following" && token ? "following" : "for-you";
    setFeedMode(nextMode);
    setActiveCommentsPostId("");
    setCommentsByPost({});
    if (mode === "following" && !token) {
      setFeedError("Faça login para ver posts das contas que você segue.");
    }
  };

  const openExplore = () => {
    setSelectedProfile(null);
    setProfileError("");
    setCurrentView("explore");
    setUserMenuOpen(false);
  };

  const openTrend = (trend) => {
    const query = String(trend?.title ?? "").replace(/^#/, "");
    setSelectedProfile(null);
    setProfileError("");
    setExploreQuery(query);
    setExploreFilter("all");
    setCurrentView("explore");
    setUserMenuOpen(false);
  };

  const openSuggestedProfile = (person) => {
    if (!person?.id) return;

    openUserProfile({
      authorId: person.id,
      authorEmail: person.user?.email,
      name: person.name,
      handle: person.handle,
      authorRole: person.badge,
      createdAt: person.user?.createdAt,
    });
  };

  const handleToggleFollow = async (person) => {
    if (!person?.id || followActionUserId) return;

    if (!token) {
      setComposerError("Faça login para seguir pessoas.");
      return;
    }

    setFollowActionUserId(person.id);
    setFollowSuggestions((prev) =>
      prev.map((item) =>
        item.id === person.id
          ? {
              ...item,
              following: !item.following,
              followersCount: Math.max(
                0,
                Number(item.followersCount ?? 0) + (item.following ? -1 : 1),
              ),
            }
          : item,
      ),
    );

    try {
      const result = await toggleUserFollowApi(
        token,
        person.id,
        person.following,
      );

      if (!result.ok) {
        if (result.status === 401) {
          setToken("");
          throw new Error("Sua sessão expirou. Faça login novamente.");
        }

        throw new Error(
          result.data?.message ?? "Não foi possível atualizar esta relação.",
        );
      }

      setFollowSuggestions((prev) =>
        prev.map((item) =>
          item.id === person.id
            ? {
                ...item,
                following: Boolean(result.data?.viewerFollowing),
                followersCount: Number(
                  result.data?.followersCount ?? item.followersCount ?? 0,
                ),
              }
            : item,
        ),
      );
      if (feedMode === "following") {
        void fetchPosts(token, "following");
      }
    } catch (error) {
      setFollowSuggestions((prev) =>
        prev.map((item) =>
          item.id === person.id
            ? {
                ...item,
                following: person.following,
                followersCount: person.followersCount,
              }
            : item,
        ),
      );
      setComposerError(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar esta relação.",
      );
    } finally {
      setFollowActionUserId("");
    }
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
    void fetchConversations();
  };

  const openSettings = () => {
    setSelectedProfile(null);
    setProfileError("");
    setCurrentView("settings");
    setUserMenuOpen(false);
  };

  const openPlus = () => {
    setSelectedProfile(null);
    setProfileError("");
    setCurrentView("plus");
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

  const handleSelectConversation = async (conversationId) => {
    if (!conversationId) return;

    setActiveConversationId(conversationId);
    const state = conversationMessagesById[conversationId];
    if (!state?.items?.length && !state?.loading) {
      void loadConversationMessages(conversationId);
    }

    void markConversationAsRead(conversationId);
  };

  const handleConversationDraftChange = (conversationId, draft) => {
    if (!conversationId) return;
    const safeDraft = String(draft ?? "").slice(0, 1000);

    setConversationMessagesById((prev) => {
      const existing = prev[conversationId] ?? {};
      return {
        ...prev,
        [conversationId]: {
          ...existing,
          items: existing.items ?? [],
          draft: safeDraft,
          hasMore: Boolean(existing.hasMore),
          nextCursor: existing.nextCursor ?? null,
          loading: Boolean(existing.loading),
          loadingMore: Boolean(existing.loadingMore),
          sending: Boolean(existing.sending),
          error: "",
        },
      };
    });
  };

  const handleSendConversationMessage = async (conversationId) => {
    if (!token || !conversationId) return;

    const current = conversationMessagesById[conversationId] ?? {};
    const text = String(current.draft ?? "").trim();
    if (!text || current.sending) return;

    setConversationMessagesById((prev) => {
      const existing = prev[conversationId] ?? {};
      return {
        ...prev,
        [conversationId]: {
          ...existing,
          items: existing.items ?? [],
          draft: existing.draft ?? "",
          sending: true,
          error: "",
        },
      };
    });

    try {
      const result = await sendConversationMessageApi(
        token,
        conversationId,
        text,
      );

      if (!result.ok) {
        if (result.status === 401) {
          setToken("");
          throw new Error("Sua sessão expirou. Faça login novamente.");
        }

        throw new Error(
          result.data?.message ?? "Não foi possível enviar a mensagem.",
        );
      }

      const message = mapApiMessage(result.data);
      setConversationMessagesById((prev) => {
        const existing = prev[conversationId] ?? {};
        return {
          ...prev,
          [conversationId]: {
            ...existing,
            items: [...(existing.items ?? []), message],
            draft: "",
            sending: false,
            error: "",
          },
        };
      });
      setConversations((prev) =>
        prev
          .map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  lastMessage: message,
                  preview: message.text,
                  time: message.time,
                  updatedAt: message.createdAt,
                  unreadCount: 0,
                }
              : conversation,
          )
          .sort((left, right) =>
            String(right.updatedAt).localeCompare(String(left.updatedAt)),
          ),
      );
    } catch (error) {
      setConversationMessagesById((prev) => {
        const existing = prev[conversationId] ?? {};
        return {
          ...prev,
          [conversationId]: {
            ...existing,
            items: existing.items ?? [],
            draft: existing.draft ?? text,
            sending: false,
            error:
              error instanceof Error
                ? error.message
                : "Não foi possível enviar a mensagem.",
          },
        };
      });
    }
  };

  const handleStartConversation = async (participantId) => {
    if (!participantId || conversationStarting) return;

    if (!token) {
      setProfileError("Faça login para enviar mensagem.");
      return;
    }

    setConversationStarting(true);
    setProfileError("");
    setConversationsError("");

    try {
      const result = await createConversationApi(token, participantId);

      if (!result.ok) {
        if (result.status === 401) {
          setToken("");
          throw new Error("Sua sessão expirou. Faça login novamente.");
        }

        throw new Error(
          result.data?.message ?? "Não foi possível iniciar a conversa.",
        );
      }

      const conversation = mapApiConversation(result.data);
      setConversations((prev) => {
        const withoutCurrent = prev.filter(
          (item) => item.id !== conversation.id,
        );
        return [conversation, ...withoutCurrent];
      });
      setActiveConversationId(conversation.id);
      setSelectedProfile(null);
      setProfileError("");
      setCurrentView("conversations");
      void loadConversationMessages(conversation.id);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar a conversa.";
      setProfileError(message);
      setConversationsError(message);
    } finally {
      setConversationStarting(false);
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

  const handleComposerContentChange = (value) => {
    setContent(value);
    if (composerError) setComposerError("");
    if (composerNotice) setComposerNotice("");
  };

  const handleMarkNotificationRead = async (notificationId, quiet = false) => {
    if (!token || !notificationId) return;

    setNotificationsError("");
    if (!quiet) setNotificationsNotice("");

    try {
      const result = await markNotificationRead(notificationId, token);

      if (!result.ok) {
        if (result.status === 401) {
          setToken("");
          throw new Error("Sua sessão expirou. Faça login novamente.");
        }

        throw new Error(
          result.data?.message ?? "Não foi possível atualizar a notificação.",
        );
      }

      const updated = mapApiNotification(result.data);
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId ? updated : notification,
        ),
      );
      if (!quiet) setNotificationsNotice("Notificação marcada como lida.");
    } catch (error) {
      setNotificationsError(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a notificação.",
      );
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    if (!token || unreadNotificationsCount === 0) return;

    setNotificationsError("");
    setNotificationsNotice("");

    try {
      const result = await markAllNotificationsRead(token);

      if (!result.ok) {
        if (result.status === 401) {
          setToken("");
          throw new Error("Sua sessão expirou. Faça login novamente.");
        }

        throw new Error(
          result.data?.message ?? "Não foi possível atualizar as notificações.",
        );
      }

      const readAt = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((notification) => ({
          ...notification,
          readAt: notification.readAt ?? readAt,
        })),
      );
      setNotificationsNotice(
        "Todas as notificações foram marcadas como lidas.",
      );
    } catch (error) {
      setNotificationsError(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar as notificações.",
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

  const handleOpenNotificationConversation = async (notification) => {
    if (!notification?.conversationId) return;

    setSelectedProfile(null);
    setProfileError("");
    setCurrentView("conversations");
    setActiveConversationId(notification.conversationId);
    setUserMenuOpen(false);

    if (
      !conversations.some(
        (conversation) => conversation.id === notification.conversationId,
      )
    ) {
      await fetchConversations(token, { silent: true });
    }

    void loadConversationMessages(notification.conversationId);
    void markConversationAsRead(notification.conversationId);

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
      const result = await fetchUser(authorId);

      if (!result.ok) {
        setProfileError(
          result.data?.message ?? "Não foi possível carregar este perfil.",
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

      setSelectedProfile(result.data?.user ?? null);
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

  const handleChooseComposerImage = () => {
    composerImageInputRef.current?.click();
  };

  const handleRemoveComposerImage = () => {
    imageUploadIdRef.current += 1;
    setImageUploadLoading(false);
    setComposerImage(null);
    setComposerError("");
    setComposerNotice("");
  };

  const handleComposerImageChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!token) {
      setComposerError("Faça login para anexar imagem.");
      setComposerNotice("");
      return;
    }

    const validationError = getPostImageValidationError(file);
    if (validationError) {
      setComposerError(validationError);
      setComposerNotice("");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const uploadId = imageUploadIdRef.current + 1;
    imageUploadIdRef.current = uploadId;

    setComposerImage({
      previewUrl,
      imageUrl: "",
      fileName: file.name,
      size: file.size,
    });
    setImageUploadLoading(true);
    setComposerError("");
    setComposerNotice("");

    try {
      const result = await uploadImage(token, file);

      if (uploadId !== imageUploadIdRef.current) {
        return;
      }

      if (!result.ok) {
        if (result.status === 401) {
          setToken("");
          setComposerImage(null);
          setComposerError("Sua sessão expirou. Faça login novamente.");
          return;
        }

        const message = Array.isArray(result.data?.message)
          ? result.data.message.join(" ")
          : result.data?.message;
        setComposerImage(null);
        setComposerError(message ?? "Não foi possível anexar a imagem.");
        return;
      }

      const data = result.data;
      if (typeof data?.imageUrl !== "string") {
        setComposerImage(null);
        setComposerError("O upload não retornou uma imagem válida.");
        return;
      }

      setComposerImage((prev) =>
        prev?.previewUrl === previewUrl
          ? { ...prev, imageUrl: data.imageUrl, path: data.path ?? "" }
          : prev,
      );
      setComposerNotice("Imagem anexada.");
    } catch {
      if (uploadId === imageUploadIdRef.current) {
        setComposerImage(null);
        setComposerError("Backend indisponível. Não foi possível anexar.");
      }
    } finally {
      if (uploadId === imageUploadIdRef.current) {
        setImageUploadLoading(false);
      }
    }
  };

  const handleActivateEurecaPlus = async (plan) => {
    if (!token) {
      return {
        ok: false,
        data: { message: "Faça login para ativar o EURECA+." },
      };
    }

    const result = await activateEurecaPlus(token, plan);
    if (result.ok && result.data?.user) {
      setMe(result.data.user);
    }
    return result;
  };

  const handleCancelEurecaPlus = async () => {
    if (!token) {
      return {
        ok: false,
        data: { message: "Faça login para gerir o EURECA+." },
      };
    }

    const result = await cancelEurecaPlus(token);
    if (result.ok && result.data?.user) {
      setMe(result.data.user);
    }
    return result;
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

    if (imageUploadLoading || (composerImage && !composerImage.imageUrl)) {
      setComposerError("Aguarde o envio da imagem antes de postar.");
      setComposerNotice("");
      return;
    }

    setCreateLoading(true);
    setComposerError("");
    setComposerNotice("");

    try {
      // O autor vem do token; a imagem ja foi enviada e entra como URL.
      const result = await createPost(token, {
        content: text,
        ...(composerImage?.imageUrl
          ? { imageUrl: composerImage.imageUrl }
          : {}),
      });

      if (!result.ok) {
        if (result.status === 401) {
          setToken("");
          setComposerError("Sua sessão expirou. Faça login novamente.");
          return;
        }

        setComposerError(
          result.data?.message ?? "Não foi possível publicar o post.",
        );
        return;
      }

      if (feedMode === "following") {
        await fetchPosts(token, "following");
      } else {
        setPosts((prev) => [mapApiPost(result.data), ...prev]);
      }
      setContent("");
      setComposerImage(null);
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
        <AppTopbar
          currentView={currentView}
          unreadNotificationsCount={unreadNotificationsCount}
          userInitial={userInitial}
          userMenuOpen={userMenuOpen}
          userMenuRef={userMenuRef}
          sessionName={sessionName}
          sessionHandle={sessionHandle}
          onToggleUserMenu={() => setUserMenuOpen((prev) => !prev)}
          onOpenProfile={openProfile}
          onOpenHome={openHome}
          onOpenExplore={openExplore}
          onOpenAlerts={openAlerts}
          onOpenConversations={openConversations}
          onOpenSettings={openSettings}
          onOpenPlus={openPlus}
          onLogout={handleLogout}
        />

        <main className="eureca-layout">
          {/* Coluna lateral com resumo do usuario, tendencias e sugestoes. */}
          <Sidebar
            latestMyPost={latestMyPost}
            latestMyPostPreview={latestMyPostPreview}
            me={me}
            trends={resolvedTrends}
            suggestions={resolvedFollowSuggestions}
            followActionUserId={followActionUserId}
            onNewPost={openHome}
            onTrendClick={openTrend}
            onSuggestionClick={openSuggestedProfile}
            onToggleFollow={handleToggleFollow}
          />

          <section className="feed-column">
            {/* A coluna principal troca de conteudo conforme a "view" selecionada. */}
            {currentView === "profile" ? (
              <ProfileView
                isOwnProfile={isOwnProfile}
                profileInitial={profileInitial}
                profileUser={profileUser}
                profileName={profileName}
                profileHandle={profileHandle}
                profileEmail={profileEmail}
                profileCreatedAt={profileCreatedAt}
                profileBio={profileBio}
                profilePosts={profilePosts}
                profileCommunityProgress={profileCommunityProgress}
                totalProfileLikes={totalProfileLikes}
                totalProfileViews={totalProfileViews}
                profileSocial={profileSocial}
                profileLoading={profileLoading}
                profileError={profileError}
                postsLoading={postsLoading}
                onBackToFeed={openHome}
                onRefreshPosts={() => fetchPosts()}
                onAuthorClick={openUserProfile}
                onStartConversation={handleStartConversation}
                conversationStarting={conversationStarting}
              />
            ) : currentView === "explore" ? (
              <ExploreView
                exploreQuery={exploreQuery}
                exploreFilter={exploreFilter}
                exploreData={exploreData}
                postsLoading={postsLoading}
                currentUserId={me?.id ?? ""}
                onQueryChange={setExploreQuery}
                onFilterChange={setExploreFilter}
                onRefreshPosts={() => fetchPosts()}
                onOpenPostDiscussion={openPostDiscussion}
                onOpenUserProfile={openUserProfile}
                onStartConversation={handleStartConversation}
              />
            ) : currentView === "alerts" ? (
              <AlertsView
                notifications={notifications}
                loading={notificationsLoading}
                error={notificationsError}
                notice={notificationsNotice}
                unreadCount={unreadNotificationsCount}
                onRefresh={() => fetchNotifications()}
                onMarkAllRead={handleMarkAllNotificationsRead}
                onMarkRead={handleMarkNotificationRead}
                onOpenPost={handleOpenNotificationPost}
                onOpenConversation={handleOpenNotificationConversation}
                onAuthorClick={handleNotificationAuthorClick}
              />
            ) : currentView === "conversations" ? (
              <ConversationsView
                conversations={conversations}
                conversationsLoading={conversationsLoading}
                conversationsError={conversationsError}
                socketConnected={conversationSocketConnected}
                conversationCandidates={conversationCandidates}
                conversationStarting={conversationStarting}
                activeConversation={activeConversation}
                activeConversationState={activeConversationState}
                currentUserId={me?.id ?? ""}
                onRefreshConversations={() => fetchConversations()}
                onSelectConversation={handleSelectConversation}
                onLoadMoreMessages={() =>
                  loadConversationMessages(activeConversationId, {
                    append: true,
                  })
                }
                onDraftChange={handleConversationDraftChange}
                onSendMessage={handleSendConversationMessage}
                onStartConversation={handleStartConversation}
                onOpenExplore={openExplore}
              />
            ) : currentView === "settings" ? (
              <SettingsView
                userInitial={userInitial}
                me={me}
                sessionName={sessionName}
                sessionHandle={sessionHandle}
                sessionEmail={sessionEmail}
                themeSummary={themeSummary}
                themePreference={themePreference}
                unreadNotificationsCount={unreadNotificationsCount}
                communityProgress={communityProgress}
                onOpenProfile={openProfile}
                onOpenAlerts={openAlerts}
                onThemePreferenceChange={setThemePreference}
                onLogout={handleLogout}
              />
            ) : currentView === "plus" ? (
              <EurecaPlusView
                me={me}
                sessionName={sessionName}
                token={token}
                onMembershipActivated={handleActivateEurecaPlus}
                onMembershipCancelled={handleCancelEurecaPlus}
              />
            ) : (
              <HomeView
                userInitial={userInitial}
                content={content}
                composerImage={composerImage}
                composerHasContent={composerHasContent}
                composerHasImage={composerHasImage}
                composerCanPost={composerCanPost}
                imageUploadLoading={imageUploadLoading}
                createLoading={createLoading}
                composerError={composerError}
                composerNotice={composerNotice}
                composerInputRef={composerInputRef}
                composerImageInputRef={composerImageInputRef}
                feedError={feedError}
                feedOverview={feedOverview}
                feedMode={feedMode}
                posts={posts}
                postsLoading={postsLoading}
                commentsByPost={commentsByPost}
                activeCommentsPostId={activeCommentsPostId}
                currentUserId={me?.id ?? ""}
                onComposerContentChange={handleComposerContentChange}
                onComposerKeyDown={handleComposerKeyDown}
                onUseComposerPrompt={handleUseComposerPrompt}
                onChooseComposerImage={handleChooseComposerImage}
                onRemoveComposerImage={handleRemoveComposerImage}
                onComposerImageChange={handleComposerImageChange}
                onCreatePost={handleCreatePost}
                onToggleLike={handleToggleLike}
                onToggleComments={handleToggleComments}
                onDeletePost={handleDeletePost}
                onReportPost={openReportDialog}
                onPostViewed={handlePostViewed}
                onAuthorClick={openUserProfile}
                onUpdateCommentDraft={updateCommentDraft}
                onCreateComment={handleCreateComment}
                onLoadCommentsForPost={loadCommentsForPost}
                onLoadRepliesForComment={loadRepliesForComment}
                onReplyToComment={handleReplyToComment}
                onCancelReply={handleCancelReply}
                onDeleteComment={handleDeleteComment}
                onFeedModeChange={handleFeedModeChange}
              />
            )}
          </section>

          <RightRail
            posts={posts}
            trends={resolvedTrends}
            communityProgress={communityProgress}
            unreadNotificationsCount={unreadNotificationsCount}
            onOpenDiscussion={openPostDiscussion}
            onTrendClick={openTrend}
            onUsePrompt={handleUseComposerPrompt}
          />
        </main>
      </div>

      {reportDialog.postId ? (
        <div className="report-dialog-backdrop" role="presentation">
          <section
            className="report-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-dialog-title"
          >
            <div className="report-dialog-head">
              <div>
                <span>Denúncia acadêmica</span>
                <h2 id="report-dialog-title">Denunciar post</h2>
              </div>
              <button
                type="button"
                className="plus-checkout-close"
                aria-label="Fechar denúncia"
                onClick={closeReportDialog}
                disabled={reportDialog.loading}
              >
                ×
              </button>
            </div>

            <div className="report-reason-list">
              {REPORT_REASONS.map((reason) => (
                <button
                  key={reason.value}
                  type="button"
                  className={
                    reportDialog.selectedReason === reason.value
                      ? "is-selected"
                      : ""
                  }
                  aria-pressed={reportDialog.selectedReason === reason.value}
                  onClick={() => selectReportReason(reason.value)}
                  disabled={reportDialog.loading}
                >
                  <strong>{reason.value}</strong>
                  <span>{reason.description}</span>
                </button>
              ))}
            </div>

            {reportDialog.error ? (
              <p className="report-dialog-error">{reportDialog.error}</p>
            ) : null}

            <div className="report-dialog-actions">
              <button
                type="button"
                className="mini-link-btn"
                onClick={closeReportDialog}
                disabled={reportDialog.loading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="plus-confirm-btn"
                onClick={submitReportPost}
                disabled={reportDialog.loading}
              >
                {reportDialog.loading ? "Enviando..." : "Enviar denúncia"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default App;
