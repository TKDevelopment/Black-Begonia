import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import {
  WorkshopDefinition,
  WorkshopMedia,
  WorkshopMediaRole,
  WorkshopOccurrence,
  WorkshopOccurrenceDraft,
  WorkshopSeries,
  WorkshopSeriesUpdateResult,
  WorkshopSeriesUpdateScope,
} from '../../../../core/models/workshop';
import { ToastService } from '../../../../core/services/toast.service';
import { WorkshopCatalogRepositoryService } from '../../../../core/supabase/repositories/workshop-catalog-repository.service';
import { WorkshopMediaService } from '../../../../core/supabase/services/workshop-media.service';
import { WorkshopCustomerPreviewComponent } from './workshop-customer-preview.component';

type TooltipState = 'hidden' | 'visible' | 'fading';
interface PendingMediaUpload { file: File; altText: string; }

const US_STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'],
  ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'],
  ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'],
  ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'],
  ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'],
  ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
] as const;

const DEFAULT_WORKSHOP_TERMS = `Reservation and payment
Your reservation applies only to the workshop date, time, and number of seats shown in your confirmation. A reservation is confirmed only after full payment is verified. Stripe payments are verified electronically. Direct Venmo payments remain pending until Black Begonia Florals manually verifies the payment before the stated deadline; unverified or expired reservations may release their seats.

Customer cancellations, transfers, and no-shows
Please contact Black Begonia Florals as soon as possible if your plans change. Cancellations received at least 7 calendar days before the workshop are eligible for a refund to the original payment method. Cancellations received 2 to 6 calendar days before the workshop may be transferred to another available workshop or attendee, subject to availability. Cancellations received less than 48 hours before the workshop and no-shows are non-refundable, except where applicable law requires otherwise. Approved refunds may require processing time from the payment provider.

Workshop changes or cancellation
Black Begonia Florals may reschedule or cancel a workshop because of severe weather, instructor illness, unsafe conditions, insufficient enrollment, or another circumstance outside reasonable control. If Black Begonia Florals cancels the workshop, customers may choose a full refund of the workshop price paid or transfer the reservation to an available replacement workshop. Changes to travel, lodging, childcare, or other incidental expenses are not included.

Arrival, participation, and safety
Please arrive on time and follow the instructor's safety guidance when using floral tools and materials. Flowers, foliage, adhesives, dyes, fragrances, and other natural or manufactured materials may cause sensitivities or allergic reactions. Tell Black Begonia Florals before the workshop about relevant allergies, accessibility needs, or requested reasonable modifications. Service animals are welcome as required by applicable law. A parent or legal guardian must accompany any participant under 18 unless Black Begonia Florals agrees otherwise in writing.

Materials, conduct, and photography
Unless the workshop description says otherwise, the listed materials and shared tools are included. Natural flowers and materials vary, so exact colors, varieties, and finished designs may differ from promotional images. Participants must treat staff, guests, the venue, tools, and materials respectfully; behavior that creates a material safety risk or substantially disrupts the workshop may result in removal. Photography may occur during the workshop; tell the florist when you arrive if you do not want to appear in promotional photographs.

Contact and applicable rights
Questions, cancellation requests, transfer requests, and accommodation requests should be sent through Black Begonia Florals' published contact methods. These terms do not limit any consumer or accessibility right that cannot legally be waived.`;

