# EURECA

EURECA e uma aplicacao web full-stack de comunidade social. O projeto combina feed de publicacoes, perfis, comentarios, notificacoes, conversas privadas em tempo real, upload de imagens, relacoes de seguidores e uma experiencia de assinatura Eureca Plus.

O repositorio esta dividido em duas aplicacoes independentes:

- `frontend`: interface em React + Vite
- `backend`: API em NestJS + Prisma + PostgreSQL

## Funcionalidades

- Cadastro e login com JWT
- Login por email ou nome de usuario
- Perfil com nome, usuario, area, bio, interesses e estado Eureca Plus
- Feed publico acessivel sem login
- Feed autenticado com estado de curtida por usuario
- Feed de posts das pessoas seguidas
- Criacao e remocao de posts
- Upload de imagens para posts
- Curtir e descurtir posts
- Contagem de visualizacoes
- Comentarios em posts
- Respostas a comentarios
- Edicao e remocao de comentarios proprios
- Denuncia de posts
- Sugestoes de perfis para seguir
- Seguir e deixar de seguir usuarios
- Listagem de seguidores e seguindo
- Tendencias calculadas a partir dos posts reais
- Notificacoes para curtidas, comentarios, respostas, mensagens privadas e avisos da plataforma
- Marcacao de notificacoes como lidas
- Conversas privadas com mensagens e estado de leitura
- Atualizacoes de conversa em tempo real via Socket.IO
- Area Eureca Plus com ativacao e cancelamento de plano
- Conta de desenvolvimento para testes locais

## Stack

### Frontend

- React 19
- Vite 7
- lucide-react
- socket.io-client
- CSS proprio

### Backend

- NestJS 11
- Prisma 7
- PostgreSQL
- JWT
- Passport
- bcrypt
- Multer
- Socket.IO

## Estrutura

```text
EURECA/
|-- backend/
|   |-- prisma/
|   |-- src/
|   |   |-- auth/
|   |   |-- comments/
|   |   |-- conversations/
|   |   |-- notifications/
|   |   |-- posts/
|   |   |-- uploads/
|   |   `-- users/
|   |-- test/
|   `-- package.json
|-- frontend/
|   |-- src/
|   |   |-- api/
|   |   |-- components/
|   |   |-- config/
|   |   |-- features/
|   |   |-- hooks/
|   |   `-- views/
|   `-- package.json
`-- README.md
```

## Requisitos

- Node.js
- npm
- PostgreSQL local

O projeto nao usa workspace na raiz. Frontend e backend sao instalados e executados separadamente.

## Instalação

### 1. Instalar dependencias

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Configurar variaveis de ambiente

Crie o arquivo `backend/.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/eureca"
JWT_SECRET="troque-este-segredo"
PORT=3000
```

Opcionalmente, crie `frontend/.env`:

```env
VITE_API_URL="http://localhost:3000"
```

Se `VITE_API_URL` nao for definido, o frontend usa `http://localhost:3000`.

### 3. Preparar o banco de dados

Dentro de `backend`:

```bash
npx prisma migrate dev
```

Para aplicar migrations existentes em outro ambiente:

```bash
npx prisma migrate deploy
```

### 4. Rodar o backend

```bash
cd backend
npm run start:dev
```

API padrao:

```text
http://localhost:3000
```

Healthcheck:

```bash
curl http://localhost:3000/health
```

### 5. Rodar o frontend

```bash
cd frontend
npm run dev
```

Frontend padrao:

```text
http://localhost:5173
```

## Uploads locais

O backend salva imagens enviadas para posts em `backend/uploads/posts` e expoe esses arquivos em:

```text
http://localhost:3000/uploads/posts/<arquivo>
```

Formatos aceitos:

- JPG
- PNG
- WebP

Limite por imagem:

```text
5 MB
```

## Conta de desenvolvimento

O frontend possui um atalho para login local com a conta:

```text
email: dev@eureca.local
password: dev123456
username: dev_eureca
```

Se a conta ainda nao existir, o frontend tenta cria-la automaticamente.

## Scripts

### Backend

| Script | Descricao |
| --- | --- |
| `npm run start:dev` | inicia a API em modo desenvolvimento |
| `npm run start` | inicia a API |
| `npm run build` | compila o backend |
| `npm run start:prod` | roda a versao compilada |
| `npm run test` | executa testes unitarios |
| `npm run test:e2e` | executa testes end-to-end |
| `npm run test:cov` | gera cobertura de testes |
| `npm run lint` | executa ESLint com correcao automatica |
| `npm run format` | formata arquivos TypeScript |

### Frontend

| Script | Descricao |
| --- | --- |
| `npm run dev` | inicia o Vite |
| `npm run build` | gera build de producao |
| `npm run preview` | serve a build localmente |
| `npm run lint` | executa ESLint |

## API principal

### Saude

```http
GET /health
```

### Autenticacao

```http
POST /auth/register
POST /auth/login
```

Exemplo de cadastro:

