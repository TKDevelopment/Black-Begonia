import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  ProjectPaymentKind,
  ProjectPaymentMethod,
  ProjectPaymentStatus,
  UpsertProjectPaymentRecordInput,
} from '../../../../../core/models/project-payment-record';

export interface ProjectPaymentLogPayload
  extends Omit<UpsertProjectPaymentRecordInput, 'project_id'> {}

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
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<ProjectPaymentLogPayload>();

  payment_kind: ProjectPaymentKind = 'deposit';
  status: ProjectPaymentStatus = 'paid';
  amount_due: number | null = null;
  amount_paid: number | null = null;
  due_date = '';
  paid_date = '';
  payment_method: ProjectPaymentMethod = 'venmo';
  notes = '';
  error = '';

  ngOnChanges(): void {
    if (this.open) {
      this.error = '';
    }
  }

  submit(): void {
    this.error = '';

    if (this.amount_due === null || this.amount_due < 0) {
      this.error = 'Enter an amount due.';
      return;
    }

    if (this.status === 'paid' && (!this.amount_paid || this.amount_paid <= 0)) {
      this.error = 'Enter an amount paid greater than zero.';
      return;
    }

    this.confirm.emit({
      payment_kind: this.payment_kind,
      status: this.status,
      amount_due: this.amount_due,
      amount_paid: this.amount_paid ?? 0,
      due_date: this.due_date || null,
      paid_date: this.paid_date || (this.status === 'paid' ? new Date().toISOString() : null),
      payment_method: this.status === 'paid' ? this.payment_method : null,
      payment_source: 'manual',
      notes: this.notes || null,
    });
  }
}
