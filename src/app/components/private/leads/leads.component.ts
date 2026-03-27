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
import { LeadActivity } from '../../../core/models/lead-activity';
import { LeadStatus } from '../../../core/models/lead-status';
import { FloralProposal } from '../../../core/models/floral-proposal';
import { FloralProposalResponseSummary } from '../../../core/models/floral-proposal';
import { LeadRepositoryService } from '../../../core/supabase/repositories/lead-repository.service';
import { FloralProposalRepositoryService } from '../../../core/supabase/repositories/floral-proposal-repository.service';
import { ActivityRepositoryService } from '../../../core/supabase/repositories/activity-repository.service';
import { LeadUpsertModalComponent } from './components/lead-upsert-modal/lead-upsert-modal.component';
import { LeadUpsertPayload } from './components/lead-upsert-modal/lead-upsert.types';
import { CreateGeneralLeadInput } from '../../../core/models/create-general-lead-input';
import { CreateWeddingLeadInput } from '../../../core/models/create-wedding-lead-input';
import { ToastService } from '../../../core/services/toast.service';

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
    LeadUpsertModalComponent,
  ],
  templateUrl: './leads.component.html',
  styleUrl: './leads.component.scss',
})
export class LeadsComponent implements OnInit {
  private router = inject(Router);
  private leadRepository = inject(LeadRepositoryService);
  private proposalRepository = inject(FloralProposalRepositoryService);
  private activityRepository = inject(ActivityRepositoryService);
  private toast = inject(ToastService);

  loading = signal(true);
  error = signal<string | null>(null);
  createModalOpen = signal(false);
  createSaving = signal(false);

  searchTerm = signal('');
  statusFilter = signal('all');
  eventTypeFilter = signal('all');
  serviceTypeFilter = signal('all');
  sortBy = signal<'created_desc' | 'created_asc' | 'event_date_asc' | 'event_date_desc'>('created_desc');

  leads = signal<Lead[]>([]);
  proposals = signal<FloralProposal[]>([]);
  proposalResponseActivities = signal<LeadActivity[]>([]);

  columns: AdminTableColumn[] = [
    { key: 'lead', label: 'Lead' },
    { key: 'service_type', label: 'Service Type' },
    { key: 'proposal', label: 'Proposal' },
    { key: 'proposal_response', label: 'Client Response' },
    { key: 'event_date', label: 'Event Date' },
    { key: 'status', label: 'Status' },
    { key: 'source', label: 'Source' },
    { key: 'created_at', label: 'Created' },
  ];

  proposalByLeadId = computed<Record<string, FloralProposal | null>>(() => {
    return this.proposals().reduce<Record<string, FloralProposal | null>>((acc, proposal) => {
      const current = acc[proposal.lead_id];
      if (!current) {
        acc[proposal.lead_id] = proposal;
        return acc;
      }

      if (proposal.is_active && !current.is_active) {
        acc[proposal.lead_id] = proposal;
        return acc;
      }

      if (proposal.version > current.version) {
        acc[proposal.lead_id] = proposal;
      }

      return acc;
    }, {});
  });

  proposalResponseByLeadId = computed<Record<string, FloralProposalResponseSummary | null>>(() => {
    const summaries = this.proposalResponseActivities()
      .map((activity) => this.mapActivityToProposalResponse(activity))
      .filter((summary): summary is FloralProposalResponseSummary & { lead_id: string } => summary !== null);

    return summaries.reduce<Record<string, FloralProposalResponseSummary | null>>((acc, summary) => {
      const current = acc[summary.lead_id];
      if (!current || new Date(summary.created_at).getTime() > new Date(current.created_at).getTime()) {
        acc[summary.lead_id] = summary;
      }
      return acc;
    }, {});
  });

  ngOnInit(): void {
    void this.loadLeads();
  }

