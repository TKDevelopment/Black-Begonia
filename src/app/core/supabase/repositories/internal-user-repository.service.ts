import { Injectable } from '@angular/core';
import { SupabaseService } from '../clients/supabase.service';
import { InternalUser } from '../../models/internal-user';

@Injectable({
  providedIn: 'root',
})
export class InternalUserRepositoryService {
  constructor(private supabaseService: SupabaseService) {}

  async getInternalUsers(): Promise<InternalUser[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('profiles')
      .select(`
        id,
        first_name,
        last_name,
        email
      `)
      .order('first_name', { ascending: true });

    if (error) {
      console.error('[InternalUserRepositoryService] getInternalUsers error:', error);
      return [];
    }

    return (data ?? []) as InternalUser[];
  }
}