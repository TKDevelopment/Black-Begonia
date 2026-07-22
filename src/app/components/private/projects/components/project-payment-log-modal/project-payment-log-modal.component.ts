import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  ProjectPaymentKind,
  ProjectPaymentMethod,
  ProjectPaymentRecord,
} from '../../../../../core/models/project-payment-record';
import { ManualPaymentResult } from '../../../../../core/models/payment-transaction';

export type ManualPaymentWarning = Exclude<ManualPaymentResult, { state: 'recorded' }>;

export interface ProjectPaymentLogPayload {
  obligation_id: string;
  payment_kind: ProjectPaymentKind;
  amount: number;
  received_at: string;
  payment_method: ProjectPaymentMethod;
  notes?: string | null;
  suspected_reference?: string | null;
  duplicate_override_reason?: string | null;
  confirm_overpayment?: boolean;
  confirm_spillover?: boolean;
  command_key: string;
}

@Component({
  selector: 'app-project-payment-log-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-payment-log-modal.component.html',
  styleUrl: './project-payment-log-modal.component.scss',
})
export class ProjectPaymentLogModalComponent implements OnChanges {
  @Input() open = false;
  @Input() saving = false;
  @Input() obligations: ProjectPaymentRecord[] = [];
  @Input() selectedObligationId: string | null = null;
  @Input() warning: ManualPaymentWarning | null = null;
  @Input() externalError: string | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<ProjectPaymentLogPayload>();

  obligation_id = '';
  payment_kind: ProjectPaymentKind = 'deposit';
  amount: number | null = null;
  received_at = new Date().toISOString().slice(0, 10);
  payment_method: ProjectPaymentMethod = 'cash';
  notes = '';
  suspected_reference = '';
  duplicate_override_reason = '';
  confirm_overpayment = false;
  confirm_spillover = false;
  command_key = '';
  error = '';
  private wasOpen = false;

  ngOnChanges(_changes: SimpleChanges): void {
    if (this.open && !this.wasOpen) {
      this.initializeForm();
    }
    if (this.warning?.state === 'duplicate_warning' && !this.suspected_reference) {
      this.suspected_reference = this.warning.suspectedReference;
    }
    this.wasOpen = this.open;
  }

  submit(): void {
    this.error = '';
    const obligation = this.obligations.find((item) => item.project_payment_record_id === this.obligation_id);
    if (!obligation || !this.canRecord(obligation)) {
      this.error = 'Choose an installment with an outstanding balance.';
      return;
    }
    if (!this.amount || this.amount <= 0) {
      this.error = 'Enter an amount paid greater than zero.';
      return;
    }
    const receivedDate = new Date(`${this.received_at}T12:00:00`);
    if (!this.received_at || Number.isNaN(receivedDate.getTime()) || receivedDate.getTime() > Date.now() + 300000) {
      this.error = 'Choose a valid payment date that is not in the future.';
      return;
    }
    if (!['stripe', 'venmo', 'check', 'cash', 'other'].includes(this.payment_method)) {
      this.error = 'Choose a valid payment method.';
      return;
    }
    if (this.warning?.state === 'duplicate_warning' && (!this.suspected_reference || !this.duplicate_override_reason.trim())) {
      this.error = 'Enter the suspected payment reference and why this is a separate receipt.';
      return;
    }
    if (this.warning?.state === 'spillover_warning' && !this.confirm_spillover) {
      this.error = 'Confirm the proposed spillover before recording this payment.';
      return;
    }
    if (this.warning?.state === 'overpayment_warning' && !this.confirm_overpayment) {
      this.error = 'Confirm the reviewed overpayment before recording this payment.';
      return;
    }

    this.confirm.emit({
      obligation_id: this.obligation_id,
      payment_kind: this.payment_kind,
      amount: this.amount,
      received_at: receivedDate.toISOString(),
      payment_method: this.payment_method,
      notes: this.notes.trim() || null,
      suspected_reference: this.suspected_reference || null,
      duplicate_override_reason: this.duplicate_override_reason.trim() || null,
      confirm_overpayment: this.confirm_overpayment,
      confirm_spillover: this.confirm_spillover,
      command_key: this.command_key,
    });
  }

  selectObligation(id: string): void {
    this.obligation_id = id;
    const obligation = this.obligations.find((item) => item.project_payment_record_id === id);
    if (!obligation) return;
    this.payment_kind = obligation.payment_kind;
    this.amount = Number(obligation.outstanding_amount ?? obligation.amount_due ?? 0);
    if (obligation.plannedMethod === 'cash' || obligation.plannedMethod === 'check') {
      this.payment_method = obligation.plannedMethod;
    }
  }

  canRecord(obligation: ProjectPaymentRecord): boolean {
    return !['paid', 'overpaid', 'waived', 'canceled'].includes(obligation.status)
      && Number(obligation.target_amount ?? obligation.amount_due ?? 0) > 0
      && Number(obligation.outstanding_amount ?? obligation.amount_due ?? 0) > 0;
  }

  formatPaymentKind(kind: ProjectPaymentKind): string {
    return kind === 'deposit' ? 'Deposit' : 'Final Payment';
  }

  private initializeForm(): void {
    this.error = '';
    this.notes = '';
    this.suspected_reference = '';
    this.duplicate_override_reason = '';
    this.confirm_overpayment = false;
    this.confirm_spillover = false;
    this.payment_method = 'cash';
    this.command_key = crypto.randomUUID();
    this.received_at = new Date().toISOString().slice(0, 10);
    const selected = this.obligations.find((item) => item.project_payment_record_id === this.selectedObligationId && this.canRecord(item))
      ?? this.obligations.find((item) => this.canRecord(item));
    this.selectObligation(selected?.project_payment_record_id ?? '');
  }
}
