# Frontend Service

**Version:** 1.0  
**Date:** February 2026  
**Status:** Production

---

## 1. Service Overview

The Frontend Service is the web-based user interface for the SalesAI platform. It provides a React-based SPA (Single Page Application) for sales teams, managers, and administrators to interact with the platform's features.

### 1.1 Purpose

- **User Authentication**: Login, registration, password management
- **Dashboard Views**: User, Director, and Super Admin dashboards
- **Call Management**: View call list, call details, transcripts, analysis
- **Script Management**: Upload, view, and manage sales scripts
- **Team Management**: Create and manage teams
- **Analytics Visualization**: View performance metrics, leaderboards
- **Settings**: Company settings, integrations, notifications
- **Real-time Updates**: WebSocket-based notifications

### 1.2 Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Language | TypeScript | 5.x |
| Framework | React | 18.x |
| Build Tool | Vite | 5.x |
| Styling | Tailwind CSS | 3.x |
| State Management | React Context + Hooks | - |
| HTTP Client | Axios | - |
| Internationalization | i18next | - |
| Routing | React Router | 6.x |
| UI Components | Custom + Headless UI | - |
| Charts | Recharts | - |

### 1.3 Service Location

- **Port**: 80 (via Nginx)
- **Protocol**: HTTP
- **Base Path**: `/`

---

## 2. Architecture

The Frontend Service follows a feature-based architecture:

```
services/frontend/
├── src/
│   ├── app/                       # App configuration, providers
│   │   ├── App.tsx              # Root component
│   │   ├── main.tsx             # Entry point
│   │   ├── i18n.ts             # Internationalization
│   │   └── providers/           # Context providers
│   ├── entities/                  # Domain entities (API interfaces)
│   │   ├── analytics/
│   │   ├── call/
│   │   ├── company/
│   │   ├── integration/
│   │   ├── notification/
│   │   ├── script/
│   │   ├── team/
│   │   └── user/
│   ├── features/                  # Feature modules
│   │   ├── auth/
│   │   ├── integrations/
│   │   └── team-management/
│   ├── pages/                     # Page components
│   │   ├── CallsList/
│   │   ├── CallDetail/
│   │   ├── CompanySettings/
│   │   ├── Dashboard/
│   │   ├── Login/
│   │   ├── ScriptsList/
│   │   └── ...
│   ├── shared/                    # Shared utilities
│   │   ├── api/                   # API client
│   │   ├── ui/                    # UI components
│   │   └── utils/
│   └── widgets/                   # Reusable widgets
│       ├── PageLayout/
│       └── Sidebar/
├── public/                         # Static assets
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.ts
├── tsconfig.json
├── eslint.config.js
├── nginx.conf
└── Dockerfile
```

### 2.1 Layer Responsibilities

#### App Layer
- **App.tsx**: Root component with routing
- **main.tsx**: Application bootstrap
- **i18n.ts**: Internationalization setup
- **Providers**: Context providers for auth, theme, etc.

#### Entities Layer
- **API Interfaces**: TypeScript types matching API responses
- **API Client**: Axios instance with interceptors

#### Features Layer
- **Auth**: Login, registration components
- **Integrations**: Integration management
- **Team Management**: Team CRUD operations

#### Pages Layer
- **Page Components**: Full page implementations
- **Layout Components**: Page layouts with sidebar, header

#### Shared Layer
- **API**: HTTP client configuration
- **UI**: Reusable UI components
- **Utils**: Helper functions

---

## 3. Pages & Features

### 3.1 Public Pages

| Page | Route | Description |
|------|-------|-------------|
| Landing Page | `/` | Marketing landing page |
| Login | `/login` | User login |
| Register | `/register` | User registration |

### 3.2 Dashboard Pages

| Page | Route | Description |
|------|-------|-------------|
| User Dashboard | `/dashboard` | Personal performance overview |
| Director Dashboard | `/director` | Team performance overview |
| Leaderboard | `/leaderboard` | Team rankings |

### 3.3 Call Management

| Page | Route | Description |
|------|-------|-------------|
| Calls List | `/calls` | List all calls with filters |
| Call Detail | `/calls/:id` | Call details with transcript and analysis |

### 3.4 Script Management

| Page | Route | Description |
|------|-------|-------------|
| Scripts List | `/scripts` | List all scripts |
| Script Upload | `/scripts/upload` | Upload new script |

### 3.5 Team Management

| Page | Route | Description |
|------|-------|-------------|
| Teams Overview | `/teams` | List all teams |
| Team Detail | `/teams/:id` | Team details and members |
| Team Creation | `/teams/new` | Create new team |
| Invite Members | `/teams/:id/invite` | Invite members |

### 3.6 Settings & Configuration

| Page | Route | Description |
|------|-------|-------------|
| Company Settings | `/settings` | Company configuration |
| Integrations | `/integrations` | Third-party integrations |
| Notifications | `/notifications` | Notification center |

### 3.7 Admin Pages

| Page | Route | Description |
|------|-------|-------------|
| Super Admin | `/admin` | System administration |

---

## 4. Communication Patterns

### 4.1 API Communication

