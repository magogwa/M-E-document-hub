import { DocumentsBrowser } from '../../components/DocumentsBrowser';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/ui';

export function ClientMyDocumentsPage() {
  return (
    <AppShell role="client">
      <PageHeader title="My documents" subtitle="Every document shared with you by your organization." />
      <DocumentsBrowser mode="client" defaultSort="created_at" />
    </AppShell>
  );
}