import { useEffect, useRef } from "react";
import { Icon } from "./Icons";

// Card visual de um post.
// Pode funcionar em modo simples (so exibicao) ou interativo (com botoes ativos).
function PostCard({
  post,
  interactive = false,
  onToggleLike,
  onToggleComments,
  onViewed,
  onAuthorClick,
  commentsOpen = false,
  commentPreview = [],
  commentPreviewLoading = false,
  feedContext = null,
  children,
}) {
  const cardRef = useRef(null);
  const repliesCount = Number(post.counts?.replies ?? 0);
  const likesCount = Number(post.counts?.likes ?? 0);
  const viewsCount = Number(post.counts?.views ?? 0);
  const hasDiscussion = repliesCount > 0;
  const engagementLabel = hasDiscussion
    ? `${post.stats.replies} ${repliesCount === 1 ? "comentário" : "comentários"}`
    : viewsCount > 0
      ? `${post.stats.views} ${viewsCount === 1 ? "view" : "views"}`
      : "Novo no feed";
  const socialLabel = feedContext?.label
    ? feedContext.label
    : hasDiscussion
      ? "Discussão ativa"
      : likesCount > 0
        ? "Recebendo curtidas"
        : "Novo post";
  const socialMeta = feedContext?.meta ?? "";
  const showCommentPreview =
    !commentsOpen &&
    (commentPreviewLoading || commentPreview.length > 0 || hasDiscussion);

  useEffect(() => {
    if (!interactive || !post.id || !onViewed || !cardRef.current) {
      return undefined;
    }

    const card = cardRef.current;
    let viewTimer = null;

    const registerView = () => {
      viewTimer = window.setTimeout(() => {
        onViewed(post.id);
      }, 700);
    };

    if (!("IntersectionObserver" in window)) {
      registerView();
      return () => window.clearTimeout(viewTimer);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
          if (!viewTimer) registerView();
          return;
        }

        if (viewTimer) {
          window.clearTimeout(viewTimer);
          viewTimer = null;
        }
      },
      { threshold: [0, 0.55] },
    );

    observer.observe(card);

    return () => {
      observer.disconnect();
      if (viewTimer) window.clearTimeout(viewTimer);
    };
  }, [interactive, onViewed, post.id]);

  return (
    <article
      className={`panel post-card ${interactive ? "is-interactive" : ""} ${
        commentsOpen ? "has-open-comments" : ""
      }`}
      ref={cardRef}
    >
      <div className="post-context" aria-label={socialLabel}>
        <span className="post-context-dot" />
        <span>{socialLabel}</span>
        {socialMeta ? <strong>{socialMeta}</strong> : null}
      </div>

      {/* Cabecalho com avatar, autor, horario e texto do post. */}
      <div className="post-header">
        <button
          type="button"
          className="post-avatar post-author-trigger"
          onClick={() => onAuthorClick?.(post)}
          aria-label={`Ver perfil de ${post.name}`}
        >
          {post.initials}
          <span className="post-avatar-status" aria-hidden="true" />
        </button>
        <div className="post-meta">
          <div className="post-header-row">
            <div className="post-line">
              <button
                type="button"
                className="post-author-name"
                onClick={() => onAuthorClick?.(post)}
              >
                {post.name}
              </button>
              {post.authorBadge ? (
                <span
                  className={`post-author-badge is-${post.authorBadge.tone}`}
                >
                  {post.authorBadge.label}
                </span>
              ) : null}
              <button
                type="button"
                className="post-author-handle"
                onClick={() => onAuthorClick?.(post)}
              >
                {post.handle}
              </button>
              <span>·</span>
              <span>{post.time}</span>
              {post.activityStatus ? (
                <>
                  <span>·</span>
                  <span className="post-author-state">
                    {post.activityStatus}
                  </span>
                </>
              ) : null}
            </div>
            {interactive ? (
              <button
                type="button"
                className="post-more-btn"
                aria-label="Mais opções do post"
                disabled
              >
                <Icon name="more" />
              </button>
            ) : null}
          </div>
          <p className="post-copy">{post.text}</p>
        </div>
      </div>

      {/* As acoes so aparecem quando a tela quer permitir interacao com o post. */}
      {interactive ? (
        <>
          <button
            type="button"
            className="post-discussion-strip"
            onClick={() => onToggleComments?.(post.id)}
            aria-expanded={commentsOpen}
          >
            <span>{engagementLabel}</span>
            <strong>
              {commentsOpen ? "Fechar conversa" : "Abrir conversa"}
            </strong>
          </button>

          {showCommentPreview ? (
            <div className="post-comment-preview">
              {commentPreviewLoading && commentPreview.length === 0 ? (
                <div className="post-comment-preview-item is-loading">
                  <span />
                  <p>
                    <strong>Carregando respostas</strong>
                    Buscando comentários recentes...
                  </p>
                </div>
              ) : commentPreview.length > 0 ? (
                commentPreview.slice(0, 2).map((comment) => (
                  <button
                    key={comment.id}
                    type="button"
                    className="post-comment-preview-item"
                    onClick={() => onToggleComments?.(post.id)}
                  >
                    <span>{comment.initials}</span>
                    <p>
                      <strong>{comment.name}</strong>
                      {comment.text}
                      <small>
                        {comment.handle} · {comment.time}
                      </small>
                    </p>
                  </button>
                ))
              ) : (
                <button
                  type="button"
                  className="post-comment-preview-item is-placeholder"
                  onClick={() => onToggleComments?.(post.id)}
                >
                  <span>+</span>
                  <p>
                    <strong>{post.stats.replies} respostas</strong>
                    Abra a discussão para ler os comentários.
                  </p>
                </button>
              )}
              <button
                type="button"
                className="post-quick-reply"
                onClick={() => onToggleComments?.(post.id)}
              >
                <Icon name="message" />
                <span>Responder nesta discussão...</span>
              </button>
            </div>
          ) : null}

          <div className="post-actions">
            <button
              type="button"
              className={`action-btn comment-action ${
                commentsOpen ? "is-active" : ""
              }`}
              data-tooltip={
                commentsOpen ? "Fechar comentários" : "Abrir comentários"
              }
              onClick={() => onToggleComments?.(post.id)}
              aria-expanded={commentsOpen}
              aria-label={
                commentsOpen ? "Fechar comentários" : "Abrir comentários"
              }
            >
              <Icon name="message" />
              <span>Responder</span>
              <strong>{post.stats.replies}</strong>
            </button>
            <button
              type="button"
              className="action-btn"
              aria-label="Repostar em breve"
              data-tooltip="Repostar em breve"
              disabled
            >
              <Icon name="repost" />
              <span>Repostar</span>
              <strong>{post.stats.reposts}</strong>
            </button>
            <button
              type="button"
              className={`action-btn like-action ${post.liked ? "liked" : ""}`}
              data-tooltip={post.liked ? "Remover curtida" : "Curtir post"}
              onClick={() => onToggleLike?.(post.id, post.liked)}
              aria-pressed={post.liked}
              aria-label={post.liked ? "Remover curtida" : "Curtir post"}
            >
              {/* O estado visual muda conforme o usuario ja curtiu ou nao. */}
              <Icon name="heart" />
              <span>{post.liked ? "Curtido" : "Curtir"}</span>
              <strong>{post.stats.likes}</strong>
            </button>
            <span
              className="action-btn metric-only"
              title="Visualizações"
              data-tooltip="Visualizações"
            >
              <Icon name="chart" />
              <span>Views</span>
              <strong>{post.stats.views}</strong>
            </span>
            <button
              type="button"
              className="action-btn icon-only"
              aria-label="Compartilhar"
              data-tooltip="Compartilhar em breve"
              disabled
            >
              <Icon name="share" />
            </button>
          </div>
        </>
      ) : null}

      {children}
    </article>
  );
}

export default PostCard;
