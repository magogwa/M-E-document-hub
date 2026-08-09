export type Role = 'admin' | 'client';
export type UserStatus = 'active' | 'pending' | 'inactive';
export type DocumentStatus = 'active' | 'archived';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: UserStatus;
  created_at: string;
}

export interface ClientRow {
  id: string;
  user_id: string;
  organization: string | null;
  address: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  title: string;
  description: string | null;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  category_id: string | null;
  uploaded_by: string;
  version: number;
  status: DocumentStatus;
  created_at: string;
  updated_at: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version: number;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
}

export interface DocumentAccess {
  id: string;
  document_id: string;
  client_id: string;
  granted_by: string;
  granted_at: string;
}

export interface ActivityRow {
  id: number;
  user_id: string | null;
  document_id: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  timestamp: string;
  ip_address: string | null;
}

export interface AppSettings {
  appName: string;
  allowClientUpload: boolean;
  allowClientRegistration: boolean;
  maxFileSizeMB: number;
  emailNotifications: boolean;
  storageLimitMB: number;
}

export interface AuthenticatedUser {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  profile: UserProfile;
  client?: ClientRow | null;
}