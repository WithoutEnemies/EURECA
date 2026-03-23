import { WaveMark } from './Icons'

// Tela de autenticacao.
// Ela nao cuida das regras de login sozinha: recebe dados e funcoes prontas do App principal.
function AuthScreen({
  authMode,
  email,
  password,
  confirmPassword,
  authError,
  authLoading,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onSwitchMode,
  onDevLogin,
}) {
  return (
    <div className="eureca-app">
      <div className="login-shell">
        <div className="login-panel panel">
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
            <h1>{authMode === 'login' ? 'Login' : 'Criar conta'}</h1>
            <p>
              {authMode === 'login'
                ? 'O feed só fica disponível após autenticação e já se conecta ao backend da API.'
                : 'Crie sua conta para acessar a comunidade. O cadastro já salva no backend.'}
            </p>
          </div>

          <form className="login-form" onSubmit={onSubmit}>
            {/* Campos controlados: o valor exibido sempre acompanha o estado do React. */}
            <label className="login-field">
              <span>E-mail</span>
              <input
                type="email"
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                placeholder="voce@eureca.com"
                autoComplete="email"
              />
            </label>

            <label className="login-field">
              <span>Senha</span>
              <input
                type="password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                placeholder="Digite sua senha"
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
              />
            </label>

            {/* Este campo extra so aparece no cadastro, para conferir se a senha foi repetida corretamente. */}
            {authMode === 'register' ? (
              <label className="login-field">
                <span>Confirmar senha</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => onConfirmPasswordChange(event.target.value)}
                  placeholder="Repita sua senha"
                  autoComplete="new-password"
                />
              </label>
            ) : null}

            {authError ? <p className="login-error">{authError}</p> : null}

            {/* O mesmo formulario serve para login e cadastro; so mudam os textos e a rota chamada. */}
            <button type="submit" className="login-submit" disabled={authLoading}>
              {authLoading
                ? 'Processando...'
                : authMode === 'login'
                  ? 'Entrar na Eureca'
                  : 'Criar conta'}
            </button>

            {authMode === 'login' ? (
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
            <span>{authMode === 'login' ? 'Ainda não tem conta?' : 'Já tem conta?'}</span>
            <button
              type="button"
              onClick={() => onSwitchMode(authMode === 'login' ? 'register' : 'login')}
            >
              {authMode === 'login' ? 'Criar conta' : 'Fazer login'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthScreen
