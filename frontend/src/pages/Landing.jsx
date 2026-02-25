import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { FiArrowRight, FiCheckCircle, FiPhone, FiMail, FiMapPin, FiStar, FiShield, FiTrendingUp, FiSmartphone, FiSun, FiMoon } from 'react-icons/fi';
import api from '../utils/api';

// Animation wrapper
function FadeIn({ children, delay = 0, direction = 'up', className = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const dirs = { up: [30, 0], down: [-30, 0], left: [0, 30], right: [0, -30] };
  const [y, x] = dirs[direction] || [30, 0];
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, y, x }}
      animate={inView ? { opacity: 1, y: 0, x: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.1, 0.25, 1] }}>
      {children}
    </motion.div>
  );
}

const features = [
  { icon: '🐄', title: 'Cattle Management', desc: 'Track every animal — breed, age, health, genetics, weight, purchase history. Tag-based search with full profiles and lineage.' },
  { icon: '🥛', title: 'Milk Recording', desc: 'Morning, afternoon & evening yield, fat %, SNF % — per animal, per session. Daily, weekly, monthly reports with CSV/PDF export.' },
  { icon: '🤖', title: 'AI Farm Assistant', desc: 'Powered by Google Gemini — ask anything in Hindi or English. Get instant insights, alerts, predictions from your real-time farm data.' },
  { icon: '💉', title: 'Health & Vaccination', desc: 'Schedule vaccinations, track treatments, set reminders. Smart alerts for overdue and upcoming health events.' },
  { icon: '🐣', title: 'Breeding Tracker', desc: 'AI/natural insemination, pregnancy tracking, expected deliveries, heat prediction. Complete reproductive management.' },
  { icon: '💰', title: 'Finance & Accounting', desc: 'Track milk sales, expenses by category, profit/loss analysis. Revenue breakdown with monthly comparisons.' },
  { icon: '🏘️', title: 'Dudh Khata (दूध खाता)', desc: 'Manage milk delivery to households — customer ledgers, daily delivery tracking, payment collection, outstanding dues.' },
  { icon: '👷', title: 'Employee Management', desc: 'Staff records, role-based management, salary tracking, attendance (present/absent/half-day/leave), advance payments.' },
  { icon: '🌾', title: 'Feed Management', desc: 'Record feed types, quantities, costs per animal/group. Optimize feed expenses with detailed analytics and trends.' },
  { icon: '🛡️', title: 'Insurance Tracking', desc: 'Track cattle insurance policies, premiums, coverage periods. Get alerts before policies expire. Govt scheme info included.' },
  { icon: '📊', title: '10+ Report Dashboards', desc: 'Milk trends, health analytics, employee performance, feed costs, customer analytics, revenue breakdown — all with interactive charts.' },
  { icon: '💳', title: 'Secure Payments', desc: 'Pay via UPI, QR code, cards, Paytm, PhonePe, net banking, EMI. Powered by Razorpay with instant activation.' },
];

