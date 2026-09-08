import { Injectable } from '@angular/core';
import {
  WorkshopAttendee,
  WorkshopBooking,
  WorkshopBookingAdjustment,
  WorkshopCommunicationHistoryItem,
  WorkshopCommunicationQueueItem,
  WorkshopManualReservation,
  WorkshopLifecycleCommandResult,
  WorkshopOccurrenceCancellationResult,
  WorkshopOccurrenceOperationalState,
  WorkshopRescheduleCommandResult,
  WorkshopRescheduleResponse,
  WorkshopRosterCommandResult,
  WorkshopRosterRow,
  WorkshopWaitlistEntry,
  WorkshopWaitlistCommandResult,
} from '../../models/workshop-booking';
import { SupabaseService } from '../clients/supabase.service';

export interface WorkshopOperationsRepository {
  listBookings(occurrenceId: string): Promise<WorkshopBooking[]>;
  listAttendees(bookingId: string): Promise<WorkshopAttendee[]>;
  listAttendeesForBookings(bookingIds: string[]): Promise<WorkshopAttendee[]>;
  listAdjustments(bookingId: string): Promise<WorkshopBookingAdjustment[]>;
  listWaitlist(occurrenceId: string): Promise<WorkshopWaitlistEntry[]>;
  listCommunicationQueue(bookingId: string): Promise<WorkshopCommunicationQueueItem[]>;
  listCommunicationHistory(bookingId: string): Promise<WorkshopCommunicationHistoryItem[]>;
  listMinimizedRoster(occurrenceId: string): Promise<WorkshopRosterRow[]>;
  createReservation(
    reservation: WorkshopManualReservation,
    commandKey: string,
  ): Promise<WorkshopRosterCommandResult>;
  cancelSeats(
    bookingId: string,
    quantity: number,
    reason: string,
    commandKey: string,
  ): Promise<WorkshopRosterCommandResult>;
  deleteExpiredBooking(
    bookingId: string,
    commandKey: string,
  ): Promise<WorkshopRosterCommandResult>;
  checkIn(attendeeId: string, commandKey: string): Promise<WorkshopRosterCommandResult>;
  offerWaitlistSeats(
    occurrenceId: string,
    durationMinutes: number,
    commandKey: string,
  ): Promise<WorkshopWaitlistCommandResult>;
  getOperationalState(
    occurrenceId: string,
  ): Promise<WorkshopOccurrenceOperationalState>;
  transitionOccurrence(
    occurrenceId: string,
    targetStatus: string,
    commandKey: string,
  ): Promise<WorkshopLifecycleCommandResult>;
  cancelOccurrence(
    occurrenceId: string,
    reasonCategory: string,
    commandKey: string,
  ): Promise<WorkshopOccurrenceCancellationResult>;
  listRescheduleResponses(
    occurrenceId: string,
  ): Promise<WorkshopRescheduleResponse[]>;
  beginReschedule(
    sourceOccurrenceId: string,
    replacementOccurrenceId: string,
    responseDeadline: string,
    commandKey: string,
  ): Promise<WorkshopRescheduleCommandResult>;
  expireRescheduleResponses(
    sourceOccurrenceId: string,
    commandKey: string,
  ): Promise<WorkshopRescheduleCommandResult>;
  resolveRescheduleNonresponse(
    responseId: string,
    commandKey: string,
  ): Promise<WorkshopRescheduleCommandResult>;
}