```
Frontend ──HTTP──→ Nginx ──HTTP──→ Main API
```

### 4.2 WebSocket Communication

```
Frontend ──WebSocket──→ Nginx ──WebSocket──→ Main API
```

### 4.3 Data Flow

```
┌─────────────┐
│  Frontend   │
└──────┬──────┘
       │ HTTP Request
       ▼
┌─────────────┐     ┌─────────────┐
│   Nginx     │────→│  Main API   │
└─────────────┘     └──────┬──────┘
                            │
                            ▼
                     ┌─────────────┐
                     │ PostgreSQL  │
                     └─────────────┘
```

---

## 5. API Integration

### 5.1 Authentication

The frontend uses JWT tokens for authentication:

```
Authorization: Bearer <jwt_token>
```

### 5.2 API Client

Axios instance with:
- Base URL from environment
- Request/response interceptors
- Automatic token refresh
- Error handling

### 5.3 Key Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/auth/login` | POST | User login |
| `/api/v1/auth/register` | POST | User registration |
| `/api/v1/auth/refresh` | POST | Token refresh |
| `/api/v1/calls` | GET | List calls |
| `/api/v1/calls/:id` | GET | Call details |
| `/api/v1/calls/:id/transcript` | GET | Get transcript |
| `/api/v1/calls/:id/analysis` | GET | Get analysis |
| `/api/v1/analytics/team-performance` | GET | Team metrics |
| `/api/v1/analytics/leaderboard` | GET | Leaderboard |
| `/api/v1/scripts` | GET/POST | Scripts CRUD |
| `/api/v1/teams` | GET/POST | Teams CRUD |
| `/api/v1/companies/:id/settings` | GET/PUT | Company settings |
| `/api/v1/integrations` | GET/POST | Integrations |
| `/api/v1/notifications` | GET | Notifications |

---

## 6. WebSocket Integration

### 6.1 Connection

```
WebSocket: /api/v1/ws
```

### 6.2 Events Received

- **call_completed**: New call processed
- **transcript_ready**: Transcript available
- **analysis_complete**: Analysis finished
- **notification**: User notification

---

## 7. Internationalization

### 7.1 Supported Languages

| Language | Code |
|----------|------|
| English | en |
| Russian | ru |
| Kazakh | kk |

### 7.2 Translation Files

Located in `src/locales/{code}/`:
- `translation.json`

---

## 8. Configuration

### 8.1 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | API base URL | http://localhost:8080 |
| `VITE_WS_URL` | WebSocket URL | ws://localhost:8080 |

### 8.2 Vite Configuration

```
typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
```

---

## 9. Components

### 9.1 UI Components

- **Button**: Primary, secondary, ghost variants
- **Input**: Text, password, search
- **Card**: Container with header, body
- **Modal**: Dialog component
- **Table**: Data table with sorting
- **Badge**: Status indicators
- **Avatar**: User avatars

### 9.2 Widgets

- **PageLayout**: Main layout with sidebar
- **Sidebar**: Navigation sidebar
- **Header**: Page header with actions

### 9.3 Charts

- **LineChart**: Performance trends
- **BarChart**: Comparison charts
- **PieChart**: Distribution charts

---

## 10. State Management

### 10.1 Auth Context

- User authentication state
- Token management
- Logout functionality

### 10.2 Notification Context

- Unread notification count
- Real-time updates

### 10.3 Local State

- Component-specific state using useState
- Form state management

---

## 11. Styling

### 11.1 Tailwind CSS

Utility-first CSS framework:
- Custom color palette
- Responsive design
- Dark mode support

### 11.2 Design System

- Primary color: Configurable
- Typography: Inter font family
- Spacing: 4px base unit
- Border radius: 4px/8px/12px

---

## 12. Nginx Configuration

### 12.1 Docker Configuration

```
yaml
frontend:
  build: ./services/frontend
  restart: always
  depends_on:
    - main-api
  networks:
    - sale1-network
```

### 12.2 Nginx Routes

```
/
  → Frontend static files

/api/v1/*
  → Main API (8080)
```

---

## 13. Dependencies

### 13.1 Internal Services

| Service | Connection | Purpose |
|---------|------------|---------|
| Main API | HTTP | All data operations |
| Main API | WebSocket | Real-time notifications |

### 13.2 External Libraries

| Library | Purpose |
|---------|---------|
| react | UI framework |
| react-router-dom | Routing |
| axios | HTTP client |
| i18next | Internationalization |
| tailwindcss | Styling |
| recharts | Charts |
| headlessui | UI components |

---

## 14. Build & Deployment

### 14.1 Build Process

```
bash
# Install dependencies
npm install

# Build for production
npm run build

# Output: dist/
```

### 14.2 Docker Build

```
dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## 15. Error Handling

### 15.1 API Errors

- Global error boundary
- Toast notifications for errors
- Retry logic for failed requests

### 15.2 User Feedback

- Loading states
- Success messages
- Error messages with actions

---

## 16. Related Documentation

- [Architecture Overview](../architecture.md)
- [Service Architecture](../service-architecture.md)
- [Main API Documentation](./main-api.md)
- [Deployment Guide](../deployment.md)
