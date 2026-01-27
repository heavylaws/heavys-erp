# AI Assistant Guide for Heavy's ERP

This document helps AI-powered IDEs (Cursor, GitHub Copilot, Claude, etc.) understand the architecture and conventions of this Hardware Store ERP system.

## Project Overview

**Heavy's ERP** is a full-stack Point of Sale (POS) and Enterprise Resource Planning system designed for hardware stores. It was originally built for a cafe but has been adapted for hardware retail.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite |
| UI Components | shadcn/ui (Radix primitives) + Tailwind CSS |
| State/Data | TanStack Query (React Query) |
| Routing | Wouter (lightweight React router) |
| Backend | Express.js + TypeScript |
| Database | PostgreSQL with Drizzle ORM |
| Real-time | WebSocket on `/ws/app` path |
| Desktop | Electron (optional wrapper) |

## Project Structure

```
heavys-erp/
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Route pages (admin, cashier, manager, etc.)
│   │   ├── hooks/           # Custom React hooks (useAuth, useWebSocket)
│   │   └── lib/             # Utilities (queryClient, currency-utils)
├── server/                  # Express backend
│   ├── routes.ts            # Main API routes (monolithic, being modularized)
│   ├── routes/v1/           # Modular API routes (newer pattern)
│   ├── services/            # Business logic services
│   ├── storage.ts           # Database operations (Drizzle)
│   └── index.ts             # Server entry point
├── shared/                  # Shared between client/server
│   ├── schema.ts            # Drizzle schema + Zod validation
│   └── currency-utils.ts    # Currency formatting helpers
├── electron/                # Electron desktop app wrapper
└── scripts/                 # Utility scripts
```

## Key Conventions

### API Pattern
- REST APIs at `/api/*`
- Authenticated routes check `req.session.user`
- Response format: JSON with proper HTTP status codes
- Use `apiRequest()` from `queryClient.ts` for frontend fetches

### Database (Drizzle ORM)
- Schema defined in `shared/schema.ts`
- Types exported: `Product`, `InsertProduct`, etc.
- Use `db.select().from(table)` pattern
- Migrations: `npx drizzle-kit push` (auto-sync schema)

### Forms
- Use `react-hook-form` with `zodResolver`
- Import schemas from `@shared/schema`
- Handle number inputs carefully (convert strings to numbers)

### State Management
- TanStack Query for server state
- Query keys follow URL pattern: `['/api/products']`
- Invalidate queries after mutations: `queryClient.invalidateQueries()`

### Real-time Updates
- WebSocket connection at `/ws/app` (not `/ws` to avoid Vite HMR conflicts)
- Use `useWebSocket` hook to subscribe to events
- Admin/Manager get WebSocket updates; Cashier uses polling

## User Roles

| Role | Dashboard | Capabilities |
|------|-----------|--------------|
| admin | `/admin` | Full system access, settings, users |
| manager | `/manager` | Reports, inventory, orders |
| cashier | `/cashier` | POS terminal, order creation |
| technician | `/technician` | Order fulfillment queue |

## Common Tasks

### Add a New API Endpoint
1. Add route in `server/routes.ts` or create in `server/routes/v1/`
2. Add business logic in appropriate service file
3. Add frontend query/mutation using TanStack Query

### Add a New Page
1. Create file in `client/src/pages/`
2. Add lazy import in `client/src/App.tsx`
3. Add `<Route>` in the Router component

### Add a Database Field
1. Add column in `shared/schema.ts` table definition
2. Run `PGPASSWORD=... psql -c "ALTER TABLE ... ADD COLUMN ..."`
3. Or use `npx drizzle-kit push` (may have warnings)

### Customize Login Page
Settings are in `company_settings` table:
- `name` - Company name
- `logo_url` - Logo image (base64 or URL)
- `login_subtitle` - Text below company name
- `show_demo_credentials` - Toggle demo login hint

## Development Commands

```bash
# Start dev server (Vite + Express)
npm run dev

# Database operations
npx drizzle-kit push          # Sync schema to DB
npx drizzle-kit studio        # Visual DB browser

# Build for production
npm run build
npm start
```

## Environment Variables

Required in `.env`:
```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SESSION_SECRET=your-secret-key
PORT=5003
```

## Troubleshooting

### "Expected number, received string"
Number inputs return strings. Convert in onChange:
```tsx
onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
```

### WebSocket not connecting in dev
WebSocket uses `/ws/app` path to avoid Vite HMR conflict on `/ws`.

### Blank page after changes
Check browser console for errors. Hard refresh (Ctrl+Shift+R) to clear cache.

## Architecture Decisions

1. **Monolithic routes.ts** - Being gradually modularized into `routes/v1/`
2. **Drizzle ORM** - Chosen for type safety and PostgreSQL support
3. **shadcn/ui** - Copy-paste components for full customization
4. **Wouter over React Router** - Simpler, smaller bundle
5. **Base64 logo storage** - Avoids file upload complexity
