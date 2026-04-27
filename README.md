# EURECA

Aplicacao web full-stack para uma comunidade simples, com autenticacao, feed de posts, curtidas e contagem de visualizacoes.

O repositorio esta dividido em duas apps:

- `frontend`: interface em React + Vite
- `backend`: API em NestJS + Prisma + PostgreSQL

## Visao Geral

O objetivo do projeto e oferecer uma base pequena, direta e funcional para uma experiencia de comunidade:

- visitantes conseguem ver o feed publico
- utilizadores autenticados conseguem entrar, criar posts e curtir publicacoes
- o frontend persiste a sessao no navegador
- a API devolve um feed personalizado para o utilizador logado, incluindo o estado de curtida
- cada post regista visualizacoes

Hoje o produto cobre o fluxo principal de autenticacao e publicacao. Algumas zonas da interface, como tendencias, sugestoes e conversas, ainda usam dados mockados no frontend.

## Funcionalidades

- registo e login com JWT
- registo com perfil inicial: nome, usuario, area, bio e interesses
- endpoint protegido para obter o utilizador autenticado
- feed publico sem login
- feed autenticado com `viewerLiked`
- criacao de posts com limite de 280 caracteres
- like e unlike por post
- contagem de visualizacoes
- persistencia do token em `localStorage`
- atalho `Entrar com Dev` para acelerar testes locais

## Stack

- Frontend: React 19 + Vite
- Backend: NestJS 11
- Base de dados: PostgreSQL
- ORM: Prisma 7
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
- PostgreSQL a correr localmente

Nao existe workspace root com scripts unificados. O setup e feito separadamente em `backend` e `frontend`.

## Quick Start

### 1. Instalar dependencias

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Configurar o backend

Cria `backend/.env` com estas variaveis:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/eureca"
JWT_SECRET="troca-este-segredo"
PORT=3000
```

Notas:

- `DATABASE_URL` e obrigatoria
- `JWT_SECRET` deve ser definido, embora o backend tenha fallback para desenvolvimento
- `PORT` e opcional; por omissao usa `3000`

### 3. Preparar a base de dados

Na pasta `backend`:

```bash
npx prisma migrate dev
```

Se quiseres apenas aplicar migrations existentes:

```bash
npx prisma migrate deploy
```

### 4. Arrancar a API

Num terminal, dentro de `backend`:

```bash
npm run start:dev
```

API por omissao: `http://localhost:3000`

Healthcheck:

```bash
curl http://localhost:3000/health
```

### 5. Arrancar o frontend

Noutro terminal, dentro de `frontend`:

```bash
npm run dev
```

Frontend por omissao: `http://localhost:5173`

## Variaveis de Ambiente

### Backend

| Variavel | Obrigatoria | Descricao |
| --- | --- | --- |
| `DATABASE_URL` | sim | Ligacao PostgreSQL usada pelo Prisma |
| `JWT_SECRET` | recomendada | Segredo usado para assinar os tokens |
| `PORT` | nao | Porta HTTP da API |

### Frontend

| Variavel | Obrigatoria | Descricao |
| --- | --- | --- |
| `VITE_API_URL` | nao | URL base da API; fallback para `http://localhost:3000` |

## Scripts Uteis

### Backend

| Script | O que faz |
| --- | --- |
| `npm run start:dev` | arranca a API em watch mode |
| `npm run build` | compila o backend |
| `npm run test` | corre testes unitarios |
| `npm run test:e2e` | corre testes end-to-end |
| `npm run lint` | executa ESLint com `--fix` |

### Frontend

| Script | O que faz |
| --- | --- |
| `npm run dev` | arranca o Vite em desenvolvimento |
| `npm run build` | gera build de producao |
| `npm run preview` | serve a build localmente |
| `npm run lint` | executa ESLint |

## Fluxo Rapido Para Testar

1. Inicia PostgreSQL.
2. Arranca o backend.
3. Arranca o frontend.
4. Abre `http://localhost:5173`.
5. Usa login manual ou o botao `Entrar com Dev`.

Conta de desenvolvimento usada pelo frontend:

```text
email: dev@eureca.local
password: dev123456
```

Se a conta ainda nao existir, o frontend tenta cria-la automaticamente.

## API Principal

### Saude

- `GET /health`

Resposta esperada:

```json
{
  "status": "ok",
  "time": "<ISO timestamp>",
  "version": "0.0.1"
}
```

### Autenticacao

- `POST /auth/register`
- `POST /auth/login`

Payload:

```json
{
  "email": "dev@eureca.local",
  "password": "dev123456",
  "name": "Dev Eureca",
  "username": "dev_eureca",
  "role": "Desenvolvimento",
  "bio": "Criando uma comunidade.",
  "interests": ["Frontend", "Backend"]
}
```

No login, apenas `email` e `password` sao necessarios. O campo `email` tambem aceita o nome de usuario, com ou sem `@`:

```json
{
  "email": "dev_eureca",
  "password": "dev123456"
}
```

### Utilizador autenticado

- `GET /users/me`
- `GET /users/:id`

Header:

```text
Authorization: Bearer <token>
```

`GET /users/:id` devolve o perfil publico seguro de um utilizador e nao exige token.

### Posts

- `GET /posts`
- `GET /posts/me/feed`
- `POST /posts`
- `POST /posts/:id/like`
- `DELETE /posts/:id/like`
- `POST /posts/:id/view`

O feed autenticado devolve, alem dos dados do post:

- `likesCount`
- `viewCount`
- `viewerLiked`
- `author.id`
- `author.email`
- `author.name`
- `author.username`

## Modelo de Dados

O schema Prisma tem tres entidades principais:

- `User`: conta autenticada
- `Post`: publicacao criada por um utilizador
- `PostLike`: relacao de curtida entre utilizador e post

Restricoes relevantes:

- `User.email` e unico
- `User.username` e unico quando preenchido
- um post pertence a um autor
- um utilizador nao pode curtir o mesmo post duas vezes

## Comportamento Atual

- o backend aceita CORS do frontend local em `http://localhost:5173` e `http://127.0.0.1:5173`
- o feed publico funciona sem autenticacao
- criar posts e curtir exige token JWT
- a API devolve no maximo 20 posts por feed
- a contagem de visualizacoes e publica
- tendencias, sugestoes e conversas ainda nao estao ligadas ao backend

## Proximos Passos Naturais

- ligar as areas ainda mockadas a dados reais
- adicionar paginacao ou cursor no feed
- tornar CORS configuravel por ambiente
- criar scripts de arranque unificados na raiz
- melhorar cobertura de testes do fluxo completo frontend + backend