export default function Landing() {
  const [content, setContent] = useState(null);
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [dynamicPlans, setDynamicPlans] = useState([]);

  useEffect(() => {
    api.get('/landing').then(r => setContent(r.data.data)).catch(() => {});
    api.get('/subscription/plans').then(r => setDynamicPlans(r.data.data?.plans || [])).catch(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const heroTitle = content?.heroTitle || 'Manage Your Dairy Farm Smarter';
  const heroSubtitle = content?.heroSubtitle || 'Track cattle, milk production, health records, breeding, finances — all in one place. Built for Indian dairy farmers.';
  const phone = content?.supportPhone || '+91 98765 43210';
  const email = content?.supportEmail || 'support@dairypro.in';
  const address = content?.contactAddress || 'Punjab, India';
  const trialDays = content?.pricing?.trialDays || 5;

  const defaultTestimonials = [
    { name: 'Rajesh Kumar', location: 'Punjab', text: 'DairyPro completely changed how I manage my 50-cow dairy. The farm assistant saves me hours every week!', stars: 5 },
    { name: 'Priya Sharma', location: 'Haryana', text: 'Finally, a farm management app that understands Hindi! The milk recording and finance tracking is excellent.', stars: 5 },
    { name: 'Mohit Singh', location: 'UP', text: 'Best investment for my dairy farm. The vaccination reminders alone saved me from missing important schedules.', stars: 5 },
  ];
  const testimonials = content?.testimonials?.length ? content.testimonials : defaultTestimonials;

  const plans = dynamicPlans.length > 0
    ? dynamicPlans.map(p => ({ name: p.label, price: p.price, period: p.period || '', popular: p.isPopular, days: p.days }))
    : [
        { name: 'Monthly', price: content?.pricing?.monthly || 499, period: '/month', popular: false },
        { name: 'Half Yearly', price: content?.pricing?.halfyearly || 2499, period: '/6 months', popular: true },
        { name: 'Yearly', price: content?.pricing?.yearly || 4499, period: '/year', popular: false },
      ];

  const stats = [
    { num: content?.stats?.activeFarms || '500+', label: 'Active Farms' },
    { num: content?.stats?.cattleManaged || '50,000+', label: 'Cattle Managed' },
    { num: content?.stats?.milkRecords || '10L+', label: 'Milk Records' },
    { num: content?.stats?.uptime || '99.9%', label: 'Uptime' },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 transition-colors duration-300">

      {/* ─── Navbar ─── */}
      <nav className="fixed top-0 w-full bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-800 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2">
            <span className="text-3xl">🐄</span>
            <span className="text-xl font-bold text-gray-900 dark:text-white">DairyPro</span>
          </motion.div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-600 dark:text-gray-400">
            <a href="#features" className="hover:text-emerald-600 transition">Features</a>
            <a href="#pricing" className="hover:text-emerald-600 transition">Pricing</a>
            <a href="#testimonials" className="hover:text-emerald-600 transition">Testimonials</a>
            <a href="#contact" className="hover:text-emerald-600 transition">Contact</a>
          </div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
            <button onClick={() => setDark(d => !d)} className="p-2 text-gray-500 hover:text-yellow-500 rounded-lg transition-colors">
              {dark ? <FiSun size={18} /> : <FiMoon size={18} />}
            </button>
            <Link to="/login" className="text-sm text-gray-600 dark:text-gray-400 hover:text-emerald-600 font-medium transition">Sign In</Link>
            <Link to="/register" className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-full font-medium hover:bg-emerald-700 transition shadow-sm">
              Start Free Trial
            </Link>
          </motion.div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-br from-emerald-50 via-white to-green-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 relative overflow-hidden">
        <div className="absolute top-20 right-0 w-96 h-96 bg-emerald-100 dark:bg-emerald-900/20 rounded-full blur-3xl opacity-40"></div>
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-green-100 dark:bg-green-900/20 rounded-full blur-3xl opacity-40"></div>
        <div className="max-w-7xl mx-auto text-center relative">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-full text-sm font-medium mb-6">
              <FiStar size={14} /> #1 Smart Dairy Farm Management Platform
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white leading-tight">
              {heroTitle.includes('Smarter') ? (<>{heroTitle.split('Smarter')[0]}<br /><span className="text-emerald-600 dark:text-emerald-400">Smarter{heroTitle.split('Smarter')[1]}</span></>) : heroTitle}
            </h1>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p className="mt-6 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">{heroSubtitle}</p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/register" className="px-8 py-3.5 bg-emerald-600 text-white rounded-full font-semibold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 flex items-center gap-2 hover:scale-105">
                Start Free Trial <FiArrowRight />
              </Link>
              <a href="#features" className="px-8 py-3.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full font-semibold text-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all border border-gray-200 dark:border-gray-700">
                See Features
              </a>
            </div>
            <p className="mt-4 text-sm text-gray-400">✅ {trialDays}-day free trial • No credit card required</p>
          </FadeIn>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {stats.map((s, i) => (
              <FadeIn key={s.label} delay={0.4 + i * 0.1}>
                <div className="text-center">
                  <motion.p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400"
                    initial={{ scale: 0.5 }} whileInView={{ scale: 1 }} viewport={{ once: true }}
                    transition={{ type: 'spring', stiffness: 200, delay: 0.5 + i * 0.1 }}>
                    {s.num}
                  </motion.p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{s.label}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-20 px-4 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto">
          <FadeIn>
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">Everything You Need to Run Your Dairy</h2>
              <p className="mt-4 text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">From cattle management to smart insights, DairyPro gives you complete control of your farm.</p>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.08}>
                <motion.div whileHover={{ y: -8, scale: 1.02 }} transition={{ type: 'spring', stiffness: 300 }}
                  className="p-6 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-emerald-200 dark:hover:border-emerald-800 hover:shadow-xl dark:hover:shadow-emerald-900/10 transition-all group bg-white dark:bg-gray-900">
                  <span className="text-4xl block">{f.icon}</span>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">{f.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">{f.desc}</p>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── App Modules Detail ─── */}
      <section className="py-20 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <FadeIn>
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">12 Powerful Modules, One App</h2>
              <p className="mt-4 text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">Every tool you need to run a modern dairy farm — from daily milk recording to AI-powered insights.</p>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {[
              { icon: '🏘️', title: 'Dudh Khata (दूध खाता)', points: ['Customer-wise milk delivery ledger', 'Daily quantity & rate tracking', 'Payment collection with balance', 'Outstanding dues dashboard', 'Customer-wise monthly statements'] },
              { icon: '👷', title: 'Employee Management', points: ['Staff profiles with roles & salary', 'Daily attendance marking', 'Present / Absent / Half-day / Leave', 'Advance payment tracking', 'Performance analytics in Reports'] },
              { icon: '🤖', title: 'AI Farm Assistant', points: ['Google Gemini 2.5 Flash powered', 'Hindi + English + Hinglish support', 'Real-time farm data analysis', '20+ quick action buttons', 'Predictions, alerts & recommendations'] },
              { icon: '📊', title: '10+ Report Dashboards', points: ['Milk production trends & quality', 'Health & vaccination analytics', 'Feed cost optimization', 'Employee performance charts', 'Customer analytics & revenue breakdown'] },
            ].map((mod, i) => (
              <FadeIn key={mod.title} delay={i * 0.1}>
                <div className="flex gap-4 p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-shadow">
                  <span className="text-4xl flex-shrink-0">{mod.icon}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{mod.title}</h3>
                    <ul className="mt-3 space-y-1.5">
                      {mod.points.map((p, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <FiCheckCircle size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" /> {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Why DairyPro ─── */}
      <section className="py-20 px-4 bg-gradient-to-br from-emerald-600 to-emerald-700 dark:from-emerald-800 dark:to-emerald-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"><div className="absolute top-10 left-10 w-40 h-40 border border-white rounded-full"></div><div className="absolute bottom-10 right-20 w-60 h-60 border border-white rounded-full"></div></div>
        <div className="max-w-7xl mx-auto relative">
          <FadeIn>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold">Why Farmers Love DairyPro</h2>
              <p className="mt-4 text-emerald-100 max-w-xl mx-auto">Built specifically for Indian dairy farmers, with features that actually matter.</p>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: <FiSmartphone size={28} />, title: 'Mobile First', desc: 'PWA app — install on phone like an app. Works on any device, even with slow internet.' },
              { icon: <FiShield size={28} />, title: 'Bank-Level Security', desc: 'Encrypted data, Razorpay payments (PCI DSS), farm-isolated storage. Your data stays yours.' },
              { icon: <FiTrendingUp size={28} />, title: '20+ Analytics Charts', desc: 'Milk trends, health patterns, feed costs, revenue breakdown, employee analytics — all visual.' },
              { icon: '🇮🇳', title: 'Hindi + English AI', desc: 'Ask "aaj ka dudh kitna hai?" or "show breeding status" — our Gemini AI understands both languages.' },
            ].map((item, i) => (
              <FadeIn key={item.title} delay={i * 0.1}>
                <div className="text-center">
                  <motion.div whileHover={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 0.5 }}
                    className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto text-2xl">
                    {item.icon}
                  </motion.div>
                  <h3 className="text-lg font-semibold mt-4">{item.title}</h3>
                  <p className="text-emerald-100 text-sm mt-2">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="py-20 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <FadeIn>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">Simple, Affordable Pricing</h2>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Start with a {trialDays}-day free trial. No credit card required.</p>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {plans.map((plan, i) => (
              <FadeIn key={plan.name} delay={i * 0.15}>
                <motion.div whileHover={{ y: -5 }} transition={{ type: 'spring', stiffness: 300 }}
                  className={`p-8 rounded-2xl text-center relative ${plan.popular ? 'bg-emerald-600 dark:bg-emerald-700 text-white shadow-xl shadow-emerald-200 dark:shadow-emerald-900/50 scale-105' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'}`}>
                  {plan.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full">MOST POPULAR</div>}
                  {plan.save && <p className={`text-xs font-medium mb-2 ${plan.popular ? 'text-emerald-100' : 'text-emerald-600 dark:text-emerald-400'}`}>{plan.save}</p>}
                  <h3 className={`text-lg font-semibold ${plan.popular ? '' : 'text-gray-900 dark:text-white'}`}>{plan.name}</h3>
                  <p className="mt-4"><span className="text-4xl font-bold">₹{plan.price.toLocaleString('en-IN')}</span><span className={`text-sm ${plan.popular ? 'text-emerald-100' : 'text-gray-500 dark:text-gray-400'}`}>{plan.period}</span></p>
                  <ul className={`mt-6 space-y-3 text-sm text-left ${plan.popular ? 'text-emerald-50' : 'text-gray-600 dark:text-gray-400'}`}>
                    {['All 12 modules included', 'Unlimited cattle & records', 'AI Farm Assistant (Gemini)', 'Dudh Khata + Employee Mgmt', '10+ Report dashboards', 'CSV & PDF exports'].map(f => (
                      <li key={f} className="flex items-center gap-2"><FiCheckCircle size={16} className={plan.popular ? 'text-emerald-200' : 'text-emerald-500'} /> {f}</li>
                    ))}
                  </ul>
                  <Link to="/register" className={`mt-8 block py-3 rounded-full font-semibold transition-all hover:scale-105 ${plan.popular ? 'bg-white text-emerald-600 hover:bg-emerald-50' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                    Start Free Trial
                  </Link>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section id="testimonials" className="py-20 px-4 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto">
          <FadeIn>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">What Farmers Say</h2>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Trusted by dairy farmers across India.</p>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((t, i) => (
              <FadeIn key={i} delay={i * 0.15}>
                <motion.div whileHover={{ y: -5 }}
                  className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                  <div className="flex gap-1 mb-3">{[...Array(t.stars || 5)].map((_, j) => <FiStar key={j} size={16} className="text-yellow-400 fill-yellow-400" />)}</div>
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">"{t.text}"</p>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-sm">{t.name?.[0]}</div>
                    <div>
                      <p className="font-semibold text-sm text-gray-900 dark:text-white">{t.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t.location}</p>
                    </div>
                  </div>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="py-20 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <FadeIn>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">Get Started in 3 Steps</h2>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: '1', title: 'Create Account', desc: `Sign up in 30 seconds. Start your ${trialDays}-day free trial instantly.`, emoji: '📝' },
              { step: '2', title: 'Add Your Farm', desc: 'Add your cattle, set up milk recording, and configure your farm.', emoji: '🏠' },
              { step: '3', title: 'Manage & Grow', desc: 'Use smart insights, track finances, and make data-driven decisions.', emoji: '📈' },
            ].map((s, i) => (
              <FadeIn key={s.step} delay={i * 0.2}>
                <div className="text-center">
                  <motion.div initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }}
                    transition={{ type: 'spring', stiffness: 200, delay: i * 0.2 }}
                    className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center mx-auto text-3xl">
                    {s.emoji}
                  </motion.div>
                  <div className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto -mt-4 text-sm font-bold shadow">{s.step}</div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4">{s.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{s.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Contact ─── */}
      <section id="contact" className="py-20 px-4 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto">
          <FadeIn>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">Get in Touch</h2>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Have questions? We're here to help.</p>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              { icon: <FiPhone size={24} />, title: 'Phone', value: phone, sub: 'Mon-Sat, 9am-6pm' },
              { icon: <FiMail size={24} />, title: 'Email', value: email, sub: 'We reply within 24 hours' },
              { icon: <FiMapPin size={24} />, title: 'Location', value: address, sub: 'Serving all of India' },
            ].map((c, i) => (
              <FadeIn key={c.title} delay={i * 0.1}>
                <motion.div whileHover={{ y: -5 }}
                  className="text-center p-6 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                  <div className="mx-auto text-emerald-600 dark:text-emerald-400 flex justify-center">{c.icon}</div>
                  <h3 className="font-semibold mt-3 text-gray-900 dark:text-white">{c.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{c.value}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{c.sub}</p>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-20 px-4 bg-gradient-to-br from-emerald-600 to-emerald-700 dark:from-emerald-800 dark:to-emerald-900 relative overflow-hidden">
        <motion.div className="absolute inset-0 opacity-5" animate={{ rotate: 360 }} transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white rounded-full"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-white rounded-full"></div>
        </motion.div>
        <FadeIn>
          <div className="max-w-3xl mx-auto text-center text-white relative">
            <h2 className="text-3xl sm:text-4xl font-bold">Ready to Transform Your Dairy Farm?</h2>
            <p className="mt-4 text-emerald-100 text-lg">Join hundreds of farmers already using DairyPro to increase productivity and profits.</p>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }} className="inline-block mt-8">
              <Link to="/register" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-emerald-600 rounded-full font-bold text-lg hover:bg-emerald-50 transition shadow-lg">
                Start Your Free Trial <FiArrowRight />
              </Link>
            </motion.div>
            <p className="mt-4 text-emerald-200 text-sm">{trialDays}-day free trial • Cancel anytime • No credit card needed</p>
          </div>
        </FadeIn>
      </section>

      {/* ─── FAQ Section ─── */}
      <section className="py-20 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-extrabold dark:text-white">❓ Frequently Asked Questions</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-3">Everything you need to know about DairyPro</p>
            </div>
          </FadeIn>
          <div className="space-y-4">
            {[
              { q: 'Is DairyPro free to try?', a: `Yes! You get a ${trialDays}-day free trial with full access to all 12 modules. No credit card required.` },
              { q: 'Can I use it on my phone?', a: 'Absolutely! DairyPro is a Progressive Web App (PWA) — install it on your phone like a regular app. Works on Android, iOS, tablet, and desktop.' },
              { q: 'Does it support Hindi?', a: 'Yes! Our AI Farm Assistant understands Hindi, English, and Hinglish. Ask "aaj ka dudh kitna hai?" or "show breeding status" — both work perfectly!' },
              { q: 'How does the AI chatbot work?', a: 'Powered by Google Gemini 2.5 Flash with real-time access to your farm data. It analyzes milk trends, flags health alerts, predicts deliveries, tracks customer dues, monitors employee attendance — and gives actionable recommendations.' },
              { q: 'What is Dudh Khata?', a: 'Dudh Khata (दूध खाता) is our milk delivery management module. Track daily deliveries to households, maintain customer ledgers, record payments, and see outstanding dues at a glance.' },
              { q: 'Can I manage employees?', a: 'Yes! Add staff with roles and salaries, track daily attendance (present/absent/half-day/leave), manage advance payments, and analyze workforce performance through reports.' },
              { q: 'Is my data safe?', a: 'Your data is stored on encrypted MongoDB Atlas. Payments are processed via Razorpay (PCI DSS compliant, RBI regulated). Each farm\'s data is completely isolated.' },
              { q: 'How do I pay for subscription?', a: 'We accept UPI, QR Code scan, debit/credit cards, Paytm, PhonePe, net banking, EMI, and Pay Later — all via Razorpay. Subscription activates instantly after payment.' },
              { q: 'What reports are available?', a: '10+ report dashboards: Milk production trends, health analytics, breeding status, feed cost analysis, employee performance, customer analytics, revenue breakdown, and more. All with interactive charts and CSV/PDF export.' },
              { q: 'Can I track cattle insurance?', a: 'Yes! Record insurance policies with coverage dates, premiums, and provider details. Get alerts before policies expire. The AI chatbot also knows about govt schemes like Pashu Dhan Bima Yojana.' },
              { q: 'How many cattle can I track?', a: 'No limits! Track unlimited cattle — milking, dry, heifers, calves, bulls. Unlimited records across all modules. Every plan includes everything.' },
              { q: 'Can I export my records?', a: 'Yes! Export from any module as CSV or PDF — milk records, health history, employee attendance, financial reports, customer ledgers, and more.' },
            ].map((faq, i) => (
              <FadeIn key={i} delay={i * 0.05}>
                <details className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <summary className="flex items-center justify-between p-5 cursor-pointer font-semibold text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-750 transition">
                    {faq.q}
                    <span className="text-emerald-500 group-open:rotate-45 transition-transform text-xl">+</span>
                  </summary>
                  <div className="px-5 pb-5 text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{faq.a}</div>
                </details>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="py-12 px-4 bg-gray-900 dark:bg-gray-950 text-gray-400 border-t border-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🐄</span>
                <span className="text-lg font-bold text-white">DairyPro</span>
              </div>
              <p className="text-sm leading-relaxed">Smart dairy farm management platform built for Indian farmers.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition">Pricing</a></li>
                <li><Link to="/login" className="hover:text-white transition">Sign In</Link></li>
                <li><Link to="/register" className="hover:text-white transition">Register</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Modules</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition">Cattle & Milk</a></li>
                <li><a href="#features" className="hover:text-white transition">Dudh Khata (दूध खाता)</a></li>
                <li><a href="#features" className="hover:text-white transition">Employees & Attendance</a></li>
                <li><a href="#features" className="hover:text-white transition">AI Farm Assistant</a></li>
                <li><a href="#features" className="hover:text-white transition">Health & Insurance</a></li>
                <li><a href="#features" className="hover:text-white transition">Reports & Analytics</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2"><FiPhone size={14} /> {phone}</li>
                <li className="flex items-center gap-2"><FiMail size={14} /> {email}</li>
                <li className="flex items-center gap-2"><FiMapPin size={14} /> {address}</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
            <p>© {new Date().getFullYear()} DairyPro. All rights reserved. Made with ❤️ for Indian Dairy Farmers.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
