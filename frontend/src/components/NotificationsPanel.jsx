import { formatCount, truncateText } from '../utils/formatters'

function getNotificationText(notification) {
  if (notification.type === 'comment_reply') {
    return `${notification.actorName} respondeu ao seu comentário.`
  }

  return `${notification.actorName} comentou no seu post.`
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
  onAuthorClick,
}) {
  return (
    <section className="panel notifications-page-card">
      <div className="notifications-head">
        <div>
          <h2>Atividade recente</h2>
          <span>{formatCount(unreadCount)} não lidos</span>
        </div>
        <div className="notifications-head-actions">
          <button type="button" className="mini-link-btn" onClick={onRefresh}>
            {loading ? 'Atualizando...' : 'Atualizar'}
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
        <div className="notifications-empty">Carregando alertas...</div>
      ) : null}

      {!loading && notifications.length === 0 ? (
        <div className="notifications-empty">
          Nenhum alerta ainda. Quando alguém comentar nos seus posts ou
          responder aos seus comentários, vai aparecer aqui.
        </div>
      ) : null}

      {notifications.length > 0 ? (
        <div className="notifications-list">
          {notifications.map((notification) => {
            const unread = !notification.readAt

            return (
              <article
                key={notification.id}
                className={`notification-item ${unread ? 'is-unread' : ''}`}
              >
                <button
                  type="button"
                  className="notification-avatar"
                  onClick={() => onAuthorClick?.(notification)}
                  aria-label={`Ver perfil de ${notification.actorName}`}
                >
                  {notification.actorInitials}
                </button>
                <div className="notification-body">
                  <div className="notification-line">
                    <strong>{getNotificationText(notification)}</strong>
                    <span>{notification.time}</span>
                  </div>
                  <p>{truncateText(notification.commentText, 150)}</p>
                  <small>
                    Post: {truncateText(notification.postText, 130)}
                  </small>
                  <div className="notification-actions">
                    <button
                      type="button"
                      onClick={() => onOpenPost?.(notification)}
                    >
                      Ver conversa
                    </button>
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
            )
          })}
        </div>
      ) : null}
    </section>
  )
}

export default NotificationsPanel
