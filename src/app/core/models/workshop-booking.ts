import { WorkshopCurrency } from './workshop';

export type WorkshopPaymentMethod = 'stripe' | 'direct_venmo';
export type WorkshopSeatHoldState =
  | 'active'
  | 'confirmed'
  | 'expired'
  | 'released'
  | 'cancelled'
  | 'exception';
export type WorkshopBookingStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'checked_in'
  | 'expired'
  | 'cancelled'
  | 'payment_disputed'
  | 'transfer_action_required'
  | 'transferred';
export type WorkshopPaymentState =
  | 'unselected'
  | 'pending'
  | 'processing'
  | 'paid'
  | 'partially_refunded'
  | 'refunded'
  | 'disputed'
  | 'reversed'
  | 'exception';
export type WorkshopAttendanceState = 'expected' | 'checked_in' | 'absent' | 'cancelled';
export type WorkshopRetentionPolicyState = 'draft' | 'approved' | 'active' | 'retired';
export type WorkshopPersonalDataRequestState =
  | 'pending_verification'
  | 'verified'
  | 'approved'
  | 'deferred'
  | 'completed'
  | 'denied'
  | 'expired';

export interface WorkshopSeatHold {
  workshop_seat_hold_id: string;
  workshop_occurrence_id: string;
  booking_id: string | null;
  quantity: number;
  state: WorkshopSeatHoldState;
  payment_method: WorkshopPaymentMethod;
  normal_expires_at: string;
  effective_expires_at: string;
  resolved_at: string | null;
  resolution_reason: string | null;
  command_key: string;
  created_at: string;
}

