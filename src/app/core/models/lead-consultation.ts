export interface LeadConsultationContext {
  leadId: string;
  bookingUrl: string;
  bookingSource: 'zoho_bookings';
  externalBookingId?: string | null;
  externalCalendarEventId?: string | null;
  scheduledAt?: string | null;
  acceptedAt?: string | null;
  concludedAt?: string | null;
}