@Injectable({ providedIn: 'root' })
export class WorkshopOperationsRepositoryService implements WorkshopOperationsRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async listBookings(occurrenceId: string): Promise<WorkshopBooking[]> {
    const { data, error } = await this.supabase.getClient()
      .from('workshop_bookings').select('*').eq('workshop_occurrence_id', occurrenceId)
      .order('created_at');
    if (error) throw error;
    return (data ?? []) as WorkshopBooking[];
  }

  async listAttendees(bookingId: string): Promise<WorkshopAttendee[]> {
    const { data, error } = await this.supabase.getClient()
      .from('workshop_attendees').select('*').eq('workshop_booking_id', bookingId)
      .order('seat_number');
    if (error) throw error;
    return (data ?? []) as WorkshopAttendee[];
  }

  async listAttendeesForBookings(bookingIds: string[]): Promise<WorkshopAttendee[]> {
    if (!bookingIds.length) return [];
    const { data, error } = await this.supabase.getClient()
      .from('workshop_attendees').select('*')
      .in('workshop_booking_id', bookingIds)
      .order('seat_number');
    if (error) throw error;
    return (data ?? []) as WorkshopAttendee[];
  }

  async listAdjustments(bookingId: string): Promise<WorkshopBookingAdjustment[]> {
    const { data, error } = await this.supabase.getClient()
      .from('workshop_booking_adjustments').select('*').eq('workshop_booking_id', bookingId)
      .order('created_at');
    if (error) throw error;
    return (data ?? []) as WorkshopBookingAdjustment[];
  }

  async listWaitlist(occurrenceId: string): Promise<WorkshopWaitlistEntry[]> {
    const { data, error } = await this.supabase.getClient()
      .from('workshop_waitlist_entries').select('*').eq('workshop_occurrence_id', occurrenceId)
      .order('created_at');
    if (error) throw error;
    return (data ?? []) as WorkshopWaitlistEntry[];
  }

  async listCommunicationQueue(
    bookingId: string,
  ): Promise<WorkshopCommunicationQueueItem[]> {
    const { data, error } = await this.supabase.getClient()
      .from('workshop_message_queue').select(
        'workshop_message_queue_id,workshop_booking_id,workshop_waitlist_entry_id,workshop_personal_data_request_id,communication_type,token_purpose,template_version,is_required,state,attempt_count,next_attempt_at,expires_at,last_error_category,created_at,resolved_at',
      ).eq('workshop_booking_id', bookingId).order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as WorkshopCommunicationQueueItem[];
  }

  async listCommunicationHistory(
    bookingId: string,
  ): Promise<WorkshopCommunicationHistoryItem[]> {
    const { data, error } = await this.supabase.getClient()
      .from('workshop_communications').select(
        'workshop_communication_id,workshop_booking_id,workshop_waitlist_entry_id,communication_type,template_version,delivery_state,occurred_at',
      ).eq('workshop_booking_id', bookingId).order('occurred_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as WorkshopCommunicationHistoryItem[];
  }

  async listMinimizedRoster(occurrenceId: string): Promise<WorkshopRosterRow[]> {
    const { data, error } = await this.supabase.getClient().rpc(
      'get_minimized_workshop_roster',
      { p_occurrence_id: occurrenceId },
    );
    if (error) throw error;
    return (data ?? []) as WorkshopRosterRow[];
  }

  async createReservation(
    reservation: WorkshopManualReservation,
    commandKey: string,
  ): Promise<WorkshopRosterCommandResult> {
    return this.runRosterCommand('create_reservation', {
      ...reservation,
      contactName: reservation.contactName.trim(),
      contactEmail: reservation.contactEmail.trim().toLowerCase(),
      contactPhone: reservation.contactPhone?.trim() || undefined,
      reason: reservation.reason.trim(),
    }, commandKey);
  }

  async cancelSeats(
    bookingId: string,
    quantity: number,
    reason: string,
    commandKey: string,
  ): Promise<WorkshopRosterCommandResult> {
    return this.runRosterCommand('cancel_seats', {
      bookingId,
      quantity,
      reason: reason.trim(),
    }, commandKey);
  }

  async deleteExpiredBooking(
    bookingId: string,
    commandKey: string,
  ): Promise<WorkshopRosterCommandResult> {
    const { data, error } = await this.supabase.getClient().rpc(
      'delete_expired_workshop_booking',
      {
        p_booking_id: bookingId,
        p_command_key: commandKey,
      },
    );
    if (error) throw error;
    return data as WorkshopRosterCommandResult;
  }

  async checkIn(
    attendeeId: string,
    commandKey: string,
  ): Promise<WorkshopRosterCommandResult> {
    return this.runRosterCommand('check_in', { attendeeId }, commandKey);
  }

  async offerWaitlistSeats(
    occurrenceId: string,
    durationMinutes: number,
    commandKey: string,
  ): Promise<WorkshopWaitlistCommandResult> {
    const { data, error } = await this.supabase.getClient().rpc(
      'manage_workshop_waitlist',
      {
        p_action: 'offer_next',
        p_payload: { occurrenceId, durationMinutes },
        p_command_key: commandKey,
      },
    );
    if (error) throw error;
    return data as WorkshopWaitlistCommandResult;
  }

  async getOperationalState(
    occurrenceId: string,
  ): Promise<WorkshopOccurrenceOperationalState> {
    const { data, error } = await this.supabase.getClient().rpc(
      'get_workshop_occurrence_operational_state',
      { p_occurrence_id: occurrenceId },
    );
    if (error) throw error;
    return data as WorkshopOccurrenceOperationalState;
  }

  async transitionOccurrence(
    occurrenceId: string,
    targetStatus: string,
    commandKey: string,
  ): Promise<WorkshopLifecycleCommandResult> {
    const { data, error } = await this.supabase.getClient().rpc(
      'transition_workshop_occurrence',
      {
        p_occurrence_id: occurrenceId,
        p_target_status: targetStatus,
        p_command_key: commandKey,
      },
    );
    if (error) throw error;
    return data as WorkshopLifecycleCommandResult;
  }

  async cancelOccurrence(
    occurrenceId: string,
    reasonCategory: string,
    commandKey: string,
  ): Promise<WorkshopOccurrenceCancellationResult> {
    const { data, error } = await this.supabase.getClient().rpc(
      'cancel_workshop_occurrence',
      {
        p_occurrence_id: occurrenceId,
        p_reason_category: reasonCategory,
        p_command_key: commandKey,
      },
    );
    if (error) throw error;
    return data as WorkshopOccurrenceCancellationResult;
  }

  async listRescheduleResponses(
    occurrenceId: string,
  ): Promise<WorkshopRescheduleResponse[]> {
    const { data, error } = await this.supabase.getClient()
      .from('workshop_reschedule_responses').select(
        'workshop_reschedule_response_id,workshop_booking_id,source_occurrence_id,replacement_occurrence_id,replacement_hold_id,protected_quantity,response,response_token_expires_at,responded_at,resolved_by,resolution_command_key,created_at',
      ).eq('source_occurrence_id', occurrenceId).order('created_at');
    if (error) throw error;
    return (data ?? []) as WorkshopRescheduleResponse[];
  }

  beginReschedule(
    sourceOccurrenceId: string,
    replacementOccurrenceId: string,
    responseDeadline: string,
    commandKey: string,
  ): Promise<WorkshopRescheduleCommandResult> {
    return this.runRescheduleCommand('begin', {
      sourceOccurrenceId,
      replacementOccurrenceId,
      responseDeadline,
    }, commandKey);
  }

  expireRescheduleResponses(
    sourceOccurrenceId: string,
    commandKey: string,
  ): Promise<WorkshopRescheduleCommandResult> {
    return this.runRescheduleCommand(
      'expire_due',
      { sourceOccurrenceId },
      commandKey,
    );
  }

  resolveRescheduleNonresponse(
    responseId: string,
    commandKey: string,
  ): Promise<WorkshopRescheduleCommandResult> {
    return this.runRescheduleCommand(
      'resolve_nonresponse',
      { responseId, resolution: 'cancel' },
      commandKey,
    );
  }

  private async runRosterCommand(
    action: string,
    payload: object,
    commandKey: string,
  ): Promise<WorkshopRosterCommandResult> {
    const { data, error } = await this.supabase.getClient().rpc(
      'manage_workshop_roster',
      {
        p_action: action,
        p_payload: payload,
        p_command_key: commandKey,
      },
    );
    if (error) throw error;
    return data as WorkshopRosterCommandResult;
  }

  private async runRescheduleCommand(
    action: string,
    payload: object,
    commandKey: string,
  ): Promise<WorkshopRescheduleCommandResult> {
    const { data, error } = await this.supabase.getClient().rpc(
      'manage_workshop_reschedule',
      {
        p_action: action,
        p_payload: payload,
        p_command_key: commandKey,
      },
    );
    if (error) throw error;
    return data as WorkshopRescheduleCommandResult;
  }
}
