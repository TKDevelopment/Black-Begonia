export type CrmCalendarSourceType =
  | 'lead_event'
  | 'project_event'
  | 'consultation'
  | 'installment'
  | 'workshop'
  | 'microsoft';

export type CrmCalendarColorType =
  | 'lead'
  | 'project'
  | 'consultation'
  | 'installment'
  | 'workshop'
  | 'microsoft';

export interface CrmCalendarItem {
  id: string;
  sourceType: CrmCalendarSourceType;
  sourceId: string | null;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  localDate: string;
  status: string | null;
  isInactive: boolean;
  colorType: CrmCalendarColorType;
  destination: string | null;
  timezone?: string | null;
  isPrivate?: boolean;
  isStale?: boolean;
}

export interface CrmCalendarItemDetails extends CrmCalendarItem {
  clientFirstName?: string | null;
  partnerFirstName?: string | null;
  serviceType?: string | null;
  guestCount?: number | null;
  venueName?: string | null;
  venueAddress?: string | null;
  paymentKind?: string | null;
  targetAmount?: number | null;
  creditedAmount?: number | null;
  outstandingAmount?: number | null;
  paidDate?: string | null;
  paymentMethod?: string | null;
  capacity?: number | null;
  outlookWebUrl?: string | null;
}

export type CrmCalendarMonthImportStatus =
  | 'not_loaded'
  | 'loading'
  | 'delayed'
  | 'current'
  | 'stale'
  | 'failed';

export interface CrmCalendarSyncHealth {
  connectionStatus: 'connected' | 'action_required' | 'disconnected';
  calendarDisplayName: string | null;
  lastSuccessfulSyncAt: string | null;
  lastRunStatus: string | null;
  lastErrorCode: string | null;
  openConflictCount: number;
  staleMirrorWarning: boolean;
  requestedMonth: string | null;
  monthImportStatus: CrmCalendarMonthImportStatus;
  monthLastSuccessfulScanAt: string | null;
}

export interface CrmCalendarRange {
  start: string;
  end: string;
}
