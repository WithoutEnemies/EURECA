import { formatCount } from "../utils/formatters";
import { Icon } from "./Icons";

function buildCommentTree(comments) {
  const childrenByParent = new Map();

  comments.forEach((comment) => {
    const parentId = comment.parentCommentId ?? "";
    const children = childrenByParent.get(parentId) ?? [];
    children.push(comment);
    childrenByParent.set(parentId, children);
  });

  return childrenByParent;
}

function CommentsPanel({
  post,
  state,
  draft,
  userInitial,
  maxLength = 280,
  currentUserId,
  onDraftChange,
  onSubmit,
  onRefresh,
  onLoadMore,
  onLoadReplies,
  onAuthorClick,
  onReply,
  onCancelReply,
  onDelete,
}) {
  const comments = state?.items ?? [];
  const loading = Boolean(state?.loading);
  const loadingMore = Boolean(state?.loadingMore);
  const submitting = Boolean(state?.submitting);
  const error = state?.error ?? "";
  const notice = state?.notice ?? "";
  const count = Number(post?.counts?.replies ?? comments.length);
  const hasMore = Boolean(state?.hasMore);
  const replyToId = state?.replyToId ?? "";
  const replyTarget = comments.find((comment) => comment.id === replyToId);
  const childrenByParent = buildCommentTree(comments);
  const counterState =
    draft.length >= maxLength
      ? "is-max"
      : draft.length >= maxLength - 30
        ? "is-warn"
        : "";

  const renderComment = (comment, depth = 0) => {
    const deleting = Boolean(state?.deletingIds?.includes(comment.id));
    const children = childrenByParent.get(comment.id) ?? [];
    const directRepliesCount = Math.max(
      Number(comment.repliesCount ?? 0),
      children.length,
    );
    const replyPage = state?.replyPages?.[comment.id] ?? {};
    const loadingReplies = Boolean(replyPage.loading);
    const hasHiddenReplies =
      Boolean(replyPage.hasMore) || children.length < directRepliesCount;
    const showLoadReplies =
      !comment.pending &&
      !deleting &&
      directRepliesCount > 0 &&
      hasHiddenReplies;
    const replyButtonLabel = loadingReplies
      ? "Carregando respostas..."
      : !replyPage.loaded && children.length === 0
        ? `Ver ${formatCount(directRepliesCount)} ${
            directRepliesCount === 1 ? "resposta" : "respostas"
          }`
        : "Ver mais respostas";
    const canDelete =
      Boolean(currentUserId) &&
      !comment.pending &&
      (comment.authorId === currentUserId || post.authorId === currentUserId);
    const canReply = Boolean(currentUserId) && !comment.pending && !deleting;

    return (
      <div className="comment-thread" key={comment.id}>
        <article
          className={`comment-item ${comment.pending || deleting ? "is-pending" : ""}`}
          style={{ "--reply-depth": Math.min(depth, 4) }}
        >
          <button
            type="button"
            className="comment-avatar"
            onClick={() => onAuthorClick?.(comment)}
            aria-label={`Ver perfil de ${comment.name}`}
            disabled={comment.pending || deleting}
          >
            {comment.initials}
          </button>
          <div className="comment-body">
            <div className="comment-content-head">
              <div className="comment-line">
                <button
                  type="button"
                  onClick={() => onAuthorClick?.(comment)}
                  disabled={comment.pending || deleting}
                >
                  {comment.name}
                </button>
                {comment.authorBadge ? (
                  <span
                    className={`comment-author-badge is-${comment.authorBadge.tone}`}
                  >
                    {comment.authorBadge.label}
                  </span>
                ) : null}
                <span>{comment.handle}</span>
                <span>·</span>
                <span>
                  {comment.pending
                    ? "Enviando..."
                    : deleting
                      ? "Apagando..."
                      : comment.time}
                </span>
              </div>
              {canDelete ? (
                <button
                  type="button"
                  className="comment-icon-action is-danger"
                  onClick={() => onDelete?.(comment.id)}
                  aria-label="Apagar comentário"
                  title="Apagar comentário"
                  disabled={deleting}
                >
                  <Icon name="trash" />
                </button>
              ) : null}
            </div>
            <p>{comment.text}</p>
            <div className="comment-actions-row">
              {canReply ? (
                <button type="button" onClick={() => onReply?.(comment.id)}>
                  Responder
                </button>
              ) : null}
            </div>
          </div>
        </article>

        {children.length > 0 ? (
          <div className="comment-children">
            {children.map((child) => renderComment(child, depth + 1))}
          </div>
        ) : null}

        {replyPage.error ? (
          <p
            className="comment-feedback is-error comment-reply-feedback"
            style={{ "--reply-depth": Math.min(depth + 1, 4) }}
          >
            {replyPage.error}
          </p>
        ) : null}

        {showLoadReplies ? (
          <div
            className="comment-replies-more"
            style={{ "--reply-depth": Math.min(depth + 1, 4) }}
          >
            <button
              type="button"
              onClick={() => onLoadReplies?.(comment.id)}
              disabled={loadingReplies}
            >
              {replyButtonLabel}
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <section
      className="comments-panel"
      aria-label={`Comentários de ${post.name}`}
    >
      <div className="comments-head">
        <div>
          <strong>Comentários</strong>
          <span>{formatCount(count)} no post</span>
        </div>
        <button
          type="button"
          className="mini-link-btn"
          onClick={onRefresh}
          disabled={loading || loadingMore || submitting}
        >
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      {error ? (
        <p className="comment-feedback is-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="comment-feedback is-success" role="status">
          {notice}
        </p>
      ) : null}

      {loading && comments.length === 0 ? (
        <div className="comments-empty">Carregando comentários...</div>
      ) : null}

      {!loading && comments.length === 0 ? (
        <div className="comments-empty">
          Seja o primeiro a comentar este post.
        </div>
      ) : null}

      {comments.length > 0 ? (
        <div className="comments-list">
          {(childrenByParent.get("") ?? []).map((comment) =>
            renderComment(comment),
          )}
        </div>
      ) : null}

      {comments.length > 0 && hasMore ? (
        <div className="comment-load-more-row">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loading || loadingMore || submitting}
          >
            {loadingMore ? "Carregando..." : "Ver mais comentários"}
          </button>
        </div>
      ) : null}

      <form
        className="comment-composer"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit?.();
        }}
      >
        <div className="comment-avatar is-current">{userInitial}</div>
        <div className="comment-input-wrap">
          {replyTarget ? (
            <div className="reply-target">
              <span>Respondendo a {replyTarget.handle}</span>
              <button type="button" onClick={onCancelReply}>
                Cancelar
              </button>
            </div>
          ) : null}
          <textarea
            value={draft}
            onChange={(event) => onDraftChange?.(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                onSubmit?.();
              }
            }}
            placeholder={
              replyTarget
                ? `Responder a ${replyTarget.handle}...`
                : "Escreva um comentário..."
            }
            maxLength={maxLength}
            rows={2}
            disabled={submitting}
          />
          <div className="comment-composer-actions">
            <span className={counterState}>
              {draft.length}/{maxLength}
            </span>
            <button
              type="submit"
              disabled={loading || submitting || !draft.trim()}
            >
              {submitting
                ? replyTarget
                  ? "Respondendo..."
                  : "Comentando..."
                : replyTarget
                  ? "Responder"
                  : "Comentar"}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

export default CommentsPanel;
