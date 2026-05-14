import { useMemo, useState } from "react";

const CHAT_FILTERS = [
  { value: "all", label: "Todas" },
  { value: "unread", label: "Não lidas" },
];

function normalizeChatText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function ConversationsView({
  conversations,
  conversationsLoading,
  conversationsError,
  socketConnected,
  conversationCandidates,
  conversationStarting,
  activeConversation,
  activeConversationState,
  currentUserId,
  onRefreshConversations,
  onSelectConversation,
  onLoadMoreMessages,
  onDraftChange,
  onSendMessage,
  onStartConversation,
  onOpenExplore,
}) {
  const activeConversationId = activeConversation?.id ?? "";
  const messages = activeConversationState?.items ?? [];
  const draft = activeConversationState?.draft ?? "";
  const canSend = draft.trim().length > 0 && !activeConversationState?.sending;
  const [conversationQuery, setConversationQuery] = useState("");
  const [conversationFilter, setConversationFilter] = useState("all");
  const [startPanelOpen, setStartPanelOpen] = useState(false);
  const [startQuery, setStartQuery] = useState("");

  const unreadConversationsCount = useMemo(
    () =>
      conversations.filter((conversation) => conversation.unreadCount > 0)
        .length,
    [conversations],
  );
  const normalizedQuery = normalizeChatText(conversationQuery);
  const filteredConversations = useMemo(
    () =>
      conversations.filter((conversation) => {
        const matchesFilter =
          conversationFilter !== "unread" || conversation.unreadCount > 0;

        if (!matchesFilter) return false;
        if (!normalizedQuery) return true;

        return normalizeChatText(
          [
            conversation.title,
            conversation.subtitle,
            conversation.preview,
            conversation.lastMessage?.text,
            conversation.otherParticipants
              ?.map((participant) =>
                [participant.name, participant.handle, participant.email].join(
                  " ",
                ),
              )
              .join(" "),
          ].join(" "),
        ).includes(normalizedQuery);
      }),
    [conversationFilter, conversations, normalizedQuery],
  );
  const hasConversationFilters =
    Boolean(normalizedQuery) || conversationFilter !== "all";
  const normalizedStartQuery = normalizeChatText(startQuery);
  const filteredCandidates = useMemo(
    () =>
      (conversationCandidates ?? []).filter((candidate) => {
        if (!normalizedStartQuery) return true;

        return normalizeChatText(
          [
            candidate.name,
            candidate.handle,
            candidate.email,
            candidate.role,
            candidate.context,
          ].join(" "),
        ).includes(normalizedStartQuery);
      }),
    [conversationCandidates, normalizedStartQuery],
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    if (canSend) onSendMessage(activeConversationId);
  };

  const handleStartConversation = async (candidateId) => {
    if (!candidateId || conversationStarting) return;

    await onStartConversation?.(candidateId);
    setStartPanelOpen(false);
    setStartQuery("");
  };

  return (
    <>
      <div className="feed-head">
        <h1>Conversas</h1>
      </div>

      <section className="panel chat-page-card">
        <aside className="chat-list-panel" aria-label="Lista de conversas">
          <div className="chat-list-head">
            <div>
              <h2>Pessoas</h2>
              <small>
                {conversationsLoading
                  ? "Carregando conversas..."
                  : hasConversationFilters
                    ? `${filteredConversations.length}/${conversations.length} conversas`
                    : `${conversations.length} ${
                        conversations.length === 1 ? "conversa" : "conversas"
                      }`}
              </small>
              <span
                className={`chat-live-status ${
                  socketConnected ? "is-online" : ""
                }`}
              >
                {socketConnected ? "Tempo real ativo" : "Atualização por polling"}
              </span>
            </div>
            <button
              type="button"
              className="mini-link-btn"
              onClick={onRefreshConversations}
            >
              Atualizar
            </button>
          </div>

          <div className="chat-list-tools">
            <label className="chat-search">
              <span>Buscar</span>
              <input
                type="search"
                value={conversationQuery}
                placeholder="Nome, @handle ou mensagem"
                onChange={(event) => setConversationQuery(event.target.value)}
              />
              {conversationQuery ? (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => setConversationQuery("")}
                >
                  Limpar
                </button>
              ) : null}
            </label>

            <div className="chat-filter-row" aria-label="Filtrar conversas">
              {CHAT_FILTERS.map((filter) => {
                const count =
                  filter.value === "unread"
                    ? unreadConversationsCount
                    : conversations.length;

                return (
                  <button
                    key={filter.value}
                    type="button"
                    className={
                      conversationFilter === filter.value ? "is-active" : ""
                    }
                    aria-pressed={conversationFilter === filter.value}
                    onClick={() => setConversationFilter(filter.value)}
                  >
                    <span>{filter.label}</span>
                    <strong>{count}</strong>
                  </button>
                );
              })}
            </div>
          </div>

          {conversationsError ? (
            <p className="chat-feedback is-error">{conversationsError}</p>
          ) : null}

          {conversationsLoading && conversations.length === 0 ? (
            <div className="chat-list is-empty">
              <div className="chat-list-empty">
                <span>...</span>
                <strong>Carregando</strong>
                <p>Buscando suas conversas mais recentes.</p>
              </div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="chat-list is-empty">
              <div className="chat-list-empty">
                <span>0</span>
                <strong>Sem conversas</strong>
                <p>Clique no + para iniciar uma conversa.</p>
              </div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="chat-list is-empty">
              <div className="chat-list-empty">
                <span>0</span>
                <strong>Nada encontrado</strong>
                <p>Ajuste a busca ou volte para todas as conversas.</p>
              </div>
            </div>
          ) : (
            <div className="chat-list">
              {filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={`chat-list-item ${
                    conversation.id === activeConversationId ? "is-active" : ""
                  }`}
                  onClick={() => onSelectConversation(conversation.id)}
                >
                  <div className="chat-avatar">{conversation.initials}</div>
                  <div className="chat-item-meta">
                    <div className="chat-item-row">
                      <strong>{conversation.title}</strong>
                      <span>{conversation.lastMessage?.time ?? conversation.time}</span>
                    </div>
                    <div className="chat-item-row muted">
                      <span>{conversation.subtitle}</span>
                      <p>{conversation.preview}</p>
                    </div>
                  </div>
                  {conversation.unreadCount > 0 ? (
                    <span className="chat-unread-badge">
                      {conversation.unreadCount}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="chat-thread-panel" aria-label="Conversa ativa">
          {activeConversation ? (
            <>
              <header className="chat-thread-head">
                <div className="chat-avatar is-large">
                  {activeConversation.initials}
                </div>
                <div>
                  <strong>{activeConversation.title}</strong>
                  <p>{activeConversation.subtitle}</p>
                </div>
              </header>

              <div className="chat-thread-body">
                {activeConversationState?.hasMore ? (
                  <button
                    type="button"
                    className="chat-load-more"
                    onClick={onLoadMoreMessages}
                    disabled={activeConversationState?.loadingMore}
                  >
                    {activeConversationState?.loadingMore
                      ? "Carregando..."
                      : "Carregar anteriores"}
                  </button>
                ) : null}

                {activeConversationState?.loading && messages.length === 0 ? (
                  <div className="chat-thread-empty">
                    <p>Carregando mensagens...</p>
                  </div>
                ) : null}

                {!activeConversationState?.loading && messages.length === 0 ? (
                  <div className="chat-thread-empty">
                    <p>Sem mensagens ainda. Envie a primeira mensagem.</p>
                  </div>
                ) : null}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`chat-bubble-row ${
                      message.senderId === currentUserId ? "is-me" : ""
                    }`}
                  >
                    <div className="chat-bubble">
                      {message.senderId !== currentUserId ? (
                        <strong>{message.sender.name}</strong>
                      ) : null}
                      <p>{message.text}</p>
                      <span>{message.time}</span>
                    </div>
                  </div>
                ))}
              </div>

              {activeConversationState?.error ? (
                <p className="chat-feedback is-error">
                  {activeConversationState.error}
                </p>
              ) : null}

              <form className="chat-thread-composer" onSubmit={handleSubmit}>
                <input
                  type="text"
                  placeholder="Escreva uma mensagem"
                  value={draft}
                  maxLength={1000}
                  onChange={(event) =>
                    onDraftChange(activeConversationId, event.target.value)
                  }
                />
                <button type="submit" disabled={!canSend}>
                  {activeConversationState?.sending ? "Enviando..." : "Enviar"}
                </button>
              </form>
            </>
          ) : (
            <div className="chat-thread-empty">
              <div
                className={`chat-thread-empty-card ${
                  startPanelOpen ? "is-starting" : ""
                }`}
              >
                {!startPanelOpen ? (
                  <>
                    <button
                      type="button"
                      className="chat-start-plus"
                      aria-label="Iniciar nova conversa"
                      onClick={() => setStartPanelOpen(true)}
                    >
                      +
                    </button>
                    <h2>Inicie uma conversa</h2>
                    <p>
                      Clique no + para escolher alguém da comunidade e começar
                      um chat.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="chat-start-head">
                      <div>
                        <h2>Nova conversa</h2>
                        <p>Escolha alguém que já apareceu no feed.</p>
                      </div>
                      <button
                        type="button"
                        aria-label="Fechar nova conversa"
                        onClick={() => {
                          setStartPanelOpen(false);
                          setStartQuery("");
                        }}
                      >
                        ×
                      </button>
                    </div>

                    <label className="chat-search chat-start-search">
                      <span>Buscar pessoa</span>
                      <input
                        type="search"
                        value={startQuery}
                        placeholder="Nome, @handle ou tema"
                        onChange={(event) => setStartQuery(event.target.value)}
                      />
                    </label>

                    {filteredCandidates.length > 0 ? (
                      <div className="chat-start-list">
                        {filteredCandidates.slice(0, 8).map((candidate) => (
                          <button
                            key={candidate.id}
                            type="button"
                            className="chat-start-person"
                            onClick={() => handleStartConversation(candidate.id)}
                            disabled={conversationStarting}
                          >
                            <span className="chat-avatar">
                              {candidate.initials}
                            </span>
                            <span>
                              <strong>{candidate.name}</strong>
                              <small>
                                {candidate.handle} · {candidate.role}
                              </small>
                              <em>{candidate.context}</em>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="chat-start-empty">
                        <strong>Nenhuma pessoa disponível</strong>
                        <p>
                          Abra o Explorar para encontrar perfis com publicações
                          reais.
                        </p>
                        <button type="button" onClick={onOpenExplore}>
                          Ir para Explorar
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </section>
    </>
  );
}

export default ConversationsView;
