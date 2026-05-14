import { formatCount, truncateText } from "../utils/formatters";

const quickPrompts = [
  "Qual problema você está tentando resolver hoje?",
  "Mostre um progresso do seu projeto.",
  "Que ideia merece uma segunda opinião?",
];

function RightRail({
  posts,
  trends,
  communityProgress,
  unreadNotificationsCount,
  onOpenDiscussion,
  onTrendClick,
  onUsePrompt,
}) {
  const activeDiscussions = [...posts]
    .sort((a, b) => discussionScore(b) - discussionScore(a))
    .slice(0, 3);

  const totalComments = posts.reduce(
    (total, post) => total + Number(post.counts?.replies ?? 0),
    0,
  );

  return (
    <aside className="right-rail" aria-label="Painel social">
      <section className="panel right-card social-pulse-card">
        <div className="right-card-head">
          <h3>Agora na Eureca</h3>
          <span>ao vivo</span>
        </div>
        <div className="social-pulse-grid">
          <div>
            <strong>{formatCount(posts.length)}</strong>
            <span>Posts</span>
          </div>
          <div>
            <strong>{formatCount(totalComments)}</strong>
            <span>Comentários</span>
          </div>
          <div>
            <strong>{formatCount(unreadNotificationsCount)}</strong>
            <span>Notificações</span>
          </div>
        </div>
      </section>

      {communityProgress ? (
        <section className="panel right-card reputation-card">
          <div className="right-card-head">
            <h3>Seu progresso</h3>
            <span>{communityProgress.currentLevel.label}</span>
          </div>

          <div className="reputation-score-row">
            <div>
              <strong>{formatCount(communityProgress.score)}</strong>
              <span>score</span>
            </div>
            <div>
              <strong>{communityProgress.profileCompletion}%</strong>
              <span>perfil</span>
            </div>
          </div>

          <div
            className="reputation-track"
            aria-label={`Progresso de nível: ${communityProgress.levelProgress}%`}
          >
            <span style={{ width: `${communityProgress.levelProgress}%` }} />
          </div>

          <p>{communityProgress.nextAction}</p>
        </section>
      ) : null}

      <section className="panel right-card">
        <div className="right-card-head">
          <h3>Discussões ativas</h3>
          <span>{activeDiscussions.length}</span>
        </div>

        <div className="discussion-list">
          {activeDiscussions.length ? (
            activeDiscussions.map((post) => (
              <button
                key={post.id ?? `${post.handle}-${post.createdAt}`}
                type="button"
                className="discussion-item"
                onClick={() => onOpenDiscussion(post.id)}
              >
                <span className="discussion-author">{post.handle}</span>
                <strong>{truncateText(post.text, 78)}</strong>
                <span className="discussion-meta">
                  {formatCount(post.counts?.replies)} comentários ·{" "}
                  {formatCount(post.counts?.views)} views
                </span>
              </button>
            ))
          ) : (
            <p className="right-empty">Sem discussões carregadas.</p>
          )}
        </div>
      </section>

      <section className="panel right-card">
        <div className="right-card-head">
          <h3>Tópicos para você</h3>
          <span>trending</span>
        </div>
        <div className="topic-pill-list">
          {trends.length === 0 ? (
            <p className="right-empty">Sem tópicos reais no feed.</p>
          ) : null}

          {trends.map((trend) => (
            <button
              key={trend.title}
              type="button"
              className="topic-pill"
              onClick={() => onTrendClick?.(trend)}
            >
              <strong>{trend.title}</strong>
              <span>{trend.posts}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel right-card">
        <div className="right-card-head">
          <h3>Comece uma conversa</h3>
          <span>rápido</span>
        </div>
        <div className="prompt-list">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="prompt-chip"
              onClick={() => onUsePrompt(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}

function discussionScore(post) {
  return (
    Number(post.counts?.replies ?? 0) * 8 +
    Number(post.counts?.likes ?? 0) * 3 +
    Number(post.counts?.views ?? 0)
  );
}

export default RightRail;
