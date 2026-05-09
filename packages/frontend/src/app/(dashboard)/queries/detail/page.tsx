import { Suspense } from 'react';
import QueryDetailClientPage from './client-page';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Cargando...</div>}>
      <QueryDetailClientPage />
    </Suspense>
  );
}
