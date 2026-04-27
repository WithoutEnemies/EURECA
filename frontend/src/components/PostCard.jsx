import { useEffect, useRef } from 'react'
import { Icon } from './Icons'

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
  children,
}) {
  const cardRef = useRef(null)

  useEffect(() => {
    if (!interactive || !post.id || !onViewed || !cardRef.current) {
      return undefined
    }

    const card = cardRef.current
    let viewTimer = null

    const registerView = () => {
      viewTimer = window.setTimeout(() => {
        onViewed(post.id)
      }, 700)
    }

    if (!('IntersectionObserver' in window)) {
      registerView()
      return () => window.clearTimeout(viewTimer)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
          if (!viewTimer) registerView()
          return
        }

        if (viewTimer) {
          window.clearTimeout(viewTimer)
          viewTimer = null
        }
      },
      { threshold: [0, 0.55] },
    )

    observer.observe(card)

    return () => {
      observer.disconnect()
      if (viewTimer) window.clearTimeout(viewTimer)
    }
  }, [interactive, onViewed, post.id])

  return (
    <article className="panel post-card" ref={cardRef}>
      {/* Cabecalho com avatar, autor, horario e texto do post. */}
      <div className="post-header">
        <button
          type="button"
          className="post-avatar post-author-trigger"
          onClick={() => onAuthorClick?.(post)}
          aria-label={`Ver perfil de ${post.name}`}
        >
          {post.initials}
        </button>
        <div className="post-meta">
          <div className="post-line">
            <button
              type="button"
              className="post-author-name"
              onClick={() => onAuthorClick?.(post)}
            >
              {post.name}
            </button>
            <button
              type="button"
              className="post-author-handle"
              onClick={() => onAuthorClick?.(post)}
            >
              {post.handle}
            </button>
            <span>·</span>
            <span>{post.time}</span>
          </div>
          <p>{post.text}</p>
        </div>
      </div>

      {/* As acoes so aparecem quando a tela quer permitir interacao com o post. */}
      {interactive ? (
        <div className="post-actions">
          <button
            type="button"
            className={`action-btn ${commentsOpen ? 'is-active' : ''}`}
            onClick={() => onToggleComments?.(post.id)}
            aria-expanded={commentsOpen}
            aria-label={
              commentsOpen ? 'Fechar comentários' : 'Abrir comentários'
            }
          >
            <Icon name="reply" />
            <span>{post.stats.replies}</span>
          </button>
          <button type="button" className="action-btn" disabled>
            <Icon name="repost" />
            <span>{post.stats.reposts}</span>
          </button>
          <button
            type="button"
            className={`action-btn ${post.liked ? 'liked' : ''}`}
            onClick={() => onToggleLike?.(post.id, post.liked)}
            aria-pressed={post.liked}
          >
            {/* O estado visual muda conforme o usuario ja curtiu ou nao. */}
            <Icon name="heart" />
            <span>{post.stats.likes}</span>
          </button>
          <span className="action-btn metric-only" title="Visualizações">
            <Icon name="chart" />
            <span>{post.stats.views}</span>
          </span>
          <button
            type="button"
            className="action-btn icon-only"
            aria-label="Compartilhar"
            disabled
          >
            <Icon name="share" />
          </button>
        </div>
      ) : null}

      {children}
    </article>
  )
}

export default PostCard
