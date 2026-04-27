'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { UserRole } from '@fym/shared';
import {
  LayoutDashboard,
  Users,
  FileText,
  FolderKanban,
  BarChart2,
  Wallet,
  LogOut,
  Menu,
  X,
  Settings,
  UserCheck,
  ChevronRight,
  Shield,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { href: '/clients', label: 'Clientes', icon: Users },
  { href: '/pricing', label: 'Matriz de Costos', icon: BarChart2 },
  { href: '/quotations', label: 'Cotizaciones', icon: FileText },
  { href: '/projects', label: 'Proyectos', icon: FolderKanban },
  { href: '/petty-cash', label: 'Caja Chica', icon: Wallet },
  {
    href: '/hr',
    label: 'Recursos Humanos',
    icon: UserCheck,
    roles: [
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.FIELD_SUPERVISOR,
      UserRole.ACCOUNTANT,
      UserRole.ENGINEER,
    ],
  },
  {
    href: '/users',
    label: 'Usuarios',
    icon: Shield,
    roles: [UserRole.ADMIN],
  },
  { href: '/settings', label: 'Configuraciones', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  if (isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border-2 border-muted" />
            <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse-soft">Cargando...</p>
        </div>
      </div>
    );
  }

  const initials = user.fullName
    ?.split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  const SidebarContent = () => (
    <div className="flex flex-col h-full select-none font-jakarta">
      {/* Brand */}
      <div className="flex h-[72px] items-center px-6 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative group/logo">
            <div className="absolute -inset-1 bg-gradient-to-tr from-primary/40 to-indigo-500/40 rounded-xl blur-sm opacity-0 group-hover/logo:opacity-100 transition-opacity duration-500" />
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 shadow-xl shrink-0 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-indigo-600 opacity-90" />
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 relative z-10 text-white drop-shadow-sm">
                <path d="M4 6h16M4 12h10M4 18h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
          <div className="leading-tight">
            <p className="text-[16px] font-extrabold text-white tracking-tight">COTIZADOR</p>
            <p className="text-[9px] text-white/40 tracking-[0.2em] uppercase font-bold">FYM TECH</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto custom-scrollbar">
        <p className="px-3 mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-white/20 flex items-center gap-2">
          <span className="w-4 h-[1px] bg-white/10" />
          Módulos del Sistema
        </p>
        <div className="space-y-1">
          {navItems
          .filter((item) => !item.roles || item.roles.includes(user.role as UserRole))
          .map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all duration-300 ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100'
                }`}
              >
                {isActive && (
                  <div className="absolute inset-y-2 left-0 w-1 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]" />
                )}
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300 ${
                  isActive ? 'bg-primary/20 text-primary' : 'bg-slate-800/40 text-slate-500 group-hover:text-slate-300'
                }`}>
                  <item.icon className="h-4.5 w-4.5" />
                </div>
                <span className="flex-1 tracking-wide">{item.label}</span>
                {isActive && <div className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_rgba(var(--primary-rgb),0.4)]" />}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User */}
      <div className="shrink-0 p-4 border-t border-border/50 bg-muted/30">
        <div className="group/user flex items-center gap-3 rounded-2xl p-2.5 bg-muted/40 border border-border/40 transition-all hover:bg-muted/60">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 text-white text-xs font-black shadow-lg">
              {initials}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-slate-100 truncate tracking-tight">{user.fullName}</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
              {user.role?.toLowerCase().replace('_', ' ')}
            </p>
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background font-jakarta">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden animate-in fade-in duration-300" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[280px] flex-col bg-card md:hidden flex transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${
        sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      }`}>
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute right-4 top-5 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/[0.05] transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden w-[280px] flex-col bg-card md:flex border-r border-border/60 relative z-20">
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden relative">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-30">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
        </div>

        {/* Mobile topbar */}
        <header className="flex h-[60px] items-center justify-between border-b border-border/60 bg-card/80 backdrop-blur-md px-4 md:hidden shrink-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl text-slate-400 hover:bg-white/[0.05] transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white">
                  <path d="M4 6h16M4 12h10M4 18h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="text-sm font-black text-white tracking-tight">COTIZADOR</span>
            </div>
          </div>
          
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 border border-white/10 text-[10px] font-bold text-white">
            {initials}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto relative z-10 custom-scrollbar scroll-smooth">
          <div className="min-h-full bg-background">
            <div className="mx-auto max-w-[1600px] px-6 py-8 md:px-10 md:py-10 lg:px-12">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