```json
{
  "email": "dev@eureca.local",
  "password": "dev123456",
  "name": "Dev Eureca",
  "username": "dev_eureca",
  "role": "Engenharia de Software",
  "bio": "Conta local para testar publicacoes, curtidas e conversas da Eureca.",
  "interests": ["Frontend", "Backend", "Comunidade"]
}
```

No login, o campo `email` tambem aceita o nome de usuario, com ou sem `@`.

### Usuarios

```http
GET /users/me
GET /users/me/suggestions
PATCH /users/me/eureca-plus
DELETE /users/me/eureca-plus
POST /users/:id/follow
DELETE /users/:id/follow
GET /users/:id/followers
GET /users/:id/following
GET /users/:id
```

Rotas `me`, Eureca Plus, sugestoes e follow/unfollow exigem JWT.

### Posts

```http
GET /posts
GET /posts/me/feed
GET /posts/me/following
GET /posts/trends
POST /posts
DELETE /posts/:id
POST /posts/:id/like
DELETE /posts/:id/like
POST /posts/:id/view
POST /posts/:id/report
```

O feed autenticado retorna informacoes como:

- autor
- imagem do post
- quantidade de curtidas
- quantidade de comentarios
- quantidade de visualizacoes
- estado `viewerLiked`
- informacoes de seguidores do autor quando aplicavel

### Uploads

```http
POST /uploads/images
```

Essa rota exige JWT e recebe `multipart/form-data` com o arquivo no campo `image`.

Resposta resumida:

```json
{
  "imageUrl": "http://localhost:3000/uploads/posts/arquivo.webp",
  "path": "/uploads/posts/arquivo.webp",
  "filename": "arquivo.webp",
  "originalName": "imagem.webp",
  "mimeType": "image/webp",
  "size": 12345
}
```

### Comentarios

```http
GET /posts/:postId/comments
POST /posts/:postId/comments
PATCH /comments/:id
DELETE /comments/:id
```

A listagem de comentarios aceita paginacao:

```text
limit
cursor
parentCommentId
```

Comentarios podem responder diretamente a um post ou a outro comentario.

### Notificacoes

```http
GET /notifications
PATCH /notifications/:id/read
PATCH /notifications/read-all
```

As notificacoes sao protegidas por autenticacao e podem apontar para posts, comentarios, conversas ou mensagens.

### Conversas

```http
GET /conversations
POST /conversations
GET /conversations/:id/messages
POST /conversations/:id/messages
PATCH /conversations/:id/read
```

Todas as rotas de conversa exigem JWT. A listagem de mensagens aceita:

```text
limit
cursor
```

O canal em tempo real usa Socket.IO no mesmo host da API. O token JWT pode ser enviado em `auth.token` ou no header `Authorization: Bearer <token>`.

## Modelo de dados

Principais entidades do Prisma:

- `User`: conta cadastrada
- `UserFollow`: relacao entre seguidor e usuario seguido
- `Post`: publicacao criada por um usuario
- `PostLike`: curtida de usuario em post
- `PostReport`: denuncia de usuario em post
- `Comment`: comentario ou resposta
- `Notification`: alerta gerado por interacao social, mensagem privada ou aviso da plataforma
- `Conversation`: conversa privada
- `ConversationParticipant`: participante e estado de leitura da conversa
- `Message`: mensagem enviada em uma conversa

Restricoes importantes:

- `User.email` e unico
- `User.username` e unico quando preenchido
- Um usuario nao pode curtir o mesmo post duas vezes
- Um usuario nao pode denunciar o mesmo post duas vezes
- A relacao seguidor/seguindo e unica por par de usuarios
- Conversas, mensagens, comentarios, curtidas, denuncias e notificacoes relacionadas usam exclusao em cascata quando aplicavel
- Comentarios e mensagens possuem indices para paginacao por data

## Comportamento atual

- O backend aceita CORS do frontend local em `http://localhost:5173` e `http://127.0.0.1:5173`
- O backend serve arquivos locais do diretorio `uploads`
- O feed publico funciona sem autenticacao
- Criar posts, enviar imagens, curtir, comentar, denunciar, seguir usuarios, abrir conversas e acessar notificacoes exige JWT
- O frontend persiste sessao no navegador
- Visualizacoes podem ser registradas sem login
- O realtime de conversas desconecta sockets sem token valido

## Testes

Backend:

```bash
cd backend
npm run build
npm run test
npm run test:e2e
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

## Validacao recente

Antes do ultimo push de codigo, foram executados:

```bash
cd backend && npm run build
cd backend && npm test -- --runInBand
cd frontend && npm run build
```

## Proximos passos

- Tornar CORS configuravel por ambiente
- Adicionar moderacao administrativa para denuncias
- Persistir preferencia de plano Eureca Plus com fluxo real de pagamento
- Evoluir conversas 1:1 para grupos
- Conectar mais areas de descoberta a dados reais
- Criar scripts unificados na raiz do projeto
- Adicionar deploy automatizado para frontend e backend
