import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Lazy load all pages — only loaded when user navigates to them
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const CattleList = lazy(() => import('./pages/cattle/CattleList'));
const CattleProfile = lazy(() => import('./pages/cattle/CattleProfile'));
const MilkRecords = lazy(() => import('./pages/milk/MilkRecords'));
const HealthRecords = lazy(() => import('./pages/health/HealthRecords'));
const BreedingRecords = lazy(() => import('./pages/breeding/BreedingRecords'));
const FeedRecords = lazy(() => import('./pages/feed/FeedRecords'));
const Finance = lazy(() => import('./pages/finance/Finance'));
const Reports = lazy(() => import('./pages/reports/Reports'));
const Subscription = lazy(() => import('./pages/subscription/Subscription'));
const Chatbot = lazy(() => import('./pages/chatbot/Chatbot'));
const AdminPanel = lazy(() => import('./pages/admin/AdminPanel'));
const Settings = lazy(() => import('./pages/settings/Settings'));
const Landing = lazy(() => import('./pages/Landing'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedLayout({ children, adminOnly }) {
  return (
    <ProtectedRoute adminOnly={adminOnly}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <Router>
        <Toaster position="top-right" toastOptions={{ duration: 3000, style: { borderRadius: '12px', padding: '12px 16px' } }} />
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/dashboard" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
          <Route path="/cattle/:id" element={<ProtectedLayout><CattleProfile /></ProtectedLayout>} />
          <Route path="/cattle" element={<ProtectedLayout><CattleList /></ProtectedLayout>} />
          <Route path="/milk" element={<ProtectedLayout><MilkRecords /></ProtectedLayout>} />
          <Route path="/health" element={<ProtectedLayout><HealthRecords /></ProtectedLayout>} />
          <Route path="/breeding" element={<ProtectedLayout><BreedingRecords /></ProtectedLayout>} />
          <Route path="/feed" element={<ProtectedLayout><FeedRecords /></ProtectedLayout>} />
          <Route path="/finance" element={<ProtectedLayout><Finance /></ProtectedLayout>} />
          <Route path="/reports" element={<ProtectedLayout><Reports /></ProtectedLayout>} />
          <Route path="/subscription" element={<ProtectedLayout><Subscription /></ProtectedLayout>} />
          <Route path="/chatbot" element={<ProtectedLayout><Chatbot /></ProtectedLayout>} />
          <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />
          <Route path="/admin" element={<ProtectedLayout adminOnly><AdminPanel /></ProtectedLayout>} />
          <Route path="/" element={<Landing />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
    </ThemeProvider>
  );
}
