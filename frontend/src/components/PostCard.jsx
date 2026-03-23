import { Icon } from './Icons'

// Card visual de um post.
// Pode funcionar em modo simples (so exibicao) ou interativo (com botoes ativos).
function PostCard({
  post,
  interactive = false,
  onToggleLike,
  onAddView,
}) {
  return (
    <article className="panel post-card">
      {/* Cabecalho com avatar, autor, horario e texto do post. */}
      <div className="post-header">
        <div className="post-avatar">{post.initials}</div>
        <div className="post-meta">
          <div className="post-line">
            <strong>{post.name}</strong>
            <span>{post.handle}</span>
            <span>·</span>
            <span>{post.time}</span>
          </div>
          <p>{post.text}</p>
        </div>
      </div>

      {/* As acoes so aparecem quando a tela quer permitir interacao com o post. */}
      {interactive ? (
        <div className="post-actions">
          <button type="button" className="action-btn" disabled>
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
          <button
            type="button"
            className="action-btn"
            onClick={() => onAddView?.(post.id)}
            title="Registrar visualização"
          >
            <Icon name="chart" />
            <span>{post.stats.views}</span>
          </button>
          <button type="button" className="action-btn icon-only" aria-label="Compartilhar" disabled>
            <Icon name="share" />
          </button>
        </div>
      ) : null}
    </article>
  )
}

export default PostCard
