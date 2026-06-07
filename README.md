# Students Research Lab — Admin Portal

The admin-facing management interface for the Students Research Lab. Built with React 18, TypeScript, Vite, and shadcn/ui. Connects to the SRL backend API for all data operations.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Architecture](#architecture)
- [Environment Variables](#environment-variables)
- [Installation & Setup](#installation--setup)
- [Development Workflow](#development-workflow)
- [Build & Deployment](#build--deployment)
- [Authentication & Roles](#authentication--roles)
- [Troubleshooting](#troubleshooting)

---

## Project Overview

The Admin Portal is a role-gated single-page application used by lab administrators and members to manage all SRL content. Admins have full CRUD access across every module; regular members can edit only their own CV and view scores and attendance.

**Live URL:** https://admin-srl.mmpsrpc.in

**Backend API:** https://api-srl.mmpsrpc.in

---

## Features

### Admin Features
- **Dashboard** — Lab statistics, quick stats cards, overview charts
- **Students** — Manage student profiles, enrollment details, and member status
- **Member CV** — Edit researcher CVs: research areas, papers, certifications, patents, hackathons
- **Activities** — Create and manage lab activity posts with Cloudinary image upload
- **Achievements** — Manage achievement entries with media
- **SRL Sessions** — Session management with XLSX bulk upload support
- **Publications** — Full publication lifecycle: create, edit, approve/reject, manage symbols
- **Timeline** — Manage the lab timeline displayed on the public website
- **Scores** — Student score management with batch and session breakdown
- **Attendance** — Attendance tracking with hour logging
- **Join Requests** — Review and approve/reject membership applications
- **Leaderboard / Analytics** — Performance analytics across batches

### Member Features
- **Member CV** — Edit own researcher profile, research papers, certifications, patents
- **Scores** — View own score history (read-only)
- **Attendance** — View own attendance records (read-only)

### Platform Features
- JWT authentication with role-based route guards
- OTP-based password reset flow
- Real-time updates via Server-Sent Events
- Client-side PDF → WebP conversion before upload (pdfjs-dist + canvas)
- All image uploads converted to WebP (browser canvas re-encode)
- Drag-and-drop certificate upload with live preview
- Animated show-more/less for long lists (research papers, certifications)
- Responsive layout with mobile support

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 |
| Language | TypeScript 5 |
| Build tool | Vite 5 (SWC plugin) |
| Routing | React Router DOM v6 |
| Styling | Tailwind CSS v3 |
| Component library | shadcn/ui (Radix UI primitives) |
| Animations | Framer Motion v12 |
| Forms | React Hook Form + Zod |
| Data fetching | TanStack React Query v5 |
| Charts | Recharts |
| PDF processing | pdfjs-dist v5 (browser-side, canvas render) |
| PDF export | jsPDF + jspdf-autotable |
| Icons | Lucide React |
| XLSX parsing | xlsx |
| Node requirement | ≥ 18.0.0 |

---

## Repository Structure

```
students-research-lab-admin-portal/
├── public/                         # Static assets
├── src/
│   ├── App.tsx                     # Root component, routing, auth guards
│   ├── main.tsx                    # React DOM entry point
│   ├── index.css                   # Global styles
│   ├── pages/
│   │   ├── Login.tsx               # Authentication page
│   │   ├── ForgotPassword.tsx      # OTP request page
│   │   ├── VerifyOtp.tsx           # OTP verification page
│   │   ├── ResetPassword.tsx       # Password reset page
│   │   ├── Dashboard.tsx           # Overview dashboard
│   │   ├── Students.tsx            # Student management
│   │   ├── MemberCV.tsx            # Researcher CV editor
│   │   ├── Activities.tsx          # Activity management
│   │   ├── Achievements.tsx        # Achievement management
│   │   ├── SRLSessions.tsx         # Session management
│   │   ├── Publications.tsx        # Publication management
│   │   ├── Timeline.tsx            # Timeline management
│   │   ├── Scores.tsx              # Score management
│   │   ├── Attendance.tsx          # Attendance tracking
│   │   ├── JoinRequests.tsx        # Membership application review
│   │   ├── Leadership.tsx          # Leadership management
│   │   ├── GoogleSheetData.tsx     # Google Sheets data viewer
│   │   └── NotFound.tsx            # 404 page
│   ├── components/
│   │   ├── AdminLayout.tsx         # Sidebar + header shell
│   │   ├── ProtectedRoute.tsx      # JWT auth guard
│   │   ├── CertificateUpload.tsx   # Multi-cert upload with drag-and-drop
│   │   ├── ImageUpload.tsx         # Single image upload component
│   │   ├── StudentAvatar.tsx       # Avatar with fallback initials
│   │   ├── BatchTabs.tsx           # Batch filter tabs
│   │   ├── StatCard.tsx            # Dashboard stat card
│   │   ├── ConfirmProvider.tsx     # Global confirmation dialog context
│   │   ├── NavLink.tsx             # Sidebar navigation link
│   │   ├── ScrollToTopButton.tsx   # Scroll-to-top utility
│   │   └── ui/                     # 55+ shadcn/ui components
│   ├── lib/
│   │   ├── adminApi.ts             # Typed API client (all CRUD operations)
│   │   ├── auth.ts                 # Login, token storage, getStoredUser
│   │   ├── certificateUpload.ts    # PDF→WebP + image→WebP conversion
│   │   ├── utils.ts                # cn() and general utilities
│   │   ├── fetchAllSections.ts
│   │   ├── fetchAllStudents.ts
│   │   └── fetchAllTablesData.ts
│   ├── hooks/
│   │   ├── use-mobile.tsx          # Mobile breakpoint detection
│   │   ├── use-toast.ts            # Toast notification hook
│   │   ├── useGoogleSheet.ts       # Google Sheets integration
│   │   └── useServerEvents.ts      # SSE subscription hook
│   ├── config/
│   │   └── apiConfig.ts            # API base URL + auth headers
│   └── styles/
│       └── scrollbar.css
├── components.json                 # shadcn/ui configuration
├── vite.config.ts                  # Vite + proxy config
├── tailwind.config.ts              # Tailwind theme + custom colors
├── tsconfig.json                   # TypeScript config
├── vercel.json                     # Vercel SPA routing
├── Dockerfile
├── nginx.conf
└── package.json
```

---

## Architecture

```
Browser (React 18 SPA)
  │
  ├── React Router v6 — client-side routing
  ├── ProtectedRoute — checks JWT in localStorage, redirects if expired
  ├── AdminLayout — sidebar navigation, header
  │
  ├── Pages → lib/adminApi.ts → fetch() → /api/*
  │                                         │
  │                                   Express Backend API
  │                                   (JWT Bearer required for admin routes)
  │
  └── useServerEvents (SSE) → /api/events
        └── triggers refetch on student_changed events
```

### Client-side Image Pipeline

Before any file reaches the backend, the browser converts it to WebP:

```
User selects file (PDF / JPEG / PNG / AVIF / BMP / TIFF / GIF)
  │
  └── processCertificateFile(file)   [lib/certificateUpload.ts]
        ├── PDF  → pdfjs renders page 1 to canvas → canvas.toBlob("image/webp", 0.92)
        └── image → draw to canvas → canvas.toBlob("image/webp", 0.92)
              │
              └── new File([blob], "name.webp", { type: "image/webp" })
                    │
                    └── POST /api/admin/upload-certificate (FormData)
                          │
                          └── Cloudinary stores as WebP
```

The backend also converts images server-side via Cloudinary's `format: "webp"` option, so WebP is guaranteed regardless of the upload path used.

### Route Map

| Path | Page | Access |
|---|---|---|
| `/login` | Login | Unauthenticated only |
| `/forgot-password` | ForgotPassword | Unauthenticated only |
| `/verify-otp` | VerifyOtp | Unauthenticated only |
| `/reset-password` | ResetPassword | Unauthenticated only |
| `/` | Dashboard | Admin + Member |
| `/member-cv` | MemberCV | Admin (all) + Member (own) |
| `/scores` | Scores | Admin (full) + Member (read-only) |
| `/attendance` | Attendance | Admin (full) + Member (read-only) |
| `/students` | Students | Admin only |
| `/publications` | Publications | Admin only |
| `/activities` | Activities | Admin only |
| `/achievements` | Achievements | Admin only |
| `/timeline` | Timeline | Admin only |
| `/sessions` | SRLSessions | Admin only |
| `/join-requests` | JoinRequests | Admin only |
| `*` | NotFound | — |

---

## Environment Variables

### `frontend/.env` (admin portal)

```env
# Backend API base URL
# In development, leave empty — Vite proxies /api/* → http://127.0.0.1:8000
VITE_BACKEND_URL=https://api-srl.mmpsrpc.in

# Set to "true" to skip the Vite proxy and hit the backend URL directly in dev
VITE_USE_DIRECT_API=false
```

No secrets are stored in the frontend. The JWT token is stored in `localStorage` after login and sent as `Authorization: Bearer <token>` on every admin API call.

---

## Installation & Setup

### Prerequisites
- Node.js ≥ 18.0.0
- npm ≥ 9
- The SRL backend running locally or accessible at a URL

### 1. Clone the repository

```bash
git clone <repo-url>
cd students-research-lab-admin-portal
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env:
#   Development: leave VITE_BACKEND_URL empty (Vite proxy handles it)
#   Production:  set VITE_BACKEND_URL=https://api-srl.mmpsrpc.in
```

---

## Development Workflow

```bash
# Start the admin portal dev server
npm run dev
# → http://localhost:5173
# /api/* requests are proxied to http://127.0.0.1:8000 automatically
```

The backend must be running on port 8000 for API calls to work. See the [main website repository](../StudentsResearchLab) for backend setup.

```bash
# Lint
npm run lint

# Run tests
npm run test

# Watch mode tests
npm run test:watch
```

---

## Build & Deployment

### Vercel

`vercel.json` configures a catch-all rewrite so React Router handles all client-side navigation.

```bash
npm run build       # outputs to dist/
```

Required Vercel environment variable:
```
VITE_BACKEND_URL = https://api-srl.mmpsrpc.in
```

### Docker

```bash
docker build -t srl-admin-portal .
docker run -p 5173:80 srl-admin-portal
# → http://localhost:5173
```

With Docker Compose:
```bash
docker compose up --build
```

---

## Authentication & Roles

Authentication uses JWT tokens issued by the backend. The token is stored in `localStorage` and validated on every page load by `ProtectedRoute`.

### Login flow
1. `POST /api/admin/login` with `{ email, password }`
2. Backend returns `{ token, user: { email, role, enrollmentNo } }`
3. Token and user stored via `lib/auth.ts → storeUser()`
4. All subsequent API calls include `Authorization: Bearer <token>`

### Password reset flow
1. `POST /api/auth/forgot-password` — sends a 6-digit OTP to the user's email
2. `POST /api/auth/verify-otp` — validates the OTP
3. `POST /api/auth/reset-password` — sets a new password (OTP consumed)

### Role capabilities

| Capability | Admin | Member |
|---|---|---|
| View dashboard | ✅ | ✅ |
| Edit own CV | ✅ | ✅ |
| Edit all CVs | ✅ | ✗ |
| Manage students | ✅ | ✗ |
| Manage activities | ✅ | ✗ |
| Manage publications | ✅ | ✗ |
| Manage sessions | ✅ | ✗ |
| Manage timeline | ✅ | ✗ |
| View scores | ✅ | ✅ (own only) |
| Edit scores | ✅ | ✗ |
| View attendance | ✅ | ✅ (own only) |
| Edit attendance | ✅ | ✗ |
| Review join requests | ✅ | ✗ |

---

## Troubleshooting

**Blank page after login / "Unauthorized" errors**
The JWT token may be expired. Clear `localStorage` and log in again. Tokens expire based on the `JWT_SECRET` configuration in the backend.

**API calls return 404**
Verify `VITE_BACKEND_URL` is set correctly, or that the Vite proxy is active (do not set `VITE_USE_DIRECT_API=true` in development unless intentional).

**PDF upload shows no preview**
`pdfjs-dist` requires a worker file. The worker is loaded dynamically from the npm package using `import.meta.url`. Ensure the build is served from a path that can resolve the worker URL — this works out of the box with the Vite config.

**Image upload converts to WebP but file is large**
The browser canvas re-encodes at quality `0.92`. Very large source images (e.g. 4K scans) will produce large WebP files. The backend applies additional Cloudinary optimisation (`quality: "auto:best"`) at storage time. Consider advising users to resize images before uploading.

**`npm run build` TypeScript errors**
The project uses `noImplicitAny: false` and `strictNullChecks: false`. Genuine type errors will still fail the build. Run `npm run lint` first to catch obvious issues.

**SSE events not received**
In development the Vite proxy rewrites SSE requests to the backend. If `VITE_USE_DIRECT_API=true` is set, SSE may fail due to CORS. Remove that flag or ensure the backend CORS allowlist includes your origin.
