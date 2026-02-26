# DairyPro 🐄 - Complete Dairy Farm Management System

A comprehensive, modern dairy farm management platform with AI assistance, detailed analytics, and multi-module functionality for complete farm operations.

🌐 **Live Demo:** https://dairypro-deepakchy1998s-projects.vercel.app  
🔗 **Backend API:** https://dairypro-api.onrender.com

---

## 🚀 Features Overview

DairyPro provides complete dairy farm management through 12+ integrated modules:

### 🐄 **Core Farm Management**
- **Cattle Management** — Individual animal profiles, breeding history, health records, production tracking
- **Milk Recording** — Daily milk production logging, quality tracking, automated calculations
- **Health & Vaccination** — Medical records, vaccination schedules, treatment history, alerts
- **Breeding Management** — Mating records, pregnancy tracking, calving predictions, genetic records

### 💰 **Business Operations**
- **Finance Management** — Comprehensive expense and revenue tracking with categorization
- **Feed Management** — Feed inventory, consumption tracking, cost analysis, nutrition planning
- **Dudh Khata (Milk Delivery)** — Customer ledger system, delivery tracking, payment management, dues calculation
- **Employee Management** — Staff roles, salary management, attendance tracking, advance payments

### 📊 **Advanced Features**
- **Insurance Module** — Policy management, government schemes, expiry alerts, claim tracking
- **Reports & Analytics** — 20+ interactive charts across 6 dashboard tabs with export capabilities
- **AI Farm Assistant** — Powered by Gemini 2.5 Flash, supports Hindi/English, quick command processing
- **Subscription System** — Razorpay integration, custom plan builder, free trial management

### 👨‍💼 **Admin Panel**
- **User Management** — Per-user module access control, custom limits, detailed notes system
- **Payment Verification** — Transaction monitoring and validation
- **Subscription Control** — Grant/revoke subscriptions, usage monitoring
- **App Configuration** — Module toggles, chatbot controls, maintenance mode
- **Website CMS** — Hero sections, statistics, SEO management, social links, announcements, FAQs, testimonials, pricing
- **Plan Management** — Full CRUD operations for subscription plans
- **Revenue Dashboard** — Comprehensive charts and financial analytics

---

## 🛡️ **Technical Excellence**

### **Security & Validation**
- **Input Validation** — Comprehensive Zod schema validation across all endpoints
- **Authentication** — Bulletproof auth system with React-based navigation (no redirect loops)
- **Security Headers** — Helmet.js implementation with CORS protection
- **Data Sanitization** — Input sanitization and XSS protection
- **Rate Limiting** — API endpoint protection against abuse

### **Development Quality**
- **Test Suite** — Vitest framework with 35+ comprehensive tests
- **PWA Support** — Progressive Web App capabilities for mobile experience
- **Dark Mode** — Complete theme switching functionality
- **Responsive Design** — Mobile-first approach with optimal UX

---

## 🔧 **Tech Stack**

| Component | Technology |
|-----------|------------|
| **Frontend** | React 18 + Vite + TypeScript |
| **Backend** | Node.js + Express + TypeScript |
| **Database** | MongoDB Atlas |
| **Authentication** | JWT with refresh token rotation |
| **Payments** | Razorpay Integration |
| **AI** | Google Gemini 2.5 Flash |
| **Testing** | Vitest + React Testing Library |
| **Validation** | Zod schemas |
| **Styling** | Tailwind CSS + Headless UI |
| **Charts** | Recharts + Chart.js |
| **Notifications** | WhatsApp Business API (optional) |
| **Deployment** | Vercel (Frontend) + Render (Backend) |

---

## 🚀 **Quick Setup**

### **Backend Setup**

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd dairy-farm/backend
   npm install
   ```

2. **Environment Variables**
   Create `.env` file:
   ```env
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_super_secure_jwt_secret
   JWT_REFRESH_SECRET=your_refresh_token_secret
   RAZORPAY_KEY_ID=your_razorpay_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_key_secret
   GEMINI_API_KEY=your_google_gemini_api_key
   
   # WhatsApp (Optional)
   WHATSAPP_TOKEN=your_whatsapp_business_token
   WHATSAPP_PHONE_ID=your_whatsapp_phone_number_id
   
   # Admin
   ADMIN_EMAIL=admin@dairypro.com
   ADMIN_PASSWORD=secure_admin_password
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

