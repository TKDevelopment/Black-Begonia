// src/app/services/supabase.service.ts
import { Injectable } from '@angular/core';
import { createClient, Session, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

type CalendarStatus =
  | 'accepted'
  | 'client review'
  | 'proposal accepted'
  | 'proposal declined'
  | 'complete';

const DEFAULT_CALENDAR_STATUSES: CalendarStatus[] = [
  'accepted',
  'client review',
  'proposal accepted',
  'proposal declined',
  'complete',
];

export type CalendarEventRecord = {
  supabaseType: 'event';
  supabaseId: string;
  title: string;
  clientName: string;
  notes: string;
  status: CalendarStatus | string;
  date: string;
  venue: string;
  city: string;
  state: string;
  zipcode: string;
};

export type CalendarInstallmentRecord = {
  supabaseType: 'installment';
  supabaseId: string;
  title: string;
  clientName: string;
  description: string;
  status: string;
  date: string;
  amount: number;
};

type DateRange = { from?: string; to?: string };

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly supabase: SupabaseClient;

  constructor() {
    // ✅ Prefer explicit anon key naming. Keep a fallback for your existing env key name.
    const supabaseUrl = (environment as any).supabaseUrl as string | undefined;
    const supabaseAnonKey = ((environment as any).supabaseAnonKey as string | undefined)

    console.log('SupabaseAnonKey:', supabaseAnonKey);

    if (!supabaseUrl || !supabaseAnonKey) {
      // Fail fast so you don't get silent 401/RLS issues
      throw new Error(
        `[SupabaseService] Missing environment variables.
        Expected environment.supabaseUrl and environment.supabaseAnonKey (or supabaseKey fallback).
        Got supabaseUrl=${!!supabaseUrl}, anonKey=${!!supabaseAnonKey}`
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      // Optional: add schema if you use non-public
      // db: { schema: 'public' },
    });

    // Optional debug (comment out once confirmed)
    // console.log('[SupabaseService] Initialized', {
    //   url: supabaseUrl,
    //   anonKeyPrefix: supabaseAnonKey.slice(0, 12),
    // });
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  async getUser(): Promise<User | null> {
    const { data, error } = await this.supabase.auth.getUser();
    if (error) {
      console.error('Error fetching user:', error.message);
      return null;
    }
    return data.user;
  }

  async getSession(): Promise<Session | null> {
    const { data, error } = await this.supabase.auth.getSession();
    if (error) {
      console.error('Error fetching session:', error.message);
      return null;
    }
    return data.session;
  }

  async signOut(): Promise<void> {
    try {
      const { error } = await this.supabase.auth.signOut();
      localStorage.removeItem('google_access_token');
      if (error) console.error('Error signing out:', error.message);
    } catch (err) {
      console.error('Unexpected signOut error:', err);
    }
  }

  async hasAccess(): Promise<boolean> {
    const session = await this.getSession();
    return !!session;
  }

  async fetchEventsForCalendar(
    range: DateRange = {},
    statuses: CalendarStatus[] = DEFAULT_CALENDAR_STATUSES
  ): Promise<CalendarEventRecord[]> {
    let query = this.supabase
      .from('events')
      .select(`
        event_id,
        date,
        status,
        type,
        venue,
        city,
        state,
        zipcode,
        notes,
        clients:client_id (first_name, last_name)
      `)
      .in('status', statuses);

    if (range.from) query = query.gte('date', range.from);
    if (range.to) query = query.lte('date', range.to);

    const { data, error } = await query;

    if (error) {
      console.error('[Supabase] fetchEventsForCalendar error', error);
      return [];
    }

    return (data ?? []).map((e: any): CalendarEventRecord => {
      const client = e?.clients ?? null;
      const clientName = client
        ? `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() || 'Client'
        : 'Client';

      return {
        supabaseType: 'event',
        supabaseId: e.event_id,
        title: `${clientName} • ${e.type}`,
        clientName,
        notes: e.notes ?? '',
        status: e.status ?? '',
        date: e.date,
        venue: e.venue ?? '',
        city: e.city ?? '',
        state: e.state ?? '',
        zipcode: e.zipcode ?? '',
      };
    });
  }

  async fetchInstallmentsForCalendar(range: DateRange = {}): Promise<CalendarInstallmentRecord[]> {
    let query = this.supabase
      .from('installments')
      .select(`
        installment_id,
        due_date,
        amount,
        description,
        status,
        clients:client_id (first_name, last_name)
      `);

    if (range.from) query = query.gte('due_date', range.from);
    if (range.to) query = query.lte('due_date', range.to);

    const { data, error } = await query;

    if (error) {
      console.error('[Supabase] fetchInstallmentsForCalendar error', error);
      return [];
    }

    return (data ?? []).map((i: any): CalendarInstallmentRecord => {
      const client = i?.clients ?? null;
      const clientName = client
        ? `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() || 'Client'
        : 'Client';

      return {
        supabaseType: 'installment',
        supabaseId: i.installment_id,
        title: `${clientName} • ${i.description ?? ''}`.trim(),
        clientName,
        description: i.description ?? '',
        status: i.status ?? '',
        date: i.due_date,
        amount: Number(i.amount ?? 0),
      };
    });
  }
}