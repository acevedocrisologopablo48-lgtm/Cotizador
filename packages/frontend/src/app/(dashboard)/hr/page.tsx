'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Camera, BarChart3, ClipboardList } from 'lucide-react';

const modules = [
  {
    href: '/hr/employees',
    icon: Users,
    title: 'Directorio de Empleados',
    description: 'Registra, edita y gestiona los legajos del personal activo e inactivo.',
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    href: '/hr/attendances',
    icon: Camera,
    title: 'Control de Asistencias',
    description: 'Registra entradas y salidas con foto obligatoria en tiempo real.',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
  },
  {
    href: '/hr/timesheets',
    icon: BarChart3,
    title: 'Tareos y Reportes',
    description: 'Consulta horas trabajadas por día, semana o mes y exporta a Excel.',
    color: 'text-sky-700',
    bg: 'bg-sky-50',
  },
];

export default function HrPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recursos Humanos</h1>
        <p className="text-muted-foreground text-sm">Gestión de personal, asistencias y tareos</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {modules.map(({ href, icon: Icon, title, description, color, bg }) => (
          <Link key={href} href={href}>
            <Card className="h-full cursor-pointer hover:shadow-md hover:border-primary/40 transition-all group">
              <CardContent className="p-6 space-y-4">
                <div className={`h-12 w-12 rounded-xl ${bg} flex items-center justify-center group-hover:scale-105 transition-transform`}>
                  <Icon className={`h-6 w-6 ${color}`} />
                </div>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
