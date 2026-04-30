import {
  REGISTER_INTEREST_GROUPS,
  REGISTER_MAX_INTERESTS,
  REGISTER_ROLE_GROUPS,
} from '../constants/uiData'
import { WaveMark } from './Icons'

// Tela de autenticacao.
// Ela nao cuida das regras de login sozinha: recebe dados e funcoes prontas do App principal.
function AuthScreen({
  authMode,
  email,
  password,
  confirmPassword,
  registerProfile,
  authError,
  authLoading,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onRegisterProfileChange,
  onSubmit,
  onSwitchMode,
  onDevLogin,
  theme = 'dark',
}) {
  const isRegister = authMode === 'register'
  const selectedInterests = registerProfile?.interests ?? []

  const toggleInterest = (interest) => {
    const isSelected = selectedInterests.includes(interest)
    if (!isSelected && selectedInterests.length >= REGISTER_MAX_INTERESTS) {
      return
    }

    const nextInterests = selectedInterests.includes(interest)
      ? selectedInterests.filter((item) => item !== interest)
      : [...selectedInterests, interest]

    onRegisterProfileChange('interests', nextInterests)
  }

  return (
    <div className="eureca-app" data-theme={theme}>
      <div className="login-shell">
        <div className={`login-panel panel ${isRegister ? 'is-register' : ''}`}>
          {/* Bloco visual da marca e texto de boas-vindas. */}
          <div className="login-brand">
            <div className="brand-mark">
              <WaveMark />
            </div>
            <div>
              <strong>Eureca</strong>
              <span>Entre para acessar a comunidade</span>
            </div>
          </div>

          <div className="login-copy">
            <h1>{isRegister ? 'Criar conta' : 'Login'}</h1>
            <p>
              {isRegister
                ? 'Monte seu perfil inicial para aparecer melhor no feed e encontrar pessoas com interesses parecidos.'
                : 'O feed só fica disponível após autenticação e já se conecta ao backend da API.'}
            </p>
          </div>

          <form className="login-form" onSubmit={onSubmit}>
            {/* Campos controlados: o valor exibido sempre acompanha o estado do React. */}
            {isRegister ? (
              <div className="register-profile-grid">
                <label className="login-field">
                  <span>Nome</span>
                  <input
                    type="text"
                    value={registerProfile.name}
                    onChange={(event) =>
                      onRegisterProfileChange('name', event.target.value)
                    }
                    placeholder="Seu nome completo"
                    autoComplete="name"
                    maxLength={80}
                  />
                </label>

                <label className="login-field">
                  <span>Usuário</span>
                  <input
                    type="text"
                    value={registerProfile.username}
                    onChange={(event) =>
                      onRegisterProfileChange('username', event.target.value)
                    }
                    placeholder="seu_usuario"
                    autoComplete="username"
                    maxLength={24}
                  />
                </label>

                <label className="login-field">
                  <span>Área principal</span>
                  <select
                    value={registerProfile.role}
                    onChange={(event) =>
                      onRegisterProfileChange('role', event.target.value)
                    }
                  >
                    {REGISTER_ROLE_GROUPS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.options.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>

                <label className="login-field is-wide">
                  <span>Bio curta</span>
                  <textarea
                    value={registerProfile.bio}
                    onChange={(event) =>
                      onRegisterProfileChange('bio', event.target.value)
                    }
                    placeholder="Uma frase sobre o que você está construindo"
                    rows={3}
                    maxLength={160}
                  />
                </label>

                <fieldset className="register-interest-field is-wide">
                  <legend>
                    Interesses ({selectedInterests.length}/
                    {REGISTER_MAX_INTERESTS})
                  </legend>
                  <div className="register-interest-groups">
                    {REGISTER_INTEREST_GROUPS.map((group) => (
                      <div
                        key={group.label}
                        className="register-interest-group"
                      >
                        <span>{group.label}</span>
                        <div className="register-chip-list">
                          {group.options.map((interest) => {
                            const isSelected =
                              selectedInterests.includes(interest)
                            const isDisabled =
                              !isSelected &&
                              selectedInterests.length >= REGISTER_MAX_INTERESTS

                            return (
                              <button
                                key={interest}
                                type="button"
                                className={`register-chip ${isSelected ? 'is-selected' : ''}`}
                                onClick={() => toggleInterest(interest)}
                                aria-pressed={isSelected}
                                disabled={isDisabled}
                              >
                                {interest}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </fieldset>

                <label className="register-consent is-wide">
                  <input
                    type="checkbox"
                    checked={registerProfile.acceptedTerms}
                    onChange={(event) =>
                      onRegisterProfileChange(
                        'acceptedTerms',
                        event.target.checked,
                      )
                    }
                  />
                  <span>Aceito criar um perfil público básico na Eureca.</span>
                </label>
              </div>
            ) : null}

            <label className="login-field">
              <span>{isRegister ? 'E-mail' : 'E-mail ou usuário'}</span>
              <input
                type={isRegister ? 'email' : 'text'}
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                placeholder={
                  isRegister
                    ? 'voce@eureca.com'
                    : 'voce@eureca.com ou seu_usuario'
                }
                autoComplete={isRegister ? 'email' : 'username'}
              />
            </label>

            <label className="login-field">
              <span>Senha</span>
              <input
                type="password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                placeholder="Digite sua senha"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
              />
            </label>

            {/* Este campo extra so aparece no cadastro, para conferir se a senha foi repetida corretamente. */}
            {isRegister ? (
              <label className="login-field">
                <span>Confirmar senha</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) =>
                    onConfirmPasswordChange(event.target.value)
                  }
                  placeholder="Repita sua senha"
                  autoComplete="new-password"
                />
              </label>
            ) : null}

            {authError ? <p className="login-error">{authError}</p> : null}

            {/* O mesmo formulario serve para login e cadastro; so mudam os textos e a rota chamada. */}
            <button
              type="submit"
              className="login-submit"
              disabled={authLoading}
            >
              {authLoading
                ? 'Processando...'
                : isRegister
                  ? 'Criar conta'
                  : 'Entrar na Eureca'}
            </button>

            {!isRegister ? (
              <button
                type="button"
                className="login-dev-btn"
                onClick={onDevLogin}
                disabled={authLoading}
                title="Conta de teste: dev@eureca.local"
              >
                {/* Atalho de desenvolvimento para entrar rapido no sistema. */}
                Entrar com Dev
              </button>
            ) : null}
          </form>

          {/* Alterna entre os dois modos sem trocar de pagina. */}
          <div className="auth-switch">
            <span>{isRegister ? 'Já tem conta?' : 'Ainda não tem conta?'}</span>
            <button
              type="button"
              onClick={() => onSwitchMode(isRegister ? 'login' : 'register')}
            >
              {isRegister ? 'Fazer login' : 'Criar conta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthScreen
