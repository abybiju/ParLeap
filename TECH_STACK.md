# ParLeap Technology Stack

This document explains every technology, tool, and library used in ParLeap and the reasoning behind each choice.

---

## Frontend Technologies

### Next.js 14.2.35 (App Router)

**What it is:** React framework for production with server-side rendering, static site generation, and API routes.

**Why we use it:**
- **App Router**: Modern routing system with better performance and developer experience
- **Server Components**: Reduces client-side JavaScript bundle size
- **Built-in Optimizations**: Image optimization, code splitting, and automatic static optimization
- **API Routes**: Can handle server-side logic without separate backend (though we use dedicated backend for WebSocket)
- **TypeScript Support**: First-class TypeScript support with excellent type inference
- **Vercel Integration**: Seamless deployment on Vercel platform

**Alternatives considered:** Remix, SvelteKit, Astro
**Decision factor:** Next.js has the best ecosystem, largest community, and proven production performance for React applications.

---

### React 18.3.1

**What it is:** JavaScript library for building user interfaces.

**Why we use it:**
- **Component-based Architecture**: Perfect for building reusable UI components
- **Hooks API**: Clean state management and side effects
- **Virtual DOM**: Efficient rendering and updates
- **Large Ecosystem**: Massive library ecosystem and community support
- **Concurrent Features**: React 18+ provides better performance with concurrent rendering
- **Server Components**: Works seamlessly with Next.js App Router

**Alternatives considered:** Vue.js, Svelte, Angular
**Decision factor:** React is the industry standard, has the largest ecosystem, and integrates perfectly with Next.js.

---

### TypeScript (Strict Mode)

**What it is:** Typed superset of JavaScript that compiles to plain JavaScript.

**Why we use it:**
- **Type Safety**: Catches errors at compile-time, not runtime
- **Better IDE Support**: Autocomplete, refactoring, and navigation
- **Self-Documenting Code**: Types serve as inline documentation
- **Refactoring Confidence**: Safe to refactor large codebases
- **Strict Mode**: Maximum type safety - no `any` types allowed
- **Team Collaboration**: Makes code easier to understand and maintain

**Alternatives considered:** JavaScript with JSDoc, Flow
**Decision factor:** TypeScript is the industry standard for large-scale JavaScript projects and provides the best developer experience.

---

### Tailwind CSS

**What it is:** Utility-first CSS framework.

**Why we use it:**
- **Rapid Development**: Write styles directly in JSX without switching files
- **Consistency**: Design system enforced through utility classes
- **Performance**: Only includes CSS you actually use (purging unused styles)
- **Responsive Design**: Built-in responsive utilities
- **Dark Mode**: First-class dark mode support
- **Customization**: Highly configurable through `tailwind.config.ts`

**Alternatives considered:** CSS Modules, Styled Components, Emotion
**Decision factor:** Tailwind provides the fastest development speed while maintaining consistency and performance.

---

### Shadcn/UI

**What it is:** Collection of re-usable components built with Radix UI and Tailwind CSS.

**Why we use it:**
- **Copy-Paste Components**: Not a dependency, you own the code
- **Accessible**: Built on Radix UI primitives (WCAG compliant)
- **Customizable**: Easy to modify since it's your code
- **TypeScript**: Fully typed components
- **Tailwind Integration**: Uses Tailwind for styling (consistent with our stack)
- **Modern Design**: Beautiful, modern component designs

**Alternatives considered:** Material-UI, Chakra UI, Ant Design
**Decision factor:** Shadcn/UI gives us full control over components while providing accessibility and modern design out of the box.

---

### Zustand

**What it is:** Small, fast, and scalable state management solution.

