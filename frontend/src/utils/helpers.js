import { format, parseISO } from 'date-fns';

export const formatDate = (date) => {
  if (!date) return '-';
  try { return format(new Date(date), 'dd MMM yyyy'); } catch { return '-'; }
};

export const formatDateTime = (date) => {
  if (!date) return '-';
  try { return format(new Date(date), 'dd MMM yyyy, hh:mm a'); } catch { return '-'; }
};

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
};

export const formatNumber = (num) => {
  return new Intl.NumberFormat('en-IN').format(num || 0);
};

export const formatLiters = (num) => `${(num || 0).toFixed(1)} L`;

export const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
};

export const categoryColors = {
  milking: '#10b981', dry: '#f59e0b', heifer: '#8b5cf6', calf: '#3b82f6', bull: '#ef4444', pregnant: '#ec4899',
};

export const expenseColors = {
  feed: '#10b981', medicine: '#ef4444', equipment: '#3b82f6', salary: '#f59e0b', transport: '#8b5cf6', maintenance: '#ec4899', other: '#6b7280',
};
