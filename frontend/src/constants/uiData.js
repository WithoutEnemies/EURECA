// Conta pronta para acelerar testes locais sem precisar criar um usuario manualmente.
export const DEV_ACCOUNT = {
  email: 'dev@eureca.local',
  password: 'dev123456',
}

// Itens usados na navegacao superior da aplicacao.
// Alguns possuem "view", que indica para qual tela interna o botao deve levar.
export const navItems = [
  { label: 'Início', icon: 'home', view: 'home' },
  { label: 'Explorar', icon: 'compass' },
  { label: 'Alertas', icon: 'bell' },
  { label: 'Conversas', icon: 'chat', view: 'conversations' },
  { label: 'Perfil', icon: 'user', view: 'profile' },
  { label: 'Ajustes', icon: 'settings' },
]

// Dados visuais da area "Em alta".
// Sao mockados no frontend, ou seja, nao vem do backend por enquanto.
export const trends = [
  { category: 'Technology', title: '#BuildInPublic', posts: '12.4K posts' },
  { category: 'Design', title: 'Figma Config', posts: '8.2K posts' },
  { category: 'Programming', title: 'Rust Language', posts: '5.7K posts' },
  { category: 'Trending', title: '#OpenSource', posts: '3.1K posts' },
]

// Sugestoes de perfis para preencher a interface lateral.
// Tambem sao dados fixos por enquanto.
export const suggestions = [
  { initials: 'MT', name: 'Mia Torres', handle: '@miatorres' },
  { initials: 'JK', name: 'James Kim', handle: '@jameskim_dev' },
  { initials: 'PS', name: 'Priya Sharma', handle: '@priyacodes' },
]
