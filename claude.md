You are a senior software architect and full-stack engineer.

I am building a web-based Barangay Document Issuance System. I want you to design the COMPLETE system architecture step-by-step with HIGH accuracy and minimal errors.

IMPORTANT RULES:
- Do NOT skip steps
- Do NOT jump to coding immediately
- Follow the phases in order
- Be structured and consistent
- If something is unclear, make reasonable assumptions and state them

--------------------------------------------------

PROJECT OVERVIEW:

The system digitalizes the manual issuance of barangay documents. It will be deployed online and has three roles:

1. Admin
2. Staff
3. Resident

GOALS:
- Reduce manual errors
- Allow residents to request documents online
- Provide tracking and transparency
- Enable admin monitoring and reporting

--------------------------------------------------

CRITICAL SYSTEM REQUIREMENT (REAL-TIME):

The system MUST be real-time.

This means:
- Any change in request status must instantly reflect on:
  - Resident dashboard
  - Staff dashboard
  - Admin dashboard
- Notifications should update live without requiring page refresh
- Dashboards must show live data (requests, payments, logs)
- Use Supabase real-time subscriptions or equivalent technology

Design the system to support real-time updates efficiently and reliably.

--------------------------------------------------

CORE FEATURES:

USER ROLES:

ADMIN:
- Dashboard (real-time stats: requests, payments, logs)
- Manage staff accounts (CRUD)
- View/export audit logs (Excel: daily, weekly, monthly, yearly)
- Access all released documents
- Monitor staff activity

STAFF:
- Manage document requests
- Approve / Reject requests
- Edit request details
- Verify payments (GCash or walk-in)
- Process and release documents
- Upload or generate PDFs

RESIDENT:
- Register with valid ID upload
- Account verification by staff
- Submit document requests
- Track request status (REAL-TIME)
- Choose payment method
- Upload GCash proof
- Receive document via email

--------------------------------------------------

REQUEST FLOW:

1. Resident submits request → Pending
2. Staff reviews:
   - Approve → Awaiting Payment
   - Reject → Rejected (with reason)

3. If approved:
   - Email sent
   - PDF generated (draft)

4. Payment:
   - GCash → upload proof
   - Walk-in → physical payment

5. Staff verifies payment → Paid

6. Staff processes document → Ready

7. Staff releases → Released + email with document

STATUS FLOW:
Pending → Under Review → Awaiting Payment → Paid → Ready → Released
Rejected (can occur after review)

ALL STATUS CHANGES MUST UPDATE IN REAL-TIME ACROSS ALL DASHBOARDS.

--------------------------------------------------

ACCOUNT RULES:

RESIDENT:
- Editable: email, password, phone, address, civil status
- NOT editable: full name

STAFF:
- Editable: email, password

ADMIN:
- Full control

ACCOUNT VERIFICATION:
- Resident uploads valid ID
- Staff approves or rejects
- Rejection includes reason

--------------------------------------------------

TECH STACK:

Frontend:
- HTML, CSS, JavaScript, Tailwind

Backend:
- Node.js + Express

Database/Auth:
- Supabase (PostgreSQL)

Storage:
- Supabase Storage (IDs, proofs, documents)

Real-time:
- Supabase Realtime (subscriptions)

Deployment:
- Frontend: Vercel or Netlify
- Backend: Render or Railway

--------------------------------------------------

NOW FOLLOW THESE PHASES STRICTLY:

PHASE 1: DATABASE DESIGN
- Design PostgreSQL schema
- Include tables:
  users, resident_profiles, staff_profiles,
  requests, request_documents, payments,
  audit_logs, notifications
- Include:
  - Primary keys
  - Foreign keys
  - Relationships
  - Important fields
- Ensure schema supports REAL-TIME updates efficiently

DO NOT WRITE CODE YET.

--------------------------------------------------

PHASE 2: API DESIGN
- Define REST API endpoints
- Group by modules:
  auth, requests, payments, admin, notifications
- Include:
  method, endpoint, description
- Consider real-time triggers where necessary

DO NOT IMPLEMENT YET.

--------------------------------------------------

PHASE 3: SYSTEM ARCHITECTURE
- Describe architecture clearly:
  - frontend
  - backend
  - database
  - storage
  - email service
  - real-time layer
- Show flow of data (text diagram is fine)
- Explain how real-time updates are handled

--------------------------------------------------

PHASE 4: BACKEND STRUCTURE
- Define folder structure for Node.js + Express
- Include:
  routes, controllers, services, middleware, utils

--------------------------------------------------

PHASE 5: IMPLEMENTATION PLAN
- Break system into build order:
  1. authentication
  2. account verification
  3. request module
  4. payment module
  5. document generation
  6. real-time subscriptions
  7. admin dashboard
  8. audit logs
- Explain briefly what each step does

--------------------------------------------------

PHASE 6: RISK & ERROR PREVENTION
- List possible bugs or issues
- Suggest how to prevent them
- Include real-time sync issues and how to handle them

--------------------------------------------------

OUTPUT FORMAT:
- Use clear headings
- Keep it structured
- Avoid unnecessary explanations
- Be precise and practical