import { formatCount, truncateText } from "../utils/formatters";

function getNotificationText(notification) {
  if (notification.title) {
    return notification.title;
  }

  if (notification.type === "comment_reply") {
    return `${notification.actorName} respondeu ao seu comentário`;
  }

  if (notification.type === "post_like") {
    return `${notification.actorName} curtiu seu post`;
  }

  if (notification.type === "private_message") {
    return `${notification.actorName} enviou uma mensagem`;
  }

  if (notification.type === "platform_notice") {
    return "Aviso da plataforma";
  }

  return `${notification.actorName} comentou no seu post`;
}

function getNotificationDetail(notification) {
  if (notification.body) {
    return notification.body;
  }

  if (notification.type === "private_message") {
    return notification.messageText;
  }

  if (notification.commentText) {
    return notification.commentText;
  }

  if (notification.type === "post_like") {
    return "Alguém interagiu com uma publicação sua.";
  }

  return "";
}

function getNotificationMeta(notification) {
  if (notification.type === "private_message") {
    return "Conversa privada";
  }

  if (notification.type === "platform_notice") {
    return "Eureca";
  }

  if (notification.postText) {
    return `Post: ${truncateText(notification.postText, 130)}`;
  }

  return "";
}

function getNotificationActionLabel(notification) {
  if (notification.type === "private_message") {
    return "Abrir conversa";
  }

  if (notification.postId) {
    return "Ver postagem";
  }

  return "";
}

function NotificationsPanel({
  notifications,
  loading,
  error,
  notice,
  unreadCount,
  onRefresh,
  onMarkAllRead,
  onMarkRead,
  onOpenPost,
  onOpenConversation,
  onAuthorClick,
}) {
  const handleOpenNotification = (notification) => {
    if (notification.type === "private_message") {
      onOpenConversation?.(notification);
      return;
    }

    onOpenPost?.(notification);
  };

  return (
    <section className="panel notifications-page-card">
      <div className="notifications-head">
        <div>
          <h2>Central de notificações</h2>
          <span>{formatCount(unreadCount)} não lidos</span>
        </div>
        <div className="notifications-head-actions">
          <button type="button" className="mini-link-btn" onClick={onRefresh}>
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
          <button
            type="button"
            className="mini-link-btn"
            onClick={onMarkAllRead}
            disabled={loading || unreadCount === 0}
          >
            Marcar todos como lidos
          </button>
        </div>
      </div>

      {error ? (
        <p className="notification-feedback is-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="notification-feedback is-success" role="status">
          {notice}
        </p>
      ) : null}

      {loading && notifications.length === 0 ? (
        <div className="notifications-empty">Carregando notificações...</div>
      ) : null}

      {!loading && notifications.length === 0 ? (
        <div className="notifications-empty">
          Nenhuma notificação ainda. Interações em posts, mensagens privadas e
          avisos da plataforma vão aparecer aqui.
        </div>
      ) : null}

      {notifications.length > 0 ? (
        <div className="notifications-list">
          {notifications.map((notification) => {
            const unread = !notification.readAt;
            const detail = getNotificationDetail(notification);
            const meta = getNotificationMeta(notification);
            const actionLabel = getNotificationActionLabel(notification);

            return (
              <article
                key={notification.id}
                className={`notification-item ${unread ? "is-unread" : ""}`}
              >
                {notification.actorId ? (
                  <button
                    type="button"
                    className="notification-avatar"
                    onClick={() => onAuthorClick?.(notification)}
                    aria-label={`Ver perfil de ${notification.actorName}`}
                  >
                    {notification.actorInitials}
                  </button>
                ) : (
                  <div
                    className="notification-avatar is-system"
                    aria-hidden="true"
                  >
                    {notification.actorInitials}
                  </div>
                )}
                <div className="notification-body">
                  <div className="notification-line">
                    <strong>{getNotificationText(notification)}</strong>
                    <span>{notification.time}</span>
                  </div>
                  {detail ? <p>{truncateText(detail, 150)}</p> : null}
                  {meta ? <small>{meta}</small> : null}
                  <div className="notification-actions">
                    {actionLabel ? (
                      <button
                        type="button"
                        onClick={() => handleOpenNotification(notification)}
                      >
                        {actionLabel}
                      </button>
                    ) : null}
                    {unread ? (
                      <button
                        type="button"
                        onClick={() => onMarkRead?.(notification.id)}
                      >
                        Marcar como lido
                      </button>
                    ) : null}
                  </div>
                </div>
                {unread ? (
                  <span
                    className="notification-unread-dot"
                    aria-hidden="true"
                  />
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export default NotificationsPanel;
