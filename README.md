# Azimuth — AI-Powered Property Management Platform

A full-stack real-time property management application with integrated AI capabilities for conversation summarization, smart reply suggestions, issue detection, and semantic search. Built with **React**, **TypeScript**, **Node.js/Express**, **Supabase**, and **OpenAI**.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [AI Features](#ai-features)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup Instructions](#setup-instructions)
- [Docker Setup](#docker-setup)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Running Tests](#running-tests)
- [API Endpoints](#api-endpoints)

---

## Tech Stack

| Layer        | Technology                                                     |
| ------------ | -------------------------------------------------------------- |
| **Frontend** | React 18, TypeScript, Vite, React Router v6, Axios, Socket.IO Client, Lucide React |
| **Backend**  | Node.js, Express, TypeScript, Socket.IO, OpenAI SDK            |
| **Database** | Supabase (PostgreSQL), pgvector (vector embeddings), Row-Level Security |
| **AI/ML**    | OpenAI GPT-3.5-Turbo (chat completions), text-embedding-3-small (vector embeddings) |
| **Auth**     | Supabase Auth (JWT-based), Bearer token middleware              |
| **Realtime** | Socket.IO (WebSocket) for messaging, typing indicators, and push notifications |
| **Testing**  | Jest, Supertest (backend), React Testing Library (frontend)     |
| **DevOps**   | Docker, Docker Compose, Nginx (production frontend)             |

---

## Architecture Overview

The application follows a **client–server** architecture with real-time communication and AI services:

```
┌──────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React + Vite)                    │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌────────────────────┐  │
│  │  Pages   │  │Components│  │ Contexts   │  │  Services (API)    │  │
│  │Dashboard │  │AISummary │  │AuthContext │  │  Axios + Supabase  │  │
│  │Properties│  │SmartReply│  │SocketCtx  │  │  JWT interceptor   │  │
│  │Messages  │  │Layout    │  │           │  │                    │  │
│  └──────────┘  └──────────┘  └───────────┘  └────────────────────┘  │
│         │              │             │                │               │
└─────────┼──────────────┼─────────────┼────────────────┼──────────────┘
          │    REST API  │             │    WebSocket    │
          ▼              ▼             ▼                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js + Express + Socket.IO)          │
│                                                                      │
│  ┌──────────┐  ┌────────────┐  ┌────────────┐  ┌─────────────────┐  │
│  │  Routes  │  │ Controllers│  │ Middleware  │  │    Services     │  │
│  │  /api/*  │  │  Auth      │  │  JWT Auth   │  │  AI Service     │  │
│  │          │  │  Property  │  │  RBAC       │  │  Embedding Svc  │  │
│  │          │  │  Message   │  │             │  │  Notification   │  │
│  │          │  │  AI        │  │             │  │                 │  │
│  └──────────┘  └────────────┘  └────────────┘  └─────────────────┘  │
│         │                                              │             │
└─────────┼──────────────────────────────────────────────┼─────────────┘
          │                                              │
          ▼                                              ▼
┌─────────────────────────┐              ┌─────────────────────────────┐
│       Supabase          │              │         OpenAI API          │
│  PostgreSQL + pgvector  │              │  GPT-3.5-Turbo (chat)       │
│  Auth (JWT tokens)      │              │  text-embedding-3-small     │
│  Row-Level Security     │              │  (vector embeddings)        │
│  Realtime subscriptions │              │                             │
└─────────────────────────┘              └─────────────────────────────┘
```

### Key Architectural Decisions

- **Supabase Auth** handles user registration, login, and JWT issuance. The backend validates JWTs via the Supabase Admin SDK on every authenticated request.
- **Role-Based Access Control (RBAC)** — Three user roles (`tenant`, `landlord`, `agent`) with distinct permissions enforced at both the API middleware level and database (RLS policies).
- **Socket.IO** provides real-time bidirectional communication for instant messaging, typing indicators, online presence tracking, and push notifications.
- **Graceful AI Degradation** — All AI features include keyword-based and rule-based fallbacks that activate when the OpenAI API key is not configured, ensuring the application remains fully functional without AI.

---

## AI Features

### 1. Conversation Summarization

Generates concise, structured summaries of property management conversations using GPT-3.5-Turbo. Summaries highlight key discussion points, action items, decisions, and flagged concerns. Summaries are stored in the `ai_summaries` table for future reference.

### 2. Smart Reply Suggestions

Produces three context-aware, role-specific reply suggestions based on the conversation history. Replies are tailored to the user's role (tenant, landlord, or agent) and the current conversation tone, enabling faster and more professional communication.

### 3. Issue Detection & Sentiment Analysis

Analyzes conversation content to automatically detect and categorize property management issues (e.g., Late Payment, Maintenance Request, Safety Concern, Lease Concern). Each issue is assigned a severity level (`low`, `medium`, `high`), and an overall sentiment score (`positive`, `neutral`, `negative`) is computed for the conversation.

### 4. Dashboard AI Insights

Aggregates issue detection results across all of a user's conversations to produce a high-level dashboard with total issues count, high-priority alerts, key findings, and actionable recommendations.

### 5. Semantic Search (Vector Embeddings)

Leverages OpenAI's `text-embedding-3-small` model and Supabase's `pgvector` extension to generate and store 1536-dimensional vector embeddings of conversation content. Enables:

- **Similarity search** — Find conversations semantically related to a natural-language query.
- **Context-augmented AI** — Retrieves relevant past conversations to enhance the quality of summaries and smart replies (RAG pattern).

Embeddings are automatically updated whenever new messages are sent, and similarity search is filtered by user participation via Row-Level Security.

---

## Project Structure

```
Azimuth Test Assessment/
├── backend/
│   ├── src/
│   │   ├── app.ts                  # Express app setup, middleware, routes
│   │   ├── server.ts               # HTTP server + Socket.IO initialization
│   │   ├── config/
│   │   │   ├── config.ts           # Environment configuration
│   │   │   ├── openai.ts           # OpenAI client (conditional init)
│   │   │   ├── socket.ts           # Socket.IO server, auth, event handlers
│   │   │   └── supabase.ts         # Supabase admin client
│   │   ├── controllers/            # Route handlers (auth, property, conversation, AI, etc.)
│   │   ├── middleware/
│   │   │   └── auth.ts             # JWT verification, profile loading, RBAC
│   │   ├── routes/                 # Express route definitions
│   │   ├── services/
│   │   │   ├── ai.service.ts       # Summarization, smart replies, issue detection, insights
│   │   │   ├── embedding.service.ts# Vector embedding generation, upsert, similarity search
│   │   │   └── notification.service.ts # Push notification creation + WebSocket delivery
│   │   └── types/
│   │       └── index.ts            # Shared TypeScript interfaces & types
│   ├── tests/                      # Backend unit & integration tests
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx                 # Root component, routing setup
│   │   ├── main.tsx                # Entry point
│   │   ├── components/
│   │   │   ├── AISummary.tsx       # AI summarization + issue detection panel
│   │   │   ├── SmartReplies.tsx    # Smart reply suggestion chips
│   │   │   ├── NotificationBell.tsx# Real-time notification indicator
│   │   │   ├── Layout.tsx          # App shell with sidebar
│   │   │   ├── PropertyCard.tsx    # Property listing card
│   │   │   ├── MessageBubble.tsx   # Chat message bubble
│   │   │   ├── ProtectedRoute.tsx  # Auth guard for routes
│   │   │   └── Sidebar.tsx         # Navigation sidebar
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx      # Authentication state management
│   │   │   └── SocketContext.tsx    # Socket.IO connection management
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx       # Dashboard with stats & AI insights
│   │   │   ├── Properties.tsx      # Property listing page
│   │   │   ├── PropertyDetail.tsx  # Single property view with tenant management
│   │   │   ├── CreateProperty.tsx  # Property creation form
│   │   │   ├── Messages.tsx        # Conversation list & chat view
│   │   │   ├── Login.tsx           # Login page
│   │   │   └── Register.tsx        # Registration page
│   │   ├── services/
│   │   │   └── api.ts              # Axios instance, API modules (auth, properties, AI, etc.)
│   │   ├── hooks/
│   │   │   └── useUnread.ts        # Unread notification count hook
│   │   ├── types/
│   │   │   └── index.ts            # Frontend TypeScript types
│   │   └── styles/
│   │       └── index.css           # Global stylesheet
│   ├── vite.config.ts
│   └── package.json
├── supabase/
│   └── schema.sql                  # Full database schema (tables, indexes, RLS, functions)
├── docker-compose.yml              # Multi-container Docker orchestration
└── README.md
```

---

## Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- **Docker** & **Docker Compose** (optional — for containerized deployment)
- **Supabase** account with a project created ([supabase.com](https://supabase.com))
- **OpenAI** API key (optional — AI features degrade gracefully without it)

---

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd "Azimuth Test Assessment"
```

### 2. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Configure Environment Variables

Create `.env` files in both the `backend/` and `frontend/` directories.

#### `backend/.env`

```env
PORT=5000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# OpenAI (optional — remove for fallback mode)
OPENAI_API_KEY=your-openai-api-key

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

#### `frontend/.env`

```env
VITE_API_URL=http://localhost:5000/api
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 4. Set Up the Database

1. Open your Supabase project's **SQL Editor**.
2. Copy and run the contents of `supabase/schema.sql`.

This will create all tables, indexes, Row-Level Security policies, triggers, the pgvector extension, and the `match_conversations` similarity search function.

### 5. Run the Application

```bash
# Terminal 1 — Start the backend
cd backend
npm run dev

# Terminal 2 — Start the frontend
cd frontend
npm run dev
```

- **Backend** runs at `http://localhost:5000`
- **Frontend** runs at `http://localhost:3000`

---

## Docker Setup

Run the entire stack in containers with a single command.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed.

### 1. Configure Environment

Ensure `backend/.env` exists with your Supabase and OpenAI keys (see [Environment Variables](#environment-variables)).

Create a `.env` file in the **project root** for the frontend build args:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 2. Build & Start

```bash
docker compose up --build
```

### 3. Access the Application

| Service      | URL                        |
| ------------ | -------------------------- |
| **Frontend** | http://localhost           |
| **Backend**  | http://localhost:5000/api  |

### 4. Stop

```bash
docker compose down
```

### Run Individual Containers

```bash
# Backend only
docker build -t azimuth-backend ./backend
docker run -p 5000:5000 --env-file ./backend/.env azimuth-backend

# Frontend only (pass build args for Vite env)
docker build -t azimuth-frontend ./frontend \
  --build-arg VITE_API_URL=http://localhost:5000/api \
  --build-arg VITE_SUPABASE_URL=https://your-project-id.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
docker run -p 80:80 azimuth-frontend
```

---

## Environment Variables

| Variable                     | Location  | Required | Description                                    |
| ---------------------------- | --------- | -------- | ---------------------------------------------- |
| `PORT`                       | Backend   | No       | Server port (default: `5000`)                  |
| `NODE_ENV`                   | Backend   | No       | Environment mode (default: `development`)      |
| `SUPABASE_URL`               | Backend   | Yes      | Supabase project URL                           |
| `SUPABASE_SERVICE_ROLE_KEY`  | Backend   | Yes      | Supabase service role key (admin access)       |
| `OPENAI_API_KEY`             | Backend   | No       | OpenAI API key (enables AI features)           |
| `FRONTEND_URL`               | Backend   | No       | Allowed CORS origin (default: `http://localhost:3000`) |
| `VITE_API_URL`               | Frontend  | No       | Backend API base URL (default: `http://localhost:5000/api`) |
| `VITE_SUPABASE_URL`          | Frontend  | Yes      | Supabase project URL                           |
| `VITE_SUPABASE_ANON_KEY`     | Frontend  | Yes      | Supabase anonymous/public key                  |

---

## Running Tests

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

---

## API Endpoints

All endpoints are prefixed with `/api`.

| Method | Endpoint                                  | Auth | Description                             |
| ------ | ----------------------------------------- | ---- | --------------------------------------- |
| GET    | `/api/health`                             | No   | Health check                            |
| POST   | `/api/auth/register`                      | Yes* | Register a new user profile             |
| POST   | `/api/auth/login`                         | No   | Login and receive JWT                   |
| GET    | `/api/auth/me`                            | Yes  | Get current user profile                |
| GET    | `/api/users`                              | Yes  | List users (filterable by role)         |
| GET    | `/api/users/:id`                          | Yes  | Get user by ID                          |
| GET    | `/api/properties`                         | Yes  | List user's properties                  |
| GET    | `/api/properties/all`                     | Yes  | List all properties                     |
| GET    | `/api/properties/:id`                     | Yes  | Get property details                    |
| POST   | `/api/properties`                         | Yes  | Create a property                       |
| PUT    | `/api/properties/:id`                     | Yes  | Update a property                       |
| POST   | `/api/properties/:id/tenants`             | Yes  | Assign tenant to property               |
| DELETE | `/api/properties/:id/tenants/:tenantId`   | Yes  | Remove tenant from property             |
| GET    | `/api/conversations`                      | Yes  | List user's conversations               |
| POST   | `/api/conversations`                      | Yes  | Create a new conversation               |
| GET    | `/api/conversations/:id`                  | Yes  | Get conversation with messages          |
| POST   | `/api/conversations/:id/messages`         | Yes  | Send a message                          |
| POST   | `/api/ai/summarize/:conversationId`       | Yes  | Generate AI conversation summary        |
| POST   | `/api/ai/smart-replies/:conversationId`   | Yes  | Get AI smart reply suggestions          |
| POST   | `/api/ai/detect-issues/:conversationId`   | Yes  | Detect issues in a conversation         |
| GET    | `/api/ai/insights`                        | Yes  | Get aggregated AI dashboard insights    |
| POST   | `/api/ai/search`                          | Yes  | Semantic vector search across conversations |
| GET    | `/api/notifications`                      | Yes  | List user notifications                 |
| PUT    | `/api/notifications/:id/read`             | Yes  | Mark notification as read               |
| PUT    | `/api/notifications/read-all`             | Yes  | Mark all notifications as read          |
| DELETE | `/api/notifications/:id`                  | Yes  | Delete a notification                   |

> *`/api/auth/register` requires a valid Supabase JWT (token-only verification, no profile required).

---

## WebSocket Events

| Event                  | Direction       | Description                                    |
| ---------------------- | --------------- | ---------------------------------------------- |
| `conversation:join`    | Client → Server | Join a conversation room                       |
| `conversation:leave`   | Client → Server | Leave a conversation room                      |
| `message:new`          | Server → Client | New message in a conversation                  |
| `typing:start`         | Bidirectional   | User started typing                            |
| `typing:stop`          | Bidirectional   | User stopped typing                            |
| `user:online`          | Server → Client | User online/offline status change              |
| `users:online:request` | Client → Server | Request list of online users                   |
| `users:online:list`    | Server → Client | List of currently online user IDs              |
| `notification:new`     | Server → Client | New push notification                          |

---

## License

This project was developed as a technical assessment for Azimuth.
