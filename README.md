```markdown
# EURECA

EURECA é uma aplicação web full-stack de comunidade social, com autenticação, feed de publicações, curtidas, comentários, respostas, notificações e painel social.

O projeto está dividido em duas aplicações:

- `frontend`: interface em React + Vite
- `backend`: API em NestJS + Prisma + PostgreSQL

## Funcionalidades

- Cadastro e login com JWT
- Login por email ou nome de usuário
- Perfil inicial com nome, usuário, área, bio e interesses
- Feed público acessível sem login
- Feed autenticado com estado de curtida por usuário
- Criação de posts
- Curtir e descurtir posts
- Contagem de visualizações
- Comentários em posts
- Respostas a comentários
- Edição e remoção de comentários próprios
- Notificações para interações sociais
- Marcar notificação como lida
- Marcar todas as notificações como lidas
- Painel lateral com discussões ativas, tópicos e progresso da comunidade
- Conta de desenvolvimento para testes locais

## Stack

### Frontend

- React 19
- Vite 7
- lucide-react
- CSS próprio

### Backend

- NestJS 11
- Prisma 7
- PostgreSQL
- JWT
- Passport
- bcrypt

## Estrutura

```text
EURECA/
|-- backend/
|   |-- prisma/
|   |-- src/
|   |-- test/
|   `-- package.json
|-- frontend/
|   |-- src/
|   `-- package.json
`-- README.md
```

## Requisitos

- Node.js
- npm
- PostgreSQL local

O projeto não usa workspace na raiz. Frontend e backend são instalados e executados separadamente.

## Instalação

### 1. Instalar dependências

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Configurar variáveis de ambiente

Crie o arquivo `backend/.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/eureca"
JWT_SECRET="troque-este-segredo"
PORT=3000
```

Opcionalmente, no frontend:

```env
VITE_API_URL="http://localhost:3000"
```

Se `VITE_API_URL` não for definido, o frontend usa `http://localhost:3000`.

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

API padrão:

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

Frontend padrão:

```text
http://localhost:5173
```

## Conta de desenvolvimento

O frontend possui um atalho para login local com a conta:

```text
email: dev@eureca.local
password: dev123456
username: dev_eureca
```

Se a conta ainda não existir, o frontend tenta criá-la automaticamente.

## Scripts

### Backend

| Script | Descrição |
| --- | --- |
| `npm run start:dev` | inicia a API em modo desenvolvimento |
| `npm run start` | inicia a API |
| `npm run build` | compila o backend |
| `npm run start:prod` | roda a versão compilada |
| `npm run test` | executa testes unitários |
| `npm run test:e2e` | executa testes end-to-end |
| `npm run test:cov` | gera cobertura de testes |
| `npm run lint` | executa ESLint com correção automática |
| `npm run format` | formata arquivos TypeScript |

### Frontend

| Script | Descrição |
| --- | --- |
| `npm run dev` | inicia o Vite |
| `npm run build` | gera build de produção |
| `npm run preview` | serve a build localmente |
| `npm run lint` | executa ESLint |

## API principal

### Saúde

```http
GET /health
```

### Autenticação

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
  "bio": "Conta local para testar publicações, curtidas e conversas da Eureca.",
  "interests": ["Frontend", "Backend", "Comunidade"]
}
```

No login, o campo `email` também aceita o nome de usuário, com ou sem `@`.

### Usuários

```http
GET /users/me
GET /users/:id
```

`GET /users/me` exige token JWT.

Header:

```text
Authorization: Bearer <token>
```

### Posts

```http
GET /posts
GET /posts/me/feed
POST /posts
POST /posts/:id/like
DELETE /posts/:id/like
POST /posts/:id/view
```

O feed autenticado retorna informações como:

- autor
- quantidade de curtidas
- quantidade de comentários
- quantidade de visualizações
- estado `viewerLiked`

### Comentários

```http
GET /posts/:postId/comments
POST /posts/:postId/comments
PATCH /comments/:id
DELETE /comments/:id
```

A listagem de comentários aceita paginação:

```text
limit
cursor
parentCommentId
```

Comentários podem responder diretamente a um post ou a outro comentário.

### Notificações

```http
GET /notifications
PATCH /notifications/:id/read
PATCH /notifications/read-all
```

As notificações são protegidas por autenticação.

## Modelo de dados

Principais entidades do Prisma:

- `User`: conta cadastrada
- `Post`: publicação criada por um usuário
- `PostLike`: curtida de usuário em post
- `Comment`: comentário ou resposta
- `Notification`: alerta gerado por interação social

Restrições importantes:

- `User.email` é único
- `User.username` é único quando preenchido
- Um usuário não pode curtir o mesmo post duas vezes
- Comentários, curtidas e notificações são removidos em cascata quando o conteúdo relacionado é apagado
- Comentários possuem índices para paginação por post, comentário pai e data de criação

## Comportamento atual

- O backend aceita CORS do frontend local em `http://localhost:5173` e `http://127.0.0.1:5173`
- O feed público funciona sem autenticação
- Criar posts, curtir, comentar e acessar notificações exige JWT
- O frontend persiste sessão no navegador
- Visualizações podem ser registradas sem login
- Algumas áreas de descoberta, tópicos e sugestões ainda usam dados locais/mockados no frontend

## Testes

Backend:

```bash
cd backend
npm run test
npm run test:e2e
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

## Próximos passos

- Tornar CORS configurável por ambiente
- Adicionar paginação/cursor também no feed de posts
- Conectar tópicos e sugestões a dados reais
- Criar scripts unificados na raiz do projeto
- Adicionar deploy automatizado para frontend e backend
```
