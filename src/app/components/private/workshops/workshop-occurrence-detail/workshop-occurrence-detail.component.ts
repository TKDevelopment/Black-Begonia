import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { WorkshopOccurrence } from '../../../../core/models/workshop';
import {
  WorkshopOccurrenceOperationalState,
  WorkshopRosterRow,
  WorkshopWaitlistEntry,
} from '../../../../core/models/workshop-booking';
import { WorkshopAdminFacadeService } from '../../../../core/supabase/repositories/workshop-admin-facade.service';
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
  private readonly operations = inject(WorkshopOperationsRepositoryService);
  private readonly formBuilder = inject(FormBuilder);

  readonly occurrenceId = this.route.snapshot.paramMap.get('occurrenceId') ?? '';
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly occurrence = signal<WorkshopOccurrence | null>(null);
  readonly roster = signal<WorkshopRosterRow[]>([]);
  readonly waitlist = signal<WorkshopWaitlistEntry[]>([]);
  readonly operationalState = signal<WorkshopOccurrenceOperationalState | null>(null);
  readonly actionBusy = signal(false);
  readonly actionMessage = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly rescheduleForm = this.formBuilder.nonNullable.group({
    date: ['', Validators.required],
    localStartTime: ['', Validators.required],
    localEndTime: ['', Validators.required],
    registrationCloseDate: ['', Validators.required],
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

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [detail, operationalState] = await Promise.all([
        this.facade.loadOccurrenceDetail(this.occurrenceId),
        this.operations.getOperationalState(this.occurrenceId),
      ]);
      if (!detail.occurrence) {
        this.error.set('This workshop occurrence is unavailable.');
        return;
      }
      this.occurrence.set(detail.occurrence);
      this.roster.set(detail.roster);
      this.waitlist.set(detail.waitlist);
      this.operationalState.set(operationalState);
      this.patchRescheduleForm(detail.occurrence);
    } catch {
      this.error.set('We could not load this workshop occurrence.');
    } finally {
      this.loading.set(false);
    }
  }

  async transition(targetStatus: 'registration_closed'): Promise<void> {
    if (!window.confirm('Close registration for this workshop?')) return;
    await this.runAction(async () => {
      await this.operations.transitionOccurrence(
        this.occurrenceId, targetStatus, crypto.randomUUID(),
      );
      this.actionMessage.set('Workshop registration closed.');
    });
  }

  async cancelOccurrence(reasonCategory: string): Promise<void> {
    const preview = `${this.bookingCount()} booking(s) and ${this.activeSeatCount()} active seat(s)`;
    if (!window.confirm(
      `Cancel this workshop? ${preview} will be cancelled, automatically refunded, and notified.`,
    )) return;
    await this.runAction(async () => {
      const result = await this.operations.cancelOccurrence(
        this.occurrenceId, reasonCategory, crypto.randomUUID(),
      );
      this.actionMessage.set(
        `Workshop cancelled. ${result.refundRequestsQueued} automatic refund(s) and `
        + `${result.customerNoticesQueued} notice(s) queued.`,
      );
    });
  }

  async rescheduleOccurrence(): Promise<void> {
    if (this.rescheduleForm.invalid) {
      this.rescheduleForm.markAllAsTouched();
      return;
    }
    const value = this.rescheduleForm.getRawValue();
    const localStart = `${value.date}T${value.localStartTime}`;
    const localEnd = `${value.date}T${value.localEndTime}`;
    const offset = this.offsetForNewYorkLocal(localStart);
    if (offset === null || value.localEndTime <= value.localStartTime) {
      this.actionError.set('Choose a valid New York workshop date and time.');
      return;
    }
    const workshop = this.occurrence();
    if (!workshop) return;
    let registrationClosesAt: string;
    try {
      registrationClosesAt = workshop.status === 'registration_closed'
        ? workshop.registration_closes_at
        : this.newYorkLocalToIso(
          value.registrationCloseDate === value.date
            ? localStart
            : `${value.registrationCloseDate}T23:59`,
        );
    } catch {
      this.actionError.set('Choose a valid registration closing date.');
      return;
    }
    if (!window.confirm(
      `Move this workshop to ${value.date} and email ${this.bookingCount()} booked customer(s)?`,
    )) return;
    await this.runAction(async () => {
      const result = await this.operations.rescheduleOccurrenceSchedule(
        this.occurrenceId,
        localStart,
        localEnd,
        offset,
        registrationClosesAt,
        crypto.randomUUID(),
      );
      this.actionMessage.set(
        `Workshop rescheduled. ${result.customerNoticesQueued} confirmation email(s) queued.`,
      );
    });
  }

  async completeAndArchive(): Promise<void> {
    if (!window.confirm(
      `Complete and archive this workshop, then thank ${this.bookingCount()} booked customer(s)?`,
    )) return;
    await this.runAction(async () => {
      const result = await this.operations.completeAndArchiveOccurrence(
        this.occurrenceId, crypto.randomUUID(),
      );
      this.actionMessage.set(
        `Workshop archived. ${result.customerThankYousQueued} thank-you email(s) queued.`,
      );
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
        message.includes('completion review')
          ? 'This workshop is not ready for completion review.'
          : message.includes('invalid reschedule')
            ? 'Choose a future schedule and a valid registration deadline.'
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

  private patchRescheduleForm(workshop: WorkshopOccurrence): void {
    this.rescheduleForm.setValue({
      date: workshop.local_start.slice(0, 10),
      localStartTime: workshop.local_start.slice(11, 16),
      localEndTime: workshop.local_end.slice(11, 16),
      registrationCloseDate: this.dateInNewYork(workshop.registration_closes_at),
    });
  }

  private offsetForNewYorkLocal(value: string): number | null {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
    const [date, time] = value.split('T');
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    const matchingOffsets = [-240, -300].filter((offset) => {
      const instant = new Date(
        Date.UTC(year, month - 1, day, hour, minute) - offset * 60_000,
      );
      return this.localPartsInNewYork(instant).join('|')
        === [year, month, day, hour, minute].join('|');
    });
    return matchingOffsets.length === 1 ? matchingOffsets[0] : null;
  }

  private newYorkLocalToIso(value: string): string {
    const offset = this.offsetForNewYorkLocal(value);
    if (offset === null) throw new Error('invalid_new_york_local_time');
    const [date, time] = value.split('T');
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    return new Date(
      Date.UTC(year, month - 1, day, hour, minute) - offset * 60_000,
    ).toISOString();
  }

  private localPartsInNewYork(value: Date): number[] {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(value);
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(
      parts.find((item) => item.type === type)?.value,
    );
    return [part('year'), part('month'), part('day'), part('hour'), part('minute')];
  }

  private dateInNewYork(value: string): string {
    const [year, month, day] = this.localPartsInNewYork(new Date(value));
    return [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')]
      .join('-');
  }
}
