import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, Session, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private readonly client: SupabaseClient;

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    const supabaseUrl = environment.supabaseUrl;
    const supabaseAnonKey = environment.supabaseAnonKey;
    const isBrowser = isPlatformBrowser(platformId);

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        '[SupabaseService] Missing environment.supabaseUrl or environment.supabaseAnonKey.'
      );
    }

    this.client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: isBrowser,
        autoRefreshToken: isBrowser,
        detectSessionInUrl: isBrowser,
      }
    });
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  async getSession(): Promise<Session | null> {
    const { data, error } = await this.client.auth.getSession();

    if (error) {
      console.error('[SupabaseService] getSession error:', error.message);
      return null;
    }

    return data.session ?? null;
  }

  async getUser(): Promise<User | null> {
    const { data, error } = await this.client.auth.getUser();

    if (error) {
      console.error('[SupabaseService] getUser error:', error.message);
      return null;
    }

    return data.user ?? null;
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();

    if (error) {
      console.error('[SupabaseService] signOut error:', error.message);
      throw error;
    }
  }
}
