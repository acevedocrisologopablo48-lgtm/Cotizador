'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton, TableError } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, ChevronLeft, ChevronRight, Building2 } from 'lucide-react';

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
  const { token } = useAuth();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">
            Gestión de empresas, contactos y acuerdos comerciales
          </p>
        </div>
        <Link href="/clients/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo cliente
          </Button>
        </Link>
      </div>

      <form onSubmit={handleSearch} className="flex items-center gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por RUC, razón social..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>RUC</TableHead>
              <TableHead>Sector</TableHead>
              <TableHead>Contacto principal</TableHead>
              <TableHead className="text-center">Cotizaciones</TableHead>
              <TableHead className="text-center">Proyectos</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton rows={6} columns={7} />
            ) : loadError ? (
              <TableError
                colSpan={7}
                message={loadError}
                onRetry={() => fetchCompanies(meta.page, search)}
              />
            ) : companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Building2 className="h-8 w-8" />
                    <p>No se encontraron clientes</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              companies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell>
                    <Link
                      href={`/clients/${company.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {company.tradeName || company.businessName}
                    </Link>
                    {company.tradeName && (
                      <p className="text-xs text-muted-foreground">{company.businessName}</p>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{company.ruc}</TableCell>
                  <TableCell>{company.industrySector || '—'}</TableCell>
                  <TableCell>
                    {company.contacts?.[0]?.fullName || (
                      <span className="text-muted-foreground">Sin contacto</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{company._count?.quotations ?? 0}</TableCell>
                  <TableCell className="text-center">{company._count?.projects ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={company.isActive ? 'default' : 'secondary'}>
                      {company.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {companies.length} de {meta.total} clientes
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => fetchCompanies(meta.page - 1, search)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Página {meta.page} de {meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.totalPages}
              onClick={() => fetchCompanies(meta.page + 1, search)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
