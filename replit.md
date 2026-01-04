# Influencer Analytics

## Overview

A Shopify embedded application for tracking influencer marketing ROI through a hybrid UTM link and promo code attribution system. The platform centralizes influencer partnership management, enabling merchants to measure real returns on influencer campaigns with automatic margin, commission, and profit calculations.

The application follows a three-pillar approach:
1. **Visual Experience** - Instant influencer identification through profile avatars
2. **Reliable Tracking** - Dual attribution via UTM links and promo codes
3. **ROI Focus** - Automated financial calculations for margins, commissions, and net profit

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom theme supporting light/dark modes
- **Forms**: React Hook Form with Zod validation
- **Design System**: Follows Shopify Polaris guidelines for embedded app consistency

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **API Pattern**: RESTful endpoints under `/api/*` prefix
- **Build Tool**: Vite for frontend, esbuild for server bundling

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Migrations**: Drizzle Kit with output to `./migrations`
- **Validation**: Drizzle-Zod for generating Zod schemas from database tables

### Core Data Models
- **Influencers**: CRM profiles with avatars, ratings, notes, and linked social accounts
- **Social Accounts**: Platform-specific handles (Instagram, TikTok, Snapchat) with follower counts
- **Campaigns**: Marketing operations linking influencers to tracking configurations (UTM slugs, promo codes, costs, commissions)
- **Events**: Tracking data for clicks, cart additions, and purchases with revenue attribution

### Project Structure
```
├── client/src/          # React frontend
│   ├── components/      # UI components (shadcn + custom)
│   ├── pages/           # Route pages (dashboard, influencers, campaigns)
│   ├── hooks/           # Custom React hooks
│   └── lib/             # Utilities and query client
├── server/              # Express backend
│   ├── routes.ts        # API endpoint definitions
│   ├── storage.ts       # Database operations layer
│   └── db.ts            # Database connection
├── shared/              # Shared code between client/server
│   └── schema.ts        # Drizzle database schema
└── migrations/          # Database migrations
```

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connection via `DATABASE_URL` environment variable
- **connect-pg-simple**: Session storage in PostgreSQL

### UI Libraries
- **Radix UI**: Accessible component primitives (dialog, dropdown, tabs, etc.)
- **Lucide React**: Icon library
- **React Icons**: Additional social platform icons
- **Embla Carousel**: Carousel functionality
- **React Day Picker**: Calendar/date picker
- **Vaul**: Drawer component
- **cmdk**: Command palette

### Development Tools
- **Vite**: Frontend development server and bundler
- **Replit plugins**: Dev banner, cartographer, runtime error overlay
- **TSX**: TypeScript execution for development

### Form & Validation
- **React Hook Form**: Form state management
- **Zod**: Schema validation
- **@hookform/resolvers**: Zod integration with React Hook Form