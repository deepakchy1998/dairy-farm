# 🐄 DairyPro - Smart Dairy Farm Management

A full-stack dairy farm management platform built for Indian dairy farmers.

## Features
- 🐄 Cattle Management (tag-based, full lineage)
- 🥛 Milk Recording (morning/afternoon/evening, fat%, SNF%)
- 💉 Health & Vaccination tracking with reminders
- 🐣 Breeding & Pregnancy tracking
- 🌾 Feed Management
- 💰 Finance (expenses & revenue with milk sale calculator)
- 📊 Reports & Analytics with beautiful charts
- 🤖 Smart Farm Assistant (Hindi + English)
- 💳 Subscription with UPI payments
- 👑 Admin Panel

## Tech Stack
- **Frontend:** React 19 + Vite + TailwindCSS v4 + Recharts + Framer Motion
- **Backend:** Node.js + Express + MongoDB/Mongoose + JWT
- **Database:** MongoDB Atlas

## Setup

### Backend
```bash
cd backend
npm install
cp .env.example .env  # Edit with your MongoDB URI and JWT secret
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Environment Variables (Backend)
| Variable | Description |
|----------|-------------|
| PORT | Server port (default: 5000) |
| MONGODB_URI | MongoDB connection string |
| JWT_SECRET | Secret key for JWT tokens |

## License
MIT
