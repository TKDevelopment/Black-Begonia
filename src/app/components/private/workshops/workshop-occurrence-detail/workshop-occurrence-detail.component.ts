import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { WorkshopOccurrence } from '../../../../core/models/workshop';
import {
  WorkshopRosterRow,
  WorkshopOccurrenceOperationalState,
  WorkshopRescheduleResponse,
  WorkshopWaitlistEntry,
} from '../../../../core/models/workshop-booking';
import { WorkshopAdminFacadeService } from '../../../../core/supabase/repositories/workshop-admin-facade.service';
import { WorkshopCatalogRepositoryService } from '../../../../core/supabase/repositories/workshop-catalog-repository.service';
import { WorkshopOperationsRepositoryService } from '../../../../core/supabase/repositories/workshop-operations-repository.service';

@Component({
  selector: 'app-workshop-occurrence-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './workshop-occurrence-detail.component.html',
  styleUrl: './workshop-occurrence-detail.component.scss',
})
export class WorkshopOccurrenceDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly facade = inject(WorkshopAdminFacadeService);
  private readonly catalog = inject(WorkshopCatalogRepositoryService);
  private readonly operations = inject(WorkshopOperationsRepositoryService);
  private readonly formBuilder = inject(FormBuilder);

  readonly occurrenceId = this.route.snapshot.paramMap.get('occurrenceId') ?? '';
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly occurrence = signal<WorkshopOccurrence | null>(null);
  readonly roster = signal<WorkshopRosterRow[]>([]);
  readonly waitlist = signal<WorkshopWaitlistEntry[]>([]);
  readonly operationalState = signal<WorkshopOccurrenceOperationalState | null>(null);
  readonly rescheduleResponses = signal<WorkshopRescheduleResponse[]>([]);
  readonly replacementCandidates = signal<WorkshopOccurrence[]>([]);
  readonly actionBusy = signal(false);
  readonly actionMessage = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly rescheduleForm = this.formBuilder.nonNullable.group({
    replacementOccurrenceId: ['', Validators.required],
    responseDeadline: ['', Validators.required],
  });
  readonly bookingCount = computed(() =>
    new Set(this.roster().map((row) => row.booking_reference)).size);
  readonly activeSeatCount = computed(() => {
    const quantities = new Map<string, number>();
    for (const row of this.roster()) {
      quantities.set(row.booking_reference, row.active_quantity);
    }
    return [...quantities.values()].reduce((sum, value) => sum + value, 0);
  });
  readonly checkedInCount = computed(() =>
    this.roster().filter((row) => row.attendance_state === 'checked_in').length);
  readonly pendingRescheduleCount = computed(() =>
    this.rescheduleResponses().filter((item) => item.response === 'pending').length);
  readonly followUpCount = computed(() =>
    this.rescheduleResponses().filter((item) => item.response === 'expired').length);

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [detail, operationalState, responses, occurrences] = await Promise.all([
        this.facade.loadOccurrenceDetail(this.occurrenceId),
        this.operations.getOperationalState(this.occurrenceId),
        this.operations.listRescheduleResponses(this.occurrenceId),
        this.catalog.listOccurrences(),
      ]);
      if (!detail.occurrence) {
        this.error.set('This workshop occurrence is unavailable.');
        return;
      }
      this.occurrence.set(detail.occurrence);
      this.roster.set(detail.roster);
      this.waitlist.set(detail.waitlist);
      this.operationalState.set(operationalState);
      this.rescheduleResponses.set(responses);
      this.replacementCandidates.set(occurrences.filter((item) =>
        item.workshop_occurrence_id !== this.occurrenceId
        && item.status === 'published_open'
        && new Date(item.start_at).getTime() > Date.now()));
    } catch {
      this.error.set('We could not load this workshop occurrence.');
    } finally {
      this.loading.set(false);
    }
  }

  async transition(targetStatus: 'registration_closed' | 'completed' | 'archived'): Promise<void> {
    if (!window.confirm(`Move this workshop to ${targetStatus.replaceAll('_', ' ')}?`)) {
      return;
    }
    await this.runAction(async () => {
      await this.operations.transitionOccurrence(
        this.occurrenceId, targetStatus, crypto.randomUUID(),
      );
      this.actionMessage.set('Workshop lifecycle updated.');
    });
  }

  async cancelOccurrence(reasonCategory: string): Promise<void> {
    const preview = `${this.bookingCount()} booking(s) and ${this.activeSeatCount()} active seat(s)`;
    if (!window.confirm(
      `Cancel this workshop? ${preview} will be notified and reviewed for refunds.`,
    )) return;
    await this.runAction(async () => {
      const result = await this.operations.cancelOccurrence(
        this.occurrenceId, reasonCategory, crypto.randomUUID(),
      );
      this.actionMessage.set(
        `Workshop cancelled. ${result.customerNoticesQueued} notice(s) queued.`,
      );
    });
  }

  async beginReschedule(): Promise<void> {
    if (this.rescheduleForm.invalid) {
      this.rescheduleForm.markAllAsTouched();
      return;
    }
    const value = this.rescheduleForm.getRawValue();
    const deadline = new Date(value.responseDeadline);
    if (Number.isNaN(deadline.getTime())) {
      this.actionError.set('Choose a valid customer response deadline.');
      return;
    }
    if (!window.confirm(
      `Protect replacement capacity for ${this.activeSeatCount()} active seat(s) and notify affected customers?`,
    )) return;
    await this.runAction(async () => {
      const result = await this.operations.beginReschedule(
        this.occurrenceId,
        value.replacementOccurrenceId,
        deadline.toISOString(),
        crypto.randomUUID(),
      );
      this.actionMessage.set(
        `${result.affectedBookings ?? 0} customer response(s) queued.`,
      );
      this.rescheduleForm.reset();
    });
  }

  async expireDueResponses(): Promise<void> {
    await this.runAction(async () => {
      const result = await this.operations.expireRescheduleResponses(
        this.occurrenceId, crypto.randomUUID(),
      );
      this.actionMessage.set(
        `${result.expiredResponses ?? 0} overdue response(s) flagged.`,
      );
    });
  }

  async resolveNonresponse(responseId: string): Promise<void> {
    if (!window.confirm(
      'Cancel this unconfirmed booking and send it to refund review?',
    )) return;
    await this.runAction(async () => {
      await this.operations.resolveRescheduleNonresponse(
        responseId, crypto.randomUUID(),
      );
      this.actionMessage.set('Nonresponse resolved as cancellation.');
    });
  }

  private async runAction(action: () => Promise<void>): Promise<void> {
    this.actionBusy.set(true);
    this.actionError.set(null);
    this.actionMessage.set(null);
    try {
      await action();
      await this.load();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      this.actionError.set(
        message.includes('insufficient replacement capacity')
          ? 'The replacement does not have enough protected capacity.'
          : message.includes('completion review')
            ? 'This workshop is not ready for completion review.'
            : 'That workshop lifecycle action is no longer available.',
      );
    } finally {
      this.actionBusy.set(false);
    }
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  publicWorkshopRoute(workshop: WorkshopOccurrence): string[] {
    const seriesSlug = workshop.title_snapshot
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80)
      .replace(/-$/, '');
    return ['/workshops', seriesSlug, workshop.local_start.slice(0, 10)];
  }
}
