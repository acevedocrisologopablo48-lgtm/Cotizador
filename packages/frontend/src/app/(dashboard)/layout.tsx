'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
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
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { href: '/clients', label: 'Clientes', icon: Users },
  { href: '/pricing', label: 'Matriz de Costos', icon: BarChart2 },
  { href: '/quotations', label: 'Cotizaciones', icon: FileText },
  { href: '/projects', label: 'Proyectos', icon: FolderKanban },
  { href: '/petty-cash', label: 'Caja Chica', icon: Wallet },
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
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-2 border-muted" />
          <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
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
    <div className="flex flex-col h-full select-none">
      {/* Brand */}
      <div className="flex h-[58px] items-center px-5 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-primary shrink-0">
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
              <path d="M3 4h14M3 8h10M3 12h14M3 16h10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="leading-none">
            <p className="text-[14px] font-bold text-white tracking-tight">Cotizador</p>
            <p className="text-[10px] text-[hsl(var(--sidebar-muted))] mt-[3px] tracking-wide uppercase font-medium">FYM Technologies</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-4 space-y-[2px] overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-[6px] px-3 py-2.5 text-[13px] font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-white/[0.09] text-white'
                  : 'text-[hsl(var(--sidebar-fg))] hover:bg-white/[0.05] hover:text-white/90'
              }`}
            >
              <span className={`flex h-[18px] w-[3px] rounded-full shrink-0 transition-colors ${isActive ? 'bg-primary' : 'bg-transparent group-hover:bg-white/20'}`} />
              <item.icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? 'text-primary' : 'text-[hsl(var(--sidebar-muted))] group-hover:text-white/70'}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="shrink-0 border-t border-white/[0.06] p-3">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/90 text-white text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white truncate leading-tight">{user.fullName}</p>
            <p className="text-[11px] text-[hsl(var(--sidebar-muted))] mt-0.5 capitalize leading-tight">
              {user.role?.toLowerCase().replace('_', ' ')}
            </p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-md text-[hsl(var(--sidebar-muted))] hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
            title="Cerrar sesión"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden animate-fade-in" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[240px] flex-col bg-[hsl(var(--sidebar-bg))] md:hidden flex transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute right-3 top-3.5 p-1.5 text-[hsl(var(--sidebar-muted))] hover:text-white md:hidden"
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden w-[240px] flex-col bg-[hsl(var(--sidebar-bg))] md:flex">
        <SidebarContent />
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile topbar */}
        <header className="flex h-14 items-center gap-3 border-b bg-card px-4 md:hidden shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md text-muted-foreground hover:bg-muted transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
                <path d="M3 4h14M3 8h10M3 12h14M3 16h10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="text-sm font-bold">Cotizador</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-5 py-6 md:px-7 md:py-7 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
