import { Suspense } from 'react';
import ProjectDetailPage from './client-page';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Cargando...</div>}>
      <ProjectDetailPage />
    </Suspense>
  );
}
