import { Injectable, inject } from '@angular/core';
import { CrmCalendarItem, CrmCalendarItemDetails, CrmCalendarRange, CrmCalendarSyncHealth } from '../../models/crm-calendar';
import { SupabaseService } from '../clients/supabase.service';

export class CrmCalendarReadError extends Error {
  constructor(readonly code: 'forbidden' | 'not_found' | 'unavailable') {
    super(code === 'not_found' ? 'This calendar item no longer exists.' :
      code === 'forbidden' ? 'Your account cannot view the CRM calendar.' :
      'The calendar could not be loaded. Please try again.');
  }
}

@Injectable({ providedIn: 'root' })
export class CrmCalendarRepositoryService {
  private readonly supabase = inject(SupabaseService);

  async list(range: CrmCalendarRange): Promise<CrmCalendarItem[]> {
    const { data, error } = await this.supabase.getClient().rpc('list_crm_calendar_items', {
      p_start_date: range.start, p_end_date: range.end,
    });
    if (error) throw this.mapError(error.code);
    return Array.isArray(data) ? data as CrmCalendarItem[] : [];
  }

  async details(item: CrmCalendarItem): Promise<CrmCalendarItemDetails> {
    if (!item.sourceId && item.sourceType !== 'microsoft') throw new CrmCalendarReadError('not_found');
    const { data, error } = await this.supabase.getClient().rpc('get_crm_calendar_item_details', {
      p_source_type: item.sourceType,
      p_source_id: item.sourceType === 'microsoft' ? item.id : item.sourceId,
    });
    if (error) throw this.mapError(error.code);
    if (!data) throw new CrmCalendarReadError('not_found');
    return data as CrmCalendarItemDetails;
  }

  async status(month: string | null = null): Promise<CrmCalendarSyncHealth> {
    const { data, error } = await this.supabase.getClient().rpc('get_crm_calendar_status', {
      p_month: month ? `${month}-01` : null,
    });
    if (error) throw this.mapError(error.code);
    return data as CrmCalendarSyncHealth;
  }

  private mapError(code?: string): CrmCalendarReadError {
    return new CrmCalendarReadError(code === '42501' ? 'forbidden' :
      code === 'P0002' ? 'not_found' : 'unavailable');
  }
}
