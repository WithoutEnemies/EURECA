# EURECA

EURECA e uma aplicacao web com frontend em React e backend em NestJS para uma experiencia de comunidade com autenticacao, feed de posts, curtidas e contagem de visualizacoes.

O projeto esta dividido em duas apps:

- `frontend`: interface em React + Vite
- `backend`: API em NestJS + Prisma + PostgreSQL

## O que o projeto faz

- cadastro e login com JWT
- persistencia de sessao no navegador
- feed publico para visitantes
- feed autenticado com informacao de curtidas do utilizador atual
- criacao de posts
- curtidas e remocao de curtidas
- contagem de visualizacoes por post
- atalho "Entrar com Dev" no frontend, que tenta fazer login e, se necessario, cria automaticamente a conta de desenvolvimento

## Stack

- Frontend: React 19, Vite
- Backend: NestJS 11
- Base de dados: PostgreSQL
- ORM: Prisma
- Autenticacao: JWT + Passport + bcrypt

## Estrutura

```text
EURECA/
|-- backend/
|   |-- prisma/
|   |-- src/
|   `-- package.json
|-- frontend/
|   |-- src/
|   `-- package.json
`-- README.md
```

## Requisitos

- Node.js
- npm
- PostgreSQL

## Configuracao local

### 1. Instalar dependencias

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Configurar o backend

Cria um ficheiro `backend/.env` com pelo menos estas variaveis:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/eureca"
JWT_SECRET="troca-este-segredo"
PORT=3000
```

### 3. Aplicar as migrations

Na pasta `backend`:

```bash
npx prisma migrate dev
```

Se quiseres apenas aplicar migrations existentes sem criar novas:

```bash
npx prisma migrate deploy
```

### 4. Arrancar a API

Na pasta `backend`:

```bash
npm run start:dev
```

A API fica disponivel por omissao em `http://localhost:3000`.

### 5. Arrancar o frontend

Na pasta `frontend`:

```bash
npm run dev
```

O frontend fica disponivel por omissao em `http://localhost:5173`.

## Variaveis de ambiente

### Backend

- `DATABASE_URL`: ligacao PostgreSQL usada pelo Prisma
- `JWT_SECRET`: segredo para assinar os tokens
- `PORT`: porta HTTP da API. Se nao for definida, usa `3000`

### Frontend

- `VITE_API_URL`: URL base da API. Se nao for definida, usa `http://localhost:3000`

## Endpoints principais

### Saude

- `GET /health`

### Autenticacao

- `POST /auth/register`
- `POST /auth/login`

### Utilizador autenticado

- `GET /users/me`

### Posts

- `GET /posts`
- `GET /posts/me/feed`
- `POST /posts`
- `POST /posts/:id/like`
- `DELETE /posts/:id/like`
- `POST /posts/:id/view`

## Fluxo rapido para testar

1. Inicia PostgreSQL.
2. Arranca o backend.
3. Arranca o frontend.
4. Abre `http://localhost:5173`.
5. Usa o formulario de login ou o botao `Entrar com Dev`.

## Notas importantes

- O backend esta com CORS configurado para `http://localhost:5173`.
- O feed publico funciona sem login, mas criar posts e curtir exige autenticacao.
- Algumas areas visuais do frontend, como tendencias, sugestoes e a area de conversas, ainda usam dados mockados.
