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
  const accountLabel = me?.name || me?.email;
  const accountHandle = me?.username ? `@${me.username}` : me?.email;
  const featuredTrend = trends[0];
  const otherTrends = trends.slice(1);

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
            <strong>{latestMyPost?.stats?.likes ?? "0"}</strong>
            <span>Curtidas</span>
          </div>
          <div className="status-metric">
            <strong>{latestMyPost?.stats?.replies ?? "0"}</strong>
            <span>Comentários</span>
          </div>
          <div className="status-metric">
            <strong>{latestMyPost?.stats?.reposts ?? "0"}</strong>
            <span>Compart.</span>
          </div>
          <div className="status-metric">
            <strong>{latestMyPost?.stats?.views ?? "0"}</strong>
            <span>Views</span>
          </div>
        </div>
        <div className="status-footer">
          <span>
            {latestMyPost
              ? `Publicado ${latestMyPost.time}${accountLabel ? ` · ${accountLabel}` : ""}`
              : accountLabel
                ? `Conectado como ${accountHandle || accountLabel}`
                : "Sem posts ainda"}
          </span>
          <button type="button" onClick={onNewPost}>
            Novo post
          </button>
        </div>
      </section>

      {/* Lista de assuntos populares para enriquecer a navegacao lateral. */}
      <section className="panel trends-card">
        <div className="sidebar-card-head">
          <h3>Em alta</h3>
          <span>ao vivo</span>
        </div>

        {featuredTrend ? (
          <div className="trend-featured">
            <div className="trend-featured-top">
              <span>{featuredTrend.category}</span>
              <strong>Subindo agora</strong>
            </div>
            <h4>{featuredTrend.title}</h4>
            <p>{featuredTrend.posts} falando sobre isto</p>
            <div className="trend-progress" aria-hidden="true">
              <span />
            </div>
          </div>
        ) : null}

        <div className="trend-pill-list">
          {otherTrends.map((trend, index) => (
            <div key={trend.title} className="trend-pill-item">
              <span className="trend-rank">{index + 2}</span>
              <div>
                <small>{trend.category}</small>
                <strong>{trend.title}</strong>
              </div>
              <span className="trend-posts">{trend.posts}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Sugestoes de perfis. Neste momento sao apenas visuais. */}
      <section className="panel follow-card">
        <div className="sidebar-card-head">
          <h3>Quem seguir</h3>
          <span>sugestões</span>
        </div>
        <div className="follow-list">
          {suggestions.map((person) => (
            <div key={person.handle} className="follow-item">
              <div className="follow-avatar">
                {person.initials}
                <span
                  className={`follow-status-dot is-${person.status}`}
                  aria-hidden="true"
                />
              </div>
              <div className="follow-meta">
                <div className="follow-name-row">
                  <strong>{person.name}</strong>
                  <span className="follow-badge">{person.badge}</span>
                </div>
                <span>{person.handle}</span>
                <small>{person.context}</small>
                <em>{person.mutual}</em>
              </div>
              <button type="button" className="follow-btn">
                Seguir
              </button>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

export default Sidebar;
