import { Suspense } from 'react';
import QuotationDetailPage from './client-page';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Cargando...</div>}>
      <QuotationDetailPage />
    </Suspense>
  );
}
