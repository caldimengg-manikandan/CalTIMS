import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  Clock, ArrowRight, Check, Users, FileText, BarChart3,
  Calendar, ChevronDown, LogIn, UserPlus, Menu, X,
  Shield, Zap, TrendingUp, CheckCircle, Star,
  Timer, Briefcase, UserCheck, PlayCircle, Award,
  ChevronRight, Lock, Globe, Cpu, PieChart, Bell, Settings,
  Sun, Moon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';
import { PLAN_FEATURES } from '@/constants/plans';
import { useThemeStore } from '@/store/themeStore';

// ── Pricing reference (non-hardcoded business logic — UI labels only) ─────────
const PLAN_PRICES = {
  TRIAL: { amount: '₹0',  suffix: '',         tagline: 'Free 28 Days' },
  BASIC: { amount: '₹29', suffix: '/ month',  tagline: 'For Per User' },
  PRO:   { amount: '₹49', suffix: '/ month',  tagline: 'For Per User' },
};

const FEATURE_LABELS = {
  timesheets:       'Timesheet Tracking',
  reports:          'Standard Reports',
  advanced_reports: 'Advanced Analytics',
  analytics:        'Dashboard Analytics',
  support:          'Help & Support',
  payroll:          'Payroll Processing',
  leave_management: 'Leave Management',
  payslips:         'Payslip Generation',
  audit_logs:       'Audit Logs',
  ai:               'AI Assistance',
};

