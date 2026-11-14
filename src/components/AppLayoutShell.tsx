'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  KanbanSquare,
  Users,
  Upload,
  Briefcase,
  Clock,
  FileText,
  ShieldAlert,
  Settings,
  UserCheck,
  ListTodo,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sun,
  Moon,
  Laptop,
  Menu,
  X,
  KeyRound,
  User as UserIcon,
  Shield,
  HelpCircle,
  ExternalLink,
  Check,
  Activity,
} from 'lucide-react';
import { BUILD_STAMP } from '@/lib/version';
import { COMPANY_NAME } from '@/lib/brand';
import { SessionData } from '@/lib/auth';
import { ChangePasswordModal } from './ChangePasswordModal';
import { UserProfileModal } from './UserProfileModal';
import { CompanyLogo } from './CompanyLogo';
import { useToast } from './ToastProvider';

interface AppLayoutShellProps {
  children: React.ReactNode;
}

type ThemeMode = 'light' | 'dark' | 'system';

export function AppLayoutShell({ children }: AppLayoutShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [user, setUser] = useState<SessionData | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const hasAutoPromptedRef = useRef(false);

  // 3-way Theme state
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Modals state
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Determine if this is a standalone public page
  const isPublicPage = pathname === '/login' || pathname.startsWith('/apply/');

  // Apply theme to DOM and dispatch event
  const applyTheme = (mode: ThemeMode) => {
    let dark = false;
    if (mode === 'dark') {
      dark = true;
    } else if (mode === 'light') {
      dark = false;
    } else {
      dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }

    setIsDarkMode(dark);
    window.dispatchEvent(
      new CustomEvent('hireflow-theme-change', {
        detail: { isDark: dark, mode },
      })
    );
  };

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem('hireflow_theme_preference', mode);
    localStorage.setItem('hireflow_theme', mode === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode);
    applyTheme(mode);
  };

  // Cycle theme via single button: light -> dark -> system -> light
  const cycleTheme = () => {
    if (themeMode === 'light') {
      setThemeMode('dark');
    } else if (themeMode === 'dark') {
      setThemeMode('system');
    } else {
      setThemeMode('light');
    }
  };

  // Initialize theme preference on mount
  useEffect(() => {
    const saved = (localStorage.getItem('hireflow_theme_preference') || localStorage.getItem('hireflow_theme')) as ThemeMode | null;
    const initialMode: ThemeMode = saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
    setThemeModeState(initialMode);
    applyTheme(initialMode);

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e: MediaQueryListEvent) => {
      const currentPref = localStorage.getItem('hireflow_theme_preference');
      if (currentPref === 'system' || !currentPref) {
        applyTheme('system');
      }
    };

    mql.addEventListener('change', handleSystemChange);
    return () => mql.removeEventListener('change', handleSystemChange);
  }, []);

  // Fetch current user session
  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser({
            userId: data.user.id,
            email: data.user.email,
            name: data.user.full_name,
            role: data.user.role,
            loginTime: Date.now(),
            lastActiveTime: Date.now(),
            mustChangePassword: data.user.must_change_password,
          });

          // If must change password, open modal once on login (never re-prompt on navigation)
          if (data.user.must_change_password && !hasAutoPromptedRef.current) {
            hasAutoPromptedRef.current = true;
            setPasswordModalOpen(true);
          }
        } else {
          setUser(null);
          if (!isPublicPage) {
            router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
          }
        }
      } else {
        setUser(null);
        if (!isPublicPage) {
          router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
        }
      }
    } catch (err) {
      console.error('Session verification error', err);
    } finally {
      setLoadingUser(false);
    }
  };

  useEffect(() => {
    if (!isPublicPage) {
      fetchSession();
    } else {
      setLoadingUser(false);
    }
  }, [pathname, isPublicPage]);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setUserDropdownOpen(false);
      setProfileModalOpen(false);
      toast.success('Signed out successfully.');
      router.push('/login');
    } catch (err) {
      console.error('Logout error', err);
      toast.success('Signed out successfully.');
      router.push('/login');
    }
  };

  if (isPublicPage) {
    return (
      <main className="min-h-screen bg-background text-primary transition-colors">
        {children}
      </main>
    );
  }

  const navItems = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'My Queue', href: '/queue', icon: ListTodo },
    { label: 'Pipeline Board', href: '/pipeline', icon: KanbanSquare },
    { label: 'Candidates', href: '/candidates', icon: Users },
    { label: 'WorkIndia Import', href: '/import', icon: Upload },
    { label: 'Jobs & Rules', href: '/jobs', icon: Briefcase },
    { label: 'Follow-ups (24h)', href: '/followups', icon: Clock },
    { label: 'Templates & Tones', href: '/templates', icon: FileText },
    { label: 'Company Settings', href: '/settings', icon: Settings, adminOnly: true },
    { label: 'HR Users', href: '/users', icon: UserCheck, adminOnly: true },
    { label: 'Audit Trail', href: '/audit', icon: ShieldAlert, adminOnly: true },
    { label: 'System Health', href: '/health', icon: Activity, adminOnly: true },
  ];

  const visibleNavItems = navItems.filter(
    (item) => !item.adminOnly || user?.role === 'admin'
  );

  return (
    <div className="min-h-screen bg-background text-primary transition-colors flex flex-col">
      <div className="flex flex-1 relative overflow-hidden">
        {/* ======================================================== */}
        {/* DESKTOP COLLAPSIBLE LEFT SIDEBAR */}
        {/* ======================================================== */}
        <aside
          className={`hidden lg:flex flex-col border-r border-border bg-surface transition-all duration-200 shrink-0 select-none z-30 h-screen sticky top-0 ${
            collapsed ? 'w-[72px]' : 'w-64'
          }`}
        >
          {/* Brand Header */}
          <div className="min-h-16 py-2.5 flex items-center justify-between px-4 border-b border-border shrink-0">
            <Link href="/" className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
              <CompanyLogo
                size="md"
                showText={!collapsed}
                markOnly={collapsed}
                companyName={COMPANY_NAME}
                tagline="Recruitment Desk"
              />
            </Link>

            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-surface-hover transition"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Navigation Links (Scrollable middle) */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? 'bg-brand/10 text-brand font-bold shadow-2xs'
                      : 'text-secondary hover:text-primary hover:bg-surface-hover'
                  } ${collapsed ? 'justify-center px-0' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand' : ''}`} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Bottom Pinned Actions: Theme, User Profile & Prominent Sign Out */}
          <div className="p-3 border-t border-border space-y-2.5 shrink-0 bg-surface">
            {/* Theme Selector */}
            {!collapsed ? (
              <div className="grid grid-cols-3 gap-1 bg-surface-raised p-1 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setThemeMode('light')}
                  className={`flex items-center justify-center gap-1 py-1 rounded-lg text-[11px] font-semibold transition ${
                    themeMode === 'light'
                      ? 'bg-surface text-primary shadow-2xs font-bold'
                      : 'text-secondary hover:text-primary'
                  }`}
                  title="Light theme"
                >
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('dark')}
                  className={`flex items-center justify-center gap-1 py-1 rounded-lg text-[11px] font-semibold transition ${
                    themeMode === 'dark'
                      ? 'bg-surface text-primary shadow-2xs font-bold'
                      : 'text-secondary hover:text-primary'
                  }`}
                  title="Dark theme"
                >
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Dark</span>
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('system')}
                  className={`flex items-center justify-center gap-1 py-1 rounded-lg text-[11px] font-semibold transition ${
                    themeMode === 'system'
                      ? 'bg-surface text-primary shadow-2xs font-bold'
                      : 'text-secondary hover:text-primary'
                  }`}
                  title="Auto / System theme"
                >
                  <Laptop className="w-3.5 h-3.5 text-secondary" />
                  <span>Auto</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={cycleTheme}
                className="w-full flex items-center justify-center p-2 rounded-xl text-secondary hover:text-primary hover:bg-surface-hover transition"
                title={`Theme: ${themeMode} (Click to toggle)`}
              >
                {themeMode === 'light' && <Sun className="w-4 h-4 text-amber-500" />}
                {themeMode === 'dark' && <Moon className="w-4 h-4 text-indigo-400" />}
                {themeMode === 'system' && <Laptop className="w-4 h-4 text-secondary" />}
              </button>
            )}

            {/* User Profile Pill */}
            {user && (
              <div
                className={`flex items-center gap-2 p-1.5 rounded-xl bg-surface-raised border border-border ${
                  collapsed ? 'justify-center' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(true)}
                  className="w-7 h-7 rounded-lg bg-brand text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs hover:opacity-90 transition"
                  title="View user profile"
                >
                  {user.name.charAt(0)}
                </button>
                {!collapsed && (
                  <div className="flex-1 min-w-0 pr-1">
                    <p className="text-xs font-bold text-primary truncate leading-tight">{user.name}</p>
                    <p className="text-[10px] font-semibold text-secondary uppercase tracking-wider">
                      {user.role === 'admin' ? 'Admin' : 'HR Executive'}
                    </p>
                  </div>
                )}
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => setPasswordModalOpen(true)}
                    className="p-1 rounded-lg text-muted hover:text-primary hover:bg-surface transition"
                    title="Change password"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* PROMINENT, LABELED SIGN OUT BUTTON */}
            <button
              type="button"
              onClick={handleLogout}
              data-testid="sidebar-sign-out"
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 transition shadow-2xs ${
                collapsed ? 'px-0' : ''
              }`}
              title="Sign out of HireFlow"
            >
              <LogOut className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              {!collapsed && <span>Sign Out</span>}
            </button>
          </div>
        </aside>

        {/* ======================================================== */}
        {/* MOBILE TOP BAR */}
        {/* ======================================================== */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="lg:hidden h-14 bg-surface border-b border-border px-4 flex items-center justify-between sticky top-0 z-20 transition-colors">
            <Link href="/" className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden pr-2">
              <CompanyLogo
                size="sm"
                showText={true}
                companyName={COMPANY_NAME}
                tagline="Recruitment Desk"
              />
            </Link>

            <div className="flex items-center gap-2">
              <button
                onClick={cycleTheme}
                className="p-2 rounded-lg text-secondary hover:bg-surface-hover transition"
                title={`Theme: ${themeMode}`}
              >
                {themeMode === 'light' && <Sun className="w-4 h-4 text-amber-500" />}
                {themeMode === 'dark' && <Moon className="w-4 h-4 text-indigo-400" />}
                {themeMode === 'system' && <Laptop className="w-4 h-4 text-secondary" />}
              </button>

              <button
                onClick={() => setMobileDrawerOpen(true)}
                className="p-2 rounded-lg text-secondary hover:text-primary hover:bg-surface-hover transition"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* MAIN PAGE CONTENT */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 lg:pb-8 flex flex-col justify-between">
            <div>{children}</div>

            {/* Global Quiet Footer */}
            <footer className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted">
              <span>DPDP Act 2023 Verified · Unbiased merit-based hiring · {COMPANY_NAME}</span>
              <span className="text-[11px] text-muted">{BUILD_STAMP} · © {new Date().getFullYear()} {COMPANY_NAME}</span>
            </footer>
          </main>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MOBILE BOTTOM NAVIGATION BAR (Height 60px, Min 44px tap) */}
      {/* ======================================================== */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface/95 backdrop-blur-md border-t border-border z-40 px-2 flex items-center justify-around shadow-lg transition-colors">
        <Link
          href="/"
          className={`flex flex-col items-center justify-center min-w-[50px] min-h-[44px] rounded-xl text-[10px] font-bold ${
            pathname === '/' ? 'text-brand font-black' : 'text-secondary hover:text-primary'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span>Home</span>
        </Link>

        <Link
          href="/queue"
          className={`flex flex-col items-center justify-center min-w-[50px] min-h-[44px] rounded-xl text-[10px] font-bold ${
            pathname.startsWith('/queue') ? 'text-brand font-black' : 'text-secondary hover:text-primary'
          }`}
        >
          <ListTodo className="w-5 h-5 mb-0.5" />
          <span>Queue</span>
        </Link>

        <Link
          href="/pipeline"
          className={`flex flex-col items-center justify-center min-w-[50px] min-h-[44px] rounded-xl text-[10px] font-bold ${
            pathname.startsWith('/pipeline') ? 'text-brand font-black' : 'text-secondary hover:text-primary'
          }`}
        >
          <KanbanSquare className="w-5 h-5 mb-0.5" />
          <span>Pipeline</span>
        </Link>

        <Link
          href="/import"
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] rounded-xl text-[10px] font-bold ${
            pathname.startsWith('/import') ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-secondary hover:text-primary'
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md -mt-2">
            <Upload className="w-4 h-4" />
          </div>
          <span>Import</span>
        </Link>

        <Link
          href="/candidates"
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] rounded-xl text-[10px] font-bold ${
            pathname.startsWith('/candidates') ? 'text-brand font-black' : 'text-secondary hover:text-primary'
          }`}
        >
          <Users className="w-5 h-5 mb-0.5" />
          <span>Candidates</span>
        </Link>

        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="flex flex-col items-center justify-center min-w-[56px] min-h-[44px] rounded-xl text-[10px] font-bold text-secondary hover:text-primary"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span>More</span>
        </button>
      </nav>

      {/* ======================================================== */}
      {/* MOBILE SLIDE-OUT DRAWER */}
      {/* ======================================================== */}
      {mobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative ml-auto w-72 max-w-full bg-surface h-full shadow-2xl flex flex-col p-6 z-10 animate-in slide-in-from-right duration-200 border-l border-border text-primary">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <CompanyLogo
                size="sm"
                showText={true}
                companyName={COMPANY_NAME}
                tagline="Recruitment Desk"
              />
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-surface-hover"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Theme Switcher */}
            <div className="py-3 border-b border-border">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-2">
                Theme / थीम
              </span>
              <div className="grid grid-cols-3 gap-1 bg-surface-hover p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setThemeMode('light')}
                  className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold ${
                    themeMode === 'light' ? 'bg-surface text-primary shadow-2xs font-bold' : 'text-secondary'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('dark')}
                  className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold ${
                    themeMode === 'dark' ? 'bg-surface text-primary shadow-2xs font-bold' : 'text-secondary'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Dark</span>
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('system')}
                  className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold ${
                    themeMode === 'system' ? 'bg-surface text-primary shadow-2xs font-bold' : 'text-secondary'
                  }`}
                >
                  <Laptop className="w-3.5 h-3.5 text-secondary" />
                  <span>Auto</span>
                </button>
              </div>
            </div>

            {/* Mobile Drawer Links */}
            <nav className="flex-1 overflow-y-auto py-4 space-y-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold ${
                      isActive
                        ? 'bg-brand/10 text-brand font-bold'
                        : 'text-secondary hover:text-primary hover:bg-surface-hover'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Mobile User Profile & Logout */}
            {user && (
              <div className="pt-4 border-t border-border space-y-2">
                <div className="flex items-center gap-2 px-2">
                  <div className="w-8 h-8 rounded-full bg-brand text-white font-bold flex items-center justify-center text-xs">
                    {user.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-primary truncate">{user.name}</p>
                    <p className="text-[10px] text-muted truncate">{user.email}</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileDrawerOpen(false);
                      setProfileModalOpen(true);
                    }}
                    className="flex-1 py-1.5 px-2 bg-surface-hover text-secondary hover:text-primary rounded-lg text-xs font-semibold text-center border border-border"
                  >
                    Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileDrawerOpen(false);
                      setPasswordModalOpen(true);
                    }}
                    className="flex-1 py-1.5 px-2 bg-surface-hover text-secondary hover:text-primary rounded-lg text-xs font-semibold text-center border border-border"
                  >
                    Password
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-2 mt-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded-xl text-xs font-bold"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* User Modals */}
      <UserProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={user}
        onOpenChangePassword={() => {
          setProfileModalOpen(false);
          setPasswordModalOpen(true);
        }}
        onLogout={handleLogout}
      />

      <ChangePasswordModal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        userEmail={user?.email || ''}
      />
    </div>
  );
}
