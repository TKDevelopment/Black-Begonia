export interface Vendor {
  vendor_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateVendorInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  notes?: string | null;
  is_active?: boolean;
}
