import { InjectionToken, Injectable, inject } from '@angular/core';
import { AuthService } from '../../auth/auth.service';
import { SupabaseService } from '../clients/supabase.service';

export interface CrmM365CalendarSummary { id: string; name: string; isDefaultCalendar: boolean }
export interface CrmM365Conflict {
  conflictId: string; sourceType: string; sourceId: string; sourceTitle: string;
  changedFields: string[]; remoteTitle: string | null;
  remoteStartAt: string | null; remoteEndAt: string | null;
  isRemotePrivate: boolean; detectedAt: string; status: string;
}
export interface CrmCalendarMonthRequest {
  status: 'current' | 'queued'; runId?: string; coalesced?: boolean; dispatched?: boolean;
}
export class CrmM365CalendarAdminError extends Error {
  constructor(readonly code: string, readonly status: number, readonly retryAt: string | null = null) {
    super(code === 'month_rate_limited' ? 'Too many month requests. Try again later.' :
      code === 'calendar_disconnected' ? 'Microsoft 365 is not connected.' :
      'The Microsoft calendar action could not be completed.');
  }
}
export interface CrmM365CalendarTransport {
  send<T>(action: string, payload?: Record<string, unknown>): Promise<T>;
}

@Injectable({ providedIn: 'root' })
export class SupabaseCrmM365CalendarTransport implements CrmM365CalendarTransport {
  private readonly supabase = inject(SupabaseService);

  async send<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await this.supabase.getClient().functions.invoke('crm-m365-calendar-admin', {
      body: { action, ...payload },
    });
    if (error) {
      const response = (error as { context?: Response }).context;
      const safe = response ? await response.clone().json().catch(() => null) as {
        code?: string; retryAt?: string;
      } | null : null;
      throw new CrmM365CalendarAdminError(safe?.code ?? 'calendar_unavailable',
        response?.status ?? 503, safe?.retryAt ?? null);
    }
    return data as T;
  }
}

export const CRM_M365_CALENDAR_TRANSPORT = new InjectionToken<CrmM365CalendarTransport>(
  'CRM_M365_CALENDAR_TRANSPORT',
  { providedIn: 'root', factory: () => inject(SupabaseCrmM365CalendarTransport) },
);

@Injectable({ providedIn: 'root' })
export class CrmM365CalendarAdminService {
  private readonly transport = inject(CRM_M365_CALENDAR_TRANSPORT);
  private readonly auth = inject(AuthService);

  private requireAdmin(): void {
    if (!this.auth.snapshot.roles.includes('admin')) {
      throw new CrmM365CalendarAdminError('forbidden', 403);
    }
  }

  requestMonth(month: string): Promise<CrmCalendarMonthRequest> {
    return this.transport.send<CrmCalendarMonthRequest>('requestMonth', { month });
  }
  async listCalendars(): Promise<CrmM365CalendarSummary[]> {
    this.requireAdmin();
    const result = await this.transport.send<{ calendars: CrmM365CalendarSummary[] }>('listCalendars');
    return result.calendars;
  }
  connect(calendarId: string): Promise<{ status: string; calendarDisplayName: string; runId: string }> {
    this.requireAdmin();
    return this.transport.send('connect', { calendarId });
  }
  refresh(month?: string): Promise<{ status: string; runId: string }> {
    this.requireAdmin();
    return this.transport.send('refresh', month ? { month } : {});
  }
  disconnect(): Promise<{ status: string; staleMirrorWarning: boolean }> {
    this.requireAdmin();
    return this.transport.send('disconnect');
  }
  async listConflicts(): Promise<CrmM365Conflict[]> {
    this.requireAdmin();
    const result = await this.transport.send<{ conflicts: CrmM365Conflict[] }>('listConflicts');
    return result.conflicts;
  }
  restoreConflict(conflictId: string): Promise<{ status: string; conflictId: string }> {
    this.requireAdmin();
    return this.transport.send('restoreConflict', { conflictId });
  }
}
