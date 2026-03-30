import { Session, User } from '@supabase/supabase-js';

export type CrmUserRole = 'admin' | 'staff';

export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  initialized: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: CrmUserRole[];
  isInternalUser: boolean;
}