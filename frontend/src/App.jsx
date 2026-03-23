import { useEffect, useMemo, useRef, useState } from 'react'
import AuthScreen from './components/AuthScreen'
import { Icon, WaveMark } from './components/Icons'
import PostCard from './components/PostCard'
import Sidebar from './components/Sidebar'
import { DEV_ACCOUNT, navItems, suggestions, trends } from './constants/uiData'
import { emailToInitials, formatCount, mapApiPost, truncateText } from './utils/formatters'
import './App.css'

// Endereco base da API.
// Em producao, isso pode vir da variavel VITE_API_URL; localmente cai no backend da porta 3000.
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

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

function App() {
  // Estados principais da autenticacao e dos campos do formulario.
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // Estados ligados a sessao atual e navegacao interna da interface.
  const [token, setToken] = useState(() => localStorage.getItem('eureca_token') ?? '')
  const [me, setMe] = useState(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [currentView, setCurrentView] = useState('home')

  // Estados do feed, criacao de posts e feedbacks visuais para o usuario.
  const [posts, setPosts] = useState([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [feedError, setFeedError] = useState('')
  const [content, setContent] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [composerError, setComposerError] = useState('')
  const [composerNotice, setComposerNotice] = useState('')
  const [selectedConversationId, setSelectedConversationId] = useState(CHAT_BOT_CONTACT.id)
  const userMenuRef = useRef(null)

  // Valores derivados: nao sao digitados pelo usuario, mas calculados a partir do estado atual.
  const isLoggedIn = Boolean(token)
  const activeEmail = me?.email ?? email

  // Gera as iniciais do usuario ativo para avatar e pequenos badges.
  const userInitial = useMemo(() => emailToInitials(activeEmail), [activeEmail])

  // Filtra apenas os posts que parecem pertencer ao usuario atual.
  // A comparacao e feita com base no "handle" montado a partir do email.
  const myPosts = useMemo(() => {
    if (!activeEmail) return []
    return posts.filter((post) => {
      const postHandle = (post.handle ?? '').replace(/^@/, '').toLowerCase()
      const local = (activeEmail.split('@')[0] ?? '').toLowerCase()
      return postHandle === local
    })
  }, [posts, activeEmail])
  const latestMyPost = myPosts[0] ?? null
  const latestMyPostPreview = latestMyPost
    ? truncateText(latestMyPost.text, 110)
    : 'Você ainda não publicou nenhum post. Crie seu primeiro post para aparecer aqui.'

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
  }, [token])

  // Quando existe token, busca os dados do usuario autenticado.
  useEffect(() => {
    if (!token) {
      setMe(null)
      return
    }

    fetchMe()
  }, [token])

  // Consulta a rota protegida /users/me para descobrir quem esta autenticado.
  const fetchMe = async () => {
    try {
      const res = await fetch(`${API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        if (res.status === 401) {
          setToken('')
        }
        setMe(null)
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
    }
  }

  // Busca a lista de posts e converte o formato da API para o formato esperado pela interface.
  const fetchPosts = async (authToken = token) => {
    const safeToken = typeof authToken === 'string' ? authToken : token
    setPostsLoading(true)
    setFeedError('')

    try {
      const endpoint = safeToken ? `${API_BASE}/posts/me/feed` : `${API_BASE}/posts`
      const res = await fetch(endpoint, {
        headers: safeToken ? { Authorization: `Bearer ${safeToken}` } : undefined,
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
  }

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
        const nextLikes = Math.max(0, (post.counts?.likes ?? 0) + (isCurrentlyLiked ? -1 : 1))
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
      setComposerError(error instanceof Error ? error.message : 'Erro ao curtir post.')
    }
  }

  // Registra uma visualizacao do post.
  // Usa a mesma ideia de atualizacao otimista: soma primeiro na tela e corrige depois.
  const handleAddView = async (postId) => {
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
      const res = await fetch(`${API_BASE}/posts/${postId}/view`, { method: 'POST' })
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
          ? 'Preencha e-mail e senha para entrar.'
          : 'Preencha e-mail e senha para criar a conta.',
      )
      return
    }

    if (authMode === 'register') {
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
      const res = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
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
        const shouldTryRegister = res.status === 401 || /inv[aá]lid|credenciais/i.test(loginMessage)

        if (shouldTryRegister) {
          // Se a conta nao existe, tenta criacao automatica.
          const registerAttempt = await tryAuth('register')
          res = registerAttempt.res
          data = registerAttempt.data

          if (!res.ok) {
            // Se o cadastro falhar por duplicidade, significa que a conta ja existe e vale tentar login de novo.
            const duplicate = /já está em uso|already/i.test(String(data?.message ?? ''))
            if (duplicate) {
              const secondLogin = await tryAuth('login')
              res = secondLogin.res
              data = secondLogin.data
            }
          }
        }
      }

      if (!res.ok) {
        setAuthError(data?.message ?? 'Não foi possível entrar com a conta Dev.')
        return
      }

      setToken(data?.access_token ?? '')
      setMe(data?.user ?? null)
      setConfirmPassword('')
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
    setUserMenuOpen(false)
    setContent('')
    setComposerError('')
    setComposerNotice('')
    setCurrentView('home')
  }

  // Funcoes pequenas para trocar de tela sem espalhar strings pela renderizacao.
  const openProfile = () => {
    setCurrentView('profile')
    setUserMenuOpen(false)
  }

  const openHome = () => {
    setCurrentView('home')
    setUserMenuOpen(false)
  }

  const openConversations = () => {
    setCurrentView('conversations')
    setUserMenuOpen(false)
  }

  const switchAuthMode = (mode) => {
    setAuthMode(mode)
    setAuthError('')
    setPassword('')
    setConfirmPassword('')
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
        authError={authError}
        authLoading={authLoading}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onConfirmPasswordChange={setConfirmPassword}
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
                  if (item.view === 'conversations') openConversations()
                }}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Menu da conta com acoes de perfil e logout. */}
          <div className="topbar-actions">
            <button type="button" className="new-wave-btn" title="Assinatura premium (visual)">
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
                      <strong>{activeEmail || 'Usuário'}</strong>
                      <small>Conta ativa</small>
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
                  <h1>Perfil</h1>
                </div>

                <section className="panel profile-page-card">
                  <div className="profile-page-hero">
                    <div className="profile-page-avatar">{userInitial}</div>
                    <div className="profile-page-meta">
                      <h2>{activeEmail || 'Usuário'}</h2>
                      <p>@{(activeEmail.split('@')[0] ?? 'usuario').toLowerCase()}</p>
                      <small>
                        {me?.id ? `ID: ${me.id}` : 'Conta autenticada'} ·{' '}
                        {me?.createdAt
                          ? `Criada em ${new Date(me.createdAt).toLocaleDateString('pt-BR')}`
                          : 'Sessão ativa'}
                      </small>
                    </div>
                    <button type="button" className="follow-btn profile-edit-btn" onClick={openHome}>
                      Voltar ao feed
                    </button>
                  </div>

                  <div className="profile-stats">
                    <div className="profile-stat">
                      <span>{myPosts.length}</span>
                      <small>Posts</small>
                    </div>
                    <div className="profile-stat">
                      <span>{posts.length}</span>
                      <small>No feed</small>
                    </div>
                    <div className="profile-stat">
                      <span>{emailToInitials(activeEmail)}</span>
                      <small>Badge</small>
                    </div>
                  </div>

                  <div className="profile-bio panel">
                    <h3>Sobre</h3>
                    <p>
                      Conta de teste da Eureca. Aqui você pode ver informações básicas da sessão e seus posts publicados.
                    </p>
                  </div>
                </section>

                <div className="section-title-row">
                  <h3>Seus posts</h3>
                  <button type="button" className="mini-link-btn" onClick={() => fetchPosts()}>
                    Atualizar
                  </button>
                </div>

                <div className="post-list">
                  {postsLoading ? (
                    <div className="panel post-card empty-state">Carregando posts...</div>
                  ) : null}

                  {!postsLoading && myPosts.length === 0 ? (
                    <div className="panel post-card empty-state">
                      Você ainda não publicou nada. Volte ao feed e faça seu primeiro post.
                    </div>
                  ) : null}

                  {myPosts.map((post) => (
                    <PostCard key={post.id ?? `${post.handle}-${post.time}`} post={post} />
                  ))}
                </div>
              </>
            ) : currentView === 'conversations' ? (
              <>
                {/* Tela de conversas: ainda mockada, mas ja organizada em lista + conversa ativa. */}
                <div className="feed-head">
                  <h1>Conversas</h1>
                </div>

                <section className="panel chat-page-card">
                  <aside className="chat-list-panel" aria-label="Lista de conversas">
                    <div className="chat-list-head">
                      <h2>Pessoas</h2>
                      <small>1 conversa disponível</small>
                    </div>

                    <div className="chat-list">
                      <button
                        type="button"
                        className={`chat-list-item ${
                          selectedConversationId === CHAT_BOT_CONTACT.id ? 'is-active' : ''
                        }`}
                        onClick={() => setSelectedConversationId(CHAT_BOT_CONTACT.id)}
                      >
                        <div className="chat-avatar">{CHAT_BOT_CONTACT.initials}</div>
                        <div className="chat-item-meta">
                          <div className="chat-item-row">
                            <strong>{CHAT_BOT_CONTACT.name}</strong>
                            <span>{CHAT_BOT_MESSAGES.at(-1)?.time ?? '--:--'}</span>
                          </div>
                          <div className="chat-item-row muted">
                            <span>{CHAT_BOT_CONTACT.handle}</span>
                            <p>{CHAT_BOT_CONTACT.preview}</p>
                          </div>
                        </div>
                      </button>
                    </div>
                  </aside>

                  <section className="chat-thread-panel" aria-label="Conversa ativa">
                    {selectedConversationId === CHAT_BOT_CONTACT.id ? (
                      <>
                        <header className="chat-thread-head">
                          <div className="chat-avatar is-large">{CHAT_BOT_CONTACT.initials}</div>
                          <div>
                            <strong>{CHAT_BOT_CONTACT.name}</strong>
                            <p>{CHAT_BOT_CONTACT.status === 'online' ? 'Online' : 'Offline'}</p>
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
                      <button type="button"><Icon name="image" /></button>
                      <button type="button"><Icon name="smile" /></button>
                      <button type="button"><Icon name="calendar" /></button>
                    </div>
                    <div className="composer-actions">
                      <span className="composer-counter">{content.length}/280</span>
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
                  {composerError ? <p className="composer-feedback is-error">{composerError}</p> : null}
                  {composerNotice ? <p className="composer-feedback is-success">{composerNotice}</p> : null}
                </section>

                {feedError ? <p className="feed-feedback is-error">{feedError}</p> : null}

                {/* Lista do feed, incluindo estados de carregamento e vazio. */}
                <div className="post-list">
                  {postsLoading ? (
                    <div className="panel post-card empty-state">Carregando posts...</div>
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
                      onAddView={handleAddView}
                    />
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
