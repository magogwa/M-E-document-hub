import { Link } from 'react-router-dom';
import { UploadCloud } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { DocumentsBrowser } from '../../components/DocumentsBrowser';
import { PageHeader } from '../../components/ui';

export function AdminDocumentsPage() {
  return (
    <AppShell role="admin">
      <PageHeader
        title="Documents"
        subtitle="Search, filter, preview and manage all uploaded documents."
        actions={
          <Link to="/admin/upload" className="btn-primary">
            <UploadCloud className="h-4 w-4" /> Upload
          </Link>
        }
      />
      <DocumentsBrowser mode="admin" />
    </AppShell>
  );
}