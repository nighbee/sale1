# SalesAI Frontend

A modern React-based web application for SalesAI, providing dashboards, call analytics, and team management interfaces.

## Technology Stack

- **Framework**: [React 18](https://reactjs.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [Radix UI](https://www.radix-ui.com/) / [Lucide Icons](https://lucide.dev/)
- **State Management**: [Zustand](https://docs.pmnd.rs/zustand/)
- **Data Fetching**: Axios with custom hooks

## Architecture: Feature-Sliced Design (FSD)

The project follows the [Feature-Sliced Design](https://feature-sliced.design/) methodology to ensure scalability and explicit dependencies.

### Layers

- **`app/`**: Application-wide initialization (providers, global styles, routing setup).
- **`pages/`**: Full-page components composed of widgets and features.
- **`widgets/`**: Complex UI blocks (e.g., `Leaderboard`, `CallAnalysis`, `SheetCalls`) that combine features and entities.
- **`features/`**: User-facing actions with business value (e.g., `Auth`, `Integrations`, `TeamManagement`).
- **`entities/`**: Business entities (e.g., `Call`, `User`, `Analytics`) and their internal logic (Zustand stores, API calls).
- **`shared/`**: Reusable infrastructure (UI kit, API clients, utility functions, hooks).

## Key Widgets

1. **CallTranscript**: Synchronized transcript viewer with speaker highlights.
2. **CallAnalysis**: Visualization of AI metrics, summaries, and next steps.
3. **Leaderboard**: Team performance rankings with interactive filters.
4. **SheetCalls**: Comprehensive list of calls with Google Sheets integration specific logic.

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Environment Variables

- `VITE_API_URL`: The base URL for the Main API Service.
- `VITE_WS_URL`: The WebSocket endpoint for real-time updates.