  async loadLeads(): Promise<void> {
    this.loading.set(true);

    try {
      const [leads, proposals, activities] = await Promise.all([
        this.leadRepository.getLeads(),
        this.proposalRepository.getAllProposals(),
        this.activityRepository.getProposalResponseActivities(),
      ]);

      this.leads.set(leads);
      this.proposals.set(proposals);
      this.proposalResponseActivities.set(activities);
    } catch (error) {
      console.error('[LeadsComponent] loadLeads error:', error);
      this.leads.set([]);
      this.proposals.set([]);
      this.proposalResponseActivities.set([]);
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
      const proposal = this.getProposalForLead(lead.lead_id);
      const response = this.getProposalResponseForLead(lead.lead_id);

      const matchesSearch =
        !term ||
        fullName.includes(term) ||
        lead.email.toLowerCase().includes(term) ||
        (lead.service_type ?? '').toLowerCase().includes(term) ||
        lead.source.toLowerCase().includes(term) ||
        (lead.ceremony_venue_name ?? '').toLowerCase().includes(term) ||
        (proposal?.status ?? '').toLowerCase().includes(term) ||
        (response?.feedback ?? '').toLowerCase().includes(term);

      const matchesStatus = status === 'all' || lead.status === status;
      const matchesEventType = eventType === 'all' || (lead.event_type ?? '') === eventType;
      const matchesServiceType = serviceType === 'all' || (lead.service_type ?? '') === serviceType;

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
          { label: 'Consultation Scheduled', value: 'consultation_scheduled' },
          { label: 'Nurturing', value: 'nurturing' },
          { label: 'Proposal Submitted', value: 'proposal_submitted' },
          { label: 'Proposal Declined', value: 'proposal_declined' },
          { label: 'Proposal Accepted', value: 'proposal_accepted' },
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
    this.createModalOpen.set(true);
  }

  closeCreateLeadModal(): void {
    this.createModalOpen.set(false);
  }

  async createLead(payload: LeadUpsertPayload): Promise<void> {
    if (this.createSaving()) return;

    try {
      this.createSaving.set(true);

      const lead = payload.event_type === 'wedding'
        ? await this.leadRepository.createWeddingLead({
            event_type: 'wedding',
            service_type: payload.service_type,
            first_name: payload.first_name,
            last_name: payload.last_name,
            partner_first_name: payload.partner_first_name ?? null,
            partner_last_name: payload.partner_last_name ?? null,
            planner_name: payload.planner_name ?? null,
            planner_phone: payload.planner_phone ?? null,
            planner_email: payload.planner_email ?? null,
            email: payload.email,
            phone: payload.phone ?? null,
            preferred_contact_method: payload.preferred_contact_method ?? null,
            event_date: payload.event_date ?? null,
            ceremony_venue_name: payload.ceremony_venue_name ?? null,
            ceremony_venue_city: payload.ceremony_venue_city ?? null,
            ceremony_venue_state: payload.ceremony_venue_state ?? null,
            reception_venue_name: payload.reception_venue_name ?? null,
            reception_venue_city: payload.reception_venue_city ?? null,
            reception_venue_state: payload.reception_venue_state ?? null,
            budget_range: payload.budget_range ?? null,
            guest_count: payload.guest_count ?? null,
            inquiry_message: payload.inquiry_message ?? null,
            source: payload.source ?? 'other',
          } as CreateWeddingLeadInput)
        : await this.leadRepository.createGeneralLead({
            event_type: 'general',
            service_type: payload.service_type,
            first_name: payload.first_name,
            last_name: payload.last_name,
            email: payload.email,
            phone: payload.phone ?? null,
            preferred_contact_method: payload.preferred_contact_method ?? null,
            event_date: payload.event_date ?? null,
            inquiry_message: payload.inquiry_message ?? null,
            source: payload.source ?? 'other',
          } as CreateGeneralLeadInput);

      await this.activityRepository.createLeadActivity({
        lead_id: lead.lead_id,
        activity_type: 'created',
        activity_label: 'Lead created from CRM',
        activity_description: 'Lead was created manually from the CRM leads page.',
        metadata: {
          created_from: 'crm_leads_page',
          event_type: payload.event_type,
          service_type: payload.service_type,
        },
      });

      this.createModalOpen.set(false);
      await this.loadLeads();
      this.toast.showToast('Lead created successfully.', 'success');
      await this.router.navigate(['/admin/leads', lead.lead_id]);
    } catch (error) {
      console.error('[LeadsComponent] createLead error:', error);
      this.error.set('We were unable to create the lead right now.');
    } finally {
      this.createSaving.set(false);
    }
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
      case 'proposal_submitted':
        return 'warning';
      case 'proposal_declined':
        return 'danger';
      case 'proposal_accepted':
      case 'accepted':
      case 'converted':
        return 'success';
      case 'declined':
        return 'danger';
      case 'closed_unbooked':
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

  getProposalForLead(leadId: string): FloralProposal | null {
    return this.proposalByLeadId()[leadId] ?? null;
  }

  getProposalResponseForLead(leadId: string): FloralProposalResponseSummary | null {
    return this.proposalResponseByLeadId()[leadId] ?? null;
  }

  private mapActivityToProposalResponse(
    activity: LeadActivity
  ): (FloralProposalResponseSummary & { lead_id: string }) | null {
    const metadata = activity.metadata as Record<string, unknown> | null;
    const proposalId = typeof metadata?.['floral_proposal_id'] === 'string'
      ? metadata['floral_proposal_id']
      : null;
    const responseAction = metadata?.['response_action'];

    if (!proposalId || (responseAction !== 'accept' && responseAction !== 'decline')) {
      return null;
    }

    const feedbackValue = metadata?.['feedback'];

    return {
      lead_id: activity.lead_id,
      proposal_id: proposalId,
      action: responseAction,
      feedback: typeof feedbackValue === 'string' && feedbackValue.trim().length
        ? feedbackValue
        : null,
      created_at: activity.created_at,
    };
  }
}








