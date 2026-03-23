import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { CrmPageHeaderComponent } from '../../../shared/components/private/crm-page-header/crm-page-header.component';
import {
  SearchFilterBarComponent,
  SearchFilterGroup,
} from '../../../shared/components/private/search-filter-bar/search-filter-bar.component';
import {
  AdminTableColumn,
  EntityTableShellComponent,
} from '../../../shared/components/private/entity-table-shell/entity-table-shell.component';
import { EntityTableCellDirective } from '../../../shared/components/private/entity-table-shell/entity-table-cell.directive';
import { StatusBadgeComponent } from '../../../shared/components/private/status-badge/status-badge.component';

import { Lead } from '../../../core/models/lead';
import { LeadStatus } from '../../../core/models/lead-status';
import { LeadRepositoryService } from '../../../core/supabase/repositories/lead-repository.service';

@Component({
  selector: 'app-leads',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CrmPageHeaderComponent,
    SearchFilterBarComponent,
    EntityTableShellComponent,
    EntityTableCellDirective,
    StatusBadgeComponent,
  ],
  templateUrl: './leads.component.html',
  styleUrl: './leads.component.scss',
})
export class LeadsComponent implements OnInit {
  private router = inject(Router);
  private leadRepository = inject(LeadRepositoryService);

  loading = signal(true);
  error = signal<string | null>(null);

  searchTerm = signal('');
  statusFilter = signal('all');
  eventTypeFilter = signal('all');
  serviceTypeFilter = signal('all');
  sortBy = signal<'created_desc' | 'created_asc' | 'event_date_asc' | 'event_date_desc'>('created_desc');

  leads = signal<Lead[]>([]);

  columns: AdminTableColumn[] = [
    { key: 'lead', label: 'Lead' },
    { key: 'service_type', label: 'Service Type' },
    { key: 'event_date', label: 'Event Date' },
    { key: 'status', label: 'Status' },
    { key: 'source', label: 'Source' },
    { key: 'created_at', label: 'Created' },
  ];

  ngOnInit(): void {
    void this.loadLeads();
  }

  async loadLeads(): Promise<void> {
    this.loading.set(true);

    try {
      const leads = await this.leadRepository.getLeads();
      this.leads.set(leads);
    } catch (error) {
      console.error('[LeadsComponent] loadLeads error:', error);
      this.leads.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  filteredLeads = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    const eventType = this.eventTypeFilter();
    const serviceType = this.serviceTypeFilter();

    return this.leads().filter((lead) => {
      const fullName = `${lead.first_name} ${lead.last_name}`.toLowerCase();

      const matchesSearch =
        !term ||
        fullName.includes(term) ||
        lead.email.toLowerCase().includes(term) ||
        (lead.service_type ?? '').toLowerCase().includes(term) ||
        lead.source.toLowerCase().includes(term) ||
        (lead.ceremony_venue_name ?? '').toLowerCase().includes(term);

      const matchesStatus = status === 'all' || lead.status === status;

      const matchesEventType =
        eventType === 'all' || (lead.event_type ?? '') === eventType;

      const matchesServiceType =
        serviceType === 'all' || (lead.service_type ?? '') === serviceType;

      return matchesSearch && matchesStatus && matchesEventType && matchesServiceType;
    });
  });

  filters = computed<SearchFilterGroup[]>(() => {
    const eventTypes = Array.from(
      new Set(
        this.leads()
          .map((lead) => lead.event_type)
          .filter((value): value is string => !!value && value.trim().length > 0)
      )
    ).sort((a, b) => a.localeCompare(b));

    const serviceTypes = Array.from(
      new Set(
        this.leads()
          .map((lead) => lead.service_type)
          .filter((value): value is string => !!value && value.trim().length > 0)
      )
    ).sort((a, b) => a.localeCompare(b));

    return [
      {
        key: 'status',
        label: 'Status',
        value: this.statusFilter(),
        options: [
          { label: 'All Statuses', value: 'all' },
          { label: 'New', value: 'new' },
          { label: 'Contacted', value: 'contacted' },
          { label: 'Consultation Pending', value: 'consultation_pending' },
          { label: 'Nurturing', value: 'nurturing' },
          { label: 'Accepted', value: 'accepted' },
          { label: 'Declined', value: 'declined' },
          { label: 'Converted', value: 'converted' },
          { label: 'Closed Unbooked', value: 'closed_unbooked' },
        ],
      },
      {
        key: 'event_type',
        label: 'Event Type',
        value: this.eventTypeFilter(),
        options: [
          { label: 'All Event Types', value: 'all' },
          ...eventTypes.map((eventType) => ({
            label: eventType,
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
            label: serviceType,
            value: serviceType,
          })),
        ],
      },
    ];
  });

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

  openCreateLeadModal(): void {
    console.log('Open create lead modal');
  }

  exportLeads(): void {
    console.log('Export leads');
  }

  openLead(lead: Lead): void {
    this.router.navigate(['/admin/leads', lead.lead_id]);
  }

  getLeadStatusTone(
    status: LeadStatus
  ): 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'purple' {
    switch (status) {
      case 'new':
        return 'info';
      case 'contacted':
        return 'neutral';
      case 'consultation_scheduled':
        return 'warning';
      case 'nurturing':
        return 'purple';
      case 'accepted':
        return 'success';
      case 'declined':
        return 'danger';
      case 'converted':
        return 'success';
      case 'closed_unbooked':
        return 'neutral';
      default:
        return 'neutral';
    }
  }

  formatLeadName(lead: Lead): string {
    return `${lead.first_name} ${lead.last_name}`;
  }

  formatEventDate(value: string | null | undefined): string {
    if (!value) return 'Not set';

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value));
  }

  formatCreatedAt(value: string): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value));
  }
}