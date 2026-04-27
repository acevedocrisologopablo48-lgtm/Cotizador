'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableSkeleton, TableError } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Plus, Search, ChevronLeft, ChevronRight, Building2, Pencil,
  CheckCircle2, FileText, Briefcase
} from 'lucide-react';

interface Company {
  id: string;
  ruc: string;
  businessName: string;
  tradeName: string | null;
  industrySector: string | null;
  isActive: boolean;
  contacts: { id: string; fullName: string }[];
  _count: { quotations: number; projects: number };
}

interface CompaniesResponse {
  data: Company[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export default function ClientsPage() {
  const { token, user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'ENGINEER';
  const [companies, setCompanies] = useState<Company[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 20, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchCompanies = useCallback(
    async (page = 1, searchTerm = '') => {
      if (!token) return;
      setIsLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: '20',
        });
        if (searchTerm) params.set('search', searchTerm);
        const res = await api.get<CompaniesResponse>(
          `/companies?${params.toString()}`,
          token
        );
        setCompanies(res.data);
        setMeta(res.meta);
      } catch (e: any) {
        setLoadError(e.message);
        setCompanies([]);
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCompanies(1, search);
  };

  const statColorClass: Record<string, { wrap: string; icon: string }> = {
    indigo: { wrap: 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20', icon: 'text-indigo-600 dark:text-indigo-400' },
    emerald: { wrap: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20', icon: 'text-emerald-600 dark:text-emerald-400' },
    amber: { wrap: 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20', icon: 'text-amber-600 dark:text-amber-400' },
    blue: { wrap: 'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20', icon: 'text-blue-600 dark:text-blue-400' },
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
      {/* Premium Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 font-jakarta">
            Directorio de <span className="text-primary italic">Clientes</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Gestión centralizada de socios estratégicos y rendimiento comercial.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/clients/new">
            <Button className="shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all rounded-xl h-11 px-6">
              <Plus className="mr-2 h-5 w-5" />
              Registrar Cliente
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Empresas', value: meta.total, icon: Building2, color: 'indigo' },
          { label: 'Clientes Activos', value: companies.filter(c => c.isActive).length, icon: CheckCircle2, color: 'emerald' },
          { label: 'Cotizaciones', value: companies.reduce((acc, c) => acc + (c._count?.quotations || 0), 0), icon: FileText, color: 'amber' },
          { label: 'Proyectos', value: companies.reduce((acc, c) => acc + (c._count?.projects || 0), 0), icon: Briefcase, color: 'blue' }
        ].map((stat, i) => (
          <Card key={i} className="group relative border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl overflow-hidden">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center border shadow-inner group-hover:scale-105 transition-transform ${statColorClass[stat.color].wrap}`}>
                <stat.icon className={`h-6 w-6 ${statColorClass[stat.color].icon}`} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{stat.label}</p>
                <p className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-slate-50">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters & Search */}
      <Card className="border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="RUC, Nombre Comercial o Razón Social..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus-visible:ring-primary/20 transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" variant="default" className="h-11 px-8 rounded-xl font-bold text-xs uppercase tracking-widest shadow-md">
                Buscar
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setSearch(''); fetchCompanies(1, ''); }}
                className="h-11 rounded-xl text-slate-500 font-bold text-xs uppercase tracking-widest px-6"
              >
                Limpiar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Table Section */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-xl overflow-hidden transition-all duration-500">
        <Table>
          <TableHeader className="bg-slate-50/80 dark:bg-slate-800/50">
            <TableRow className="border-b border-slate-200 dark:border-slate-800 hover:bg-transparent">
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Empresa / Razón Social</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Identificación</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Sector</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-center">Interacción</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Estado</TableHead>
              <TableHead className="w-[80px] py-4"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton rows={8} columns={6} />
            ) : loadError ? (
              <TableError
                colSpan={6}
                message={loadError}
                onRetry={() => fetchCompanies(meta.page, search)}
              />
            ) : companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-72 text-center">
                  <div className="flex flex-col items-center justify-center gap-3 text-slate-500">
                    <div className="h-20 w-20 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 border border-slate-200 dark:border-slate-700 shadow-inner">
                      <Building2 className="h-10 w-10 text-slate-400 opacity-40" />
                    </div>
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100 font-jakarta">Sin resultados</p>
                    <p className="text-sm max-w-xs mx-auto font-medium text-slate-400">
                      No se encontraron clientes con los criterios de búsqueda actuales.
                    </p>
                    <Link href="/clients/new" className="mt-4">
                      <Button variant="outline" size="sm" className="rounded-xl px-8 border-slate-200 dark:border-slate-700">Registrar Cliente</Button>
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              companies.map((company) => (
                <TableRow key={company.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all duration-300 border-b border-slate-50 dark:border-slate-800/50">
                  <TableCell className="py-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center border border-slate-200 dark:border-slate-600 shadow-sm group-hover:scale-110 transition-transform">
                        <Building2 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                      </div>
                      <div className="flex flex-col">
                        <Link
                          href={`/clients/detail?id=${company.id}`}
                          className="font-bold text-slate-900 dark:text-slate-100 hover:text-primary transition-colors leading-tight font-jakarta"
                        >
                          {company.tradeName || company.businessName}
                        </Link>
                        {company.tradeName && (
                          <span className="text-[10px] uppercase tracking-tighter text-slate-400 mt-0.5 font-bold line-clamp-1">
                            {company.businessName}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold tabular-nums">
                      {company.ruc}
                    </span>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary/40 animate-pulse" />
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tighter truncate max-w-[150px]">
                        {company.industrySector || 'General'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center justify-center gap-4">
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-black font-mono text-slate-900 dark:text-slate-50 tabular-nums">{company._count?.quotations ?? 0}</span>
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-tighter">COTIZ.</span>
                      </div>
                      <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800" />
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-black font-mono text-slate-900 dark:text-slate-50 tabular-nums">{company._count?.projects ?? 0}</span>
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-tighter">PROY.</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <StatusBadge status={company.isActive ? 'ACTIVE' : 'INACTIVE'} className="uppercase tracking-wide" />
                  </TableCell>
                  <TableCell className="py-4 text-right">
                    <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                      <Link href={`/clients/detail?id=${company.id}&edit=true`}>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/5">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination Integration */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {meta.total} Clientes Registrados
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page <= 1}
                onClick={() => fetchCompanies(meta.page - 1, search)}
                className="h-9 px-4 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm font-bold text-xs uppercase tracking-widest"
              >
                Anterior
              </Button>
              <div className="flex items-center gap-2 px-4 py-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner">
                <span className="text-xs font-black font-mono">{meta.page}</span>
                <span className="text-xs text-slate-400">/</span>
                <span className="text-xs font-black font-mono text-slate-400">{meta.totalPages}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page >= meta.totalPages}
                onClick={() => fetchCompanies(meta.page + 1, search)}
                className="h-9 px-4 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm font-bold text-xs uppercase tracking-widest"
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
