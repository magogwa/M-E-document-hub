export type Role = 'admin' | 'client';
export type UserStatus = 'active' | 'pending' | 'inactive';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: UserStatus;
  created_at: string;
}

export interface ClientInfo {
  id: string;
  user_id: string;
  organization: string | null;
  address: string | null;
  phone: string | null;
  can_upload: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  description: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  version: number;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
  category_id: string | null;
  categories?: { id: string; name: string } | null;
  uploader?: { full_name: string; email: string } | null;
}

export interface DocumentDetail extends DocumentItem {
  category?: { id: string; name: string } | null;
  versions?: DocumentVersion[];
  access?: DocumentAccessRow[];
}

export interface DocumentDetailResponse {
  document: DocumentItem;
  category?: { id: string; name: string } | null;
  versions?: DocumentVersion[];
  access?: DocumentAccessRow[];
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version: number;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

export interface DocumentAccessRow {
  id: string;
  document_id: string;
  client_id: string;
  granted_at: string;
  client_org?: string;
  client_name?: string;
  client_email?: string;
}

export interface AccessGrantItem {
  id: string;
  document_id: string;
  document_title: string;
  document_status: string;
  client_id: string;
  client_org: string;
  client_name: string;
  client_email: string;
  client_status: string;
  granted_at: string;
}

export interface AdminClient {
  id: string;
  organization: string | null;
  address: string | null;
  phone: string | null;
  created_at: string;
  profile?: { id: string; full_name: string; email: string; status: UserStatus };
  access_count: number;
  last_login: string | null;
}

export interface ActivityItem {
  id: number;
  action: string;
  timestamp: string;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  user: { id: string; full_name: string; email: string } | null;
  document: { id: string; title: string } | null;
}

export interface Settings {
  appName: string;
  allowClientUpload: boolean;
  allowClientRegistration: boolean;
  maxFileSizeMB: number;
  emailNotifications: boolean;
  storageLimitMB: number;
}

export interface AdminStats {
  totals: {
    documents: number;
    activeDocuments: number;
    clients: number;
    activeClients: number;
    documentsThisMonth: number;
    storageBytes: number;
    storageLimitMB: number;
    accessGrants: number;
    activityToday: number;
  };
  monthlyUploads: Array<{ month: string; count: number }>;
  recentUploads: Array<{
    id: string;
    title: string;
    file_type: string;
    version: number;
    created_at: string;
    uploaded_by: string;
    category: string;
  }>;
  recentActivity: Array<{ id: number; action: string; timestamp: string; actor_name: string | null }>;
}

export interface ClientStats {
  totals: {
    sharedDocuments: number;
    downloads: number;
    previews: number;
    lastShareAt: string | null;
    storageMB: number;
  };
  recentDocuments: DocumentItem[];
  categories: string[];
}

export type ClientDashboardResponse = ClientStats;

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface DocumentComment {
  id: string;
  document_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author?: { id: string; full_name: string; email: string; role: Role } | null;
}

export interface ChatContact {
  id: string;
  full_name: string;
  email: string;
  role: Role;
}

export interface ChatConversation {
  id: string;
  counterpart: { id: string; full_name: string; email: string; role: Role } | null;
  last_message: { content: string; created_at: string; sender_id: string } | null;
  unread: number;
  last_message_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
  sender?: { id: string; full_name: string; role: Role } | null;
}

export interface AppNotification {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: 'document_upload';
  title: string;
  body: string | null;
  document_id: string | null;
  read_at: string | null;
  created_at: string;
  actor?: { id: string; full_name: string } | null;
}