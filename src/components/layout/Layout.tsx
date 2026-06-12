import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, CreditCard, TrendingUp, Target, Gem, BarChart3,
  Wallet, Download, Sun, Moon, Calculator, Palmtree, Settings, Menu, X,
  ChevronRight, User, LogOut,
} from 'lucide-react';
import { useAppStore, useSettings } from '../../stores/useAppStore';
import { useAuthStore } from '../../stores/useAuthStore';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/expenses', icon: CreditCard, label: 'Expenses' },
  { to: '/income', icon: TrendingUp, label: 'Income' },
  { to: '/goals', icon: Target, label: 'Goals' },
  { to: '/gold', icon: Gem, label: 'Gold Tracker' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/budget', icon: Wallet, label: 'Budget Planner' },
  { to: '/converter', icon: Calculator, label: 'AED → INR' },
  { to: '/dubai-life', icon: Palmtree, label: 'Dubai Life' },
  { to: '/reports', icon: Download, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const settings = useSettings();
  const updateSettings = useAppStore((s) => s.updateSettings);
  const rateJustUpdated = useAppStore((s) => s.rateJustUpdated);
  const setRateJustUpdated = useAppStore((s) => s.setRateJustUpdated);
  const { user, signOut } = useAuthStore();

  useEffect(() => {
    if (!rateJustUpdated) return;
    const t = setTimeout(() => setRateJustUpdated(false), 4000);
    return () => clearTimeout(t);
  }, [rateJustUpdated, setRateJustUpdated]);

  const toggleTheme = () => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });

  return (
    <div className={`min-h-screen flex ${settings.theme === 'dark' ? 'dark' : ''}`}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 z-30 flex flex-col
        bg-sidebar border-r border-sidebar-border
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#C75B76] to-[#A6445D] flex items-center justify-center shadow-lg shadow-[#A6445D]/30">
              <Palmtree size={16} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-sidebar-text tracking-tight">Dubai Finance</div>
              <div className="text-xs text-sidebar-muted">Tracker</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-sidebar-muted hover:text-sidebar-text">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-150 group
                ${isActive
                  ? 'bg-[#A6445D]/15 text-[#A6445D] border border-[#A6445D]/20'
                  : 'text-sidebar-muted hover:text-sidebar-text hover:bg-white/5'}
              `}
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} className={isActive ? 'text-[#A6445D]' : 'text-sidebar-muted group-hover:text-sidebar-text'} />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight size={12} className="text-[#A6445D]" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-sidebar-border space-y-3">
          {/* User row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-[#A6445D]/20 flex items-center justify-center shrink-0">
                <User size={12} className="text-[#A6445D]" />
              </div>
              <span className="text-xs text-sidebar-muted truncate">{user?.email}</span>
            </div>
            <button
              onClick={signOut}
              title="Sign out"
              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/15 flex items-center justify-center text-sidebar-muted hover:text-red-400 transition-colors shrink-0"
            >
              <LogOut size={13} />
            </button>
          </div>

          {/* Rate + theme toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-sidebar-muted">1 AED = ₹{settings.aedToInrRate}</span>
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-sidebar-muted hover:text-sidebar-text transition-colors"
            >
              {settings.theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-64 bg-main">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-sidebar border-b border-sidebar-border sticky top-0 z-10">
          <button onClick={() => setSidebarOpen(true)} className="text-sidebar-muted hover:text-sidebar-text">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#C75B76] to-[#A6445D] flex items-center justify-center">
              <Palmtree size={12} className="text-white" />
            </div>
            <span className="text-sm font-bold text-sidebar-text">Dubai Finance</span>
          </div>
          <button onClick={toggleTheme} className="text-sidebar-muted hover:text-sidebar-text">
            {settings.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        {rateJustUpdated && (
          <div className="mx-4 mt-4 md:mx-6 lg:mx-8 px-4 py-2.5 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-400 text-center">
            Exchange rate updated — 1 AED = ₹{settings.aedToInrRate}
          </div>
        )}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
