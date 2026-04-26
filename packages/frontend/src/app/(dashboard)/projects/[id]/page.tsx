import ProjectDetailPage from './client-page';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Page() {
  return <ProjectDetailPage />;
}
