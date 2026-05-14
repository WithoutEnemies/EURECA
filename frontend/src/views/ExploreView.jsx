import { Icon } from "../components/Icons";
import { EXPLORE_FILTERS } from "../features/app/appConstants";
import { formatCount, truncateText } from "../utils/formatters";

function ExploreView({
  exploreQuery,
  exploreFilter,
  exploreData,
  postsLoading,
  currentUserId,
  onQueryChange,
  onFilterChange,
  onRefreshPosts,
  onOpenPostDiscussion,
  onOpenUserProfile,
  onStartConversation,
}) {
  return (
    <>
      <div className="feed-head">
        <h1>Explorar</h1>
      </div>

      <section className="panel explore-hero">
        <div className="explore-hero-main">
          <span className="explore-kicker">Descoberta</span>
          <h2>
            {exploreQuery
              ? `Resultados para "${exploreQuery}"`
              : "Encontre conversas, tópicos e pessoas"}
          </h2>
          <p>
            {exploreData.totalMatches > 0
              ? `${formatCount(exploreData.totalMatches)} itens encontrados no feed atual.`
              : "Nenhum resultado encontrado no feed atual."}
          </p>
        </div>

        <div className="explore-search-panel">
          <label className="explore-search">
            <Icon name="compass" />
            <input
              type="search"
              value={exploreQuery}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Buscar posts, tópicos ou pessoas"
              aria-label="Buscar no Explorar"
            />
            {exploreQuery ? (
              <button type="button" onClick={() => onQueryChange("")}>
                Limpar
              </button>
            ) : null}
          </label>

          <div className="explore-filter-row" aria-label="Filtros do Explorar">
            {EXPLORE_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={exploreFilter === filter.value ? "is-active" : ""}
                aria-pressed={exploreFilter === filter.value}
                onClick={() => onFilterChange(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="explore-metrics">
          <div>
            <strong>{formatCount(exploreData.posts.length)}</strong>
            <span>posts</span>
          </div>
          <div>
            <strong>{formatCount(exploreData.topics.length)}</strong>
            <span>tópicos</span>
          </div>
          <div>
            <strong>{formatCount(exploreData.people.length)}</strong>
            <span>pessoas</span>
          </div>
        </div>
      </section>

      <div className="explore-grid">
        {exploreFilter !== "people" ? (
          <section className="panel explore-section-card is-wide">
            <div className="section-title-row">
              <h3>Posts em destaque</h3>
              <button
                type="button"
                className="mini-link-btn"
                onClick={onRefreshPosts}
              >
                Atualizar
              </button>
            </div>

            <div className="explore-post-list">
              {postsLoading ? (
                <div className="explore-empty">Carregando posts...</div>
              ) : null}

              {!postsLoading && exploreData.posts.length === 0 ? (
                <div className="explore-empty">Nenhum post encontrado.</div>
              ) : null}

              {exploreData.posts.slice(0, 8).map((post, index) => (
                <button
                  key={post.id ?? `${post.handle}-${post.createdAt}`}
                  type="button"
                  className="explore-post-item"
                  onClick={() => onOpenPostDiscussion(post.id)}
                >
                  <span className="explore-post-rank">{index + 1}</span>
                  <div className="explore-post-body">
                    <div className="explore-post-line">
                      <strong>{post.name}</strong>
                      <span>{post.handle}</span>
                      {post.authorBadge ? <em>{post.authorBadge.label}</em> : null}
                    </div>
                    <p>{truncateText(post.text, 140)}</p>
                    <div className="explore-post-stats">
                      <span>
                        {formatCount(post.counts?.replies)} comentários
                      </span>
                      <span>{formatCount(post.counts?.likes)} curtidas</span>
                      <span>{formatCount(post.counts?.views)} views</span>
                      <strong>{formatCount(post.score)} score</strong>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="panel explore-section-card">
          <div className="section-title-row">
            <h3>Tópicos</h3>
            <span className="explore-count-pill">
              {formatCount(exploreData.topics.length)}
            </span>
          </div>

          <div className="explore-topic-list">
            {exploreData.topics.length === 0 ? (
              <div className="explore-empty">Nenhum tópico encontrado.</div>
            ) : null}

            {exploreData.topics.map((trend, index) => (
              <button
                key={trend.title}
                type="button"
                className="explore-topic-item"
                onClick={() => {
                  onQueryChange(trend.title.replace(/^#/, ""));
                  onFilterChange("all");
                }}
              >
                <span>{index + 1}</span>
                <div>
                  <strong>{trend.title}</strong>
                  <small>{trend.category}</small>
                </div>
                <em>{trend.posts}</em>
              </button>
            ))}
          </div>
        </section>

        <section className="panel explore-section-card">
          <div className="section-title-row">
            <h3>Pessoas</h3>
            <span className="explore-count-pill">
              {formatCount(exploreData.people.length)}
            </span>
          </div>

          <div className="explore-people-list">
            {exploreData.people.length === 0 ? (
              <div className="explore-empty">Nenhuma pessoa encontrada.</div>
            ) : null}

            {exploreData.people.slice(0, 8).map((person) => (
              <div key={person.handle} className="explore-person">
                <div className="explore-person-avatar">
                  {person.initials}
                  <span
                    className={`follow-status-dot is-${person.status}`}
                    aria-hidden="true"
                  />
                </div>
                <div className="explore-person-meta">
                  <div className="follow-name-row">
                    <strong>{person.name}</strong>
                    <span className="follow-badge">{person.badge}</span>
                  </div>
                  <span>{person.handle}</span>
                  <small>{person.context}</small>
                </div>
                <div className="explore-person-actions">
                  <button
                    type="button"
                    className="mini-link-btn"
                    onClick={() =>
                      person.post ? onOpenUserProfile(person.post) : null
                    }
                    disabled={!person.post}
                  >
                    {person.post ? "Perfil" : "Em breve"}
                  </button>
                  {person.post?.authorId &&
                  person.post.authorId !== currentUserId ? (
                    <button
                      type="button"
                      className="mini-link-btn is-accent"
                      onClick={() => onStartConversation?.(person.post.authorId)}
                    >
                      Mensagem
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

export default ExploreView;
