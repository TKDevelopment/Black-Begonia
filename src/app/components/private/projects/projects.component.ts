import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { Project, ProjectStatus } from '../../../core/models/project';
import { ProjectRepositoryService } from '../../../core/supabase/repositories/project-repository.service';
import { CrmPageHeaderComponent } from '../../../shared/components/private/crm-page-header/crm-page-header.component';
import { ErrorStateBlockComponent } from '../../../shared/components/private/error-state-block/error-state-block.component';
import { StatusBadgeComponent } from '../../../shared/components/private/status-badge/status-badge.component';
import { formatDateOnlyForDisplay } from '../../../core/utils/date-only';
import {
  SearchFilterBarComponent,
  SearchFilterGroup,
} from '../../../shared/components/private/search-filter-bar/search-filter-bar.component';
import {
  AdminTableColumn,
  EntityTableShellComponent,
} from '../../../shared/components/private/entity-table-shell/entity-table-shell.component';
import { EntityTableCellDirective } from '../../../shared/components/private/entity-table-shell/entity-table-cell.directive';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [
    CommonModule,
    CrmPageHeaderComponent,
    SearchFilterBarComponent,
    EntityTableShellComponent,
    EntityTableCellDirective,
    ErrorStateBlockComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss',
})
export class ProjectsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly projectRepository = inject(ProjectRepositoryService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly projects = signal<Project[]>([]);
  readonly searchTerm = signal('');
  readonly statusFilter = signal('all');
  readonly eventTypeFilter = signal('all');
  readonly serviceTypeFilter = signal('all');

  readonly columns: AdminTableColumn[] = [
    { key: 'project', label: 'Project' },
    { key: 'service_type', label: 'Service Type' },
    { key: 'event_date', label: 'Event Date' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions', headerClassName: 'text-right', className: 'text-right' },
  ];

  readonly filteredProjects = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    const eventType = this.eventTypeFilter();
    const serviceType = this.serviceTypeFilter();

    return this.projects().filter((project) => {
      const searchFields = [
        project.project_name,
        project.service_type,
        project.event_type,
        this.formatProjectStatus(project.status),
        this.formatDate(project.event_date),
        project.ceremony_venue_name,
        project.ceremony_venue_city,
        project.ceremony_venue_state,
        project.ceremony_venue_address,
        project.ceremony_venue_zipcode,
        project.reception_venue_name,
        project.reception_venue_city,
        project.reception_venue_state,
        project.reception_venue_address,
        project.reception_venue_zipcode,
      ];

      const matchesSearch =
        !term ||
        searchFields
          .filter((value): value is string => !!value)
          .some((value) => value.toLowerCase().includes(term));
      const matchesStatus = status === 'all' || project.status === status;
      const matchesEventType = eventType === 'all' || (project.event_type ?? '') === eventType;
      const matchesServiceType = serviceType === 'all' || (project.service_type ?? '') === serviceType;

      return matchesSearch && matchesStatus && matchesEventType && matchesServiceType;
    });
  });

  readonly filters = computed<SearchFilterGroup[]>(() => {
    const eventTypes = this.uniqueOptions(this.projects().map((project) => project.event_type));
    const serviceTypes = this.uniqueOptions(this.projects().map((project) => project.service_type));

    return [
      {
        key: 'status',
        label: 'Status',
        value: this.statusFilter(),
        options: [
          { label: 'All Statuses', value: 'all' },
          { label: 'Awaiting Deposit', value: 'awaiting_deposit' },
          { label: 'Booked', value: 'booked' },
          { label: 'Awaiting Final Payment', value: 'awaiting_final_payment' },
          { label: 'Final Prep', value: 'final_prep' },
          { label: 'Completed', value: 'completed' },
          { label: 'Canceled', value: 'canceled' },
        ],
      },
      {
        key: 'event_type',
        label: 'Event Type',
        value: this.eventTypeFilter(),
        options: [
          { label: 'All Event Types', value: 'all' },
          ...eventTypes.map((eventType) => ({
            label: this.formatDisplayValue(eventType),
            value: eventType,
          })),
        ],
      },
      {
        key: 'service_type',
        label: 'Service Type',
        value: this.serviceTypeFilter(),
        options: [
          { label: 'All Service Types', value: 'all' },
          ...serviceTypes.map((serviceType) => ({
            label: this.formatDisplayValue(serviceType),
            value: serviceType,
          })),
        ],
      },
    ];
  });

  async ngOnInit(): Promise<void> {
    await this.loadProjects();
  }

  async loadProjects(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const projects = await this.projectRepository.getProjects();
      this.projects.set(projects);
    } catch (error) {
      console.error('[ProjectsComponent] loadProjects error:', error);
      this.error.set('We could not load projects right now.');
    } finally {
      this.loading.set(false);
    }
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
  }

  onFilterChange(event: { key: string; value: string }): void {
    if (event.key === 'status') {
      this.statusFilter.set(event.value);
    }

    if (event.key === 'event_type') {
      this.eventTypeFilter.set(event.value);
    }

    if (event.key === 'service_type') {
      this.serviceTypeFilter.set(event.value);
    }
  }

  resetFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set('all');
    this.eventTypeFilter.set('all');
    this.serviceTypeFilter.set('all');
  }

  openProject(project: Project): void {
    void this.router.navigate(['/admin/projects', project.project_id]);
  }

  formatDate(value: string | null | undefined): string {
    return formatDateOnlyForDisplay(value, 'No date set', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatDisplayValue(value: string | null | undefined): string {
    if (!value) {
      return 'Not set';
    }

    return value
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  formatProjectStatus(status: ProjectStatus): string {
    return this.formatDisplayValue(status);
  }

  getProjectStatusTone(
    status: ProjectStatus
  ): 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'purple' {
    switch (status) {
      case 'awaiting_deposit':
        return 'warning';
      case 'booked':
        return 'success';
      case 'awaiting_final_payment':
        return 'danger';
      case 'final_prep':
        return 'purple';
      case 'completed':
        return 'success';
      case 'canceled':
      default:
        return 'neutral';
    }
  }

  private uniqueOptions(values: (string | null | undefined)[]): string[] {
    return Array.from(
      new Set(values.filter((value): value is string => !!value && value.trim().length > 0))
    ).sort((a, b) => a.localeCompare(b));
  }
}
