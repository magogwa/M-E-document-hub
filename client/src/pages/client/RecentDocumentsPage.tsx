import { DocumentsBrowser } from '../../components/DocumentsBrowser';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/ui';

export function ClientRecentDocumentsPage() {
  return (
    <AppShell role="client">
      <PageHeader title="Recent documents" subtitle="The latest documents shared with you, newest first." />
      <DocumentsBrowser mode="client" defaultSort="created_at" />
    </AppShell>
  );
}