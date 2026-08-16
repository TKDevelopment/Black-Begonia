import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  WorkshopExpense,
  WorkshopFinancialEntry,
  WorkshopFinancialSummary,
  WorkshopPaymentException,
  WorkshopRefundEligibility,
} from '../../../../core/models/workshop-financial';
import { WorkshopOccurrence } from '../../../../core/models/workshop';
import { WorkshopAdminFacadeService } from '../../../../core/supabase/repositories/workshop-admin-facade.service';
import { WorkshopFinancialRepositoryService } from '../../../../core/supabase/repositories/workshop-financial-repository.service';

@Component({
  selector: 'app-workshop-financials',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './workshop-financials.component.html',
  styleUrl: './workshop-financials.component.scss',
})
export class WorkshopFinancialsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly facade = inject(WorkshopAdminFacadeService);
  private readonly financials = inject(WorkshopFinancialRepositoryService);

  readonly occurrenceId = this.route.snapshot.paramMap.get('occurrenceId') ?? '';
  readonly occurrence = signal<WorkshopOccurrence | null>(null);
  readonly summary = signal<WorkshopFinancialSummary | null>(null);
  readonly entries = signal<WorkshopFinancialEntry[]>([]);
  readonly expenses = signal<WorkshopExpense[]>([]);
  readonly exceptions = signal<WorkshopPaymentException[]>([]);
  readonly refundEligibility = signal<WorkshopRefundEligibility | null>(null);
  readonly receipt = signal<File | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly chargeEntries = computed(() =>
    this.entries().filter(entry =>
      entry.source_type === 'transaction' && entry.entry_category === 'charge' &&
      entry.transaction_state !== 'exception'
    ),
  );
  readonly attentionEntries = computed(() =>
    this.entries().filter(entry =>
      ['dispute', 'reversal'].includes(entry.entry_category)
    ),
  );

  readonly expenseForm = this.fb.nonNullable.group({
    category: ['materials', Validators.required],
    description: ['', [Validators.required, Validators.maxLength(500)]],
    vendorOrPayee: ['', Validators.maxLength(160)],
    note: ['', Validators.maxLength(500)],
    amountMinor: [0, [Validators.required, Validators.min(1)]],
    expenseDate: [new Date().toISOString().slice(0, 10), Validators.required],
  });
  readonly refundForm = this.fb.nonNullable.group({
    transactionId: ['', Validators.required],
    amountMinor: [0, [Validators.required, Validators.min(1)]],
    reason: ['customer_requested', Validators.required],
  });
  readonly externalRefundForm = this.fb.nonNullable.group({
    transactionId: ['', Validators.required],
    amountMinor: [0, [Validators.required, Validators.min(1)]],
    reference: ['', Validators.required],
    reason: ['customer_requested', Validators.required],
    occurredAt: [new Date().toISOString().slice(0, 16), Validators.required],
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const overview = await this.facade.loadFinancialOverview(this.occurrenceId);
      this.occurrence.set(overview.occurrence);
      this.summary.set(overview.summary);
      this.entries.set(overview.entries);
      this.expenses.set(overview.expenses);
      this.exceptions.set(overview.exceptions);
    } catch {
      this.error.set('Workshop financials could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }

  selectReceipt(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (
      file && file.size <= 10 * 1024 * 1024 &&
      ['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)
    ) {
      this.receipt.set(file);
      this.error.set('');
    } else if (file) {
      this.receipt.set(null);
      this.error.set('Receipt evidence must be a JPG, PNG, or PDF up to 10 MB.');
    }
  }

  async submitExpense(): Promise<void> {
    if (this.expenseForm.invalid || !Number.isSafeInteger(this.expenseForm.value.amountMinor)) {
      this.expenseForm.markAllAsTouched();
      this.error.set('Enter a valid positive whole-cent expense.');
      return;
    }
    await this.run(async () => {
      const raw = this.expenseForm.getRawValue();
      const receiptStoragePath = this.receipt()
        ? await this.financials.uploadReceipt(this.occurrenceId, this.receipt()!)
        : undefined;
      await this.financials.recordExpense({
        occurrenceId: this.occurrenceId,
        category: raw.category as never,
        description: raw.description,
        vendorOrPayee: raw.vendorOrPayee,
        note: raw.note,
        amountMinor: raw.amountMinor,
        expenseDate: raw.expenseDate,
        receiptStoragePath,
      }, crypto.randomUUID());
      this.message.set('Expense added to immutable financial history.');
      this.receipt.set(null);
    });
  }

  async inspectRefund(transactionId: string): Promise<void> {
    await this.run(async () => {
      const eligibility = await this.financials.getRefundEligibility(transactionId);
      this.refundEligibility.set(eligibility);
      this.refundForm.patchValue({
        transactionId,
        amountMinor: eligibility.remainingRefundableMinor,
      });
      this.message.set(eligibility.eligible
        ? 'Refund eligibility verified. Confirm the amount and reason.'
        : 'This charge has no technically refundable balance.');
    }, false);
  }

  async submitRefund(): Promise<void> {
    const raw = this.refundForm.getRawValue();
    const eligibility = this.refundEligibility();
    if (
      this.refundForm.invalid || !eligibility?.eligible ||
      raw.transactionId !== eligibility.transactionId ||
      !Number.isSafeInteger(raw.amountMinor) ||
      raw.amountMinor > eligibility.remainingRefundableMinor
    ) {
      this.error.set('Refresh eligibility and enter an amount within the remaining balance.');
      return;
    }
    if (!window.confirm(
      `Request a ${this.money(raw.amountMinor)} Stripe refund? ` +
      'This does not cancel seats or change workshop capacity.',
    )) return;
    await this.run(async () => {
      const result = await this.financials.requestStripeRefund(
        raw.transactionId, raw.amountMinor, raw.reason, crypto.randomUUID(),
      );
      this.message.set(result.state === 'provider_accepted'
        ? 'Stripe accepted the refund request. Webhook reconciliation is pending.'
        : `Refund outcome: ${result.state.replaceAll('_', ' ')}.`);
      this.refundEligibility.set(null);
    });
  }

  async submitExternalRefund(): Promise<void> {
    const raw = this.externalRefundForm.getRawValue();
    if (
      this.externalRefundForm.invalid ||
      !Number.isSafeInteger(raw.amountMinor) || raw.amountMinor <= 0
    ) {
      this.error.set('Enter the externally completed refund amount and reference.');
      return;
    }
    if (!window.confirm(
      'Record this externally completed refund? This records money only and does not cancel seats.',
    )) return;
    await this.run(async () => {
      await this.financials.recordExternalRefund(
        raw.transactionId, raw.amountMinor, raw.reference.trim(), raw.reason,
        new Date(raw.occurredAt).toISOString(), crypto.randomUUID(),
      );
      this.message.set('External refund added to immutable financial history.');
    });
  }

  async resolveException(exception: WorkshopPaymentException): Promise<void> {
    if (!window.confirm(
      'Resolve this financial exception? Original transactions remain immutable.',
    )) return;
    await this.run(async () => {
      await this.financials.resolveException(
        exception.workshop_payment_exception_id,
        'provider_resolved',
        `CRM-${crypto.randomUUID()}`,
        crypto.randomUUID(),
      );
      this.message.set('Financial exception resolved with an audit reference.');
    });
  }

  downloadExport(): void {
    const csv = this.financials.exportEntries(this.entries());
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `workshop-financials-${this.occurrenceId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  money(amountMinor: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
    }).format(amountMinor / 100);
  }

  private async run(action: () => Promise<void>, reload = true): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    try {
      await action();
      if (reload) await this.load();
    } catch {
      this.error.set(
        'The financial action could not be completed. No seats or source facts were changed.',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
