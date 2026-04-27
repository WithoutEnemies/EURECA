import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AuthScreen from './components/AuthScreen'
import CommentsPanel from './components/CommentsPanel'
import { Icon, WaveMark } from './components/Icons'
import NotificationsPanel from './components/NotificationsPanel'
import PostCard from './components/PostCard'
import Sidebar from './components/Sidebar'
import {
  DEV_ACCOUNT,
  REGISTER_MAX_INTERESTS,
  REGISTER_ROLE_OPTIONS,
  navItems,
  suggestions,
  trends,
} from './constants/uiData'
import {
  emailToInitials,
  formatCount,
  mapApiComment,
  mapApiNotification,
  mapApiPost,
  truncateText,
} from './utils/formatters'
import './App.css'

// Endereco base da API.
// Em producao, isso pode vir da variavel VITE_API_URL; localmente cai no backend da porta 3000.
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const VIEWED_POSTS_STORAGE_KEY = 'eureca_viewed_posts'
const COMMENT_MAX_LENGTH = 280
const REGISTER_PROFILE_INITIAL = {
  name: '',
  username: '',
  role: REGISTER_ROLE_OPTIONS[0],
  bio: '',
  interests: [],
  acceptedTerms: false,
}

// Contato ficticio usado para preencher a tela de conversas enquanto o chat real nao existe.
const CHAT_BOT_CONTACT = {
  id: 'eureca-bot',
  name: 'Eureca Bot',
  handle: '@eureca_bot',
  initials: 'EB',
  status: 'online',
  preview: 'Olá! Este é o chat de teste da Eureca.',
}

// Mensagens mockadas para simular uma conversa pronta.
const CHAT_BOT_MESSAGES = [
  {
    id: 'bot-1',
    sender: 'bot',
    text: 'Olá! Eu sou o bot de teste da Eureca.',
    time: '09:41',
  },
  {
    id: 'bot-2',
    sender: 'bot',
    text: 'Aqui vai aparecer o chat em tempo real no futuro. Por agora, esta tela já simula a experiência de conversa.',
    time: '09:42',
  },
]

function loadViewedPostIds() {
  try {
    const raw = sessionStorage.getItem(VIEWED_POSTS_STORAGE_KEY)
    const parsed = JSON.parse(raw ?? '[]')
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((id) => typeof id === 'string')
        : [],
    )
  } catch {
    return new Set()
  }
}