export interface WorkshopBooking {
  workshop_booking_id: string;
  workshop_occurrence_id: string;
  booking_reference: string;
  status_token_expires_at: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  purchased_quantity: number;
  active_quantity: number;
  status: WorkshopBookingStatus;
  payment_state: WorkshopPaymentState;
  price_per_seat_minor_snapshot: number;
  subtotal_minor_snapshot: number;
  total_minor_snapshot: number;
  required_charges_minor_snapshot: number;
  currency: WorkshopCurrency;
  terms_snapshot: string;
  terms_version: number;
  payment_method: WorkshopPaymentMethod | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  checked_in_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkshopAttendee {
  workshop_attendee_id: string;
  workshop_booking_id: string;
  seat_number: number;
  display_name: string | null;
  accommodation_details: string | null;
  attendance_state: WorkshopAttendanceState;
  checked_in_at: string | null;
  checked_in_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkshopBookingAdjustment {
  workshop_booking_adjustment_id: string;
  workshop_booking_id: string;
  adjustment_type:
    | 'partial_cancel'
    | 'full_cancel'
    | 'transfer'
    | 'manual'
    | 'complimentary'
    | 'correction';
  quantity_delta: number;
  amount_minor_delta: number;
  reason: string;
  command_key: string;
  actor_type: 'customer' | 'internal' | 'system' | 'provider';
  actor_id: string | null;
  created_at: string;
}

export interface WorkshopRescheduleResponse {
  workshop_reschedule_response_id: string;
  workshop_booking_id: string;
  source_occurrence_id: string;
  replacement_occurrence_id: string;
  replacement_hold_id: string;
  protected_quantity: number;
  response:
    | 'pending'
    | 'accepted'
    | 'declined'
    | 'expired'
    | 'staff_resolved';
  response_token_expires_at: string;
  responded_at: string | null;
  resolved_by: string | null;
  resolution_command_key: string | null;
  created_at: string;
}

export interface WorkshopOccurrenceOperationalState {
  occurrenceId: string;
  lifecycle:
    | 'draft'
    | 'published_open'
    | 'registration_closed'
    | 'rescheduled'
    | 'cancelled'
    | 'completed'
    | 'archived';
  availability:
    | 'available'
    | 'limited'
    | 'sold_out'
    | 'waitlist_available'
    | 'closed';
  capacity: number;
  reservedQuantity: number;
  remainingQuantity: number;
  hasWaitingCustomers: boolean;
  completionReviewRequired: boolean;
}

export interface WorkshopLifecycleCommandResult
  extends WorkshopOccurrenceOperationalState {
  replayed: boolean;
}

export interface WorkshopOccurrenceCancellationResult {
  replayed: boolean;
  occurrenceId: string;
  lifecycle: 'cancelled';
  reasonCategory: string;
  invalidatedHolds: number;
  checkoutExpirationsQueued: number;
  affectedBookings: number;
  customerNoticesQueued: number;
  refundReviews: number;
  raceReviews: number;
  closedWaitlistEntries: number;
}

export interface WorkshopRescheduleCommandResult {
  replayed: boolean;
  state?: 'accepted' | 'declined' | 'expired' | 'staff_resolved' | 'unavailable';
  responseId?: string;
  sourceOccurrenceId?: string;
  replacementOccurrenceId?: string;
  responseDeadline?: string;
  affectedBookings?: number;
  protectedQuantity?: number;
  expiredResponses?: number;
}

export interface WorkshopWaitlistEntry {
  workshop_waitlist_entry_id: string;
  workshop_occurrence_id: string;
  contact_name: string;
  contact_email: string;
  requested_quantity: number;
  state: 'waiting' | 'offered' | 'converted' | 'expired' | 'withdrawn';
  created_at: string;
  updated_at: string;
}

export interface WorkshopWaitlistOffer {
  workshop_waitlist_offer_id: string;
  workshop_waitlist_entry_id: string;
  workshop_occurrence_id: string;
  quantity: number;
  state: 'active' | 'accepted' | 'expired' | 'cancelled';
  expires_at: string;
  resolved_at: string | null;
  created_at: string;
}

export interface WorkshopWaitlistCommandResult {
  replayed: boolean;
  state: 'waiting' | 'active' | 'accepted' | 'cancelled' | 'expired'
    | 'no_capacity' | 'empty' | 'unavailable';
  entryId?: string;
  offerId?: string;
  quantity?: number;
  effectiveExpiresAt?: string;
}

export interface WorkshopCommunicationQueueItem {
  workshop_message_queue_id: string;
  workshop_booking_id: string | null;
  workshop_waitlist_entry_id: string | null;
  workshop_personal_data_request_id: string | null;
  communication_type: string;
  token_purpose: string | null;
  template_version: string;
  is_required: boolean;
  state: 'queued' | 'claimed' | 'sent' | 'failed' | 'suppressed';
  attempt_count: number;
  next_attempt_at: string;
  expires_at: string | null;
  last_error_category: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface WorkshopCommunicationHistoryItem {
  workshop_communication_id: string;
  workshop_booking_id: string | null;
  workshop_waitlist_entry_id: string | null;
  communication_type: string;
  template_version: string;
  delivery_state: 'sent' | 'failed';
  occurred_at: string;
}

export interface WorkshopRosterRow {
  booking_reference: string;
  contact_name: string;
  active_quantity: number;
  booking_status: WorkshopBookingStatus;
  seat_number: number;
  attendee_name: string | null;
  attendance_state: WorkshopAttendanceState;
}

export interface WorkshopRosterCommandResult {
  replayed: boolean;
  bookingId: string;
  status?: WorkshopBookingStatus;
  activeQuantity?: number;
  attendeeId?: string;
  attendanceState?: WorkshopAttendanceState;
}

export interface WorkshopManualReservation {
  occurrenceId: string;
  quantity: number;
  reservationType: 'manual' | 'complimentary';
  statusTokenDigest: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  reason: string;
}

export interface WorkshopReplacementEmailVerification {
  personalDataRequestId: string;
  state: 'pending' | 'confirmed' | 'expired' | 'invalidated';
  expiresAt: string;
  confirmedAt: string | null;
}

export type WorkshopCustomerStatus =
  | { state: 'processing'; supportReference: string }
  | { state: 'pending_venmo'; supportReference: string; expiresAt: string }
  | {
      state: 'confirmed';
      publicWorkshopPath: string;
      workshopTitle: string;
      startAt: string;
      endAt: string;
      timezone: string;
      venueName: string;
      addressLine1: string;
      addressLine2: string | null;
      locality: string;
      region: string;
      postalCode: string;
      activeQuantity: number;
      termsSnapshot: string;
      analyticsOutcomeGrant?: string;
    }
  | {
      state:
        | 'privacy_verification_pending'
        | 'proposed_email_pending'
        | 'proposed_email_confirmed'
        | 'proposed_email_expired';
    }
  | {
      state: 'action_required';
      action?: 'reschedule';
      responseState?: 'pending' | 'expired';
      responseDeadline?: string;
      sourceTitle?: string;
      sourceStartAt?: string;
      replacementTitle?: string;
      replacementStartAt?: string;
      replacementVenue?: string;
      protectedQuantity?: number;
    }
  | { state: 'expired' | 'cancelled' | 'refunded' }
  | { state: 'unavailable' };

export interface WorkshopPersonalDataRequest {
  workshop_personal_data_request_id: string;
  workshop_booking_id: string;
  request_type: 'correction' | 'minimization';
  requested_field_categories: string[];
  state: WorkshopPersonalDataRequestState;
  verification_method: 'booking_status_token' | 'email_link';
  verification_expires_at: string | null;
  verified_at: string | null;
  replacement_email_expires_at: string | null;
  replacement_email_confirmed_at: string | null;
  retention_policy_version: string | null;
  processed_by: string | null;
  reason_category: string | null;
  earliest_eligible_at: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
}

export interface WorkshopRetentionFieldRule {
  fieldCategory: 'contact_email' | 'contact_phone' | 'attendee_name' | 'accommodation_details';
  permittedActions: Array<'correct' | 'minimize' | 'retain'>;
  minimumAgeDays: number;
  prerequisites: string[];
}

export interface WorkshopDataRetentionPolicy {
  workshop_data_retention_policy_id: string;
  policy_version: string;
  state: WorkshopRetentionPolicyState;
  effective_at: string | null;
  field_rules: WorkshopRetentionFieldRule[];
  operational_retention_days: number;
  communication_retention_days: number;
  financial_retention_days: number;
  dispute_retention_days: number;
  audit_retention_days: number;
  approved_by: string | null;
  approved_at: string | null;
  activated_by: string | null;
  activated_at: string | null;
  retired_by: string | null;
  retired_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkshopRetentionPolicyDraft {
  policyVersion: string;
  fieldRules: WorkshopRetentionFieldRule[];
  operationalRetentionDays: number;
  communicationRetentionDays: number;
  financialRetentionDays: number;
  disputeRetentionDays: number;
  auditRetentionDays: number;
}

export interface WorkshopRetentionPolicyCommandResult {
  replayed: boolean;
  policyId: string;
  policyVersion: string;
  state: WorkshopRetentionPolicyState;
}

export interface WorkshopPersonalDataCommandResult {
  replayed: boolean;
  requestId: string;
  state: WorkshopPersonalDataRequestState | 'accepted' | 'registered' | 'unavailable';
  reasonCategory?: string | null;
  earliestEligibleAt?: string | null;
}

export interface CreateWorkshopBookingRequest {
  occurrenceSlug: string;
  quantity: number;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  acceptedTermsVersion: number;
  commandKey: string;
}

export interface WorkshopHeldBooking {
  state: 'held';
  bookingToken: string;
  supportReference: string;
  quantity: number;
  priceMinor: number;
  totalMinor: number;
  currency: WorkshopCurrency;
  effectiveExpiresAt: string;
  methods: WorkshopPaymentMethod[];
}

export type WorkshopPaymentHandoff =
  | {
      state: 'redirect';
      method: 'stripe';
      url: string;
      effectiveExpiresAt: string;
    }
  | {
      state: 'pending_manual_payment';
      method: 'direct_venmo';
      approvedTarget: string;
      amountMinor: number;
      currency: WorkshopCurrency;
      reference: string;
      effectiveExpiresAt: string;
    };

export interface WorkshopStatusAccessRequest {
  email: string;
  supportReference: string;
}

export interface WorkshopStatusAccessAccepted {
  state: 'accepted';
  message: string;
}

export type WorkshopCustomerAction =
  | 'cancel_booking'
  | 'respond_to_reschedule'
  | 'respond_to_waitlist';

export interface WorkshopCustomerActionResult {
  state: string;
  replayed?: boolean;
  responseId?: string;
  activeQuantity?: number;
  refundProcessingState?: 'not_required' | 'pending_review';
  quantity?: number;
  effectiveExpiresAt?: string;
  bookingToken?: string;
}
