import { useState } from "react";
import PostCard from "../components/PostCard";
import {
  emailToInitials,
  formatCount,
  getEurecaPlusRank,
} from "../utils/formatters";

function getSocialUserLabel(user) {
  const email = user?.email ?? "anonimo@eureca";
  const name = user?.name?.trim() || email.split("@")[0] || "Usuário";
  const username = user?.username?.trim() || email.split("@")[0] || "usuario";

  return {
    name,
    handle: `@${username.toLowerCase()}`,
    initials: emailToInitials(name || email),
    badge: user?.role ?? user?.interests?.[0] ?? "Membro",
  };
}

function SocialUserList({ emptyText, items, onAuthorClick }) {
  if (!items.length) {
    return <p className="profile-social-empty">{emptyText}</p>;
  }

  return (
    <div className="profile-social-list">
      {items.map((item) => {
        const user = item.user ?? item;
        const label = getSocialUserLabel(user);

        return (
          <button
            key={user.id}
            type="button"
            className="profile-social-person"
            onClick={() =>
              onAuthorClick?.({
                authorId: user.id,
                authorEmail: user.email,
                name: label.name,
                handle: label.handle,
                authorRole: user.role,
                createdAt: user.createdAt,
              })
            }
          >
            <span className="profile-social-avatar">{label.initials}</span>
            <span>
              <strong>{label.name}</strong>
              <small>{label.handle}</small>
            </span>
            <em>{label.badge}</em>
          </button>
        );
      })}
    </div>
  );
}