function saveViewedPostIds(ids) {
  try {
    sessionStorage.setItem(VIEWED_POSTS_STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    // Se o navegador bloquear sessionStorage, a API continua a funcionar sem dedupe local.
  }
}

function normalizeUsername(value) {
  return String(value ?? '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
}

function removeCommentBranch(items, commentId) {
  const idsToRemove = new Set([commentId])
  let changed = true

  while (changed) {
    changed = false
    items.forEach((comment) => {
      if (comment.parentCommentId && idsToRemove.has(comment.parentCommentId)) {
        if (!idsToRemove.has(comment.id)) {
          idsToRemove.add(comment.id)
          changed = true
        }
      }
    })
  }

  return items.filter((comment) => !idsToRemove.has(comment.id))
}

function App() {
  // Estados principais da autenticacao e dos campos do formulario.
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [registerProfile, setRegisterProfile] = useState(
    REGISTER_PROFILE_INITIAL,
  )
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // Estados ligados a sessao atual e navegacao interna da interface.
  const [token, setToken] = useState(
    () => localStorage.getItem('eureca_token') ?? '',
  )
  const [me, setMe] = useState(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [currentView, setCurrentView] = useState('home')
  const [selectedProfile, setSelectedProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')

  // Estados do feed, criacao de posts e feedbacks visuais para o usuario.
  const [posts, setPosts] = useState([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [feedError, setFeedError] = useState('')
  const [content, setContent] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [composerError, setComposerError] = useState('')
  const [composerNotice, setComposerNotice] = useState('')
  const [activeCommentsPostId, setActiveCommentsPostId] = useState('')
  const [commentsByPost, setCommentsByPost] = useState({})
  const [notifications, setNotifications] = useState([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState('')
  const [notificationsNotice, setNotificationsNotice] = useState('')
  const [selectedConversationId, setSelectedConversationId] = useState(
    CHAT_BOT_CONTACT.id,
  )
  const userMenuRef = useRef(null)
  const viewedPostIdsRef = useRef(null)

  if (viewedPostIdsRef.current === null) {
    viewedPostIdsRef.current = loadViewedPostIds()
  }

  // Valores derivados: nao sao digitados pelo usuario, mas calculados a partir do estado atual.
  const isLoggedIn = Boolean(token)
  const sessionEmail = me?.email ?? email
  const sessionName = me?.name?.trim() || sessionEmail || 'Usuário'
  const sessionHandle = me?.username
    ? `@${me.username}`
    : `@${(sessionEmail.split('@')[0] || 'usuario').toLowerCase()}`
  const profileUser = selectedProfile ?? me
  const isOwnProfile = !selectedProfile || selectedProfile.id === me?.id
  const profileEmail = profileUser?.email ?? sessionEmail
  const profileName = profileUser?.name?.trim() || profileEmail || 'Usuário'
  const profileHandle = profileUser?.username
    ? `@${profileUser.username}`
    : `@${(profileEmail.split('@')[0] || 'usuario').toLowerCase()}`
  const profileBio =
    profileUser?.bio?.trim() ||
    'Conta da Eureca. Aqui você pode ver informações básicas da sessão e seus posts publicados.'

  // Gera as iniciais do usuario ativo para avatar e pequenos badges.
  const userInitial = useMemo(() => emailToInitials(sessionName), [sessionName])
  const profileInitial = useMemo(
    () => emailToInitials(profileName),
    [profileName],
  )

  // Filtra os posts do usuario atual usando identidade real do autor.
  // Se o perfil ainda nao carregou, cai para comparacao por email do autor.
  const myPosts = useMemo(() => {
    const activeUserId = me?.id ?? ''
    const normalizedEmail = sessionEmail.trim().toLowerCase()

    if (!activeUserId && !normalizedEmail) return []

    return posts.filter((post) => {
      if (activeUserId && post.authorId) {
        return post.authorId === activeUserId
      }

      return (post.authorEmail ?? '').trim().toLowerCase() === normalizedEmail
    })
  }, [posts, me?.id, sessionEmail])
  const profilePosts = useMemo(() => {
    const profileUserId = profileUser?.id ?? ''
    const normalizedEmail = profileEmail.trim().toLowerCase()

    if (!profileUserId && !normalizedEmail) return []

    return posts.filter((post) => {
      if (profileUserId && post.authorId) {
        return post.authorId === profileUserId
      }

      return (post.authorEmail ?? '').trim().toLowerCase() === normalizedEmail
    })
  }, [posts, profileUser?.id, profileEmail])
  const latestMyPost = myPosts[0] ?? null
  const latestMyPostPreview = latestMyPost
    ? truncateText(latestMyPost.text, 110)
    : 'Você ainda não publicou nenhum post. Crie seu primeiro post para aparecer aqui.'
  const totalProfileLikes = profilePosts.reduce(
    (total, post) => total + Number(post.counts?.likes ?? 0),
    0,
  )
  const totalProfileViews = profilePosts.reduce(
    (total, post) => total + Number(post.counts?.views ?? 0),
    0,
  )
  const profileCreatedAt = profileUser?.createdAt
    ? new Date(profileUser.createdAt).toLocaleDateString('pt-BR')
    : 'Sessão ativa'
  const unreadNotificationsCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications],
  )

  // Busca a lista de posts e converte o formato da API para o formato esperado pela interface.
  const fetchPosts = useCallback(
    async (authToken = token) => {
      const safeToken = typeof authToken === 'string' ? authToken : token
      setPostsLoading(true)
      setFeedError('')

      try {
        const endpoint = safeToken
          ? `${API_BASE}/posts/me/feed`
          : `${API_BASE}/posts`
        const res = await fetch(endpoint, {
          headers: safeToken
            ? { Authorization: `Bearer ${safeToken}` }
            : undefined,
        })
        const data = await res.json()

        if (!res.ok) {
          setFeedError(data?.message ?? 'Não foi possível carregar o feed.')
          setPosts([])
          return
        }

        setPosts(Array.isArray(data) ? data.map(mapApiPost) : [])
      } catch {
        setFeedError('Backend indisponível. Inicie a API para carregar posts.')
        setPosts([])
      } finally {
        setPostsLoading(false)
      }
    },
    [token],
  )

  const fetchNotifications = useCallback(
    async (authToken = token) => {
      const safeToken = typeof authToken === 'string' ? authToken : token

      if (!safeToken) {
        setNotifications([])
        return
      }

      setNotificationsLoading(true)
      setNotificationsError('')

      try {
        const res = await fetch(`${API_BASE}/notifications`, {
          headers: { Authorization: `Bearer ${safeToken}` },
        })
        const data = await res.json().catch(() => [])

        if (!res.ok) {
          if (res.status === 401) {
            setToken('')
            setNotifications([])
            setNotificationsError('Sua sessão expirou. Faça login novamente.')
            return
          }

          throw new Error(
            data?.message ?? 'Não foi possível carregar os alertas.',
          )
        }

        setNotifications(
          Array.isArray(data) ? data.map(mapApiNotification) : [],
        )
      } catch (error) {
        setNotificationsError(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar os alertas.',
        )
      } finally {
        setNotificationsLoading(false)
      }
    },
    [token],
  )

  // Consulta a rota protegida /users/me para descobrir quem esta autenticado.
  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        if (res.status === 401) {
          setToken('')
        }
        setMe(null)
        setSelectedProfile(null)
        return
      }

      const data = await res.json()
      const user = data?.user ?? null
      setMe(user)
      if (user?.email) {
        setEmail(user.email)
      }
    } catch {
      setMe(null)
      setSelectedProfile(null)
    }
  }, [token])

  // Mantem o token salvo no navegador para que o login persista ao recarregar a pagina.
  useEffect(() => {
    if (token) {
      localStorage.setItem('eureca_token', token)
    } else {
      localStorage.removeItem('eureca_token')
    }
  }, [token])

  // Fecha o menu do usuario quando a pessoa clica fora dele.
  useEffect(() => {
    if (!userMenuOpen) return undefined

    const handleClickOutside = (event) => {
      if (!userMenuRef.current?.contains(event.target)) {
        setUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userMenuOpen])

  // Sempre que o token muda, recarrega o feed.
  // Sem token, busca o feed publico; com token, busca o feed personalizado.
  useEffect(() => {
    fetchPosts(token)
  }, [fetchPosts, token])

  useEffect(() => {
    if (!token) {
      setNotifications([])
      return
    }

    fetchNotifications(token)
  }, [fetchNotifications, token])

  // Quando existe token, busca os dados do usuario autenticado.
  useEffect(() => {
    if (!token) {
      setMe(null)
      return
    }

    fetchMe()
  }, [fetchMe, token])

  // Fluxo de curtida com atualizacao otimista:
  // a interface muda na hora para parecer rapida e depois confirma com o backend.
  const handleToggleLike = async (postId, isCurrentlyLiked) => {
    if (!token) {
      setComposerError('Faça login para curtir posts.')
      return
    }

    const method = isCurrentlyLiked ? 'DELETE' : 'POST'

    // Atualiza a interface antes da resposta do servidor.
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post
        const nextLikes = Math.max(
          0,
          (post.counts?.likes ?? 0) + (isCurrentlyLiked ? -1 : 1),
        )
        return {
          ...post,
          liked: !isCurrentlyLiked,
          counts: { ...(post.counts ?? {}), likes: nextLikes },
          stats: { ...post.stats, likes: formatCount(nextLikes) },
        }
      }),
    )

    try {
      // Sincroniza a curtida real com o backend.
      const res = await fetch(`${API_BASE}/posts/${postId}/like`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (res.status === 401) {
          setToken('')
          setComposerError('Sua sessão expirou. Faça login novamente.')
          return
        }
        throw new Error(data?.message ?? 'Erro ao curtir post.')
      }

      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post
          const likesCount = Number(data?.likesCount ?? post.counts?.likes ?? 0)
          return {
            ...post,
            liked: Boolean(data?.viewerLiked),
            counts: { ...(post.counts ?? {}), likes: likesCount },
            stats: { ...post.stats, likes: formatCount(likesCount) },
          }
        }),
      )
    } catch (error) {
      // Se algo falhar, desfaz a mudanca visual para nao deixar a tela mentindo.
      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post
          const rolledBackLikes = Math.max(
            0,
            (post.counts?.likes ?? 0) + (isCurrentlyLiked ? 1 : -1),
          )
          return {
            ...post,
            liked: isCurrentlyLiked,
            counts: { ...(post.counts ?? {}), likes: rolledBackLikes },
            stats: { ...post.stats, likes: formatCount(rolledBackLikes) },
          }
        }),
      )
      setComposerError(
        error instanceof Error ? error.message : 'Erro ao curtir post.',
      )
    }
  }

  // Registra uma visualizacao automaticamente quando o post entra na tela.
  // O sessionStorage evita somar varias views do mesmo post na mesma sessao do navegador.
  const handlePostViewed = useCallback(async (postId) => {
    if (!postId || viewedPostIdsRef.current?.has(postId)) {
      return
    }

    const viewedPostIds = viewedPostIdsRef.current ?? new Set()
    viewedPostIds.add(postId)
    viewedPostIdsRef.current = viewedPostIds
    saveViewedPostIds(viewedPostIds)

    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post
        const nextViews = Math.max(0, (post.counts?.views ?? 0) + 1)
        return {
          ...post,
          counts: { ...(post.counts ?? {}), views: nextViews },
          stats: { ...post.stats, views: formatCount(nextViews) },
        }
      }),
    )

    try {
      const res = await fetch(`${API_BASE}/posts/${postId}/view`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data?.message ?? 'Erro ao registrar visualização.')
      }

      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post
          const viewCount = Number(data?.viewCount ?? post.counts?.views ?? 0)
          return {
            ...post,
            counts: { ...(post.counts ?? {}), views: viewCount },
            stats: { ...post.stats, views: formatCount(viewCount) },
          }
        }),
      )
    } catch {
      viewedPostIds.delete(postId)
      saveViewedPostIds(viewedPostIds)

      // Em caso de erro, volta a contagem para evitar inflar os numeros na interface.
      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) return post
          const rolledBackViews = Math.max(0, (post.counts?.views ?? 0) - 1)
          return {
            ...post,
            counts: { ...(post.counts ?? {}), views: rolledBackViews },
            stats: { ...post.stats, views: formatCount(rolledBackViews) },
          }
        }),
      )
    }
  }, [])

  const setPostCommentsCount = useCallback((postId, commentsCount) => {
    const nextCount = Math.max(0, Number(commentsCount ?? 0))

    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post
        return {
          ...post,
          counts: { ...(post.counts ?? {}), replies: nextCount },
          stats: { ...post.stats, replies: formatCount(nextCount) },
        }
      }),
    )
  }, [])

  const updateCommentDraft = (postId, draft) => {
    const safeDraft = String(draft ?? '').slice(0, COMMENT_MAX_LENGTH)

    setCommentsByPost((prev) => {
      const current = prev[postId] ?? {}
      return {
        ...prev,
        [postId]: {
          ...current,
          items: current.items ?? [],
          loaded: Boolean(current.loaded),
          loading: Boolean(current.loading),
          submitting: Boolean(current.submitting),
          deletingIds: current.deletingIds ?? [],
          replyToId: current.replyToId ?? '',
          error: '',
          notice: '',
          draft: safeDraft,
        },
      }
    })
  }

  const loadCommentsForPost = useCallback(
    async (postId) => {
      if (!postId) return

      setCommentsByPost((prev) => {
        const current = prev[postId] ?? {}
        return {
          ...prev,
          [postId]: {
            ...current,
            items: current.items ?? [],
            draft: current.draft ?? '',
            replyToId: current.replyToId ?? '',
            deletingIds: current.deletingIds ?? [],
            loaded: Boolean(current.loaded),
            submitting: Boolean(current.submitting),
            loading: true,
            error: '',
          },
        }
      })

      try {
        const res = await fetch(`${API_BASE}/posts/${postId}/comments`)
        const data = await res.json().catch(() => [])

        if (!res.ok) {
          throw new Error(
            data?.message ?? 'Não foi possível carregar os comentários.',
          )
        }

        const items = Array.isArray(data) ? data.map(mapApiComment) : []
        setPostCommentsCount(postId, items.length)
        setCommentsByPost((prev) => {
          const current = prev[postId] ?? {}
          return {
            ...prev,
            [postId]: {
              ...current,
              items,
              loading: false,
              loaded: true,
              error: '',
              notice: '',
            },
          }
        })
      } catch (error) {
        setCommentsByPost((prev) => {
          const current = prev[postId] ?? {}
          return {
            ...prev,
            [postId]: {
              ...current,
              items: current.items ?? [],
              loading: false,
              loaded: Boolean(current.loaded),
              error:
                error instanceof Error
                  ? error.message
                  : 'Não foi possível carregar os comentários.',
            },
          }
        })
      }
    },
    [setPostCommentsCount],
  )

  const handleToggleComments = (postId) => {
    if (!postId) return

    if (activeCommentsPostId === postId) {
      setActiveCommentsPostId('')
      return
    }

    setActiveCommentsPostId(postId)

    const current = commentsByPost[postId]
    if (!current?.loaded && !current?.loading) {
      void loadCommentsForPost(postId)
    }
  }

  const handleReplyToComment = (postId, commentId) => {
    setActiveCommentsPostId(postId)
    setCommentsByPost((prev) => {
      const current = prev[postId] ?? {}
      return {
        ...prev,
        [postId]: {
          ...current,
          items: current.items ?? [],
          draft: current.draft ?? '',
          replyToId: commentId,
          error: '',
          notice: '',
        },
      }
    })
  }

  const handleCancelReply = (postId) => {
    setCommentsByPost((prev) => {
      const current = prev[postId] ?? {}
      return {
        ...prev,
        [postId]: {
          ...current,
          items: current.items ?? [],
          replyToId: '',
          error: '',
        },
      }
    })
  }

  const handleCreateComment = async (postId) => {
    const current = commentsByPost[postId] ?? {}
    const draft = String(current.draft ?? '')
    const text = draft.trim()
    const parentCommentId = current.replyToId || undefined

    if (current.loading || current.submitting) return

    if (!text) {
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: {
          ...(prev[postId] ?? {}),
          items: prev[postId]?.items ?? [],
          draft,
          submitting: false,
          error: 'Escreva algo antes de comentar.',
          notice: '',
        },
      }))
      return
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
          notice: '',
        },
      }))
      return
    }

    if (!token) {
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: {
          ...(prev[postId] ?? {}),
          items: prev[postId]?.items ?? [],
          draft: text,
          submitting: false,
          error: 'Faça login para comentar.',
          notice: '',
        },
      }))
      return
    }

    const previousItems = current.items ?? []
    const previousPost = posts.find((post) => post.id === postId)
    const previousCount = Number(
      previousPost?.counts?.replies ?? previousItems.length,
    )
    const optimisticId = `temp-comment-${postId}-${Date.now()}`
    const now = new Date().toISOString()
    const optimisticComment = {
      id: optimisticId,
      postId,
      authorId: me?.id ?? '',
      authorEmail: me?.email ?? sessionEmail,
      initials: userInitial,
      name: sessionName,
      handle: sessionHandle,
      time: 'agora',
      text,
      parentCommentId: parentCommentId ?? null,
      createdAt: now,
      updatedAt: now,
      pending: true,
    }

    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: {
        ...(prev[postId] ?? {}),
        items: [...(prev[postId]?.items ?? []), optimisticComment],
        draft: '',
        replyToId: current.replyToId ?? '',
        submitting: true,
        loaded: true,
        loading: false,
        error: '',
        notice: '',
      },
    }))
    setPostCommentsCount(postId, previousCount + 1)

    try {
      const res = await fetch(`${API_BASE}/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: text,
          ...(parentCommentId ? { parentCommentId } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (res.status === 401) {
          setToken('')
          throw new Error('Sua sessão expirou. Faça login novamente.')
        }

        throw new Error(data?.message ?? 'Não foi possível comentar.')
      }

      const created = data?.comment ? mapApiComment(data.comment) : null
      const commentsCount = Number(
        data?.commentsCount ?? (current.items?.length ?? 0) + 1,
      )

      setCommentsByPost((prev) => {
        const existing = prev[postId] ?? {}
        const items = existing.items ?? []
        const nextItems = created
          ? items.map((comment) =>
              comment.id === optimisticId ? created : comment,
            )
          : items.filter((comment) => comment.id !== optimisticId)

        return {
          ...prev,
          [postId]: {
            ...existing,
            items: nextItems,
            draft: '',
            replyToId: '',
            submitting: false,
            loaded: true,
            loading: false,
            error: '',
            notice: parentCommentId
              ? 'Resposta publicada.'
              : 'Comentário publicado.',
          },
        }
      })
      setPostCommentsCount(postId, commentsCount)
    } catch (error) {
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: {
          ...(prev[postId] ?? {}),
          items: (prev[postId]?.items ?? []).filter(
            (comment) => comment.id !== optimisticId,
          ),
          draft: text,
          replyToId: parentCommentId ?? '',
          submitting: false,
          loaded: Boolean(prev[postId]?.loaded),
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : 'Não foi possível comentar.',
          notice: '',
        },
      }))
      setPostCommentsCount(postId, previousCount)
    }
  }

  const handleDeleteComment = async (postId, commentId) => {
    const current = commentsByPost[postId] ?? {}
    const target = (current.items ?? []).find(
      (comment) => comment.id === commentId,
    )

    if (!target || target.pending || current.deletingIds?.includes(commentId)) {
      return
    }

    if (!token) {
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: {
          ...(prev[postId] ?? {}),
          items: prev[postId]?.items ?? [],
          error: 'Faça login para apagar comentários.',
          notice: '',
        },
      }))
      return
    }

    const previousPost = posts.find((post) => post.id === postId)
    const previousCount = Number(
      previousPost?.counts?.replies ?? current.items?.length ?? 0,
    )

    setCommentsByPost((prev) => {
      const existing = prev[postId] ?? {}
      const deletingIds = new Set(existing.deletingIds ?? [])
      deletingIds.add(commentId)

      return {
        ...prev,
        [postId]: {
          ...existing,
          items: existing.items ?? [],
          deletingIds: [...deletingIds],
          error: '',
          notice: '',
        },
      }
    })

    try {
      const res = await fetch(`${API_BASE}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (res.status === 401) {
          setToken('')
          throw new Error('Sua sessão expirou. Faça login novamente.')
        }

        throw new Error(
          data?.message ?? 'Não foi possível apagar o comentário.',
        )
      }

      const commentsCount = Number(
        data?.commentsCount ?? Math.max(0, previousCount - 1),
      )

      setCommentsByPost((prev) => {
        const existing = prev[postId] ?? {}
        return {
          ...prev,
          [postId]: {
            ...existing,
            items: removeCommentBranch(existing.items ?? [], commentId),
            deletingIds: (existing.deletingIds ?? []).filter(
              (id) => id !== commentId,
            ),
            error: '',
            notice: 'Comentário apagado.',
          },
        }
      })
      setPostCommentsCount(postId, commentsCount)
    } catch (error) {
      setCommentsByPost((prev) => {
        const existing = prev[postId] ?? {}
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
                : 'Não foi possível apagar o comentário.',
            notice: '',
          },
        }
      })
      setPostCommentsCount(postId, previousCount)
    }
  }

  // Envia login ou cadastro para o backend, dependendo do modo atual da tela.
  const handleAuth = async (event) => {
    event.preventDefault()
    setAuthError('')
    setComposerNotice('')

    // Validacoes simples antes de chamar a API.
    if (!email.trim() || !password.trim()) {
      setAuthError(
        authMode === 'login'
          ? 'Preencha e-mail ou usuário e senha para entrar.'
          : 'Preencha e-mail e senha para criar a conta.',
      )
      return
    }

    if (authMode === 'register') {
      const name = registerProfile.name.trim()
      const username = normalizeUsername(registerProfile.username)
      const bio = registerProfile.bio.trim()

      if (!name || !username) {
        setAuthError('Preencha nome e usuário para criar a conta.')
        return
      }

      if (!/^[a-z0-9_]{3,24}$/.test(username)) {
        setAuthError(
          'O usuário deve ter 3 a 24 caracteres, usando letras, números ou _.',
        )
        return
      }

      if (!registerProfile.role) {
        setAuthError('Escolha sua área principal.')
        return
      }

      if (registerProfile.interests.length === 0) {
        setAuthError('Escolha pelo menos um interesse.')
        return
      }

      if (registerProfile.interests.length > REGISTER_MAX_INTERESTS) {
        setAuthError(`Escolha no máximo ${REGISTER_MAX_INTERESTS} interesses.`)
        return
      }

      if (bio.length > 160) {
        setAuthError('A bio deve ter no máximo 160 caracteres.')
        return
      }

      if (!registerProfile.acceptedTerms) {
        setAuthError('Confirme a criação do perfil público básico.')
        return
      }

      if (password.length < 6) {
        setAuthError('A senha precisa ter pelo menos 6 caracteres.')
        return
      }

      if (password !== confirmPassword) {
        setAuthError('As senhas não conferem.')
        return
      }
    }

    setAuthLoading(true)

    try {
      // A mesma estrutura de formulario serve para duas rotas diferentes.
      const endpoint = authMode === 'login' ? 'login' : 'register'
      const registerPayload = {
        email: email.trim(),
        password,
        name: registerProfile.name.trim(),
        username: normalizeUsername(registerProfile.username),
        role: registerProfile.role,
        bio: registerProfile.bio.trim(),
        interests: registerProfile.interests,
      }
      const payload =
        authMode === 'login'
          ? { email: email.trim(), password }
          : registerPayload
      const res = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setAuthError(data?.message ?? 'Falha na autenticação.')
        return
      }

      setToken(data?.access_token ?? '')
      setMe(data?.user ?? null)
      setPassword('')
      setConfirmPassword('')
      setRegisterProfile(REGISTER_PROFILE_INITIAL)
      setSelectedProfile(null)
      setProfileError('')
      setAuthMode('login')
      setCurrentView('home')
      await fetchPosts(data?.access_token ?? '')
    } catch {
      setAuthError('Não foi possível conectar ao backend.')
    } finally {
      setAuthLoading(false)
    }
  }

  // Atalho de desenvolvimento:
  // 1. tenta entrar com a conta Dev,
  // 2. se nao existir, tenta cadastrar,
  // 3. se o cadastro disser que ja existe, tenta login novamente.
  const handleDevLogin = async () => {
    setAuthLoading(true)
    setAuthError('')
    setComposerNotice('')
    setEmail(DEV_ACCOUNT.email)
    setPassword(DEV_ACCOUNT.password)

    // Pequena funcao auxiliar para evitar repetir a mesma chamada de autenticacao.
    const tryAuth = async (endpoint) => {
      const res = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(DEV_ACCOUNT),
      })
      const data = await res.json().catch(() => ({}))
      return { res, data }
    }

    try {
      let { res, data } = await tryAuth('login')

      if (!res.ok) {
        const loginMessage = String(data?.message ?? '')
        const shouldTryRegister =
          res.status === 401 || /inv[aá]lid|credenciais/i.test(loginMessage)

        if (shouldTryRegister) {
          // Se a conta nao existe, tenta criacao automatica.
          const registerAttempt = await tryAuth('register')
          res = registerAttempt.res
          data = registerAttempt.data

          if (!res.ok) {
            // Se o cadastro falhar por duplicidade, significa que a conta ja existe e vale tentar login de novo.
            const duplicate = /já está em uso|already/i.test(
              String(data?.message ?? ''),
            )
            if (duplicate) {
              const secondLogin = await tryAuth('login')
              res = secondLogin.res
              data = secondLogin.data
            }
          }
        }
      }

      if (!res.ok) {
        setAuthError(
          data?.message ?? 'Não foi possível entrar com a conta Dev.',
        )
        return
      }

      setToken(data?.access_token ?? '')
      setMe(data?.user ?? null)
      setConfirmPassword('')
      setSelectedProfile(null)
      setProfileError('')
      setAuthMode('login')
      setCurrentView('home')
      await fetchPosts(data?.access_token ?? '')
    } catch {
      setAuthError('Não foi possível conectar ao backend para o login Dev.')
    } finally {
      setAuthLoading(false)
    }
  }

  // Limpa os dados de sessao local e volta a interface ao estado inicial.
  const handleLogout = () => {
    setToken('')
    setMe(null)
    setPassword('')
    setConfirmPassword('')
    setRegisterProfile(REGISTER_PROFILE_INITIAL)
    setUserMenuOpen(false)
    setContent('')
    setComposerError('')
    setComposerNotice('')
    setSelectedProfile(null)
    setProfileError('')
    setActiveCommentsPostId('')
    setCommentsByPost({})
    setNotifications([])
    setNotificationsError('')
    setNotificationsNotice('')
    setCurrentView('home')
  }

  // Funcoes pequenas para trocar de tela sem espalhar strings pela renderizacao.
  const openProfile = () => {
    setSelectedProfile(null)
    setProfileError('')
    setProfileLoading(false)
    setCurrentView('profile')
    setUserMenuOpen(false)
  }

  const openHome = () => {
    setSelectedProfile(null)
    setProfileError('')
    setCurrentView('home')
    setUserMenuOpen(false)
  }

  const openAlerts = () => {
    setSelectedProfile(null)
    setProfileError('')
    setCurrentView('alerts')
    setUserMenuOpen(false)
    setNotificationsNotice('')
    void fetchNotifications()
  }

  const openConversations = () => {
    setSelectedProfile(null)
    setProfileError('')
    setCurrentView('conversations')
    setUserMenuOpen(false)
  }

  const handleMarkNotificationRead = async (notificationId, quiet = false) => {
    if (!token || !notificationId) return

    setNotificationsError('')
    if (!quiet) setNotificationsNotice('')

    try {
      const res = await fetch(
        `${API_BASE}/notifications/${notificationId}/read`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (res.status === 401) {
          setToken('')
          throw new Error('Sua sessão expirou. Faça login novamente.')
        }

        throw new Error(data?.message ?? 'Não foi possível atualizar o alerta.')
      }

      const updated = mapApiNotification(data)
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId ? updated : notification,
        ),
      )
      if (!quiet) setNotificationsNotice('Alerta marcado como lido.')
    } catch (error) {
      setNotificationsError(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar o alerta.',
      )
    }
  }

  const handleMarkAllNotificationsRead = async () => {
    if (!token || unreadNotificationsCount === 0) return

    setNotificationsError('')
    setNotificationsNotice('')

    try {
      const res = await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (res.status === 401) {
          setToken('')
          throw new Error('Sua sessão expirou. Faça login novamente.')
        }

        throw new Error(
          data?.message ?? 'Não foi possível atualizar os alertas.',
        )
      }

      const readAt = new Date().toISOString()
      setNotifications((prev) =>
        prev.map((notification) => ({
          ...notification,
          readAt: notification.readAt ?? readAt,
        })),
      )
      setNotificationsNotice('Todos os alertas foram marcados como lidos.')
    } catch (error) {
      setNotificationsError(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar os alertas.',
      )
    }
  }

  const handleOpenNotificationPost = (notification) => {
    if (!notification?.postId) return

    setSelectedProfile(null)
    setProfileError('')
    setCurrentView('home')
    setActiveCommentsPostId(notification.postId)

    const current = commentsByPost[notification.postId]
    if (!current?.loaded && !current?.loading) {
      void loadCommentsForPost(notification.postId)
    }

    if (!notification.readAt) {
      void handleMarkNotificationRead(notification.id, true)
    }
  }

  const openUserProfile = async (post) => {
    const authorId = post?.authorId
    if (!authorId) return

    if (authorId === me?.id) {
      openProfile()
      return
    }

    setCurrentView('profile')
    setUserMenuOpen(false)
    setSelectedProfile({
      id: authorId,
      email: post.authorEmail,
      name: post.name,
      username: post.handle?.replace(/^@/, ''),
      createdAt: post.createdAt,
    })
    setProfileLoading(true)
    setProfileError('')

    try {
      const res = await fetch(`${API_BASE}/users/${authorId}`)
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setProfileError(
          data?.message ?? 'Não foi possível carregar este perfil.',
        )
        setSelectedProfile({
          id: authorId,
          email: post.authorEmail,
          name: post.name,
          username: post.handle?.replace(/^@/, ''),
          createdAt: post.createdAt,
        })
        return
      }

      setSelectedProfile(data?.user ?? null)
    } catch {
      setProfileError(
        'Backend indisponível. Não foi possível carregar este perfil.',
      )
      setSelectedProfile({
        id: authorId,
        email: post.authorEmail,
        name: post.name,
        username: post.handle?.replace(/^@/, ''),
        createdAt: post.createdAt,
      })
    } finally {
      setProfileLoading(false)
    }
  }

  const handleNotificationAuthorClick = (notification) => {
    openUserProfile({
      authorId: notification.actorId,
      authorEmail: notification.actorEmail,
      name: notification.actorName,
      handle: notification.actorHandle,
      createdAt: notification.createdAt,
    })
  }

  const switchAuthMode = (mode) => {
    setAuthMode(mode)
    setAuthError('')
    setPassword('')
    setConfirmPassword('')
  }

  const updateRegisterProfile = (field, value) => {
    setRegisterProfile((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  // Publica um novo post no backend e adiciona o resultado ao topo do feed.
  const handleCreatePost = async () => {
    const text = content.trim()
    if (!text) {
      setComposerError('Escreva algo antes de postar.')
      setComposerNotice('')
      return
    }

    if (!token) {
      setComposerError('Faça login para publicar.')
      setComposerNotice('')
      return
    }

    setCreateLoading(true)
    setComposerError('')
    setComposerNotice('')

    try {
      // Envia apenas o conteudo digitado. O autor vem do token.
      const res = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: text }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (res.status === 401) {
          setToken('')
          setComposerError('Sua sessão expirou. Faça login novamente.')
          return
        }

        setComposerError(data?.message ?? 'Não foi possível publicar o post.')
        return
      }

      setPosts((prev) => [mapApiPost(data), ...prev])
      setContent('')
      setComposerNotice('Post publicado.')
    } catch {
      setComposerError('Backend indisponível. Não foi possível publicar.')
    } finally {
      setCreateLoading(false)
    }
  }

  // Atalho de teclado para publicar mais rapido com Cmd/Ctrl + Enter.
  const handleComposerKeyDown = (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      handleCreatePost()
    }
  }

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
      />
    )
  }

  return (
    <div className="eureca-app">
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
                className={`nav-item ${item.view && currentView === item.view ? 'is-active' : ''}`}
                onClick={() => {
                  if (item.view === 'profile') openProfile()
                  if (item.view === 'home') openHome()
                  if (item.view === 'alerts') openAlerts()
                  if (item.view === 'conversations') openConversations()
                }}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
                {item.view === 'alerts' && unreadNotificationsCount > 0 ? (
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
            {currentView === 'profile' ? (
              <>
                {/* Tela de perfil: mostra dados basicos da conta e lista de posts do usuario. */}
                <div className="feed-head">
                  <h1>{isOwnProfile ? 'Perfil' : 'Perfil público'}</h1>
                </div>

                <section className="panel profile-page-card">
                  <div className="profile-cover" aria-hidden="true" />
                  <div className="profile-page-hero">
                    <div className="profile-page-avatar">{profileInitial}</div>
                    <div className="profile-page-meta">
                      <span className="profile-role-pill">
                        {profileUser?.role ?? 'Membro da comunidade'}
                      </span>
                      <h2>{profileName}</h2>
                      <p>{profileHandle}</p>
                      <div className="profile-meta-grid">
                        <span>
                          {isOwnProfile ? profileEmail : 'Perfil público'}
                        </span>
                        <span>Criada em {profileCreatedAt}</span>
                        <span>
                          {profileUser?.id
                            ? `ID ${profileUser.id.slice(0, 8)}`
                            : 'Conta autenticada'}
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
                    {isOwnProfile ? 'Seus posts' : `Posts de ${profileName}`}
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
                        ? 'Você ainda não publicou nada. Volte ao feed e faça seu primeiro post.'
                        : 'Este usuário ainda não tem posts visíveis no feed carregado.'}
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
            ) : currentView === 'alerts' ? (
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
            ) : currentView === 'conversations' ? (
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
                            ? 'is-active'
                            : ''
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
                              {CHAT_BOT_MESSAGES.at(-1)?.time ?? '--:--'}
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
                              {CHAT_BOT_CONTACT.status === 'online'
                                ? 'Online'
                                : 'Offline'}
                            </p>
                          </div>
                        </header>

                        <div className="chat-thread-body">
                          {CHAT_BOT_MESSAGES.map((message) => (
                            <div
                              key={message.id}
                              className={`chat-bubble-row ${
                                message.sender === 'me' ? 'is-me' : 'is-bot'
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

                <section className="panel composer-card">
                  {/* Area onde o usuario escreve um novo post. */}
                  <div className="composer-top">
                    <div className="composer-avatar">{userInitial}</div>
                    <textarea
                      className="composer-input"
                      placeholder="No que você tá pensando?"
                      value={content}
                      onChange={(event) => {
                        setContent(event.target.value)
                        if (composerError) setComposerError('')
                        if (composerNotice) setComposerNotice('')
                      }}
                      onKeyDown={handleComposerKeyDown}
                      maxLength={280}
                    />
                  </div>
                  <div className="composer-bottom">
                    <div className="composer-tools" aria-hidden="true">
                      <button type="button">
                        <Icon name="image" />
                      </button>
                      <button type="button">
                        <Icon name="smile" />
                      </button>
                      <button type="button">
                        <Icon name="calendar" />
                      </button>
                    </div>
                    <div className="composer-actions">
                      <span className="composer-counter">
                        {content.length}/280
                      </span>
                      <button
                        type="button"
                        className="post-btn"
                        onClick={handleCreatePost}
                        disabled={createLoading || !content.trim()}
                      >
                        {createLoading ? 'Postando...' : 'Postar'}
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

                  {posts.map((post) => (
                    <PostCard
                      key={post.id ?? `${post.handle}-${post.time}`}
                      post={post}
                      interactive
                      onToggleLike={handleToggleLike}
                      onToggleComments={handleToggleComments}
                      onViewed={handlePostViewed}
                      onAuthorClick={openUserProfile}
                      commentsOpen={activeCommentsPostId === post.id}
                    >
                      {activeCommentsPostId === post.id ? (
                        <CommentsPanel
                          post={post}
                          state={commentsByPost[post.id]}
                          draft={commentsByPost[post.id]?.draft ?? ''}
                          userInitial={userInitial}
                          maxLength={COMMENT_MAX_LENGTH}
                          currentUserId={me?.id ?? ''}
                          onDraftChange={(draft) =>
                            updateCommentDraft(post.id, draft)
                          }
                          onSubmit={() => handleCreateComment(post.id)}
                          onRefresh={() => loadCommentsForPost(post.id)}
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
                  ))}
                </div>
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

export default App
