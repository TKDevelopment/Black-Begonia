import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { Organization, OrganizationType } from '../../../core/models/organization';
import { Lead } from '../../../core/models/lead';
import { Project } from '../../../core/models/project';
import { ActivityLogEntry } from '../../../core/models/activity-log';
import { OrganizationRepositoryService } from '../../../core/supabase/repositories/organization-repository.service';
import { ActivityLogRepositoryService } from '../../../core/supabase/repositories/activity-log-repository.service';
import { LeadRepositoryService } from '../../../core/supabase/repositories/lead-repository.service';
import { ProjectRepositoryService } from '../../../core/supabase/repositories/project-repository.service';
import { OrganizationService } from '../../../core/supabase/services/organization.service';
import { ToastService } from '../../../core/services/toast.service';
import { CrmPageHeaderComponent } from '../../../shared/components/private/crm-page-header/crm-page-header.component';
import { SearchFilterBarComponent, SearchFilterGroup } from '../../../shared/components/private/search-filter-bar/search-filter-bar.component';
import { AdminTableColumn, EntityTableShellComponent } from '../../../shared/components/private/entity-table-shell/entity-table-shell.component';
import { EntityTableCellDirective } from '../../../shared/components/private/entity-table-shell/entity-table-cell.directive';
import { EntityDetailShellComponent } from '../../../shared/components/private/entity-detail-shell/entity-detail-shell.component';
import { LoadingStateBlockComponent } from '../../../shared/components/private/loading-state-block/loading-state-block.component';
import { ErrorStateBlockComponent } from '../../../shared/components/private/error-state-block/error-state-block.component';
import { OrganizationUpsertModalComponent, OrganizationUpsertPayload } from './components/organization-upsert-modal/organization-upsert-modal.component';
import { OrganizationProjectLinkModalComponent, OrganizationProjectLinkPayload } from './components/organization-project-link-modal/organization-project-link-modal.component';

