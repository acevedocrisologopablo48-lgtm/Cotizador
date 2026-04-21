'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      const msg =
        err?.code === 'auth/invalid-credential'
          ? 'Credenciales incorrectas. Verifica tu correo y contraseña.'
          : err?.code === 'auth/too-many-requests'
          ? 'Demasiados intentos. Intenta más tarde.'
          : err.message || 'Error al iniciar sesión';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-[46%] flex-col justify-between bg-[hsl(222,44%,8%)] p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[7px] bg-primary">
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
              <path d="M3 4h14M3 8h10M3 12h14M3 16h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div className="leading-none">
            <p className="text-[14px] font-bold text-white">Cotizador</p>
            <p className="text-[10px] text-white/40 mt-[2px] tracking-widest uppercase font-medium">FYM Technologies</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-white leading-snug">
              Gestión de cotizaciones<br />y proyectos industriales
            </h1>
            <p className="mt-3 text-sm text-white/50 leading-relaxed max-w-sm">
              Plataforma centralizada para cotizar, presupuestar y gestionar proyectos de inspección y ensayos no destructivos.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Cotizaciones', desc: 'Genera y aprueba' },
              { label: 'Proyectos', desc: 'Planifica y controla' },
              { label: 'Clientes', desc: 'Gestiona cartera' },
              { label: 'Costos', desc: 'Matriz de precios' },
            ].map((f) => (
              <div key={f.label} className="rounded-lg border border-white/[0.07] bg-white/[0.04] px-4 py-3">
                <p className="text-[13px] font-semibold text-white/80">{f.label}</p>
                <p className="text-[11px] text-white/35 mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-white/20">
          © {new Date().getFullYear()} FYM Technologies — Todos los derechos reservados
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center bg-background px-6">
        <div className="w-full max-w-[380px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-primary">
              <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
                <path d="M3 4h14M3 8h10M3 12h14M3 16h10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-sm font-bold">Cotizador · FYM Technologies</span>
          </div>

          <div className="mb-7">
            <h2 className="text-2xl font-bold tracking-tight">Iniciar sesión</h2>
            <p className="text-sm text-muted-foreground mt-1">Ingresa tus credenciales para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-[13px] font-medium text-foreground/80">
                Correo electrónico
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-card px-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all"
                placeholder="correo@empresa.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-password" className="text-[13px] font-medium text-foreground/80">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-card px-3.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 flex h-10 w-full items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-white shadow-sm shadow-primary/30 transition-all hover:bg-primary/90 hover:shadow-md hover:shadow-primary/25 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2 disabled:opacity-55 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ingresando...
                </>
              ) : (
                'Ingresar'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
