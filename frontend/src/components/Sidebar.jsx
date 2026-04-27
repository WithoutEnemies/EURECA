// Coluna lateral da interface.
// Ela resume a atividade do usuario e exibe blocos auxiliares da experiencia.
function Sidebar({
  latestMyPost,
  latestMyPostPreview,
  me,
  trends,
  suggestions,
  onNewPost,
}) {
  const accountLabel = me?.name || me?.email
  const accountHandle = me?.username ? `@${me.username}` : me?.email

  return (
    <aside className="sidebar">
      {/* Resumo do ultimo post do usuario logado. */}
      <section className="panel status-card">
        <div className="status-title">
          <span className="status-dot" />
          <span>Seu último post</span>
        </div>
        <p>{latestMyPostPreview}</p>
        <div className="status-metrics">
          <div className="status-metric">
            <strong>{latestMyPost?.stats?.likes ?? '0'}</strong>
            <span>Curtidas</span>
          </div>
          <div className="status-metric">
            <strong>{latestMyPost?.stats?.replies ?? '0'}</strong>
            <span>Comentários</span>
          </div>
          <div className="status-metric">
            <strong>{latestMyPost?.stats?.reposts ?? '0'}</strong>
            <span>Compart.</span>
          </div>
          <div className="status-metric">
            <strong>{latestMyPost?.stats?.views ?? '0'}</strong>
            <span>Views</span>
          </div>
        </div>
        <div className="status-footer">
          <span>
            {latestMyPost
              ? `Publicado ${latestMyPost.time}${accountLabel ? ` · ${accountLabel}` : ''}`
              : accountLabel
                ? `Conectado como ${accountHandle || accountLabel}`
                : 'Sem posts ainda'}
          </span>
          <button type="button" onClick={onNewPost}>
            Novo post
          </button>
        </div>
      </section>

      {/* Lista de assuntos populares para enriquecer a navegacao lateral. */}
      <section className="panel trends-card">
        <h3>Em alta 🔥</h3>
        <div className="trend-list">
          {trends.map((trend) => (
            <div key={trend.title} className="trend-item">
              <small>{trend.category}</small>
              <strong>{trend.title}</strong>
              <span>{trend.posts}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Sugestoes de perfis. Neste momento sao apenas visuais. */}
      <section className="panel follow-card">
        <h3>Quem seguir</h3>
        <div className="follow-list">
          {suggestions.map((person) => (
            <div key={person.handle} className="follow-item">
              <div className="follow-avatar">{person.initials}</div>
              <div className="follow-meta">
                <strong>{person.name}</strong>
                <span>{person.handle}</span>
              </div>
              <button type="button" className="follow-btn">
                Seguir
              </button>
            </div>
          ))}
        </div>
      </section>
    </aside>
  )
}

export default Sidebar
