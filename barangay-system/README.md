# Barangay Document Issuance System

A full-stack web application for digitalizing barangay document requests with real-time status tracking.

## Tech Stack

- **Backend:** Node.js + Express
- **Database/Auth:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage
- **Real-time:** Supabase Realtime (WebSocket)
- **Frontend:** Vanilla HTML/CSS/JS + Tailwind CSS
- **Email:** Nodemailer (Gmail SMTP)

## Project Structure

```
barangay-system/
├── database/
│   └── schema.sql              # Complete PostgreSQL schema
├── backend/
│   ├── index.js                # Express server entry point
│   ├── package.json
│   ├── .env.example
│   ├── config/
│   │   └── supabase.js         # Supabase client setup
│   ├── middleware/
│   │   ├── auth.js             # JWT verification
│   │   ├── roleGuard.js        # Role-based access control
│   │   ├── validate.js         # Joi request validation
│   │   └── errorHandler.js     # Global error handler
│   ├── routes/
│   │   ├── auth.routes.js      # Register, login, profile
│   │   ├── request.routes.js   # CRUD + status + edit
│   │   ├── payment.routes.js   # Submit + verify payments
│   │   ├── verification.routes.js
│   │   ├── admin.routes.js     # Staff mgmt, audit logs
│   │   └── notification.routes.js
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── request.service.js  # Core business logic
│   │   ├── payment.service.js
│   │   ├── verification.service.js
│   │   ├── staff.service.js
│   │   ├── notification.service.js
│   │   ├── audit.service.js
│   │   └── email.service.js
│   └── utils/
│       ├── constants.js        # Enums, status transitions
│       └── errors.js           # Custom error classes
├── frontend/
│   ├── index.html              # Main SPA shell
│   └── js/
│       ├── app.js              # Page routing + rendering
│       └── services/
│           └── api.js          # Supabase client + API calls
└── README.md
```

## Setup Guide

### 1. Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to **SQL Editor** and run the entire `database/schema.sql` file
3. Go to **Storage** and create 3 buckets:
   - `valid-ids` (public read)
   - `payment-proofs` (public read)
   - `documents` (public read)
4. Copy your **Project URL** and **anon key** from Settings > API

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your Supabase URL, keys, and SMTP credentials
npm install
npm run dev
```

The server starts on `http://localhost:3000`.

### 3. Frontend Setup

1. Edit `frontend/js/services/api.js`:
   - Replace `%%SUPABASE_URL%%` with your Supabase URL
   - Replace `%%SUPABASE_ANON_KEY%%` with your anon key
   - Set `API_BASE` to your backend URL

2. Serve the frontend:
```bash
# Using VS Code Live Server, or:
npx serve frontend -p 5500
```

3. Open `http://localhost:5500`

### 4. Create Admin Account

Run this in Supabase SQL Editor to create the initial admin:

```sql
-- First, create the auth user via Supabase Dashboard > Authentication > Users
-- Then link it:
INSERT INTO users (id, email, role, is_verified)
VALUES ('YOUR_AUTH_USER_UUID', 'admin@brgy.gov.ph', 'admin', true);
```

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Resident registration |
| POST | `/api/auth/login` | Login (returns JWT) |
| GET | `/api/auth/me` | Get current profile |
| PUT | `/api/auth/password` | Change password |
| PUT | `/api/auth/profile` | Update profile |

### Requests
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/requests` | List requests (role-scoped) |
| GET | `/api/requests/:id` | Get request detail |
| POST | `/api/requests` | Submit new request (resident) |
| PUT | `/api/requests/:id/status` | Update status (staff/admin) |
| PUT | `/api/requests/:id/edit` | Edit details (under_review/processing) |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments/:requestId` | Submit payment + proof |
| PUT | `/api/payments/:id/verify` | Verify/reject payment |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Aggregate stats |
| GET | `/api/admin/staff` | List staff |
| POST | `/api/admin/staff` | Create staff account |
| PUT | `/api/admin/staff/:userId` | Update staff |
| GET | `/api/admin/audit-logs` | List audit logs |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | Get user notifications |
| PUT | `/api/notifications/:id/read` | Mark as read |
| PUT | `/api/notifications/read-all` | Mark all as read |

## Key Features

### Free Document Auto-Skip
When a staff member approves a free document (₱0 fee like Certificate of Indigency), the system automatically skips the payment step:
- `under_review` → `paid` (skips `awaiting_payment`)
- Creates a payment record with `method: 'free'` and `status: 'verified'`

### Request Editing
Staff/admin can edit request details (document type, purpose, remarks) during `under_review` and `processing` statuses. Changes are audit-logged and the resident is notified.

### Real-Time Updates
All status changes, notifications, and payment updates push instantly via Supabase Realtime WebSocket to all connected dashboards.

### Status Flow
```
Pending → Under Review → Awaiting Payment → Paid → Processing → Ready → Released
                ↓                                                       
              Rejected (with reason)
                
Free docs: Under Review → Paid (auto-skip)
```

## Deployment

### Backend (Render/Railway)
1. Push to GitHub
2. Connect to Render/Railway
3. Set environment variables from `.env.example`
4. Deploy

### Frontend (Vercel/Netlify)
1. Push `frontend/` to GitHub
2. Connect to Vercel/Netlify
3. Set build directory to `frontend/`
4. Deploy
