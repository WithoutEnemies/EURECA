import { THEME_OPTIONS } from "../features/app/appConstants";
import { formatCount } from "../utils/formatters";

function SettingsView({
  userInitial,
  me,
  sessionName,
  sessionHandle,
  sessionEmail,
  themeSummary,
  themePreference,
  unreadNotificationsCount,
  communityProgress,
  onOpenProfile,
  onOpenAlerts,
  onThemePreferenceChange,
  onLogout,
}) {
  return (
    <>
      <div className="feed-head">
        <h1>Ajustes</h1>
      </div>

      <section className="settings-page">
        <div className="panel settings-account-card">
          <div className="settings-account-main">
            <div className="settings-account-avatar">{userInitial}</div>
            <div>
              <div className="profile-social-row">
                <span className="profile-role-pill">
                  {me?.role ?? "Membro da comunidade"}
                </span>
                <span className="profile-presence-pill">Online agora</span>
              </div>
              <h2>{sessionName}</h2>
              <p>{sessionHandle}</p>
            </div>
          </div>
          <div className="settings-account-actions">
            <button
              type="button"
              className="follow-btn"
              onClick={onOpenProfile}
            >
              Abrir perfil
            </button>
            <button
              type="button"
              className="settings-danger-btn"
              onClick={onLogout}
            >
              Sair
            </button>
          </div>
        </div>

        <div className="settings-grid">
          <section className="panel settings-section-card">
            <div className="settings-section-head">
              <h2>Conta</h2>
              <span>Perfil público</span>
            </div>
            <div className="settings-list">
              <div className="settings-row">
                <div>
                  <strong>E-mail</strong>
                  <span>{me?.email ?? sessionEmail}</span>
                </div>
              </div>
              <div className="settings-row">
                <div>
                  <strong>Usuário</strong>
                  <span>{sessionHandle}</span>
                </div>
              </div>
              <div className="settings-row">
                <div>
                  <strong>Interesses</strong>
                  <span>
                    {me?.interests?.length
                      ? `${me.interests.length} selecionados`
                      : "Nenhum selecionado"}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="panel settings-section-card">
            <div className="settings-section-head">
              <h2>Preferências</h2>
              <span>Experiência</span>
            </div>
            <div className="settings-list">
              <div className="settings-row">
                <div>
                  <strong>Aparência</strong>
                  <span>{themeSummary}</span>
                </div>
                <div
                  className="settings-choice-group"
                  aria-label="Selecionar aparência"
                >
                  {THEME_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={
                        themePreference === option.value ? "is-selected" : ""
                      }
                      aria-pressed={themePreference === option.value}
                      onClick={() => onThemePreferenceChange(option.value)}
                    >
                      <span
                        className={`theme-option-dot is-${option.value}`}
                        aria-hidden="true"
                      />
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="settings-row">
                <div>
                  <strong>Notificações</strong>
                  <span>{formatCount(unreadNotificationsCount)} não lidos</span>
                </div>
                <button
                  type="button"
                  className="mini-link-btn"
                  onClick={onOpenAlerts}
                >
                  Ver notificações
                </button>
              </div>
            </div>
          </section>

          <section className="panel settings-section-card">
            <div className="settings-section-head">
              <h2>Reputação</h2>
              <span>Progresso</span>
            </div>
            <div className="settings-list">
              <div className="settings-row">
                <div>
                  <strong>Score da comunidade</strong>
                  <span>
                    {communityProgress.currentLevel.label} ·{" "}
                    {formatCount(communityProgress.score)} pontos
                  </span>
                </div>
                <span className="settings-status-pill">
                  {communityProgress.profileCompletion}% perfil
                </span>
              </div>
              <div className="settings-row">
                <div>
                  <strong>Próximo passo</strong>
                  <span>{communityProgress.nextAction}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="panel settings-section-card is-wide">
            <div className="settings-section-head">
              <h2>Sessão</h2>
              <span>Dispositivo atual</span>
            </div>
            <div className="settings-list">
              <div className="settings-row">
                <div>
                  <strong>Status</strong>
                  <span>Conectado como {sessionHandle}</span>
                </div>
                <span className="settings-status-pill">Ativa</span>
              </div>
              <div className="settings-row">
                <div>
                  <strong>Conta</strong>
                  <span>
                    Criada em{" "}
                    {me?.createdAt
                      ? new Date(me.createdAt).toLocaleDateString("pt-BR")
                      : "Sessão atual"}
                  </span>
                </div>
                <button
                  type="button"
                  className="settings-danger-btn"
                  onClick={onLogout}
                >
                  Encerrar sessão
                </button>
              </div>
            </div>
          </section>
        </div>
      </section>
    </>
  );
}

export default SettingsView;
