import NotificationsPanel from "../components/NotificationsPanel";

function AlertsView({
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
  return (
    <>
      <div className="feed-head">
        <h1>Notificações</h1>
      </div>

      <NotificationsPanel
        notifications={notifications}
        loading={loading}
        error={error}
        notice={notice}
        unreadCount={unreadCount}
        onRefresh={onRefresh}
        onMarkAllRead={onMarkAllRead}
        onMarkRead={onMarkRead}
        onOpenPost={onOpenPost}
        onOpenConversation={onOpenConversation}
        onAuthorClick={onAuthorClick}
      />
    </>
  );
}

export default AlertsView;
