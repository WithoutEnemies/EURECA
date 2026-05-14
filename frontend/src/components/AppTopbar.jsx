import { navItems } from "../constants/uiData";
import { formatCount } from "../utils/formatters";
import { Icon, WaveMark } from "./Icons";

function AppTopbar({
  currentView,
  unreadNotificationsCount,
  userInitial,
  userMenuOpen,
  userMenuRef,
  sessionName,
  sessionHandle,
  onToggleUserMenu,
  onOpenProfile,
  onOpenHome,
  onOpenExplore,
  onOpenAlerts,
  onOpenConversations,
  onOpenSettings,
  onOpenPlus,
  onLogout,
}) {
  const handleNavClick = (view) => {
    if (view === "profile") onOpenProfile();
    if (view === "home") onOpenHome();
    if (view === "explore") onOpenExplore();
    if (view === "alerts") onOpenAlerts();
    if (view === "conversations") onOpenConversations();
    if (view === "settings") onOpenSettings();
  };

  return (
    <header className="eureca-topbar">
      <div className="brand">
        <div className="brand-mark">
          <WaveMark />
        </div>
        <span className="brand-name">Eureca</span>
      </div>

      <nav className="main-nav" aria-label="Navegação principal">
        {navItems.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`nav-item ${
              item.view && currentView === item.view ? "is-active" : ""
            }`}
            onClick={() => handleNavClick(item.view)}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
            {item.view === "alerts" && unreadNotificationsCount > 0 ? (
              <strong className="nav-badge">
                {formatCount(unreadNotificationsCount)}
              </strong>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="topbar-actions">
        <button
          type="button"
          className="new-wave-btn"
          title="Ver plano Eureca+"
          onClick={onOpenPlus}
        >
          Eureca+
        </button>
        <div className="user-menu" ref={userMenuRef}>
          <button
            type="button"
            className="user-chip"
            aria-label="Abrir menu do perfil"
            aria-expanded={userMenuOpen}
            onClick={onToggleUserMenu}
          >
            {userInitial}
          </button>

          {userMenuOpen ? (
            <div className="user-dropdown" role="menu">
              <div className="user-dropdown-head">
                <span className="user-dropdown-initial">{userInitial}</span>
                <div>
                  <strong>{sessionName}</strong>
                  <small>{sessionHandle}</small>
                </div>
              </div>
              <button
                type="button"
                className="user-dropdown-item"
                role="menuitem"
                onClick={onOpenProfile}
              >
                Perfil
              </button>
              <button
                type="button"
                className="user-dropdown-item danger"
                role="menuitem"
                onClick={onLogout}
              >
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export default AppTopbar;
