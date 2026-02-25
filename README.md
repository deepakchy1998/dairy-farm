# 🐄 DairyPro — Smart Dairy Farm Management

A full-stack dairy farm management platform built for Indian dairy farmers. Track cattle, milk production, health records, breeding, feed, and finances — all in one place.

🌐 **Live Demo:** [dairypro-deepakchy1998s-projects.vercel.app](https://dairypro-deepakchy1998s-projects.vercel.app)

---

## ✨ Features

### 🐄 Cattle Management
- Tag-based cattle tracking with breed, category, gender, weight
- Categories: Milking, Dry, Heifer, Calf, Bull, Pregnant
- Cattle profile with linked milk, health, and breeding records
- Search and filter by tag, breed, category, status

### 🥛 Milk Recording
- Morning, afternoon, and evening yield tracking
- Fat% and SNF% recording per session
- Daily/monthly summaries with trends
- Top and low producer identification
- PDF report generation (per cattle or farm-wide)

### 💉 Health & Vaccination
- Vaccination, treatment, checkup, and deworming records
- Next due date tracking with automated reminders
- Overdue vaccination alerts
- Vet name and medicine cost tracking

### 🐣 Breeding Management
- Natural and artificial insemination tracking
- Auto-calculated expected delivery date (280 days)
- Breeding status: Bred → Confirmed → Delivered / Failed
- Upcoming delivery alerts (30-day window)

### 🌾 Feed Management
- Feed type, quantity (kg/quintal/ton), and cost tracking
- Monthly feed expense breakdown

### 💰 Finance
- **Expenses:** Feed, medicine, equipment, salary, transport, maintenance
- **Revenue:** Milk sale, cattle sale, manure sale with rate calculator
- Monthly profit/loss reports with trends
- Cost per liter / Revenue per liter / Profit per liter analytics

### 📊 Reports & Analytics
- Profit & Loss (month-over-month comparison)
- Milk analytics with top producers and daily averages
- Cattle analytics (by breed, category, gender, status)
- Expense breakdown by category
- Exportable PDF reports

### 🤖 AI Farm Assistant (Chatbot)
- Powered by **Google Gemini 2.5 Flash**
- Real-time access to all your farm data
- Supports **Hindi + English + Hinglish**
- Smart topic detection (only fetches relevant data)
- 60-second cache for fast responses
- Quick commands: `/alerts`, `/milk`
- 12 quick-action buttons + context-aware follow-up suggestions
- Proactive alerts, trend analysis, and farming tips

### 💳 Subscription & Payments
- **5-day free trial** on registration
- Plans: Monthly (₹499) / Quarterly (₹1299) / Half-Yearly (₹2499) / Yearly (₹4499)
- **UPI payment** with transaction ID + screenshot upload
- Admin manual verification system
- Strict paywall — app locked after trial/plan expiry
- Duplicate transaction ID prevention
- 48-hour auto-expiry on unverified payments
- 3-day expiry warning notifications

### 🔔 Smart Notifications
- Overdue vaccination alerts (critical)
- Upcoming vaccination reminders (3-day advance)
- Expected delivery alerts (7-day window)
- Low milk production detection (25%+ drop)
- Expense exceeding revenue warnings
- Subscription expiry reminders
- Missing milk record reminders

### 👑 Admin Panel
- User management with subscription status
- Payment verification dashboard (verify/reject with notes)
- Manual subscription grant/revoke
- Platform statistics (users, farms, cattle, revenue)
- Landing page content management
- Plan pricing and UPI ID configuration

### 📱 Progressive Web App (PWA)
- Installable on Android and iOS (home screen app)
- Service worker for offline caching
- Standalone display (no browser bar)
- Persistent "Install App" button (disappears after install)

### 🎨 UI/UX
- Beautiful responsive design with TailwindCSS v4
- Dark mode support throughout
- Framer Motion animations
- Recharts for interactive data visualization
- Draggable chat bubble and install button on mobile
- 2-step registration wizard with Indian states dropdown
- Password strength indicator
- Remember me with auto-fill

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite, TailwindCSS v4, Recharts, Framer Motion |
| **Backend** | Node.js, Express.js, ES Modules |
| **Database** | MongoDB Atlas, Mongoose ODM |
| **Auth** | JWT (30-day tokens), bcryptjs |
| **AI** | Google Gemini 2.5 Flash API |
| **Hosting** | Vercel (frontend), Render (backend) |
| **PWA** | Service Worker, Web App Manifest |

---

## 📁 Project Structure

```
dairy-farm/
├── backend/
│   ├── server.js              # Express app entry
│   ├── middleware/
│   │   ├── auth.js            # JWT verification
│   │   ├── admin.js           # Admin role check
│   │   ├── subscription.js    # Subscription enforcement
│   │   └── errorHandler.js    # Centralized error handling
│   ├── models/                # 14 Mongoose models
│   │   ├── User.js, Farm.js, Cattle.js
│   │   ├── MilkRecord.js, HealthRecord.js, BreedingRecord.js
│   │   ├── FeedRecord.js, Expense.js, Revenue.js
│   │   ├── Subscription.js, Payment.js
│   │   ├── Activity.js, Notification.js, LandingContent.js
│   ├── routes/                # 17 route files
│   │   ├── auth.js, farm.js, cattle.js, milk.js
│   │   ├── health.js, breeding.js, feed.js
│   │   ├── expense.js, revenue.js, reports.js
│   │   ├── activity.js, subscription.js, payment.js
│   │   ├── admin.js, landing.js, chatbot.js, notifications.js
│   └── utils/helpers.js       # Pagination, date filters, activity logger
├── frontend/
│   ├── index.html
│   ├── public/
│   │   ├── manifest.json, sw.js
│   │   └── icon-192.png, icon-512.png
│   └── src/
│       ├── main.jsx, App.jsx, index.css
│       ├── components/        # Layout, Modal, Paywall, ChatBubble, InstallPrompt, etc.
│       ├── context/           # AuthContext, ThemeContext
│       ├── hooks/             # useDraggable
│       ├── pages/             # 15+ page components
│       └── utils/             # api.js, helpers.js, exportCsv.js, exportPdf.js
├── .gitignore
└── README.md
```

---

## 🚀 Setup & Installation

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (or local MongoDB)
- Gemini API key (free at [aistudio.google.com](https://aistudio.google.com/apikey))

### Backend

```bash
cd backend
npm install

# Create environment file
cp .env.example .env
```

Edit `.env`:
```env
PORT=5000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dairypro
JWT_SECRET=your-super-secret-jwt-key
GEMINI_API_KEY=your-gemini-api-key
```

```bash
npm run dev    # Development (auto-restart)
npm start      # Production
```

### Frontend

```bash
cd frontend
npm install

# Optional: set API URL for local development
# Create .env.local with:
# VITE_API_URL=http://localhost:5000

npm run dev    # Development server at localhost:5173
npm run build  # Production build
```

---

## 🌐 Deployment

### Backend → Render
1. Create a **Web Service** on [render.com](https://render.com)
2. Connect your GitHub repo
3. Settings: Root Directory = `backend`, Build = `npm install`, Start = `node server.js`
4. Add environment variables: `MONGODB_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `PORT=10000`

### Frontend → Vercel
1. Import project on [vercel.com](https://vercel.com)
2. Settings: Root Directory = `frontend`, Framework = Vite
3. Add environment variable: `VITE_API_URL=https://your-backend.onrender.com`

---

## 🔑 API Endpoints

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register + create farm + 5-day trial |
| POST | `/api/auth/login` | Login, returns JWT |
| POST | `/api/auth/forgot-password` | Generate reset token |
| POST | `/api/auth/reset-password` | Reset password |
| GET | `/api/landing` | Landing page content |
| GET | `/api/subscription/plans` | Plan pricing |

### Protected (requires JWT)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/me` | Current user |
| GET/PUT | `/api/farm` | Farm details |
| GET | `/api/farm/dashboard` | Dashboard data |
| CRUD | `/api/cattle` | Cattle management |
| CRUD | `/api/milk` | Milk records |
| CRUD | `/api/health` | Health records |
| CRUD | `/api/breeding` | Breeding records |
| CRUD | `/api/feed` | Feed records |
| CRUD | `/api/expense` | Expenses |
| CRUD | `/api/revenue` | Revenue |
| GET | `/api/reports/*` | Reports & analytics |
| POST | `/api/chatbot/ask` | AI chatbot |
| GET | `/api/notifications` | Smart notifications |
| GET | `/api/subscription/current` | Subscription status |
| POST | `/api/payment` | Submit UPI payment |

### Admin Only
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | All users with subscription status |
| GET | `/api/admin/payments` | All payments (filterable) |
| PUT | `/api/admin/payments/:id/verify` | Verify payment → activate subscription |
| PUT | `/api/admin/payments/:id/reject` | Reject payment |
| POST | `/api/admin/subscription/grant` | Manually grant subscription |
| POST | `/api/admin/subscription/revoke` | Revoke subscription |
| GET | `/api/admin/stats` | Platform statistics |
| PUT | `/api/admin/landing` | Update landing content & pricing |

---

## 🔒 Security

- **JWT Authentication** with 30-day expiry + auto-refresh
- **bcryptjs** password hashing (12 rounds)
- **Farm-scoped data** — all queries filtered by farmId
- **Subscription enforcement** — backend blocks all data routes when expired
- **Duplicate payment prevention** — unique UPI transaction IDs
- **Payment screenshot proof** — base64 image upload
- **48-hour payment expiry** — stale payments auto-expire
- **Rate limiting** — per-IP global rate limiter (100 req/min) + auth-specific limiter
- **Helmet** security headers (CSP, Permissions-Policy)
- **CORS** with configurable origins
- **Request ID tracking** — every request gets a UUID for debugging
- **NoSQL injection protection** — input sanitization middleware
- **Graceful shutdown** — clean MongoDB disconnect on SIGTERM/SIGINT
- **MongoDB connection retry** — auto-retry up to 3 times on startup failure

---

## 📄 License

MIT

---

**Built with ❤️ for Indian Dairy Farmers 🇮🇳**
