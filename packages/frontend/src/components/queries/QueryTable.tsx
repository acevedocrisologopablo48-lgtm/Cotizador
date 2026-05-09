'use client';

import { ProjectQueryItem } from '@/lib/queries-api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { QueryStatusBadge } from './QueryStatusBadge';

export function QueryTable({
  items,
  onOpen,
}: {
  items: ProjectQueryItem[];
  onOpen: (queryId: string) => void;
}) {
  if (!items.length) {
    return <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">No hay consultas registradas.</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Título</TableHead>
          <TableHead>Prioridad</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Creado por</TableHead>
          <TableHead>Última actualización</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id} className="cursor-pointer" onClick={() => onOpen(item.id)}>
            <TableCell>
              <p className="font-semibold text-slate-900">{item.title}</p>
              <p className="line-clamp-1 text-xs text-slate-500">{item.description}</p>
            </TableCell>
            <TableCell>{item.priority}</TableCell>
            <TableCell>
              <QueryStatusBadge status={item.status} />
            </TableCell>
            <TableCell>{item.createdByName}</TableCell>
            <TableCell>{new Date(item.updatedAt).toLocaleString('es-PE')}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