function ProfileView({
  isOwnProfile,
  profileInitial,
  profileUser,
  profileName,
  profileHandle,
  profileEmail,
  profileCreatedAt,
  profileBio,
  profilePosts,
  profileCommunityProgress,
  totalProfileLikes,
  totalProfileViews,
  profileSocial,
  profileLoading,
  profileError,
  postsLoading,
  onBackToFeed,
  onRefreshPosts,
  onAuthorClick,
  onStartConversation,
  conversationStarting,
}) {
  const eurecaPlusRank = getEurecaPlusRank(profileUser);
  const [socialDialog, setSocialDialog] = useState("");
  const [socialSearch, setSocialSearch] = useState("");
  const followersCount = Number(
    profileUser?.followersCount ?? profileSocial?.followers?.length ?? 0,
  );
  const followingCount = Number(
    profileUser?.followingCount ?? profileSocial?.following?.length ?? 0,
  );
  const activeSocialItems =
    socialDialog === "followers"
      ? (profileSocial?.followers ?? [])
      : (profileSocial?.following ?? []);
  const normalizedSocialSearch = socialSearch.trim().toLowerCase();
  const filteredSocialItems = normalizedSocialSearch
    ? activeSocialItems.filter((item) => {
        const user = item.user ?? item;
        return [
          user?.name,
          user?.username,
          user?.email,
          user?.role,
          ...(Array.isArray(user?.interests) ? user.interests : []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSocialSearch);
      })
    : activeSocialItems;
  const activeSocialEmptyText =
    normalizedSocialSearch
      ? "Nenhuma conta encontrada."
      : socialDialog === "followers"
        ? "Ainda não há seguidores."
        : "Ainda não segue ninguém.";

  const openSocialDialog = (type) => {
    setSocialDialog(type);
    setSocialSearch("");
  };

  const switchSocialDialog = (type) => {
    setSocialDialog(type);
    setSocialSearch("");
  };

  const closeSocialDialog = () => {
    setSocialDialog("");
    setSocialSearch("");
  };

  return (
    <>
      <div className="feed-head">
        <h1>{isOwnProfile ? "Perfil" : "Perfil público"}</h1>
      </div>

      <section className="panel profile-page-card">
        <div className="profile-cover" aria-hidden="true" />
        <div className="profile-page-hero">
          <div className="profile-page-avatar">
            {profileInitial}
            <span className="profile-presence-dot" aria-hidden="true" />
          </div>
          <div className="profile-page-meta">
            <div className="profile-social-row">
              <span className="profile-role-pill">
                {profileUser?.role ?? "Membro da comunidade"}
              </span>
              <span className="profile-presence-pill">
                {isOwnProfile ? "Online agora" : "Membro ativo"}
              </span>
              {eurecaPlusRank ? (
                <span
                  className={`profile-plus-rank is-${eurecaPlusRank.tone}`}
                  title={eurecaPlusRank.meta}
                >
                  {eurecaPlusRank.label}
                </span>
              ) : null}
            </div>
            <h2>{profileName}</h2>
            <p>{profileHandle}</p>
            <div className="profile-meta-grid">
              <span>{isOwnProfile ? profileEmail : "Perfil público"}</span>
              <span>Criada em {profileCreatedAt}</span>
              <span>
                {profileUser?.id
                  ? `ID ${profileUser.id.slice(0, 8)}`
                  : "Conta autenticada"}
              </span>
            </div>
          </div>
          <div className="profile-actions">
            {!isOwnProfile ? (
              <button
                type="button"
                className="follow-btn profile-message-btn"
                onClick={() => onStartConversation?.(profileUser?.id)}
                disabled={conversationStarting || !profileUser?.id}
              >
                {conversationStarting ? "Abrindo..." : "Mensagem"}
              </button>
            ) : null}
            <button
              type="button"
              className="follow-btn profile-edit-btn"
              onClick={onBackToFeed}
            >
              Voltar ao feed
            </button>
          </div>
        </div>

        <div className="profile-stats">
          <div className="profile-stat">
            <span>{profilePosts.length}</span>
            <small>Posts</small>
          </div>
          <div className="profile-stat">
            <span>{formatCount(totalProfileLikes)}</span>
            <small>Curtidas</small>
          </div>
          <div className="profile-stat">
            <span>{formatCount(totalProfileViews)}</span>
            <small>Views</small>
          </div>
          <button
            type="button"
            className="profile-stat is-clickable"
            onClick={() => openSocialDialog("followers")}
          >
            <span>{formatCount(followersCount)}</span>
            <small>Seguidores</small>
          </button>
          <button
            type="button"
            className="profile-stat is-clickable"
            onClick={() => openSocialDialog("following")}
          >
            <span>{formatCount(followingCount)}</span>
            <small>Seguindo</small>
          </button>
          <div className="profile-stat is-plus-rank">
            <span>{eurecaPlusRank?.shortLabel ?? "Livre"}</span>
            <small>EURECA+</small>
          </div>
        </div>

        <div className="profile-reputation">
          <div className="profile-reputation-main">
            <span className="profile-reputation-kicker">Reputação</span>
            <h3>{profileCommunityProgress.currentLevel.label}</h3>
            <p>{profileCommunityProgress.nextAction}</p>
            <div
              className="profile-level-track"
              aria-label={`Progresso de nível: ${profileCommunityProgress.levelProgress}%`}
            >
              <span
                style={{ width: `${profileCommunityProgress.levelProgress}%` }}
              />
            </div>
            <small>
              {profileCommunityProgress.nextLevel
                ? `${formatCount(profileCommunityProgress.remainingScore)} pontos até ${profileCommunityProgress.nextLevel.label}`
                : "Nível máximo desta etapa"}
            </small>
          </div>

          <div className="profile-score-stack">
            <div>
              <strong>{formatCount(profileCommunityProgress.score)}</strong>
              <span>score</span>
            </div>
            <div>
              <strong>{profileCommunityProgress.profileCompletion}%</strong>
              <span>perfil</span>
            </div>
          </div>

          <div className="achievement-list">
            {profileCommunityProgress.achievements.map((achievement) => (
              <span
                key={achievement.label}
                className={achievement.unlocked ? "is-unlocked" : ""}
              >
                <strong>{achievement.label}</strong>
                <small>{achievement.meta}</small>
              </span>
            ))}
          </div>
        </div>

        {profileLoading ? (
          <p className="profile-feedback">Carregando perfil...</p>
        ) : null}
        {profileError ? (
          <p className="profile-feedback is-error">{profileError}</p>
        ) : null}

        <div className="profile-bio panel">
          <div>
            <h3>Sobre</h3>
            <p>{profileBio}</p>
          </div>
          <div>
            <h3>Interesses</h3>
            {profileUser?.interests?.length ? (
              <div className="profile-interest-list">
                {profileUser.interests.map((interest) => (
                  <span key={interest}>{interest}</span>
                ))}
              </div>
            ) : (
              <p>Nenhum interesse adicionado ainda.</p>
            )}
          </div>
        </div>

        <div className="profile-social-panel">
          <section className="panel profile-social-card">
            <div className="settings-section-head">
              <h3>Seguidores</h3>
              <span>{formatCount(followersCount)}</span>
            </div>
            {profileSocial?.loading ? (
              <p className="profile-social-empty">Carregando seguidores...</p>
            ) : (
              <SocialUserList
                items={profileSocial?.followers ?? []}
                emptyText="Ainda não há seguidores."
                onAuthorClick={onAuthorClick}
              />
            )}
          </section>

          <section className="panel profile-social-card">
            <div className="settings-section-head">
              <h3>Seguindo</h3>
              <span>{formatCount(followingCount)}</span>
            </div>
            {profileSocial?.loading ? (
              <p className="profile-social-empty">Carregando contas...</p>
            ) : (
              <SocialUserList
                items={profileSocial?.following ?? []}
                emptyText="Ainda não segue ninguém."
                onAuthorClick={onAuthorClick}
              />
            )}
          </section>
        </div>

        {profileSocial?.error ? (
          <p className="profile-feedback is-error">{profileSocial.error}</p>
        ) : null}
      </section>

      {socialDialog ? (
        <div className="profile-social-dialog-backdrop" role="presentation">
          <section
            className="profile-social-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-social-dialog-title"
          >
            <div className="profile-social-dialog-head">
              <div>
                <span>{profileHandle}</span>
                <h2 id="profile-social-dialog-title">
                  {socialDialog === "followers" ? "Seguidores" : "Seguindo"}
                </h2>
              </div>
              <button
                type="button"
                className="plus-checkout-close"
                aria-label="Fechar lista social"
                onClick={closeSocialDialog}
              >
                ×
              </button>
            </div>

            <div className="profile-social-tabs" aria-label="Listas sociais">
              <button
                type="button"
                className={socialDialog === "followers" ? "is-active" : ""}
                aria-pressed={socialDialog === "followers"}
                onClick={() => switchSocialDialog("followers")}
              >
                Seguidores
                <span>{formatCount(followersCount)}</span>
              </button>
              <button
                type="button"
                className={socialDialog === "following" ? "is-active" : ""}
                aria-pressed={socialDialog === "following"}
                onClick={() => switchSocialDialog("following")}
              >
                Seguindo
                <span>{formatCount(followingCount)}</span>
              </button>
            </div>

            <label className="profile-social-search">
              <span>Buscar</span>
              <input
                type="search"
                value={socialSearch}
                onChange={(event) => setSocialSearch(event.target.value)}
                placeholder="Nome, @usuário, email ou interesse"
                aria-label="Buscar nesta lista"
              />
              {socialSearch ? (
                <button
                  type="button"
                  onClick={() => setSocialSearch("")}
                  aria-label="Limpar busca"
                >
                  Limpar
                </button>
              ) : null}
            </label>

            {profileSocial?.loading ? (
              <p className="profile-social-empty">Carregando contas...</p>
            ) : (
              <SocialUserList
                items={filteredSocialItems}
                emptyText={activeSocialEmptyText}
                onAuthorClick={(post) => {
                  closeSocialDialog();
                  onAuthorClick?.(post);
                }}
              />
            )}
          </section>
        </div>
      ) : null}

      <div className="section-title-row">
        <h3>{isOwnProfile ? "Seus posts" : `Posts de ${profileName}`}</h3>
        <button type="button" className="mini-link-btn" onClick={onRefreshPosts}>
          Atualizar
        </button>
      </div>

      <div className="post-list">
        {postsLoading ? (
          <div className="panel post-card empty-state">Carregando posts...</div>
        ) : null}

        {!postsLoading && profilePosts.length === 0 ? (
          <div className="panel post-card empty-state">
            {isOwnProfile
              ? "Você ainda não publicou nada. Volte ao feed e faça seu primeiro post."
              : "Este usuário ainda não tem posts visíveis no feed carregado."}
          </div>
        ) : null}

        {profilePosts.map((post) => (
          <PostCard
            key={post.id ?? `${post.handle}-${post.time}`}
            post={post}
            onAuthorClick={onAuthorClick}
          />
        ))}
      </div>
    </>
  );
}

export default ProfileView;