@Component({
  selector: 'app-organizations',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CrmPageHeaderComponent,
    SearchFilterBarComponent,
    EntityTableShellComponent,
    EntityTableCellDirective,
    EntityDetailShellComponent,
    LoadingStateBlockComponent,
    ErrorStateBlockComponent,
    OrganizationUpsertModalComponent,
    OrganizationProjectLinkModalComponent,
  ],
  templateUrl: './organizations.component.html',
  styleUrl: './organizations.component.scss',
})
export class OrganizationsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly organizationRepository = inject(OrganizationRepositoryService);
  private readonly activityLogRepository = inject(ActivityLogRepositoryService);
  private readonly leadRepository = inject(LeadRepositoryService);
  private readonly projectRepository = inject(ProjectRepositoryService);
  private readonly organizationService = inject(OrganizationService);
  private readonly toast = inject(ToastService);

  readonly organizationTypes: OrganizationType[] = ['venue', 'planner', 'vendor', 'corporate_client', 'rental_company', 'hospitality', 'other'];
  readonly columns: AdminTableColumn[] = [
    { key: 'name', label: 'Organization' },
    { key: 'organization_type', label: 'Type' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'created_at', label: 'Created' },
  ];

  loading = signal(true);
  error = signal<string | null>(null);
  detailLoading = signal(true);
  detailError = signal<string | null>(null);
  saving = signal(false);
  createModalOpen = signal(false);
  editModalOpen = signal(false);
  linkProjectModalOpen = signal(false);

  currentOrganizationId = signal<string | null>(null);
  organizations = signal<Organization[]>([]);
  organization = signal<Organization | null>(null);
  availableProjects = signal<Project[]>([]);
  relatedProjects = signal<Project[]>([]);
  createdFromLead = signal<Lead | null>(null);
  activityLog = signal<ActivityLogEntry[]>([]);

  searchTerm = signal('');
  typeFilter = signal('all');
  archiveFilter = signal<'active' | 'archived' | 'all'>('active');
  sortFilter = signal<'name' | 'created_desc' | 'created_asc'>('name');

  readonly isDetailView = computed(() => !!this.currentOrganizationId());

  readonly filteredOrganizations = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const type = this.typeFilter();
    const sort = this.sortFilter();

    const filtered = this.organizations().filter((organization) => {
      const matchesSearch = !term || organization.name.toLowerCase().includes(term) || (organization.email ?? '').toLowerCase().includes(term) || (organization.phone ?? '').toLowerCase().includes(term);
      const matchesType = type === 'all' || organization.organization_type === type;
      const matchesArchive =
        this.archiveFilter() === 'all' ||
        (this.archiveFilter() === 'archived' ? organization.is_archived : !organization.is_archived);
      return matchesSearch && matchesType && matchesArchive;
    });

    return filtered.sort((a, b) => {
      if (sort === 'created_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sort === 'created_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return a.name.localeCompare(b.name);
    });
  });

  readonly filters = computed<SearchFilterGroup[]>(() => [
    {
      key: 'organization_type',
      label: 'Organization Type',
      value: this.typeFilter(),
      options: [{ label: 'All Types', value: 'all' }, ...this.organizationTypes.map((option) => ({ label: this.formatLabel(option), value: option }))],
    },
    {
      key: 'sort',
      label: 'Sort By',
      value: this.sortFilter(),
      options: [
        { label: 'Name', value: 'name' },
        { label: 'Created Date (Newest)', value: 'created_desc' },
        { label: 'Created Date (Oldest)', value: 'created_asc' },
      ],
    },
    {
      key: 'archive',
      label: 'Record Status',
      value: this.archiveFilter(),
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Archived', value: 'archived' },
        { label: 'All Records', value: 'all' },
      ],
    },
  ]);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const organizationId = params.get('organizationId');
      this.currentOrganizationId.set(organizationId);
      if (organizationId) {
        void this.loadOrganizationDetail(organizationId);
      } else {
        void this.loadOrganizations();
      }
    });
  }

  async loadOrganizations(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.organizations.set(await this.organizationRepository.getOrganizations());
    } catch (error) {
      console.error('[OrganizationsComponent] loadOrganizations error:', error);
      this.error.set('We were unable to load organizations right now.');
      this.organizations.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async loadOrganizationDetail(organizationId: string): Promise<void> {
    this.detailLoading.set(true);
    this.detailError.set(null);
    try {
      const [organization, relatedProjects, activityLog] = await Promise.all([
        this.organizationRepository.getOrganizationById(organizationId),
        this.organizationRepository.getRelatedProjects(organizationId),
        this.activityLogRepository.getEntityActivity('organization', organizationId),
      ]);

      if (!organization) {
        this.detailError.set('We could not find this organization record.');
        this.organization.set(null);
        this.relatedProjects.set([]);
        this.activityLog.set([]);
        this.createdFromLead.set(null);
        return;
      }

      this.organization.set(organization);
      this.relatedProjects.set(relatedProjects);
      this.activityLog.set(activityLog);
      this.createdFromLead.set(organization.created_from_lead_id ? await this.leadRepository.getLeadById(organization.created_from_lead_id) : null);
    } catch (error) {
      console.error('[OrganizationsComponent] loadOrganizationDetail error:', error);
      this.detailError.set('We were unable to load this organization right now.');
      this.organization.set(null);
      this.relatedProjects.set([]);
      this.activityLog.set([]);
      this.createdFromLead.set(null);
    } finally {
      this.detailLoading.set(false);
    }
  }

  onSearchChange(value: string): void { this.searchTerm.set(value); }
  onFilterChange(event: { key: string; value: string }): void {
    if (event.key === 'organization_type') this.typeFilter.set(event.value);
    if (event.key === 'sort') this.sortFilter.set(event.value as 'name' | 'created_desc' | 'created_asc');
    if (event.key === 'archive') this.archiveFilter.set(event.value as 'active' | 'archived' | 'all');
  }
  resetFilters(): void { this.searchTerm.set(''); this.typeFilter.set('all'); this.sortFilter.set('name'); this.archiveFilter.set('active'); }
  openCreateModal(): void { this.createModalOpen.set(true); }
  closeCreateModal(): void { this.createModalOpen.set(false); }
  openEditModal(): void { this.editModalOpen.set(true); }
  closeEditModal(): void { this.editModalOpen.set(false); }
  openLinkProjectModal(): void {
    if (this.organization()?.is_archived) return;
    this.linkProjectModalOpen.set(true);
    if (!this.availableProjects().length) {
      void this.loadAvailableProjects();
    }
  }
  closeLinkProjectModal(): void { this.linkProjectModalOpen.set(false); }

  async createOrganization(payload: OrganizationUpsertPayload): Promise<void> {
    if (this.saving()) return;
    try {
      this.saving.set(true);
      const organization = await this.organizationService.createOrganization(payload);
      this.createModalOpen.set(false);
      this.toast.showToast('Organization created successfully.', 'success');
      await this.router.navigate(['/admin/organizations', organization.organization_id]);
    } catch (error) {
      console.error('[OrganizationsComponent] createOrganization error:', error);
      this.error.set('We were unable to create the organization right now.');
    } finally {
      this.saving.set(false);
    }
  }

  async saveOrganizationEdits(payload: OrganizationUpsertPayload): Promise<void> {
    const organization = this.organization();
    if (!organization || this.saving()) return;
    try {
      this.saving.set(true);
      await this.organizationService.updateOrganization(organization.organization_id, payload, organization);
      this.editModalOpen.set(false);
      await this.loadOrganizationDetail(organization.organization_id);
      this.toast.showToast('Organization updated successfully.', 'success');
    } catch (error) {
      console.error('[OrganizationsComponent] saveOrganizationEdits error:', error);
      this.detailError.set('We were unable to save organization updates right now.');
    } finally {
      this.saving.set(false);
    }
  }

  async archiveCurrentOrganization(): Promise<void> {
    const organization = this.organization();
    if (!organization || this.saving()) return;
    const confirmed = window.confirm(`Archive ${organization.name}? You can restore the record later.`);
    if (!confirmed) return;

    try {
      this.saving.set(true);
      await this.organizationService.archiveOrganization(organization);
      await this.loadOrganizationDetail(organization.organization_id);
      await this.loadOrganizations();
      this.toast.showToast('Organization archived.', 'success');
    } catch (error) {
      console.error('[OrganizationsComponent] archiveCurrentOrganization error:', error);
      this.toast.showToast('We were unable to archive the organization right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async restoreCurrentOrganization(): Promise<void> {
    const organization = this.organization();
    if (!organization || this.saving()) return;

    try {
      this.saving.set(true);
      await this.organizationService.restoreOrganization(organization);
      await this.loadOrganizationDetail(organization.organization_id);
      await this.loadOrganizations();
      this.toast.showToast('Organization restored.', 'success');
    } catch (error) {
      console.error('[OrganizationsComponent] restoreCurrentOrganization error:', error);
      this.toast.showToast('We were unable to restore the organization right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async linkOrganizationToProject(payload: OrganizationProjectLinkPayload): Promise<void> {
    const organization = this.organization();
    if (!organization || this.saving()) return;

    try {
      this.saving.set(true);
      await this.organizationService.linkOrganizationToProject(organization, {
        organization_id: organization.organization_id,
        project_id: payload.project_id,
        relationship_type: payload.relationship_type,
      });
      this.linkProjectModalOpen.set(false);
      await this.loadOrganizationDetail(organization.organization_id);
      this.toast.showToast('Organization linked to project.', 'success');
    } catch (error: any) {
      console.error('[OrganizationsComponent] linkOrganizationToProject error:', error);
      const isDuplicate = error?.code === '23505';
      this.toast.showToast(
        isDuplicate
          ? 'This organization is already linked to that project with the selected relationship.'
          : 'We were unable to link the organization to the project right now.',
        'error'
      );
    } finally {
      this.saving.set(false);
    }
  }

  openOrganization(organization: Organization): void { void this.router.navigate(['/admin/organizations', organization.organization_id]); }
  goBack(): void { void this.router.navigate(['/admin/organizations']); }
  retryList(): void { void this.loadOrganizations(); }
  retryDetail(): void { const id = this.currentOrganizationId(); if (id) void this.loadOrganizationDetail(id); }

  formatDate(value: string | null | undefined): string {
    if (!value) return 'Not set';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Not available';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
  }

  formatLabel(value: string | null | undefined): string {
    if (!value) return 'Not provided';
    return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  getTypeClasses(type: string | null | undefined): string {
    switch (type) {
      case 'venue': return 'bg-amber-100 text-amber-700';
      case 'planner': return 'bg-violet-100 text-violet-700';
      case 'vendor': return 'bg-emerald-100 text-emerald-700';
      case 'corporate_client': return 'bg-blue-100 text-blue-700';
      case 'rental_company': return 'bg-sky-100 text-sky-700';
      case 'hospitality': return 'bg-rose-100 text-rose-700';
      default: return 'bg-stone-100 text-stone-700';
    }
  }

  async loadAvailableProjects(): Promise<void> {
    this.availableProjects.set(await this.projectRepository.getProjects());
  }

  getActivityIconClasses(type: string): string {
    switch (type) {
      case 'created': return 'bg-blue-100 text-blue-700';
      case 'updated': return 'bg-stone-100 text-stone-700';
      default: return 'bg-emerald-100 text-emerald-700';
    }
  }
}