### **Frontend Setup**

1. **Install Dependencies**
   ```bash
   cd dairy-farm/frontend
   npm install
   ```

2. **Environment Variables**
   Create `.env` file:
   ```env
   VITE_API_URL=http://localhost:5000
   VITE_RAZORPAY_KEY_ID=your_razorpay_key_id
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

### **Database Setup**
- MongoDB Atlas account required
- Collections are auto-created on first run
- Indexes automatically configured for optimal performance

---

## 📡 **API Endpoints**

### **Core Endpoints**
```
# Authentication
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh-token
POST   /api/auth/logout

# Cattle Management
GET    /api/cattle
POST   /api/cattle
PUT    /api/cattle/:id
DELETE /api/cattle/:id

# Milk Records
GET    /api/milk-records
POST   /api/milk-records
PUT    /api/milk-records/:id

# Health & Vaccination
GET    /api/health-records
POST   /api/health-records
GET    /api/vaccinations
POST   /api/vaccinations
```

### **Advanced Features**
```
# Subscription Management
POST   /api/subscription/create-order
POST   /api/subscription/verify-payment
POST   /api/subscription/custom-plan

# Admin Panel
GET    /api/admin/users
PUT    /api/admin/users/:id/overrides
GET    /api/admin/payments
GET    /api/admin/revenue

# Configuration
GET    /api/app-config
PUT    /api/app-config

# AI Assistant
POST   /api/ai/chat
POST   /api/ai/quick-command
```

### **Analytics & Reports**
```
# Dashboard Data
GET    /api/analytics/overview
GET    /api/analytics/milk-production
GET    /api/analytics/financial
GET    /api/analytics/health
GET    /api/analytics/breeding
GET    /api/analytics/feed

# Export Functions
GET    /api/reports/export/cattle
GET    /api/reports/export/milk-records
GET    /api/reports/export/financial
```

---

## 🌍 **Deployment**

### **Production Deployment**

**Backend (Render):**
1. Connect GitHub repository to Render
2. Configure environment variables in Render dashboard
3. Set build command: `cd backend && npm install`
4. Set start command: `cd backend && npm start`
5. Auto-deploy on git push

**Frontend (Vercel):**
1. Connect GitHub repository to Vercel
2. Set root directory to `frontend/`
3. Configure environment variables
4. Auto-deploy on git push

### **Domain Configuration**
- Frontend: Custom domain via Vercel
- Backend: Custom API domain via Render
- SSL certificates automatically managed

---

## 🔐 **Security Features**

- **Data Encryption:** All sensitive data encrypted at rest
- **Secure Headers:** Comprehensive security headers via Helmet
- **CORS Protection:** Configured for specific origins only
- **Rate Limiting:** API endpoint protection against abuse
- **Input Validation:** Server-side validation using Zod schemas
- **XSS Protection:** Input sanitization and output encoding
- **JWT Security:** Secure token generation with rotation
- **Password Hashing:** bcrypt with salt rounds
- **Environment Security:** Sensitive data in environment variables only

---

## 📱 **WhatsApp Integration (Optional)**

DairyPro can send automated WhatsApp notifications for:
- **Vaccination Alerts** — Overdue and upcoming vaccinations
- **Delivery Reminders** — Milk delivery schedules and dues
- **Subscription Expiry** — Payment reminders and plan updates
- **Daily Farm Summary** — Complete farm status at 9 PM daily

**Setup:** See `WHATSAPP_SETUP_GUIDE.md` for complete configuration instructions.
**Note:** WhatsApp integration is entirely optional — DairyPro works perfectly without it.

---

## 🧪 **Testing**

```bash
# Backend Tests
cd backend
npm test

# Frontend Tests  
cd frontend
npm test

# Coverage Report
npm run test:coverage
```

**Test Coverage:**
- 35+ comprehensive test cases
- Unit tests for all critical functions
- Integration tests for API endpoints
- Component tests for React components
- Mock data for consistent testing

---

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📞 **Support**

For support, feature requests, or bug reports:
- 📧 Email: support@dairypro.com
- 🐛 GitHub Issues: [Create an issue](https://github.com/your-repo/issues)
- 📖 Documentation: Comprehensive guides in `/docs` folder

---

**DairyPro** - Empowering dairy farmers with modern technology 🐄✨