**Why we use it:**
- **Lightweight**: ~1KB bundle size (vs Redux's ~10KB)
- **Simple API**: No boilerplate, easy to learn
- **TypeScript Support**: Excellent TypeScript inference
- **No Providers**: No need to wrap app in providers
- **Performance**: Only re-renders components that use changed state
- **DevTools**: Optional Redux DevTools integration

**Alternatives considered:** Redux Toolkit, Jotai, Recoil, Context API
**Decision factor:** Zustand provides the perfect balance of simplicity and power for our state management needs without the complexity of Redux.

---

### Lucide React

**What it is:** Beautiful, consistent icon library.

**Why we use it:**
- **Consistent Design**: All icons follow the same design language
- **Tree-Shakable**: Only imports icons you use
- **TypeScript**: Fully typed
- **Customizable**: Easy to customize size, color, stroke width
- **Large Collection**: 1000+ icons
- **Lightweight**: Optimized SVG icons

**Alternatives considered:** React Icons, Heroicons, Feather Icons
**Decision factor:** Lucide provides the best balance of icon count, consistency, and bundle size.

---

## Backend Technologies

### Node.js

**What it is:** JavaScript runtime built on Chrome's V8 engine.

**Why we use it:**
- **JavaScript Everywhere**: Same language for frontend and backend
- **Performance**: V8 engine is highly optimized
- **Event-Driven**: Perfect for real-time applications (WebSockets)
- **Large Ecosystem**: npm has the largest package ecosystem
- **Non-Blocking I/O**: Handles concurrent connections efficiently
- **Mature**: Battle-tested in production for over a decade

**Alternatives considered:** Deno, Bun, Python (FastAPI), Go
**Decision factor:** Node.js allows code sharing between frontend/backend and has the best WebSocket support in JavaScript ecosystem.

---

### Express.js

**What it is:** Minimal and flexible Node.js web application framework.

**Why we use it:**
- **Minimal**: Lightweight, doesn't impose structure
- **Middleware**: Powerful middleware system
- **Mature**: Most popular Node.js framework, battle-tested
- **Flexible**: Can structure code however you want
- **Performance**: Fast and efficient
- **Large Ecosystem**: Massive middleware ecosystem

**Alternatives considered:** Fastify, Koa, NestJS, Hapi
**Decision factor:** Express is the most mature, widely-used, and flexible framework. Perfect for our custom WebSocket implementation.

---

### WebSocket (ws library)

**What it is:** Lightweight WebSocket library for Node.js.

**Why we use it:**
- **Lightweight**: Minimal overhead, fast
- **Standard Compliant**: Implements WebSocket protocol correctly
- **No Dependencies**: Few dependencies, reliable
- **Event-Driven**: Works perfectly with Node.js event loop
- **Production Ready**: Used by major companies
- **TypeScript Support**: Full TypeScript definitions

**Alternatives considered:** Socket.io, uWebSockets.js, SockJS
**Decision factor:** We need raw WebSocket protocol (not Socket.io's abstraction) for our custom message protocol. `ws` is the industry standard for raw WebSockets in Node.js.

**Why NOT Socket.io:**
- Socket.io adds protocol overhead we don't need
- We want full control over message format
- Our protocol is simpler and more efficient

---

### Zod

**What it is:** TypeScript-first schema validation library.

**Why we use it:**
- **TypeScript Integration**: Generates TypeScript types from schemas
- **Runtime Validation**: Validates data at runtime (critical for WebSocket messages)
- **Type Inference**: Automatically infers types from schemas
- **Error Messages**: Clear, helpful error messages
- **Composable**: Schemas can be composed and reused
- **Small Bundle**: ~12KB minified

**Alternatives considered:** Yup, Joi, class-validator
**Decision factor:** Zod provides the best TypeScript integration and type inference, making it perfect for validating WebSocket messages.

---

### string-similarity

**What it is:** Library for fuzzy string matching using Levenshtein distance.

**Why we use it:**
- **Fuzzy Matching**: Finds similar strings even with typos/variations
- **Simple API**: Easy to use
- **Performance**: Fast enough for our use case (<500ms requirement)
- **Accuracy**: Provides similarity scores (0-1) for matching confidence
- **Lightweight**: Small bundle size

**Alternatives considered:** fast-levenshtein, fuse.js, fuzzy-search
**Decision factor:** string-similarity provides the perfect balance of simplicity and performance for matching transcribed text to song lyrics.

---

### CORS (cors middleware)

**What it is:** Express middleware for enabling Cross-Origin Resource Sharing.

**Why we use it:**
- **Security**: Controls which origins can access the API
- **Required**: Frontend (Vercel) and backend (Railway) are on different domains
- **Configurable**: Can set specific origins, credentials, headers
- **Standard**: Implements CORS specification correctly

**Why we need it:** Our frontend is deployed on Vercel (`par-leap.vercel.app`) and backend on Railway (`parleapbackend-production.up.railway.app`). CORS is required for cross-origin requests.

---

## Database & Backend Services

### Supabase

**What it is:** Open-source Firebase alternative with PostgreSQL database, authentication, and real-time subscriptions.

**Why we use it:**
- **PostgreSQL**: Powerful relational database (vs Firebase's NoSQL)
- **Row Level Security (RLS)**: Database-level security policies
- **Authentication**: Built-in auth with email/password, OAuth, etc.
- **Real-time**: Real-time subscriptions (though we use WebSocket for our use case)
- **Open Source**: Can self-host if needed
- **TypeScript**: Generates TypeScript types from database schema
- **Free Tier**: Generous free tier for development

**Alternatives considered:** Firebase, PlanetScale, MongoDB Atlas, AWS RDS
**Decision factor:** Supabase provides PostgreSQL (better for relational data) with built-in auth and RLS, perfect for our SaaS needs.

---

### PostgreSQL (via Supabase)

**What it is:** Advanced open-source relational database.

**Why we use it:**
- **Relational Data**: Perfect for our data model (users, songs, events, setlists)
- **ACID Compliance**: Data integrity guarantees
- **JSON Support**: Can store JSON when needed
- **Performance**: Excellent performance for our use case
- **Mature**: Battle-tested for decades
- **RLS**: Row Level Security for multi-tenant data

**Why not NoSQL:** Our data is relational (users have songs, events have setlists). PostgreSQL's relational model fits perfectly.

---

## Infrastructure & Deployment

### Vercel

**What it is:** Platform for frontend frameworks and static sites.

**Why we use it:**
- **Next.js Optimized**: Built by Next.js creators, perfect integration
- **Automatic Deployments**: Deploys on every git push
- **Edge Network**: Global CDN for fast loading
- **Preview Deployments**: Automatic preview URLs for PRs
- **Environment Variables**: Easy secret management
- **Free Tier**: Generous free tier for personal projects
- **Zero Config**: Works out of the box with Next.js

**Alternatives considered:** Netlify, AWS Amplify, Cloudflare Pages
**Decision factor:** Vercel is the best platform for Next.js applications with the smoothest developer experience.

---

### Railway

**What it is:** Platform for deploying backend services and databases.

**Why we use it:**
- **Simple Deployment**: Deploy from GitHub, zero config
- **Auto-Deploy**: Automatically deploys on git push
- **Environment Variables**: Easy secret management
- **Logs**: Built-in logging and monitoring
- **Scaling**: Easy to scale up/down
- **WebSocket Support**: Native WebSocket support
- **Free Tier**: $5 free credit monthly

**Alternatives considered:** Heroku, Render, Fly.io, AWS ECS
**Decision factor:** Railway provides the simplest deployment experience for Node.js backends with excellent WebSocket support.

---

### GitHub

**What it is:** Code hosting platform for version control and collaboration.

**Why we use it:**
- **Version Control**: Git-based version control
- **CI/CD Integration**: Integrates with Vercel and Railway
- **Collaboration**: Easy team collaboration
- **Issues & PRs**: Built-in project management
- **Free**: Free for public repositories
- **Industry Standard**: Most widely used platform

**Alternatives considered:** GitLab, Bitbucket
**Decision factor:** GitHub is the industry standard and integrates seamlessly with our deployment platforms.

---

## Development Tools

### TypeScript

**What it is:** Typed superset of JavaScript.

**Why we use it:**
- **Type Safety**: Catches errors before runtime
- **Better DX**: Autocomplete, refactoring, navigation
- **Documentation**: Types serve as documentation
- **Refactoring**: Safe refactoring of large codebases
- **Strict Mode**: Maximum type safety

**Used in:** Both frontend and backend for full-stack type safety.

---

### ESLint

**What it is:** JavaScript/TypeScript linter.

**Why we use it:**
- **Code Quality**: Catches bugs and enforces best practices
- **Consistency**: Enforces consistent code style
- **Next.js Integration**: `eslint-config-next` provides Next.js-specific rules
- **TypeScript Support**: Works with TypeScript

**Configuration:** Uses `eslint-config-next` for Next.js best practices.

---

### npm Workspaces

**What it is:** Monorepo management built into npm.

**Why we use it:**
- **Monorepo**: Single repository for frontend and backend
- **Shared Dependencies**: Can share dependencies between workspaces
- **Simple**: Built into npm, no extra tools needed
- **Scripts**: Can run scripts across workspaces

**Alternatives considered:** Yarn Workspaces, pnpm, Turborepo, Nx
**Decision factor:** npm workspaces is simple and built-in. We don't need the complexity of Turborepo/Nx for our two-workspace monorepo.

---

## Future Technologies (Planned)

### Google Cloud Speech-to-Text OR ElevenLabs Scribe

**What it is:** Speech-to-text API services for real-time transcription.

**Why we'll use one:**
- **Real-time Streaming**: Both support streaming audio for low latency
- **Accuracy**: High accuracy for speech recognition
- **API Integration**: Easy to integrate via REST/WebSocket APIs

**Decision pending:** Will evaluate both based on:
- Latency (<500ms requirement)
- Accuracy for music/lyrics
- Cost
- Ease of integration

---

## Architecture Decisions

### Monorepo Structure

**Why:** Single repository for frontend and backend allows:
- Shared TypeScript types
- Easier code sharing
- Single source of truth
- Simplified dependency management

### Hybrid Backend Architecture

**Why:** We use Supabase for standard SaaS operations (auth, database) and a dedicated Node.js server for real-time audio processing:
- **Supabase**: Perfect for CRUD operations, auth, database
- **Node.js Server**: Needed for custom WebSocket protocol and audio processing
- **Separation of Concerns**: Each service does what it's best at

### WebSocket Protocol (Custom)

**Why:** Custom protocol instead of Socket.io:
- **Control**: Full control over message format
- **Efficiency**: No protocol overhead
- **Type Safety**: TypeScript types for all messages
- **Simplicity**: Simpler protocol for our specific use case

---

## Performance Considerations

### Latency Goal: <500ms End-to-End

**How we achieve it:**
- **WebSocket**: Real-time bidirectional communication (no HTTP overhead)
- **Streaming**: Process audio chunks as they arrive (not batch processing)
- **In-Memory Caching**: Cache setlist in Node.js memory (no DB queries during session)
- **Optimized Matching**: Fast fuzzy matching algorithm
- **Edge Deployment**: Vercel edge network for fast frontend delivery

### Bundle Size Optimization

**How we optimize:**
- **Tree Shaking**: Only import what we use
- **Code Splitting**: Next.js automatic code splitting
- **Server Components**: Reduce client-side JavaScript
- **Image Optimization**: Next.js automatic image optimization

---

## Security Considerations

### Row Level Security (RLS)

**Why:** Supabase RLS ensures users can only access their own data at the database level, not just application level.

### Environment Variables

**Why:** All secrets stored in environment variables, never committed to git:
- API keys
- Database credentials
- Service URLs

### CORS Configuration

**Why:** Restricts API access to only our Vercel frontend domain, preventing unauthorized access.

### TypeScript Strict Mode

**Why:** Catches type errors that could lead to runtime bugs or security issues.

---

## Summary

ParLeap uses a modern, type-safe, and performant tech stack:

- **Frontend**: Next.js + React + TypeScript for fast, type-safe UI
- **Backend**: Node.js + Express for real-time WebSocket processing
- **Database**: PostgreSQL via Supabase for relational data with RLS
- **Deployment**: Vercel (frontend) + Railway (backend) for zero-config deployments
- **State**: Zustand for simple, performant state management
- **Styling**: Tailwind CSS + Shadcn/UI for rapid, consistent UI development

Every technology was chosen for a specific reason: performance, developer experience, type safety, or production readiness. The stack is optimized for our <500ms latency requirement and real-time audio processing needs.