const NAV_LINKS = [
  { href: '#features',     label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#pricing',      label: 'Pricing' },
  { href: '#faq',          label: 'FAQ' },
];

const FAQS = [
  {
    q: 'How does the pricing work?',
    a: 'Start free with our Trial plan — no credit card required. Upgrade to Basic or Pro as your team grows. All plans are billed monthly with no hidden fees or long-term commitments.',
  },
  {
    q: 'Do you offer a free trial?',
    a: 'Yes. The Trial plan is free for 28 days and supports up to 10 employees. It gives you full access to nearly all core features so you can test the platform with your core team.',
  },
  {
    q: 'Can managers approve timesheets?',
    a: 'Absolutely. CalTIMS has a built-in approval workflow — employees submit their hours, and managers receive notifications to approve or reject directly from the dashboard.',
  },
  {
    q: 'Is payroll processed inside CalTIMS?',
    a: 'Yes. The Pro and Trial plans include full payroll processing — calculations, payslip generation, and bank-export-ready reports all linked to your approved timesheet data.',
  },
  {
    q: 'Is there a limit on employees?',
    a: 'The Trial plan is limited to 10 employees. Basic and Pro plans scale with your organization — there are no hard limits on team size, and you simply pay for what you use.',
  },
  {
    q: 'How secure is my data?',
    a: 'CalTIMS uses encrypted storage, role-based access control, and comprehensive audit logs to ensure your workforce data is always protected and compliant.',
  },
];

// ── Animation helpers ─────────────────────────────────────────────────────────
const FadeIn = ({ children, delay = 0, className = '', direction = 'up' }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const variants = {
    hidden: {
      opacity: 0,
      y: direction === 'up' ? 24 : direction === 'down' ? -24 : 0,
      x: direction === 'left' ? 28 : direction === 'right' ? -28 : 0,
    },
    visible: { opacity: 1, y: 0, x: 0 },
  };
  return (
    <motion.div
      ref={ref}
      variants={variants}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      transition={{ duration: 0.52, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

const SectionLabel = ({ children, color = 'text-gray-400' }) => (
  <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] ${color} mb-3`}>
    <span className="w-4 h-px bg-current opacity-60" />
    {children}
    <span className="w-4 h-px bg-current opacity-60" />
  </span>
);

const VideoPlayer = ({ className = '' }) => (
  <div className={`relative rounded-3xl overflow-hidden border border-gray-200/80 bg-gray-950 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.18)] ${className}`}>
    <div className="absolute top-0 left-0 right-0 h-10 bg-gray-100/90 flex items-center gap-1.5 px-4 z-10 backdrop-blur-sm border-b border-gray-200/60">
      {['bg-red-400', 'bg-amber-400', 'bg-emerald-400'].map((c) => (
        <span key={c} className={`w-3 h-3 rounded-full ${c}`} />
      ))}
      <span className="ml-3 text-[12px] font-medium text-gray-400">CalTIMS — Time & Workforce Management</span>
    </div>
    <div className="pt-10 aspect-video">
      <video
        src="/assets/images/vid_2.mp4"
        autoPlay
        muted
        loop
        controls
        playsInline
        className="w-full h-full object-cover scale-105 origin-center"
      />
    </div>
  </div>
);

// ── Animated counter ──────────────────────────────────────────────────────────
const AnimatedStat = ({ value, suffix, label }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  return (
    <div ref={ref} className="text-center">
      <motion.div
        className="text-3xl font-extrabold text-gray-900 tracking-tight"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={inView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {value}{suffix}
      </motion.div>
      <p className="text-xs text-gray-500 font-medium mt-1">{label}</p>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate();

  const general     = useSettingsStore((s) => s.general);
  const companyName = general?.branding?.organizationName || general?.organization?.companyName || 'CalTIMS';
  const logoUrl     = general?.branding?.logoUrl;
  const { applyTheme } = useThemeStore();

  const { isAuthenticated, subscription } = useAuthStore();
  const currentPlan = subscription?.planType || null;

  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeFaq,  setActiveFaq]  = useState(null);
  const [scrolled,   setScrolled]   = useState(false);

  const { mode, setMode } = useThemeStore();

  useEffect(() => {
    if (general?.branding) {
      applyTheme(false); // If there are branding elements
      useThemeStore.getState().syncFromBranding(general.branding);
    } else {
      applyTheme(false);
    }
    const fn = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, [applyTheme, general?.branding]);

  // Build plan tiers from PLAN_FEATURES (dynamic — no hardcoded data)
  const pricingTiers = Object.keys(PLAN_FEATURES).map((key) => ({
    key,
    name:        key.charAt(0) + key.slice(1).toLowerCase(),
    price:       PLAN_PRICES[key]?.amount  ?? 'Custom',
    suffix:      PLAN_PRICES[key]?.suffix  ?? '',
    tagline:     PLAN_PRICES[key]?.tagline ?? '',
    features:    Object.entries(PLAN_FEATURES[key])
                   .filter(([k, v]) => v === true && k !== 'maxEmployees')
                   .map(([k]) => FEATURE_LABELS[k] ?? k.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())),
    limit:       key === 'TRIAL' ? `Up to ${PLAN_FEATURES[key].maxEmployees} employees` : null,
    recommended: key === 'PRO',
  }));

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 antialiased selection:bg-gray-900 selection:text-white">

      {/* ── NAVBAR ──────────────────────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-50 w-full transition-all duration-300 ${
          scrolled
            ? 'bg-white/98 dark:bg-gray-950/98 backdrop-blur-md shadow-[0_1px_0_0_#e5e7eb] dark:shadow-[0_1px_0_0_#1e293b]'
            : 'bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm border-b border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-[62px] flex items-center justify-between">
          {/* Logo + Nav */}
          <div className="flex items-center gap-10">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-2.5 focus:outline-none group"
              aria-label="Go to top"
            >
              {logoUrl ? (
                <img src={logoUrl} alt={companyName} className="h-7 object-contain" />
              ) : (
                <>
                  <span className="w-8 h-8 bg-[var(--color-primary)] rounded-[9px] flex items-center justify-center shadow-sm hover:bg-[var(--color-primary-hover)] transition-colors">
                    <Clock className="w-4 h-4 text-white" />
                  </span>
                  <span className="text-[15px] font-bold text-gray-900 dark:text-white tracking-tight">{companyName}</span>
                </>
              )}
            </button>

            <nav className="hidden md:flex items-center gap-0.5">
              {NAV_LINKS.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  className="px-3.5 py-2 text-[13.5px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-all duration-150"
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>

          {/* CTA buttons */}
          <div className="hidden md:flex items-center gap-2">
            <button
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
              onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
            >
              {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              id="nav-login-btn"
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-[13.5px] font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-all"
            >
              Log in
            </button>
            <button
              id="nav-signup-btn"
              onClick={() => navigate('/signup')}
              className="px-5 py-2.5 text-[14px] font-semibold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] rounded-lg transition-all shadow-sm hover:shadow-md hover:-translate-y-px active:scale-[0.97]"
              style={{ '--tw-bg-opacity': 1 }}
            >
              Get started free
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="md:hidden border-t border-gray-100 dark:border-white/5 bg-white dark:bg-gray-950 overflow-hidden"
            >
              <div className="px-5 py-4 space-y-1">
                {NAV_LINKS.map(({ href, label }) => (
                  <a
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg"
                  >
                    {label}
                  </a>
                ))}
                <div className="pt-3 border-t border-gray-100 dark:border-white/5 mt-2 flex flex-col gap-2 pb-4">
                  <button
                    onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
                    className="w-full py-2.5 flex items-center justify-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    {mode === 'dark' ? <><Sun size={16}/> Light Mode</> : <><Moon size={16}/> Dark Mode</>}
                  </button>
                  <button
                    onClick={() => navigate('/login')}
                    className="w-full py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    Log in
                  </button>
                  <button
                    onClick={() => navigate('/signup')}
                    className="w-full py-3 text-[15px] font-semibold text-white bg-[var(--color-primary)] rounded-xl hover:bg-[var(--color-primary-hover)] transition-colors"
                  >
                    Get started free
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="dark:bg-gray-950">

        {/* ── 1. HERO ──────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          {/* Subtle background texture */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#f1f5f9_0%,_transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top_right,_#1e293b_0%,_transparent_60%)] pointer-events-none" />
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-blue-50/40 via-transparent to-transparent dark:from-blue-900/10 dark:via-transparent dark:to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="relative max-w-7xl mx-auto px-5 sm:px-8 pt-16 pb-20 md:pt-24 md:pb-28 grid lg:grid-cols-2 gap-14 items-center">
            {/* Text column */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-7"
            >
              {/* Badge */}
              <div className="inline-flex items-center gap-2 self-start bg-white border border-gray-200 text-gray-600 text-[11.5px] font-semibold px-3.5 py-1.5 rounded-full shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Enterprise-grade workforce management
              </div>

              <div className="space-y-6">
                <h1 className="text-[48px] sm:text-[60px] lg:text-[68px] font-extrabold tracking-[-0.03em] text-gray-900 dark:text-white leading-[1.05]">
                  Effortless Time<br className="hidden sm:block" /> Tracking for<br className="hidden sm:block" />
                  <span className="text-[var(--color-primary)]"> Modern Teams</span>
                </h1>
                <p className="text-[18px] sm:text-[20px] text-gray-500 dark:text-gray-400 leading-[1.7] max-w-[520px]">
                  Track employee work hours, manage projects, and automate payroll with precision — all from one unified platform.
                </p>
              </div>

              {/* CTA buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  id="hero-get-started-btn"
                  onClick={() => navigate('/signup')}
                  className="inline-flex items-center gap-2 px-8 h-14 bg-[var(--color-primary)] text-white text-[15px] font-semibold rounded-xl hover:bg-[var(--color-primary-hover)] active:scale-[0.97] transition-all shadow-sm hover:shadow-md"
                >
                  Get started free <ArrowRight size={18} className="mt-px" />
                </button>
                <button
                  id="hero-login-btn"
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center gap-2 px-6 h-12 border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 text-[14px] font-semibold rounded-xl hover:border-gray-300 dark:hover:border-white/20 hover:bg-gray-50 dark:hover:bg-white/10 active:scale-[0.97] transition-all"
                >
                  <LogIn size={15} /> Log in
                </button>
              </div>

              {/* Social proof micro-copy */}
              <div className="flex flex-wrap items-center gap-4 text-[12px] text-gray-400 font-medium pt-1">
                {['No credit card required', 'Free plan available', 'Setup in minutes'].map((t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <CheckCircle size={12} className="text-emerald-500" /> {t}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* Video column */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="w-full xl:ml-8"
            >
              <div className="relative group">
                {/* Glow behind video */}
                <div className="absolute -inset-6 bg-gradient-to-br from-blue-50 via-violet-50/20 to-transparent rounded-3xl blur-3xl -z-10 opacity-70" />
                <div className="transition-transform duration-500 ease-out group-hover:scale-[1.015]">
                  <VideoPlayer />
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── 2. TRUST / VALUE STRIP ─────────────────────────────────────────── */}
        <section className="border-y border-gray-100 dark:border-white/5 bg-gray-50/80 dark:bg-white/5">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-5">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-5 sm:gap-10">
              <span className="text-gray-300 dark:text-gray-600 font-semibold uppercase text-[10px] tracking-[0.18em] shrink-0">
                Trusted for workforce management
              </span>
              <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-3">
                {[
                  { icon: Timer,      label: 'Accurate time tracking'   },
                  { icon: TrendingUp, label: 'Real-time insights'       },
                  { icon: Shield,     label: 'Enterprise security'      },
                  { icon: Zap,        label: 'Instant payroll runs'     },
                  { icon: Globe,      label: 'Role-based access control' },
                ].map(({ icon: Icon, label }) => (
                  <span key={label} className="flex items-center gap-2 text-[13px] text-gray-500 dark:text-gray-400 font-medium">
                    <Icon size={14} className="text-gray-400 dark:text-gray-500" /> {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. FEATURES (ALTERNATING LAYOUT) ─────────────────────────────── */}
        <section id="features">

          {/* ── Feature 1: Track Time ─── */}
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-20 lg:py-28 grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
            <FadeIn direction="right">
              <SectionLabel>Time Tracking</SectionLabel>
              <h2 className="text-[30px] sm:text-[34px] font-bold text-gray-900 dark:text-white mb-4 leading-tight tracking-tight">
                Track Time — Effortlessly
              </h2>
              <p className="text-[15.5px] text-gray-500 dark:text-gray-400 leading-[1.75] mb-6 max-w-[460px]">
                Give your employees a simple, intuitive interface to log their daily work hours from anywhere — desktop or mobile. CalTIMS captures every minute accurately, from clock-in to clock-out, so you never miss billable time or compliance windows.
              </p>
              <ul className="space-y-3">
                {[
                  'One-click timesheet entry',
                  'Project and task-level tracking',
                  'Manager approval workflows',
                  'Overtime detection and alerts',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-[13.5px] text-gray-700 dark:text-gray-300 font-medium">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-sm shadow-emerald-200">
                      <Check size={11} className="text-white" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </FadeIn>

            <FadeIn direction="left" delay={0.1}>
              <div className="relative rounded-2xl overflow-hidden border border-gray-100 dark:border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.1)] group">
                <div className="absolute inset-0 bg-gray-900/5 dark:bg-white/5 group-hover:bg-transparent transition-colors duration-300 z-10 pointer-events-none" />
                <img
                  src="/assets/images/timesheet.png"
                  alt="Timesheet Entry Interface showing week view and project selection"
                  className="w-full h-auto object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=2670&auto=format&fit=crop';
                  }}
                />
              </div>
            </FadeIn>
          </div>

          {/* ── Feature 2: Manage Teams ─── */}
          <div className="bg-gray-50/80 dark:bg-white/5 border-y border-gray-100 dark:border-white/5">
            <div className="max-w-7xl mx-auto px-5 sm:px-8 py-20 lg:py-28 grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
              <FadeIn direction="right" delay={0.05}>
                <div className="relative rounded-2xl overflow-hidden border border-gray-100 dark:border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.1)] group">
                  <div className="absolute inset-0 bg-gray-900/5 dark:bg-white/5 group-hover:bg-transparent transition-colors duration-300 z-10 pointer-events-none" />
                  <img
                    src="/assets/images/dashboard.png"
                    alt="CalTIMS Dashboard showing personalized KPI widgets, active staff, and pending approvals"
                    className="w-full h-auto object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2670&auto=format&fit=crop';
                    }}
                  />
                </div>
              </FadeIn>

              <FadeIn direction="left" delay={0.1}>
                <SectionLabel>Team & Project Management</SectionLabel>
                <h2 className="text-[30px] sm:text-[34px] font-bold text-gray-900 dark:text-white mb-4 leading-tight tracking-tight">
                  Manage Teams<br /> & Projects
                </h2>
                <p className="text-[15.5px] text-gray-500 dark:text-gray-400 leading-[1.75] mb-6 max-w-[460px]">
                  Organize your workforce into teams, assign projects, and track progress in real time. CalTIMS gives managers full visibility into who's working on what — so resources are always optimally allocated and deadlines are never missed.
                </p>
                <ul className="space-y-3">
                  {[
                    'Personalized management dashboard',
                    'At-a-glance pending compliance approvals',
                    'Real-time active staff visibility',
                    'Visualized hourly productivity trends',
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-3 text-[13.5px] text-gray-700 dark:text-gray-300 font-medium">
                      <span className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                        <Check size={11} className="text-blue-600 dark:text-blue-400" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </FadeIn>
            </div>
          </div>

          {/* ── Feature 3: Automate Payroll ─── */}
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-20 lg:py-28 grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
            <FadeIn direction="right">
              <SectionLabel>Payroll Automation</SectionLabel>
              <h2 className="text-[30px] sm:text-[34px] font-bold text-gray-900 dark:text-white mb-4 leading-tight tracking-tight">
                Automate Payroll —<br /> End to End
              </h2>
              <p className="text-[15.5px] text-gray-500 dark:text-gray-400 leading-[1.75] mb-6 max-w-[460px]">
                Once timesheets are approved, payroll runs itself. CalTIMS automatically calculates gross pay, deductions, taxes, and net salary — then generates professional payslips ready for distribution. Eliminate manual spreadsheets and payroll errors for good.
              </p>
              <ul className="space-y-3">
                {[
                  'Linked to approved timesheets',
                  'Automated tax & deduction calculation',
                  'One-click payslip generation',
                  'Bank-export ready reports',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-[13.5px] text-gray-700 dark:text-gray-300 font-medium">
                    <span className="w-5 h-5 rounded-full bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center flex-shrink-0">
                      <Check size={11} className="text-violet-600 dark:text-violet-400" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </FadeIn>

            <FadeIn direction="left" delay={0.1}>
              <div className="bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)] space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-gray-50 dark:border-white/5">
                  <div>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-widest">Payroll Run</p>
                    <p className="text-[13.5px] font-bold text-gray-900 dark:text-white mt-0.5">April 2026</p>
                  </div>
                  <span className="text-[11px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-500/20">Processed ✓</span>
                </div>
                {[
                  { name: 'Alice Johnson', role: 'Engineer',   net: '$4,200', status: 'Paid' },
                  { name: 'Bob Smith',     role: 'Designer',   net: '$3,800', status: 'Paid' },
                  { name: 'Carol White',   role: 'Manager',    net: '$5,100', status: 'Paid' },
                ].map(({ name, role, net, status }) => (
                  <div key={name} className="flex items-center justify-between bg-gray-50 dark:bg-white/5 rounded-xl px-4 py-3 border border-gray-100 dark:border-white/5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center text-[11px] font-bold text-gray-600 dark:text-gray-400">{name[0]}</div>
                      <div>
                        <p className="text-[12.5px] font-semibold text-gray-800 dark:text-gray-200">{name}</p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">{role}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-bold text-gray-900 dark:text-white">{net}</p>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{status}</p>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 dark:bg-black rounded-xl border dark:border-white/5">
                  <span className="text-[12px] font-semibold text-gray-400 dark:text-gray-500">Total disbursed</span>
                  <span className="text-[14px] font-extrabold text-white">$13,100</span>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ── 4. USE CASES ────────────────────────────────────────────────────── */}
        <section className="bg-gray-50/80 dark:bg-white/5 border-y border-gray-100 dark:border-white/5">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-20 lg:py-24">
            <FadeIn className="text-center max-w-xl mx-auto mb-14">
              <SectionLabel>Built for everyone</SectionLabel>
              <h2 className="text-[30px] sm:text-[36px] font-bold text-gray-900 dark:text-white mb-3 tracking-tight">Who uses {companyName}?</h2>
              <p className="text-[15.5px] text-gray-500 dark:text-gray-400 leading-[1.7]">
                Whether you're in HR, leading a team, or clocking in daily — CalTIMS works for you.
              </p>
            </FadeIn>

            <div className="grid md:grid-cols-3 gap-5">
              {[
                {
                  icon: UserCheck,
                  title: 'HR Teams',
                  color: 'text-violet-600',
                  iconBg: 'bg-violet-50',
                  borderAccent: 'border-violet-100 hover:border-violet-200',
                  desc: 'Centralize employee records, manage leave policies, and generate compliance reports with zero manual effort. CalTIMS gives HR full control over the workforce lifecycle — from onboarding to payroll.',
                  benefits: ['Employee records', 'Leave management', 'Compliance reports'],
                },
                {
                  icon: Briefcase,
                  title: 'Managers',
                  color: 'text-blue-600',
                  iconBg: 'bg-blue-50',
                  borderAccent: 'border-blue-100 hover:border-blue-200',
                  desc: 'Review and approve timesheets, monitor project progress, and keep your team on track — all from a single, clean dashboard. Spot issues before they become costly delays.',
                  benefits: ['Timesheet approvals', 'Project monitoring', 'Team visibility'],
                },
                {
                  icon: Timer,
                  title: 'Employees',
                  color: 'text-emerald-600',
                  iconBg: 'bg-emerald-50',
                  borderAccent: 'border-emerald-100 hover:border-emerald-200',
                  desc: 'Log hours in seconds, request leave, and download your payslip without chasing anyone. CalTIMS puts employees in control of their own time and information.',
                  benefits: ['Clock-in/out', 'Leave requests', 'Payslip access'],
                },
              ].map(({ icon: Icon, title, color, iconBg, borderAccent, desc, benefits }, i) => (
                <FadeIn key={title} delay={i * 0.1}>
                  <div className={`bg-white dark:bg-white/5 p-7 rounded-2xl border border-gray-100 dark:border-white/10 ${borderAccent} shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-full flex flex-col group`}>
                    <div className={`w-12 h-12 ${iconBg} dark:bg-white/10 rounded-xl flex items-center justify-center ${color} mb-5 group-hover:scale-110 transition-transform`}>
                      <Icon size={24} />
                    </div>
                    <h3 className="text-[16px] font-bold text-gray-900 dark:text-white mb-3">{title}</h3>
                    <p className="text-[13.5px] text-gray-500 dark:text-gray-400 leading-[1.75] mb-5 flex-1">{desc}</p>
                    <ul className="space-y-2 border-t border-gray-50 dark:border-white/10 pt-4">
                      {benefits.map((b) => (
                        <li key={b} className={`flex items-center gap-2 text-[12.5px] ${color} font-semibold`}>
                          <ChevronRight size={12} /> {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── 5. HOW IT WORKS ─────────────────────────────────────────────────── */}
        <section id="how-it-works">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-20 lg:py-28">
            <FadeIn className="text-center max-w-xl mx-auto mb-16">
              <SectionLabel>Simple workflow</SectionLabel>
              <h2 className="text-[30px] sm:text-[36px] font-bold text-gray-900 dark:text-white mb-3 tracking-tight">
                How {companyName} works
              </h2>
              <p className="text-[15.5px] text-gray-500 dark:text-gray-400 leading-[1.7]">
                Three steps from sign-up to payroll. No training required.
              </p>
            </FadeIn>

            <div className="grid md:grid-cols-3 gap-8 relative">
              {/* Connector line */}
              <div className="hidden md:block absolute top-9 left-[calc(16.7%+28px)] right-[calc(16.7%+28px)] h-px bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-white/5 dark:via-white/20 dark:to-white/5" />

              {[
                {
                  icon: Timer,
                  step: '01',
                  title: 'Log Work Hours',
                  desc: 'Employees submit their daily or weekly hours through a clean, simple interface. CalTIMS ensures every minute is captured accurately across devices.',
                  color: 'bg-blue-600',
                },
                {
                  icon: CheckCircle,
                  step: '02',
                  title: 'Manage Approvals',
                  desc: 'Managers receive instant notifications and approve or reject timesheets with one click. Full history and comment trail kept automatically.',
                  color: 'bg-violet-600',
                },
                {
                  icon: FileText,
                  step: '03',
                  title: 'Generate Payroll',
                  desc: 'Approved hours feed directly into payroll. Salary calculations, deductions, and payslips are generated automatically — no spreadsheets.',
                  color: 'bg-emerald-600',
                },
              ].map(({ icon: Icon, step, title, desc, color }, i) => (
                <FadeIn key={step} delay={i * 0.14} className="flex flex-col items-center text-center">
                  <div className="relative mb-6 z-10">
                    <div className={`w-[60px] h-[60px] rounded-full ${color} text-white flex items-center justify-center ring-8 ring-white shadow-lg`}>
                      <Icon size={22} />
                    </div>
                    <span className="absolute -top-1 -right-1 text-[10px] font-black text-gray-500 bg-white border border-gray-200 rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="text-[16px] font-bold text-gray-900 mb-2">{title}</h3>
                  <p className="text-[13.5px] text-gray-500 leading-[1.75] max-w-[240px]">{desc}</p>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── 6. DEMO VIDEO HIGHLIGHT ──────────────────────────────────────────── */}
        <section className="bg-gray-950">
          <div className="max-w-5xl mx-auto px-5 sm:px-8 py-20 lg:py-28">
            <FadeIn className="text-center mb-10">
              <div className="inline-flex items-center gap-2 text-gray-400 text-[12.5px] font-semibold mb-4 uppercase tracking-widest">
                <PlayCircle size={14} className="text-gray-500" /> Product demo
              </div>
              <h2 className="text-[28px] sm:text-[36px] font-bold text-white mb-3 tracking-tight">
                See {companyName} in action
              </h2>
              <p className="text-[15px] text-gray-400 max-w-md mx-auto leading-[1.7]">
                Watch how teams use CalTIMS to track time, manage projects, and run payroll — all in one place.
              </p>
            </FadeIn>
            <FadeIn delay={0.1} className="max-w-4xl mx-auto">
              <VideoPlayer className="shadow-[0_40px_80px_rgba(0,0,0,0.4)]" />
            </FadeIn>
            {/* CTA below video */}
            <FadeIn delay={0.2} className="text-center mt-10">
              <button
                onClick={() => navigate('/signup')}
                className="inline-flex items-center gap-2 px-8 h-14 bg-[var(--color-primary)] text-white text-[15px] font-semibold rounded-xl hover:bg-[var(--color-primary-hover)] active:scale-[0.97] transition-all"
              >
                Try it yourself <ArrowRight size={15} />
              </button>
            </FadeIn>
          </div>
        </section>

        {/* ── 7. PRICING ──────────────────────────────────────────────────────── */}
        <section id="pricing">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-20 lg:py-28">
            <FadeIn className="text-center max-w-xl mx-auto mb-4">
              <SectionLabel>Pricing</SectionLabel>
              <h2 className="text-[30px] sm:text-[36px] font-bold text-gray-900 dark:text-white mb-3 tracking-tight">
                Simple, transparent pricing
              </h2>
              <p className="text-[15.5px] text-gray-500 dark:text-gray-400">Start free. Scale as your team grows. No surprises.</p>
            </FadeIn>

            {/* Current plan badge (dynamic, only shown when authenticated) */}
            {isAuthenticated && currentPlan && (
              <FadeIn className="flex justify-center mt-6 mb-2">
                <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-[13px] font-semibold px-4 py-2 rounded-full border border-emerald-200">
                  <Check size={13} /> You're on: {currentPlan.charAt(0) + currentPlan.slice(1).toLowerCase()} plan
                </div>
              </FadeIn>
            )}

            <div className="grid md:grid-cols-3 gap-6 items-stretch mt-12">
              {pricingTiers.map((tier, i) => {
                const isActive = isAuthenticated && currentPlan === tier.key;
                // ── per-plan button config ───────────────────────────────
                const btnClass = isActive
                  ? 'w-full py-3.5 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-400 dark:text-gray-600 cursor-default'
                  : tier.key === 'TRIAL'
                    ? 'w-full py-3.5 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10 hover:border-gray-400 transition-all duration-200 active:scale-[0.97]'
                    : tier.key === 'BASIC'
                      ? 'w-full py-3.5 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-200 transition-all duration-200 active:scale-[0.97]'
                      : 'w-full py-3.5 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] shadow-[0_4px_18px_rgba(59,130,246,0.3)] hover:shadow-[0_6px_24px_rgba(59,130,246,0.45)] transition-all duration-200 active:scale-[0.97]';

                const btnLabel = isActive
                  ? <><Check size={14} /> Current Plan</>
                  : tier.key === 'TRIAL'
                    ? <>Start free <ArrowRight size={15} /></>
                    : tier.key === 'BASIC'
                      ? <>Get Basic <ArrowRight size={15} /></>
                      : <>Get Pro <ArrowRight size={15} /></>;

                return (
                  <FadeIn key={tier.key} delay={i * 0.1} className="h-full">
                    <div
                      className={`relative bg-white dark:bg-white/5 rounded-2xl border flex flex-col h-full transition-all duration-300 overflow-hidden ${
                        tier.recommended
                          ? 'border-[var(--color-primary)] shadow-[0_8px_32px_rgba(59,130,246,0.14)]'
                          : 'border-gray-200 dark:border-white/10 shadow-sm hover:shadow-lg hover:-translate-y-0.5'
                      }`}
                    >
                      {/* Most popular banner — absolute so it never shifts content height */}
                      {tier.recommended && (
                        <div className="absolute top-0 left-0 right-0 bg-[var(--color-primary)] text-white text-[10px] font-black px-4 py-2 text-center uppercase tracking-[0.22em] z-10">
                          ★ Most Popular
                        </div>
                      )}

                      {/* Active badge */}
                      {isActive && (
                        <div className="absolute top-3.5 right-4 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1 z-20">
                          <Check size={9} /> Active
                        </div>
                      )}

                      {/* pt-14 on ALL cards keeps plan name at same vertical position */}
                      <div className="p-8 pt-14 flex flex-col flex-1">

                        {/* Plan name + price */}
                        <div className="mb-5">
                          <p className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.18em] mb-2">{tier.name}</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-[44px] font-extrabold tracking-tight text-gray-900 dark:text-white leading-none">{tier.price}</span>
                            {tier.suffix && <span className="text-gray-400 dark:text-gray-500 text-[13px] font-medium ml-1">{tier.suffix}</span>}
                          </div>
                          <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-1.5 font-medium">{tier.tagline}</p>

                          {tier.limit ? (
                            <div className="mt-3 inline-flex items-center gap-1.5 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 px-3 py-1.5 rounded-lg">
                              <Users size={11} className="text-gray-400 dark:text-gray-500" />
                              <span className="text-[11.5px] text-gray-600 dark:text-gray-400 font-semibold">{tier.limit}</span>
                            </div>
                          ) : (
                            <div className="mt-3 h-[30px]" />
                          )}
                        </div>

                        {/* Subtle divider */}
                        <div className="h-px bg-gray-100 dark:bg-white/5 mb-5" />

                        {/* Feature list — flex-1 stretches this so buttons are all pinned to the bottom */}
                        <ul className="space-y-2.5 flex-1 mb-8">
                          {tier.features.map((f) => (
                            <li key={f} className="flex items-start gap-2.5 text-[13px] text-gray-600 dark:text-gray-400">
                              <Check size={13} className={`mt-0.5 shrink-0 ${tier.recommended ? 'text-[var(--color-primary)]' : 'text-gray-500 dark:text-gray-500'}`} />
                              {f}
                            </li>
                          ))}
                        </ul>

                        {/* CTA button */}
                        <button
                          id={`pricing-cta-${tier.key.toLowerCase()}`}
                          disabled={isActive}
                          onClick={() => !isActive && navigate('/signup')}
                          className={btnClass}
                        >
                          {btnLabel}
                        </button>
                      </div>
                    </div>
                  </FadeIn>
                );
              })}
            </div>

            {/* Bottom note */}
            {/* <FadeIn className="text-center mt-8">
              <p className="text-[12px] text-gray-400 font-medium">
                All plans include a 14-day free trial · No credit card required · Cancel anytime
              </p>
            </FadeIn> */}
          </div>
        </section>

        {/* ── 8. BENEFITS SECTION ──────────────────────────────────────────────── */}
        <section className="bg-gray-50/80 dark:bg-white/5 border-y border-gray-100 dark:border-white/5">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-20 lg:py-24">
            <FadeIn className="text-center max-w-xl mx-auto mb-14">
              <SectionLabel>Why CalTIMS</SectionLabel>
              <h2 className="text-[30px] sm:text-[36px] font-bold text-gray-900 dark:text-white mb-3 tracking-tight">
                Real outcomes for your business
              </h2>
              <p className="text-[15.5px] text-gray-500 dark:text-gray-400 leading-[1.7]">
                CalTIMS isn't just software — it's a systematic improvement to how your organisation runs.
              </p>
            </FadeIn>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: Zap,
                  color: 'text-amber-600',
                  iconBg: 'bg-amber-50',
                  border: 'hover:border-amber-200',
                  title: 'Save Time',
                  desc: 'Eliminate manual data entry, chasing approvals, and spreadsheet errors. What used to take hours now takes minutes — freeing your team to focus on high-value work instead of administrative overhead.',
                  stat: '80%', statLabel: 'less admin time reported',
                },
                {
                  icon: BarChart3,
                  color: 'text-blue-600',
                  iconBg: 'bg-blue-50',
                  border: 'hover:border-blue-200',
                  title: 'Reduce Manual Work',
                  desc: 'Automate the entire workflow from timesheet submission to payslip distribution. CalTIMS handles the repetitive tasks so your HR and finance teams never have to again.',
                  stat: '3x', statLabel: 'faster payroll processing',
                },
                {
                  icon: Award,
                  color: 'text-violet-600 dark:text-violet-400',
                  iconBg: 'bg-violet-50 dark:bg-violet-900/20',
                  border: 'hover:border-violet-200 dark:hover:border-violet-800',
                  title: 'Improve Accuracy',
                  desc: 'Calculations are always correct. Approved hours feed directly into payroll with no rounding errors, missing entries, or compliance gaps — giving you confidence in every single run.',
                  stat: '99.9%', statLabel: 'payroll accuracy rate',
                },
              ].map(({ icon: Icon, color, iconBg, border, title, desc, stat, statLabel }, i) => (
                <FadeIn key={title} delay={i * 0.1}>
                  <div className={`bg-white dark:bg-white/5 p-7 rounded-2xl border border-gray-100 dark:border-white/10 ${border} shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-full flex flex-col group`}>
                    <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center ${color} mb-5 group-hover:scale-110 transition-transform`}>
                      <Icon size={24} />
                    </div>
                    <h3 className="text-[16px] font-bold text-gray-900 dark:text-white mb-3">{title}</h3>
                    <p className="text-[13.5px] text-gray-500 dark:text-gray-400 leading-[1.75] flex-1">{desc}</p>
                    <div className={`mt-6 pt-5 border-t border-gray-50 dark:border-white/10`}>
                      <span className={`text-[28px] font-extrabold ${color} tracking-tight`}>{stat}</span>
                      <p className="text-[12px] text-gray-400 dark:text-gray-500 font-medium mt-0.5">{statLabel}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── 9. FAQ ───────────────────────────────────────────────────────────── */}
        <section id="faq">
          <div className="max-w-2xl mx-auto px-5 sm:px-8 py-20 lg:py-28">
            <FadeIn className="text-center mb-12">
              <SectionLabel>FAQ</SectionLabel>
              <h2 className="text-[30px] sm:text-[36px] font-bold text-gray-900 dark:text-white mb-3 tracking-tight">
                Frequently asked questions
              </h2>
              <p className="text-[15.5px] text-gray-500 dark:text-gray-400">Everything you need to know before getting started.</p>
            </FadeIn>

            <div className="space-y-2">
              {FAQS.map(({ q, a }, i) => (
                <FadeIn key={i} delay={i * 0.04}>
                  <div className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-white/5 hover:border-gray-300 dark:hover:border-white/20 transition-colors">
                    <button
                      className="w-full flex items-center justify-between px-6 py-4.5 text-left hover:bg-gray-50/80 dark:hover:bg-white/10 transition-colors focus:outline-none"
                      style={{ paddingTop: '16px', paddingBottom: '16px' }}
                      onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                    >
                      <span className="font-semibold text-gray-900 dark:text-white text-[13.5px] pr-6 leading-snug">{q}</span>
                      <span className={`flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center transition-all duration-200 ${activeFaq === i ? 'bg-gray-900 dark:bg-[var(--color-primary)]' : ''}`}>
                        <ChevronDown size={13} className={`transition-transform duration-200 ${activeFaq === i ? 'rotate-180 text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {activeFaq === i && (
                        <motion.div
                          key="ans"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: 'easeOut' }}
                          className="overflow-hidden"
                        >
                          <p className="px-6 pb-5 text-[13.5px] text-gray-500 dark:text-gray-400 leading-[1.75] border-t border-gray-50 dark:border-white/10 pt-3">{a}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </FadeIn>
              ))}
            </div>

            <FadeIn delay={0.2} className="text-center mt-8">
              <p className="text-[13px] text-gray-400">
                Still have questions?{' '}
                <a href="mailto:support@caltims.com" className="text-gray-700 font-semibold hover:underline">
                  Contact support →
                </a>
              </p>
            </FadeIn>
          </div>
        </section>

        {/* ── 10. FINAL CTA ────────────────────────────────────────────────────── */}
        <section className="bg-gray-50 dark:bg-white/5 border-t border-gray-100 dark:border-white/5">
          <div className="max-w-4xl mx-auto px-5 sm:px-8 py-24 lg:py-28 text-center">
            <FadeIn>
              <div className="inline-flex items-center gap-2 bg-white dark:bg-white/10 text-gray-500 dark:text-gray-400 text-[11.5px] font-semibold px-3.5 py-1.5 rounded-full border border-gray-200 dark:border-white/10 shadow-sm mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Ready to get started?
              </div>

              <h2 className="text-[36px] sm:text-[44px] font-extrabold tracking-tight text-gray-900 dark:text-white mb-5 leading-[1.08]">
                Start managing your<br className="hidden sm:block" /> workforce smarter
              </h2>
              <p className="text-[17px] text-gray-500 dark:text-gray-400 mb-10 max-w-lg mx-auto leading-[1.7]">
                Join teams already using {companyName} to save time, run payroll, and stay organised.
              </p>

              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <button
                  id="cta-get-started-btn"
                  onClick={() => navigate('/signup')}
                  className="inline-flex items-center justify-center gap-2 px-8 h-14 bg-[var(--color-primary)] text-white text-[15px] font-semibold rounded-xl hover:bg-[var(--color-primary-hover)] active:scale-[0.97] transition-all shadow-sm hover:shadow-md"
                  style={{ height: '56px' }}
                >
                  <UserPlus size={18} /> Get started free
                </button>
                <button
                  id="cta-login-btn"
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center justify-center gap-2 px-8 h-14 border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 text-[15px] font-semibold rounded-xl hover:bg-white dark:hover:bg-white/10 hover:border-gray-300 dark:hover:border-white/20 active:scale-[0.97] transition-all"
                  style={{ height: '56px' }}
                >
                  <LogIn size={18} /> Log in
                </button>
              </div>

              <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-6 font-medium">
                No credit card required · Free plan available · Setup in under 5 minutes
              </p>
            </FadeIn>
          </div>
        </section>

      </main>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-white/5">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-5 text-[13px] text-gray-400">
            {/* Brand */}
            <div className="flex items-center gap-2 font-semibold text-gray-600 dark:text-gray-400">
              {logoUrl ? (
                <img src={logoUrl} alt={companyName} className="h-5 object-contain" />
              ) : (
                <>
                  <span className="w-6 h-6 bg-gray-900 dark:bg-white/10 rounded-md flex items-center justify-center">
                    <Clock size={12} className="text-white" />
                  </span>
                  {companyName}
                </>
              )}
            </div>

            {/* Copyright */}
            <span className="text-gray-400 dark:text-gray-600">
              © {new Date().getFullYear()} {companyName}. All rights reserved.
            </span>

            {/* Links */}
            <div className="flex items-center gap-6 font-medium">
              {['Privacy', 'Terms', 'Contact'].map((l) => (
                <a key={l} href="#" className="hover:text-gray-700 dark:hover:text-white transition-colors">
                  {l}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
