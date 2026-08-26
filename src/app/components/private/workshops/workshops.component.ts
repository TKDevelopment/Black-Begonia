import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import {
  WorkshopLifecycleStatus,
  WorkshopOccurrence,
  WorkshopSeries,
} from '../../../core/models/workshop';
import { ToastService } from '../../../core/services/toast.service';
import { WorkshopCatalogRepositoryService } from '../../../core/supabase/repositories/workshop-catalog-repository.service';
import { CrmPageHeaderComponent } from '../../../shared/components/private/crm-page-header/crm-page-header.component';
import { ErrorStateBlockComponent } from '../../../shared/components/private/error-state-block/error-state-block.component';
import { LoadingStateBlockComponent } from '../../../shared/components/private/loading-state-block/loading-state-block.component';

type WorkshopStatusFilter = 'all' | WorkshopLifecycleStatus;

interface WorkshopConceptCard {
  workshopDefinitionId: string;
  title: string;
  occurrences: WorkshopOccurrence[];
}

@Component({
  selector: 'app-admin-workshops',
  standalone: true,
  imports: [CommonModule, CrmPageHeaderComponent, ErrorStateBlockComponent, LoadingStateBlockComponent],
  templateUrl: './workshops.component.html',
  styleUrl: './workshops.component.scss',
})
export class WorkshopsComponent implements OnInit {
  private readonly repository = inject(WorkshopCatalogRepositoryService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);
  readonly occurrences = signal<WorkshopOccurrence[]>([]);
  readonly series = signal<WorkshopSeries[]>([]);
  readonly statusFilter = signal<WorkshopStatusFilter>('all');

  readonly filteredConcepts = computed<WorkshopConceptCard[]>(() => {
    const filter = this.statusFilter();
    const orderedOccurrences = this.occurrences()
      .filter((occurrence) => filter === 'all' || occurrence.status === filter)
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
    const concepts = new Map<string, WorkshopOccurrence[]>();
    for (const occurrence of orderedOccurrences) {
      const conceptOccurrences = concepts.get(occurrence.workshop_definition_id) ?? [];
      conceptOccurrences.push(occurrence);
      concepts.set(occurrence.workshop_definition_id, conceptOccurrences);
    }
    return Array.from(concepts, ([workshopDefinitionId, occurrences]) => ({
      workshopDefinitionId,
      title: occurrences[0].title_snapshot,
      occurrences,
    }));
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [occurrences, series] = await Promise.all([
        this.repository.listOccurrences(),
        this.repository.listSeries(),
      ]);
      this.occurrences.set(occurrences);
      this.series.set(series);
    } catch (error) {
      console.error('[WorkshopsComponent] load error:', error);
      this.occurrences.set([]);
      this.error.set('We are unable to load workshops right now.');
    } finally {
      this.loading.set(false);
    }
  }

  createWorkshop(): void {
    void this.router.navigate(['/admin/workshops/new']);
  }

  openRoster(occurrence: WorkshopOccurrence): void {
    void this.router.navigate([
      '/admin/workshops', occurrence.workshop_occurrence_id, 'roster',
    ]);
  }

  editWorkshop(occurrence: WorkshopOccurrence): void {
    void this.router.navigate(['/admin/workshops', occurrence.workshop_occurrence_id, 'edit']);
  }

  previewWorkshop(occurrence: WorkshopOccurrence): void {
    void this.router.navigate([
      '/workshops',
      this.publicSeriesSlug(occurrence.title_snapshot),
      occurrence.local_start.slice(0, 10),
    ]);
  }

  async publish(occurrence: WorkshopOccurrence): Promise<void> {
    if (this.busyId()) return;
    this.busyId.set(occurrence.workshop_occurrence_id);
    this.actionError.set(null);
    try {
      await this.repository.publishOccurrence(occurrence.workshop_occurrence_id, crypto.randomUUID());
      this.toast.showToast('Workshop published.', 'success');
      await this.load();
    } catch (error) {
      const message = this.errorMessage(error, 'We could not publish this workshop.');
      this.actionError.set(message);
      this.toast.showToast(message, 'error');
    } finally {
      this.busyId.set(null);
    }
  }

  async remove(occurrence: WorkshopOccurrence): Promise<void> {
    const draftCanDelete = occurrence.status === 'draft' && !occurrence.published_at;
    const action = draftCanDelete ? 'delete this draft' : 'archive this historical workshop';
    if (!window.confirm(`Are you sure you want to ${action}?`)) return;
    this.busyId.set(occurrence.workshop_occurrence_id);
    this.actionError.set(null);
    try {
      if (draftCanDelete) {
        await this.repository.deleteOccurrence(occurrence.workshop_occurrence_id, crypto.randomUUID());
        this.toast.showToast('Workshop draft deleted.', 'success');
      } else {
        await this.repository.archiveOccurrence(occurrence.workshop_occurrence_id, crypto.randomUUID());
        this.toast.showToast('Workshop archived.', 'success');
      }
      await this.load();
    } catch (error) {
      const message = this.errorMessage(error, `We could not ${action}.`);
      this.actionError.set(message);
      this.toast.showToast(message, 'error');
    } finally {
      this.busyId.set(null);
    }
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium', timeStyle: 'short',
    }).format(new Date(value));
  }

  formatMoney(minor: number, currency: string): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100);
  }

  statusLabel(status: WorkshopLifecycleStatus): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase());
  }

  seriesFor(occurrence: WorkshopOccurrence): WorkshopSeries | null {
    if (!occurrence.workshop_series_id) return null;
    return this.series().find(
      (series) => series.workshop_series_id === occurrence.workshop_series_id,
    ) ?? null;
  }

  seriesOverrideLabels(occurrence: WorkshopOccurrence): string[] {
    const series = this.seriesFor(occurrence);
    if (!series) return [];
    const labels: string[] = [];
    if (occurrence.venue_name !== series.default_venue_name) labels.push('Venue exception');
    if (occurrence.capacity !== series.default_capacity) labels.push('Capacity exception');
    if (occurrence.price_minor !== series.default_price_minor) labels.push('Price exception');
    if (occurrence.timezone !== series.default_timezone) labels.push('Timezone exception');
    return labels;
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object' && 'message' in error) {
      const message = String((error as { message: unknown }).message);
      if (message && message.length < 240) return message;
    }
    return fallback;
  }

  private publicSeriesSlug(title: string): string {
    return title.trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 80)
      .replace(/^-+|-+$/g, '');
  }
}