@Component({
  selector: 'app-workshop-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, WorkshopCustomerPreviewComponent],
  templateUrl: './workshop-editor.component.html',
  styleUrl: './workshop-editor.component.scss',
})
export class WorkshopEditorComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly repository = inject(WorkshopCatalogRepositoryService);
  readonly mediaService = inject(WorkshopMediaService);
  private readonly toast = inject(ToastService);

  readonly definitions = signal<WorkshopDefinition[]>([]);
  readonly series = signal<WorkshopSeries[]>([]);
  readonly currentOccurrence = signal<WorkshopOccurrence | null>(null);
  readonly seriesOccurrences = signal<WorkshopOccurrence[]>([]);
  readonly media = signal<WorkshopMedia[]>([]);
  readonly pendingMedia = signal<PendingMediaUpload[]>([]);
  readonly mediaRole = signal<WorkshopMediaRole>('gallery');
  readonly mediaBusy = signal(false);
  readonly conceptBusy = signal(false);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly previewOpen = signal(false);
  readonly publishAfterSave = signal(false);
  readonly seriesLabel = signal('');
  readonly stateOptions = US_STATES;
  readonly invalidTooltips: Record<string, TooltipState> = {};
  private readonly tooltipTimers: Record<string, ReturnType<typeof setTimeout>> = {};
  readonly seriesScope = signal<WorkshopSeriesUpdateScope>('current');
  readonly selectedSeriesOccurrenceIds = signal<string[]>([]);
  readonly seriesUpdatePreview = signal<WorkshopSeriesUpdateResult | null>(null);
  selectedDefinition(): WorkshopDefinition | null {
    return this.definitions().find(
      (definition) => definition.workshop_definition_id === this.form.controls.definitionId.value,
    ) ?? null;
  }

  conceptOptions(): WorkshopDefinition[] {
    const selectedId = this.form.controls.definitionId.value;
    const currentDefinitionId = this.currentOccurrence()?.workshop_definition_id;
    return this.definitions().filter((definition) => definition.is_reusable
      || definition.workshop_definition_id === selectedId
      || definition.workshop_definition_id === currentDefinitionId);
  }

  stripeCatalogMessage(): string | null {
    const definition = this.selectedDefinition();
    if (!definition) return null;
    if (definition.stripe_catalog_state === 'ready') return 'Stripe Checkout is ready.';
    if (definition.stripe_catalog_state === 'pending') return 'Stripe Checkout setup is in progress.';
    if (definition.stripe_catalog_state === 'failed') {
      return `Stripe Checkout setup needs attention${definition.stripe_catalog_error ? `: ${definition.stripe_catalog_error}` : '.'}`;
    }
    return 'Stripe Checkout will be configured when this workshop is saved.';
  }
  readonly previewHeroMedia = computed(() => this.media().find(
    (item) => item.media_role === 'hero',
  ) ?? null);
  readonly previewGalleryMedia = computed(() => this.media().filter(
    (item) => item.media_role === 'gallery',
  ));
  readonly currentSeries = computed(() => this.series().find(
    (item) => item.workshop_series_id === this.currentOccurrence()?.workshop_series_id,
  ) ?? null);
  readonly form = this.fb.nonNullable.group({
    definitionId: [''],
    title: ['', [Validators.required, Validators.pattern(/.*\S.*/), Validators.maxLength(160)]],
    theme: ['', [Validators.required, Validators.pattern(/.*\S.*/), Validators.maxLength(80)]],
    advertisingLine: ['', [Validators.required, Validators.pattern(/.*\S.*/), Validators.maxLength(240)]],
    description: ['', [Validators.required, Validators.pattern(/[\s\S]*\S[\s\S]*/), Validators.maxLength(10000)]],
    includedMaterials: ['', [Validators.required, Validators.pattern(/[\s\S]*\S[\s\S]*/)]],
    terms: [DEFAULT_WORKSHOP_TERMS, [Validators.required, Validators.pattern(/[\s\S]*\S[\s\S]*/)]],
    venueName: ['', [Validators.required, Validators.pattern(/.*\S.*/)]],
    addressLine1: ['', [Validators.required, Validators.pattern(/.*\S.*/)]],
    addressLine2: [''],
    locality: ['', [Validators.required, Validators.pattern(/.*\S.*/)]],
    region: ['', Validators.required],
    postalCode: ['', [Validators.required, Validators.pattern(/^\d{5}(?:-\d{4})?$/)]],
    occurrences: this.fb.nonNullable.array([this.createOccurrenceSchedule()]),
    capacity: [12, [Validators.required, Validators.min(1), Validators.max(10000)]],
    perBookingLimit: [4, [Validators.required, Validators.min(1)]],
    priceMajor: [85, [Validators.required, Validators.min(0), Validators.max(1000000)]],
  });

  readonly occurrenceSchedules = this.form.controls.occurrences;
  private readonly scheduleRevision = signal(0);
  readonly seriesMode = computed(() => {
    this.scheduleRevision();
    return this.occurrenceSchedules.length > 1;
  });
  constructor() {
    this.occurrenceSchedules.valueChanges.subscribe(() => {
      this.scheduleRevision.update((value) => value + 1);
    });
  }

  readonly validationSummary = computed(() => {
    const labels: string[] = [];
    for (const [name, control] of Object.entries(this.form.controls)) {
      if (control.invalid) labels.push(this.fieldLabel(name));
    }
    labels.push(...this.scheduleErrors());
    if (this.seriesMode() && !this.seriesLabel().trim()) labels.push('series label');
    return [...new Set(labels)].join(', ');
  });

  readonly materialChangeWarning = computed(() => {
    const current = this.currentOccurrence();
    if (!current?.published_at) return '';
    const value = this.form.getRawValue();
    const schedule = value.occurrences[0];
    if (
      Math.round(value.priceMajor * 100) !== current.price_minor
      || `${schedule.date}T${schedule.localStartTime}` !== this.toLocalInput(current.local_start)
      || value.venueName.trim() !== current.venue_name
      || value.terms.trim() !== current.terms_snapshot
    ) {
      return 'This published workshop has material price, schedule, venue, or terms changes. Review the public preview before saving.';
    }
    return '';
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      void this.initialize(params.get('occurrenceId'));
    });
  }

  async initialize(occurrenceId: string | null): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [definitions, series] = await Promise.all([
        this.repository.listDefinitions(),
        this.repository.listSeries(),
      ]);
      this.definitions.set(definitions);
      this.series.set(series);
      if (occurrenceId && occurrenceId !== 'new') {
        const occurrence = await this.repository.getOccurrence(occurrenceId);
        if (!occurrence) throw new Error('Workshop occurrence not found.');
        this.currentOccurrence.set(occurrence);
        this.patchOccurrence(occurrence, definitions);
        this.media.set(await this.repository.listMedia(occurrence.workshop_definition_id));
        if (occurrence.workshop_series_id) {
          const related = (await this.repository.listOccurrences()).filter(
            (item) => item.workshop_series_id === occurrence.workshop_series_id,
          );
          this.seriesOccurrences.set(related);
          this.selectedSeriesOccurrenceIds.set([occurrence.workshop_occurrence_id]);
        }
      } else {
        const reusableDefinitions = definitions.filter((definition) => definition.is_reusable);
        if (reusableDefinitions.length === 1) {
          this.form.controls.definitionId.setValue(reusableDefinitions[0].workshop_definition_id);
          this.patchDefinition(reusableDefinitions[0]);
          this.media.set(await this.repository.listMedia(reusableDefinitions[0].workshop_definition_id));
        }
      }
    } catch (error) {
      console.error('[WorkshopEditorComponent] initialize error:', error);
      this.error.set('We could not load this workshop editor.');
    } finally {
      this.loading.set(false);
    }
  }

  scheduleErrors(): string[] {
    const value = this.form.getRawValue();
    const errors: string[] = [];
    value.occurrences.forEach((schedule, index) => {
      const prefix = `Occurrence ${index + 1}`;
      if (schedule.localStartTime && schedule.localEndTime
        && schedule.localEndTime <= schedule.localStartTime) {
        errors.push(`${prefix}: workshop end must follow its start`);
      }
      if (schedule.registrationStartDate && schedule.registrationCloseDate
        && schedule.registrationCloseDate < schedule.registrationStartDate) {
        errors.push(`${prefix}: registration close must follow registration start`);
      }
      if (schedule.registrationCloseDate && schedule.date
        && schedule.registrationCloseDate > schedule.date) {
        errors.push(`${prefix}: registration must close by the workshop date`);
      }
      if (schedule.date && schedule.localStartTime
        && this.offsetForNewYorkLocal(`${schedule.date}T${schedule.localStartTime}`) === null) {
        errors.push(`${prefix}: choose a valid, unambiguous America/New_York start time`);
      }
      if (schedule.date && schedule.localEndTime
        && this.offsetForNewYorkLocal(`${schedule.date}T${schedule.localEndTime}`) === null) {
        errors.push(`${prefix}: choose a valid, unambiguous America/New_York end time`);
      }
    });
    if (value.perBookingLimit > value.capacity) {
      errors.push('Per-booking limit cannot exceed capacity');
    }
    return errors;
  }

  validExample(): Partial<typeof this.form.value> {
    return {
      definitionId: '10000000-0000-4000-8000-000000000001',
      title: 'Summer Garden Centerpiece',
      theme: 'seasonal',
      advertisingLine: 'Design a garden-inspired centerpiece with us.',
      description: 'A welcoming hands-on floral workshop.',
      includedMaterials: 'Flowers, vessel, tools, and instruction.',
      terms: 'Workshop seats are subject to the published cancellation policy.',
      venueName: 'Black Begonia Studio',
      addressLine1: '100 Flower Lane',
      locality: 'Richmond',
      region: 'VA',
      postalCode: '23220',
      occurrences: [{
        date: '2026-08-15',
        localStartTime: '13:00',
        localEndTime: '15:00',
        registrationStartDate: '2026-07-29',
        registrationCloseDate: '2026-08-14',
      }],
      capacity: 12,
      perBookingLimit: 4,
      priceMajor: 85,
    };
  }

  openPreview(): void {
    this.form.markAllAsTouched();
    this.previewOpen.set(true);
  }

  addOccurrence(): void {
    const previous = this.occurrenceSchedules.at(this.occurrenceSchedules.length - 1)?.getRawValue();
    this.occurrenceSchedules.push(this.createOccurrenceSchedule({
      localStartTime: previous?.localStartTime ?? '',
      localEndTime: previous?.localEndTime ?? '',
    }));
  }

  removeOccurrence(index: number): void {
    if (this.occurrenceSchedules.length <= 1) return;
    this.occurrenceSchedules.removeAt(index);
  }

  fieldInvalid(name: string): boolean {
    if (name === 'seriesLabel') return this.seriesMode() && !this.seriesLabel().trim();
    const control = this.form.get(name);
    if (!!control && control.invalid && control.touched) return true;
    if (name === 'perBookingLimit' && this.form.controls.perBookingLimit.touched) {
      return this.form.controls.perBookingLimit.value > this.form.controls.capacity.value;
    }
    const match = /^occurrences\.(\d+)\.(.+)$/.exec(name);
    return match ? !!this.scheduleFieldError(Number(match[1]), match[2]) : false;
  }

  tooltipVisible(name: string): boolean {
    return this.invalidTooltips[name] !== undefined
      && this.invalidTooltips[name] !== 'hidden';
  }

  validationMessage(name: string): string {
    if (name === 'seriesLabel') return 'Series label is required';
    const control = this.form.get(name);
    const label = this.fieldLabel(name.replace(/^occurrences\.\d+\./, ''));
    if (control?.hasError('required')) return `${label} is required`;
    if (control?.hasError('maxlength')) return `${label} is too long`;
    if (control?.hasError('min') || control?.hasError('max')) return `${label} is outside the allowed range`;
    if (name === 'perBookingLimit'
      && this.form.controls.perBookingLimit.value > this.form.controls.capacity.value) {
      return 'Maximum seats per booking cannot exceed open seats';
    }
    const match = /^occurrences\.(\d+)\.(.+)$/.exec(name);
    if (match) return this.scheduleFieldError(Number(match[1]), match[2]) ?? `Review ${label}`;
    return `Review ${label}`;
  }

  private scheduleFieldError(index: number, field: string): string | null {
    const schedule = this.occurrenceSchedules.at(index)?.getRawValue();
    if (!schedule) return null;
    if (field === 'localEndTime' && schedule.localStartTime && schedule.localEndTime
      && schedule.localEndTime <= schedule.localStartTime) {
      return 'Local end time must follow local start time';
    }
    if (field === 'registrationCloseDate' && schedule.registrationStartDate
      && schedule.registrationCloseDate < schedule.registrationStartDate) {
      return 'Registration close date must follow registration start date';
    }
    if (field === 'registrationCloseDate' && schedule.date
      && schedule.registrationCloseDate > schedule.date) {
      return 'Registration must close by the workshop date';
    }
    if ((field === 'localStartTime' || field === 'localEndTime') && schedule.date) {
      const time = field === 'localStartTime' ? schedule.localStartTime : schedule.localEndTime;
      if (time && this.offsetForNewYorkLocal(`${schedule.date}T${time}`) === null) {
        return 'Choose a valid, unambiguous New York local time';
      }
    }
    return null;
  }

  closePreview(): void {
    this.previewOpen.set(false);
  }

  async definitionChanged(): Promise<void> {
    const definition = this.selectedDefinition();
    if (!definition) {
      this.media.set([]);
      return;
    }
    this.patchDefinition(definition);
    try {
      this.media.set(await this.repository.listMedia(definition.workshop_definition_id));
    } catch (error) {
      console.error('[WorkshopEditorComponent] media load error:', error);
      this.error.set('We could not load the workshop imagery.');
    }
  }

  async removeSelectedConcept(): Promise<void> {
    const definition = this.selectedDefinition();
    if (!definition?.is_reusable || this.conceptBusy()) return;
    if (!window.confirm(
      `Remove "${definition.title}" from reusable workshop concepts? Existing workshops and imagery will remain unchanged.`,
    )) return;
    this.conceptBusy.set(true);
    this.error.set(null);
    try {
      const retired = await this.repository.retireDefinition(definition.workshop_definition_id);
      this.definitions.update((items) => items.map((item) =>
        item.workshop_definition_id === retired.workshop_definition_id ? retired : item));
      this.toast.showToast('Concept removed from future workshop choices.', 'success');
    } catch (error) {
      const message = this.safeMessage(error);
      this.error.set(message);
      this.toast.showToast(message, 'error');
    } finally {
      this.conceptBusy.set(false);
    }
  }

  selectMediaFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selected = Array.from(input.files ?? []);
    const files = this.mediaRole() === 'hero' ? selected.slice(0, 1) : selected;
    this.pendingMedia.set(files.map((file) => ({ file, altText: '' })));
  }

  changeMediaRole(role: WorkshopMediaRole): void {
    this.mediaRole.set(role);
    if (role === 'hero') this.pendingMedia.update((items) => items.slice(0, 1));
  }

  updatePendingMediaAlt(index: number, altText: string): void {
    this.pendingMedia.update((items) => items.map((item, itemIndex) => itemIndex === index
      ? { ...item, altText }
      : item));
  }

  trackPendingMedia(_index: number, item: PendingMediaUpload): File {
    return item.file;
  }

  previewDateLabel(): string {
    const value = this.occurrenceSchedules.at(0).controls.date.value;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return 'Date not set';
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}`;
  }

  previewTimeLabel(): string {
    const schedule = this.occurrenceSchedules.at(0).controls;
    const start = this.formatPreviewClock(schedule.localStartTime.value);
    const end = this.formatPreviewClock(schedule.localEndTime.value);
    return start && end ? `@ ${start} - ${end}` : 'Time not set';
  }

  async uploadMedia(): Promise<void> {
    const pending = this.pendingMedia();
    if (!pending.length) {
      this.showMediaError('Choose one or more images to upload.');
      return;
    }
    const mediaErrors = pending.flatMap(({ file, altText }) => this.mediaService
      .validateImage(file, altText)
      .map((message) => `${file.name}: ${message}`));
    if (mediaErrors.length) {
      this.showMediaError(mediaErrors.join(' '));
      return;
    }
    const definitionFields = [
      'title', 'theme', 'advertisingLine', 'description', 'includedMaterials', 'terms',
    ];
    if (!this.form.controls.definitionId.value
      && definitionFields.some((name) => this.form.get(name)?.invalid)) {
      definitionFields.forEach((name) => this.form.get(name)?.markAsTouched());
      this.showInvalidTooltips(definitionFields);
      this.showMediaError('Complete the required Workshop Story fields before uploading.');
      return;
    }

    this.mediaBusy.set(true);
    this.error.set(null);
    try {
      const definitionId = await this.resolveDefinition();
      let uploadedCount = 0;
      for (const item of pending) {
        const dimensions = await this.readImageDimensions(item.file);
        const uploaded = await this.mediaService.upload({
          owner: { definitionId },
          role: this.mediaRole(),
          file: item.file,
          altText: item.altText,
          displayOrder: this.media().length,
          ...dimensions,
        });
        this.media.update((items) => [...items, uploaded]);
        this.pendingMedia.update((items) => items.slice(1));
        uploadedCount += 1;
      }
      this.toast.showToast(
        uploadedCount === 1
          ? 'Workshop image uploaded.'
          : `${uploadedCount} workshop images uploaded.`,
        'success',
      );
    } catch (error) {
      this.showMediaError(this.safeMessage(error));
    } finally {
      this.mediaBusy.set(false);
    }
  }

  async moveMedia(index: number, direction: -1 | 1): Promise<void> {
    const target = index + direction;
    if (target < 0 || target >= this.media().length || this.mediaBusy()) return;
    const reordered = [...this.media()];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    this.mediaBusy.set(true);
    try {
      await this.mediaService.reorder(reordered);
      this.media.set(reordered.map((item, displayOrder) => ({ ...item, display_order: displayOrder })));
    } catch (error) {
      this.error.set(this.safeMessage(error));
    } finally {
      this.mediaBusy.set(false);
    }
  }

  async removeMedia(item: WorkshopMedia): Promise<void> {
    if (this.mediaBusy() || !confirm(`Remove image "${item.alt_text}"?`)) return;
    this.mediaBusy.set(true);
    try {
      await this.mediaService.remove(item);
      this.media.update((items) => items.filter(
        (candidate) => candidate.workshop_media_id !== item.workshop_media_id,
      ));
    } catch (error) {
      this.error.set(this.safeMessage(error));
    } finally {
      this.mediaBusy.set(false);
    }
  }

  async save(publish: boolean): Promise<void> {
    if (this.seriesMode() && !this.currentOccurrence()) {
      await this.generateSeries(publish);
      return;
    }
    this.form.markAllAsTouched();
    if (this.form.invalid || this.scheduleErrors().length || this.saving()) {
      this.showInvalidTooltips();
      this.error.set(`Review these fields: ${this.validationSummary()}.`);
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const definitionId = await this.resolveDefinition();
      const value = this.form.getRawValue();
      const priceVersionId = (await this.repository.syncStripeCatalog(
        definitionId,
        Math.round(value.priceMajor * 100),
        crypto.randomUUID(),
      )).priceVersionId;
      const saved = await this.repository.saveOccurrence(
        this.buildDraft(definitionId, priceVersionId),
        crypto.randomUUID(),
      );
      const finalOccurrence = publish
        ? await this.repository.publishOccurrence(saved.workshop_occurrence_id, crypto.randomUUID())
        : saved;
      this.currentOccurrence.set(finalOccurrence);
      this.toast.showToast(publish ? 'Workshop published.' : 'Workshop draft saved.', 'success');
      await this.router.navigate(['/admin/workshops', finalOccurrence.workshop_occurrence_id, 'edit']);
    } catch (error) {
      const message = this.safeMessage(error);
      this.error.set(message);
      this.toast.showToast(message, 'error');
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    void this.router.navigate(['/admin/workshops']);
  }

  async generateSeries(publish: boolean): Promise<void> {
    this.form.markAllAsTouched();
    if (
      this.form.invalid
      || this.scheduleErrors().length
      || !this.seriesLabel().trim()
      || this.occurrenceSchedules.length < 2
      || this.saving()
    ) {
      this.showInvalidTooltips();
      this.error.set('Provide a series label and at least two valid workshop occurrences.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const definitionId = await this.resolveDefinition();
      const value = this.form.getRawValue();
      const priceVersionId = (await this.repository.syncStripeCatalog(
        definitionId,
        Math.round(value.priceMajor * 100),
        crypto.randomUUID(),
      )).priceVersionId;
      const createdSeries = await this.repository.createSeries({
        workshopDefinitionId: definitionId,
        label: this.seriesLabel(),
        capacity: value.capacity,
        priceMinor: Math.round(value.priceMajor * 100),
        venueName: value.venueName,
        addressLine1: value.addressLine1,
        addressLine2: value.addressLine2,
        locality: value.locality,
        region: value.region,
        postalCode: value.postalCode,
        country: 'US',
        timezone: 'America/New_York',
      });
      const schedules = this.occurrenceSchedules.getRawValue();
      const drafts = schedules.map((schedule, index) => {
        const duplicateDate = schedules.filter((item) => item.date === schedule.date).length > 1;
        return this.buildDraft(definitionId, priceVersionId, schedule, {
          workshopOccurrenceId: undefined,
          workshopSeriesId: createdSeries.workshop_series_id,
          slug: this.generatedSlug(value.title, schedule, duplicateDate ? index : undefined),
        });
      });
      const generated = await this.repository.generateSeries(
        createdSeries.workshop_series_id,
        drafts,
        crypto.randomUUID(),
      );
      if (publish) {
        for (const occurrence of generated) {
          await this.repository.publishOccurrence(
            occurrence.workshop_occurrence_id,
            crypto.randomUUID(),
          );
        }
      }
      this.toast.showToast(
        `${generated.length} workshop dates ${publish ? 'published' : 'created as drafts'}.`,
        'success',
      );
      await this.router.navigate(['/admin/workshops']);
    } catch (error) {
      const message = this.safeMessage(error);
      this.error.set(message);
      this.toast.showToast(message, 'error');
    } finally {
      this.saving.set(false);
    }
  }

  toggleSeriesOccurrence(id: string, checked: boolean): void {
    this.selectedSeriesOccurrenceIds.update((ids) => checked
      ? [...new Set([...ids, id])]
      : ids.filter((candidate) => candidate !== id));
    this.seriesUpdatePreview.set(null);
  }

  async previewBulkUpdate(): Promise<void> {
    const series = this.currentSeries();
    const current = this.currentOccurrence();
    if (!series || !current) return;
    const occurrenceIds = this.seriesScope() === 'current'
      ? [current.workshop_occurrence_id]
      : this.selectedSeriesOccurrenceIds();
    try {
      this.seriesUpdatePreview.set(await this.repository.previewSeriesUpdate(
        series.workshop_series_id,
        occurrenceIds,
        this.buildSeriesPatch(),
      ));
    } catch (error) {
      this.error.set(this.safeMessage(error));
    }
  }

  async applyBulkUpdate(): Promise<void> {
    const series = this.currentSeries();
    const preview = this.seriesUpdatePreview();
    if (!series || !preview) return;
    if (
      preview.bookedOccurrenceIds.length
      && !window.confirm(
        `${preview.bookedOccurrenceIds.length} selected workshop date(s) already have bookings. Apply this material change?`,
      )
    ) return;
    this.saving.set(true);
    try {
      await this.repository.applySeriesUpdate(
        series.workshop_series_id,
        preview.occurrenceIds,
        {
          ...this.buildSeriesPatch(),
          confirmedBookedOccurrenceIds: preview.bookedOccurrenceIds,
        },
        crypto.randomUUID(),
      );
      this.toast.showToast('Series occurrences updated.', 'success');
      this.seriesUpdatePreview.set(null);
      await this.initialize(this.currentOccurrence()!.workshop_occurrence_id);
    } catch (error) {
      this.error.set(this.safeMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  overrideLabels(occurrence: WorkshopOccurrence): string[] {
    const series = this.currentSeries();
    if (!series) return [];
    const labels: string[] = [];
    if (occurrence.venue_name !== series.default_venue_name) labels.push('Venue override');
    if (occurrence.capacity !== series.default_capacity) labels.push('Capacity override');
    if (occurrence.price_minor !== series.default_price_minor) labels.push('Price override');
    if (occurrence.timezone !== series.default_timezone) labels.push('Timezone override');
    return labels;
  }

  private async resolveDefinition(): Promise<string> {
    const value = this.form.getRawValue();
    if (value.definitionId) return value.definitionId;
    const definition = await this.repository.createDefinition({
      title: value.title,
      theme: value.theme,
      advertisingLine: value.advertisingLine,
      description: value.description,
      includedMaterials: value.includedMaterials,
      defaultTerms: value.terms,
    });
    this.definitions.update((items) => [...items, definition]);
    this.form.controls.definitionId.setValue(definition.workshop_definition_id);
    return definition.workshop_definition_id;
  }

  private patchDefinition(definition: WorkshopDefinition): void {
    this.form.patchValue({
      title: definition.title,
      theme: definition.theme,
      advertisingLine: definition.advertising_line,
      description: definition.description,
      includedMaterials: definition.included_materials,
      terms: definition.default_terms,
    });
  }

  private buildDraft(
    definitionId: string,
    stripePriceVersionId?: string | null,
    schedule = this.occurrenceSchedules.at(0).getRawValue(),
    identity?: Pick<WorkshopOccurrenceDraft, 'workshopOccurrenceId' | 'workshopSeriesId' | 'slug'>,
  ): WorkshopOccurrenceDraft {
    const value = this.form.getRawValue();
    const localStart = `${schedule.date}T${schedule.localStartTime}`;
    const localEnd = `${schedule.date}T${schedule.localEndTime}`;
    const utcOffsetMinutes = this.offsetForNewYorkLocal(localStart);
    if (utcOffsetMinutes === null) throw new Error('invalid_workshop_start_time');
    return {
      workshopOccurrenceId: identity?.workshopOccurrenceId
        ?? this.currentOccurrence()?.workshop_occurrence_id,
      workshopDefinitionId: definitionId,
      workshopSeriesId: identity?.workshopSeriesId
        ?? this.currentOccurrence()?.workshop_series_id,
      slug: identity?.slug
        ?? this.currentOccurrence()?.slug
        ?? this.generatedSlug(value.title, schedule),
      title: value.title.trim(),
      advertisingLine: value.advertisingLine.trim(),
      description: value.description.trim(),
      includedMaterials: value.includedMaterials.trim(),
      terms: value.terms.trim(),
      termsVersion: this.currentOccurrence()?.terms_version ?? 1,
      venueName: value.venueName.trim(),
      addressLine1: value.addressLine1.trim(),
      addressLine2: value.addressLine2.trim() || null,
      locality: value.locality.trim(),
      region: value.region.trim(),
      postalCode: value.postalCode.trim(),
      country: 'US',
      timezone: 'America/New_York',
      localStart,
      localEnd,
      utcOffsetMinutes,
      registrationOpensAt: this.newYorkLocalToIso(`${schedule.registrationStartDate}T00:00`),
      registrationClosesAt: this.newYorkLocalToIso(
        schedule.registrationCloseDate === schedule.date
          ? `${schedule.date}T${schedule.localStartTime}`
          : `${schedule.registrationCloseDate}T23:59`,
      ),
      capacity: value.capacity,
      perBookingLimit: value.perBookingLimit,
      priceMinor: Math.round(value.priceMajor * 100),
      currency: 'USD',
      stripePriceVersionId,
      stripeEnabled: true,
      venmoEnabled: true,
      waitlistEnabled: true,
      isFeatured: true,
      featuredOrder: this.currentOccurrence()?.featured_order,
    };
  }

  private buildSeriesPatch() {
    const value = this.form.getRawValue();
    return {
      scope: this.seriesScope(),
      title: value.title.trim(),
      advertisingLine: value.advertisingLine.trim(),
      description: value.description.trim(),
      includedMaterials: value.includedMaterials.trim(),
      terms: value.terms.trim(),
      termsVersion: this.currentOccurrence()?.terms_version ?? 1,
      venueName: value.venueName.trim(),
      addressLine1: value.addressLine1.trim(),
      addressLine2: value.addressLine2.trim() || null,
      locality: value.locality.trim(),
      region: value.region.trim(),
      postalCode: value.postalCode.trim(),
      country: 'US',
      capacity: value.capacity,
      perBookingLimit: value.perBookingLimit,
      priceMinor: Math.round(value.priceMajor * 100),
      stripePriceVersionId: this.currentOccurrence()?.stripe_price_version_id,
      stripeEnabled: true,
      venmoEnabled: true,
      waitlistEnabled: true,
    } as const;
  }

  private patchOccurrence(occurrence: WorkshopOccurrence, definitions: WorkshopDefinition[]): void {
    const definition = definitions.find((item) => item.workshop_definition_id === occurrence.workshop_definition_id);
    this.form.patchValue({
      definitionId: occurrence.workshop_definition_id,
      theme: definition?.theme ?? '',
      title: occurrence.title_snapshot,
      advertisingLine: occurrence.advertising_line_snapshot,
      description: occurrence.description_snapshot,
      includedMaterials: occurrence.included_materials_snapshot,
      terms: occurrence.terms_snapshot,
      venueName: occurrence.venue_name,
      addressLine1: occurrence.address_line_1,
      addressLine2: occurrence.address_line_2 ?? '',
      locality: occurrence.locality,
      region: occurrence.region,
      postalCode: occurrence.postal_code,
      occurrences: [{
        date: occurrence.local_start.slice(0, 10),
        localStartTime: occurrence.local_start.slice(11, 16),
        localEndTime: occurrence.local_end.slice(11, 16),
        registrationStartDate: this.dateInNewYork(occurrence.registration_opens_at),
        registrationCloseDate: this.dateInNewYork(occurrence.registration_closes_at),
      }],
      capacity: occurrence.capacity,
      perBookingLimit: occurrence.per_booking_limit,
      priceMajor: occurrence.price_minor / 100,
    });
  }

  private toLocalInput(value: string): string {
    return value.slice(0, 16);
  }

  private async readImageDimensions(file: File): Promise<{ width: number; height: number }> {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  }

  private createOccurrenceSchedule(initial?: Partial<{
    date: string;
    localStartTime: string;
    localEndTime: string;
    registrationStartDate: string;
    registrationCloseDate: string;
  }>) {
    return this.fb.nonNullable.group({
      date: [initial?.date ?? '', Validators.required],
      localStartTime: [initial?.localStartTime ?? '', Validators.required],
      localEndTime: [initial?.localEndTime ?? '', Validators.required],
      registrationStartDate: [initial?.registrationStartDate ?? '', Validators.required],
      registrationCloseDate: [initial?.registrationCloseDate ?? '', Validators.required],
    });
  }

  private generatedSlug(
    title: string,
    schedule: { date: string; localStartTime: string },
    duplicateIndex?: number,
  ): string {
    const base = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      || 'workshop';
    const duplicateSuffix = duplicateIndex === undefined
      ? ''
      : `-${schedule.localStartTime.replace(':', '')}-${duplicateIndex + 1}`;
    return `${base}-${schedule.date}${duplicateSuffix}`;
  }

  private offsetForNewYorkLocal(value: string): number | null {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
    const [date, time] = value.split('T');
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    const matchingOffsets = [-240, -300].filter((offset) => {
      const instant = new Date(Date.UTC(year, month - 1, day, hour, minute) - offset * 60_000);
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
    return new Date(Date.UTC(year, month - 1, day, hour, minute) - offset * 60_000).toISOString();
  }

  private localPartsInNewYork(value: Date): number[] {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(value);
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(
      parts.find((item) => item.type === type)?.value,
    );
    return [part('year'), part('month'), part('day'), part('hour'), part('minute')];
  }

  private dateInNewYork(value: string): string {
    const [year, month, day] = this.localPartsInNewYork(new Date(value));
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private showInvalidTooltips(fieldNames?: string[]): void {
    const names = fieldNames ?? Object.keys(this.form.controls)
      .filter((name) => name !== 'occurrences');
    if (!fieldNames) {
      if (this.seriesMode()) names.push('seriesLabel');
      this.occurrenceSchedules.controls.forEach((_, index) => {
        names.push(
          `occurrences.${index}.date`,
          `occurrences.${index}.localStartTime`,
          `occurrences.${index}.localEndTime`,
          `occurrences.${index}.registrationStartDate`,
          `occurrences.${index}.registrationCloseDate`,
        );
      });
    }
    names.forEach((name) => {
      const control = this.form.get(name);
      if (!this.fieldInvalid(name)) {
        this.invalidTooltips[name] = 'hidden';
        return;
      }
      this.invalidTooltips[name] = 'visible';
      if (this.tooltipTimers[name]) clearTimeout(this.tooltipTimers[name]);
      this.tooltipTimers[name] = setTimeout(() => {
        this.invalidTooltips[name] = 'fading';
        this.tooltipTimers[name] = setTimeout(() => {
          this.invalidTooltips[name] = 'hidden';
        }, 400);
      }, 3000);
    });
  }

  private formatPreviewClock(value: string): string | null {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    const hour = Number(match[1]);
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
  }

  private fieldLabel(name: string): string {
    if (name === 'postalCode') return 'zipcode';
    if (name === 'capacity') return 'open seats';
    return name.replace(/([A-Z])/g, ' $1').toLowerCase();
  }

  private showMediaError(message: string): void {
    this.error.set(message);
    this.toast.showToast(message, 'error');
  }

  private safeMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
      const message = String((error as { message: unknown }).message);
      if (message.length < 240) return message;
    }
    return 'We could not save this workshop.';
  }
}
