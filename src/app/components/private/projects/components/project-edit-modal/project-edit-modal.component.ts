import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Project, PROJECT_STATUSES, ProjectStatus, UpdateProjectInput } from '../../../../../core/models/project';
import { Lead } from '../../../../../core/models/lead';
import {
  FloralServiceDefinition,
  FloralServiceEventType,
  getFloralServicesForEventType,
  resolveFloralServiceDatabaseValue,
  resolveFloralServiceLabel,
} from '../../../../../core/floral-services/floral-service-catalog';

export interface ProjectEditPayload extends UpdateProjectInput {
  event_start_time?: string | null;
  ceremony_start_time?: string | null;
  reception_start_time?: string | null;
}

@Component({
  selector: 'app-project-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-edit-modal.component.html',
  styleUrl: './project-edit-modal.component.scss',
})
export class ProjectEditModalComponent implements OnChanges {
  private readonly weddingServiceOptions = getFloralServicesForEventType('wedding');
  private readonly generalServiceOptions = getFloralServicesForEventType('general');

  @Input() open = false;
  @Input() saving = false;
  @Input() project: Project | null = null;
  @Input() sourceLead: Lead | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<ProjectEditPayload>();

  readonly statuses = PROJECT_STATUSES;
  readonly eventTypes: FloralServiceEventType[] = ['general', 'wedding'];
  form: ProjectEditPayload = {};
  error = '';

  get selectedEventType(): FloralServiceEventType {
    return this.form.event_type === 'wedding' ? 'wedding' : 'general';
  }

  get serviceTypeOptions(): FloralServiceDefinition[] {
    return this.selectedEventType === 'wedding'
      ? this.weddingServiceOptions
      : this.generalServiceOptions;
  }

  get timingEditable(): boolean {
    return !!this.sourceLead;
  }

  ngOnChanges(): void {
    if (!this.project || !this.open) {
      return;
    }

    this.error = '';
    this.form = {
      project_name: this.project.project_name,
      event_type: this.project.event_type ?? null,
      service_type: this.project.service_type,
      event_date: this.project.event_date ?? null,
      ceremony_venue_name: this.project.ceremony_venue_name ?? null,
      ceremony_venue_city: this.project.ceremony_venue_city ?? null,
      ceremony_venue_state: this.project.ceremony_venue_state ?? null,
      ceremony_venue_address: this.project.ceremony_venue_address ?? null,
      ceremony_venue_zipcode: this.project.ceremony_venue_zipcode ?? null,
      reception_venue_name: this.project.reception_venue_name ?? null,
      reception_venue_city: this.project.reception_venue_city ?? null,
      reception_venue_state: this.project.reception_venue_state ?? null,
      reception_venue_address: this.project.reception_venue_address ?? null,
      reception_venue_zipcode: this.project.reception_venue_zipcode ?? null,
      style_notes: this.project.style_notes ?? null,
      internal_notes: this.project.internal_notes ?? null,
      status: this.project.status,
      event_start_time: this.sourceLead?.event_start_time ?? null,
      ceremony_start_time: this.sourceLead?.ceremony_start_time ?? null,
      reception_start_time: this.sourceLead?.reception_start_time ?? null,
    };

    this.form.service_type =
      resolveFloralServiceLabel(this.project.service_type, this.selectedEventType) ??
      this.project.service_type;
  }

  onEventTypeChange(value: FloralServiceEventType): void {
    this.form.event_type = value;

    const serviceStillValid = this.serviceTypeOptions.some(
      (option) => option.label === this.form.service_type
    );

    if (!serviceStillValid) {
      this.form.service_type = '';
    }
  }

  submit(): void {
    this.error = '';

    if (!this.form.project_name?.trim()) {
      this.error = 'Project name is required.';
      return;
    }

    if (!this.form.service_type?.trim()) {
      this.error = 'Service type is required.';
      return;
    }

    const serviceType = resolveFloralServiceDatabaseValue(
      this.form.service_type,
      this.selectedEventType
    );

    if (!serviceType) {
      this.error = 'Choose a valid service type for the selected event type.';
      return;
    }

    this.confirm.emit({
      ...this.form,
      project_name: this.form.project_name.trim(),
      service_type: serviceType,
      event_type: this.selectedEventType,
      event_date: this.form.event_date || null,
      status: this.form.status as ProjectStatus,
      event_start_time: this.timingEditable
        ? this.normalizeTime(this.form.event_start_time)
        : undefined,
      ceremony_start_time: this.timingEditable
        ? this.normalizeTime(this.form.ceremony_start_time)
        : undefined,
      reception_start_time: this.timingEditable
        ? this.normalizeTime(this.form.reception_start_time)
        : undefined,
    });
  }

  formatStatus(status: ProjectStatus): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  formatEventType(eventType: FloralServiceEventType): string {
    return eventType.replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private normalizeTime(value: string | null | undefined): string | null {
    return value?.trim() || null;
  }
}
