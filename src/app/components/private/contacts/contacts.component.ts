import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { Contact, ContactType } from '../../../core/models/contact';
import { Project } from '../../../core/models/project';
import { Lead } from '../../../core/models/lead';
import { ActivityLogEntry } from '../../../core/models/activity-log';
import { ContactRepositoryService } from '../../../core/supabase/repositories/contact-repository.service';
import { ActivityLogRepositoryService } from '../../../core/supabase/repositories/activity-log-repository.service';
import { LeadRepositoryService } from '../../../core/supabase/repositories/lead-repository.service';
import { ProjectRepositoryService } from '../../../core/supabase/repositories/project-repository.service';
import { ContactService } from '../../../core/supabase/services/contact.service';
import { ToastService } from '../../../core/services/toast.service';
import { CrmPageHeaderComponent } from '../../../shared/components/private/crm-page-header/crm-page-header.component';
import { SearchFilterBarComponent, SearchFilterGroup } from '../../../shared/components/private/search-filter-bar/search-filter-bar.component';
import { AdminTableColumn, EntityTableShellComponent } from '../../../shared/components/private/entity-table-shell/entity-table-shell.component';
import { EntityTableCellDirective } from '../../../shared/components/private/entity-table-shell/entity-table-cell.directive';
import { EntityDetailShellComponent } from '../../../shared/components/private/entity-detail-shell/entity-detail-shell.component';
import { LoadingStateBlockComponent } from '../../../shared/components/private/loading-state-block/loading-state-block.component';
import { ErrorStateBlockComponent } from '../../../shared/components/private/error-state-block/error-state-block.component';
import { ContactUpsertModalComponent, ContactUpsertPayload } from './components/contact-upsert-modal/contact-upsert-modal.component';
import { ContactProjectLinkModalComponent, ContactProjectLinkPayload } from './components/contact-project-link-modal/contact-project-link-modal.component';

@Component({
  selector: 'app-contacts',
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
    ContactUpsertModalComponent,
    ContactProjectLinkModalComponent,
  ],
  templateUrl: './contacts.component.html',
  styleUrl: './contacts.component.scss',
})
export class ContactsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly contactRepository = inject(ContactRepositoryService);
  private readonly activityLogRepository = inject(ActivityLogRepositoryService);
  private readonly leadRepository = inject(LeadRepositoryService);
  private readonly projectRepository = inject(ProjectRepositoryService);
  private readonly contactService = inject(ContactService);
  private readonly toast = inject(ToastService);

  readonly contactTypeOptions: ContactType[] = ['client', 'partner', 'planner', 'venue_contact', 'vendor_contact', 'other'];
  readonly columns: AdminTableColumn[] = [
    { key: 'name', label: 'Contact' },
    { key: 'contact_type', label: 'Type' },
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

  currentContactId = signal<string | null>(null);
  contacts = signal<Contact[]>([]);
  contact = signal<Contact | null>(null);
  availableProjects = signal<Project[]>([]);
  relatedProjects = signal<Project[]>([]);
  createdFromLead = signal<Lead | null>(null);
  activityLog = signal<ActivityLogEntry[]>([]);

  searchTerm = signal('');
  typeFilter = signal('all');
  archiveFilter = signal<'active' | 'archived' | 'all'>('active');
  sortFilter = signal<'last_name' | 'created_desc' | 'created_asc'>('last_name');

  readonly isDetailView = computed(() => !!this.currentContactId());

  readonly filteredContacts = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const type = this.typeFilter();
    const sort = this.sortFilter();

    const filtered = this.contacts().filter((contact) => {
      const matchesSearch = !term || `${contact.first_name} ${contact.last_name}`.toLowerCase().includes(term) || (contact.email ?? '').toLowerCase().includes(term) || (contact.phone ?? '').toLowerCase().includes(term);
      const matchesType = type === 'all' || contact.contact_type === type;
      const matchesArchive =
        this.archiveFilter() === 'all' ||
        (this.archiveFilter() === 'archived' ? contact.is_archived : !contact.is_archived);
      return matchesSearch && matchesType && matchesArchive;
    });

    return filtered.sort((a, b) => {
      if (sort === 'created_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sort === 'created_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);
    });
  });

  readonly filters = computed<SearchFilterGroup[]>(() => [
    {
      key: 'contact_type',
      label: 'Contact Type',
      value: this.typeFilter(),
      options: [{ label: 'All Types', value: 'all' }, ...this.contactTypeOptions.map((option) => ({ label: this.formatLabel(option), value: option }))],
    },
    {
      key: 'sort',
      label: 'Sort By',
      value: this.sortFilter(),
      options: [
        { label: 'Last Name', value: 'last_name' },
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
      const contactId = params.get('contactId');
      this.currentContactId.set(contactId);
      if (contactId) {
        void this.loadContactDetail(contactId);
      } else {
        void this.loadContacts();
      }
    });
  }

  async loadContacts(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.contacts.set(await this.contactRepository.getContacts());
    } catch (error) {
      console.error('[ContactsComponent] loadContacts error:', error);
      this.error.set('We were unable to load contacts right now.');
      this.contacts.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async loadContactDetail(contactId: string): Promise<void> {
    this.detailLoading.set(true);
    this.detailError.set(null);
    try {
      const [contact, relatedProjects, activityLog] = await Promise.all([
        this.contactRepository.getContactById(contactId),
        this.contactRepository.getRelatedProjects(contactId),
        this.activityLogRepository.getEntityActivity('contact', contactId),
      ]);

      if (!contact) {
        this.detailError.set('We could not find this contact record.');
        this.contact.set(null);
        this.relatedProjects.set([]);
        this.activityLog.set([]);
        this.createdFromLead.set(null);
        return;
      }

      this.contact.set(contact);
      this.relatedProjects.set(relatedProjects);
      this.activityLog.set(activityLog);
      this.createdFromLead.set(contact.created_from_lead_id ? await this.leadRepository.getLeadById(contact.created_from_lead_id) : null);
    } catch (error) {
      console.error('[ContactsComponent] loadContactDetail error:', error);
      this.detailError.set('We were unable to load this contact right now.');
      this.contact.set(null);
      this.relatedProjects.set([]);
      this.activityLog.set([]);
      this.createdFromLead.set(null);
    } finally {
      this.detailLoading.set(false);
    }
  }

  onSearchChange(value: string): void { this.searchTerm.set(value); }
  onFilterChange(event: { key: string; value: string }): void {
    if (event.key === 'contact_type') this.typeFilter.set(event.value);
    if (event.key === 'sort') this.sortFilter.set(event.value as 'last_name' | 'created_desc' | 'created_asc');
    if (event.key === 'archive') this.archiveFilter.set(event.value as 'active' | 'archived' | 'all');
  }
  resetFilters(): void { this.searchTerm.set(''); this.typeFilter.set('all'); this.sortFilter.set('last_name'); this.archiveFilter.set('active'); }
  openCreateModal(): void { this.createModalOpen.set(true); }
  closeCreateModal(): void { this.createModalOpen.set(false); }
  openEditModal(): void { this.editModalOpen.set(true); }
  closeEditModal(): void { this.editModalOpen.set(false); }
  openLinkProjectModal(): void {
    if (this.contact()?.is_archived) return;
    this.linkProjectModalOpen.set(true);
    if (!this.availableProjects().length) {
      void this.loadAvailableProjects();
    }
  }
  closeLinkProjectModal(): void { this.linkProjectModalOpen.set(false); }

  async createContact(payload: ContactUpsertPayload): Promise<void> {
    if (this.saving()) return;
    try {
      this.saving.set(true);
      const contact = await this.contactService.createContact(payload);
      this.createModalOpen.set(false);
      this.toast.showToast('Contact created successfully.', 'success');
      await this.router.navigate(['/admin/contacts', contact.contact_id]);
    } catch (error) {
      console.error('[ContactsComponent] createContact error:', error);
      this.error.set('We were unable to create the contact right now.');
    } finally {
      this.saving.set(false);
    }
  }

  async saveContactEdits(payload: ContactUpsertPayload): Promise<void> {
    const contact = this.contact();
    if (!contact || this.saving()) return;
    try {
      this.saving.set(true);
      await this.contactService.updateContact(contact.contact_id, payload, contact);
      this.editModalOpen.set(false);
      await this.loadContactDetail(contact.contact_id);
      this.toast.showToast('Contact updated successfully.', 'success');
    } catch (error) {
      console.error('[ContactsComponent] saveContactEdits error:', error);
      this.detailError.set('We were unable to save contact updates right now.');
    } finally {
      this.saving.set(false);
    }
  }

  async archiveCurrentContact(): Promise<void> {
    const contact = this.contact();
    if (!contact || this.saving()) return;
    const confirmed = window.confirm(`Archive ${contact.first_name} ${contact.last_name}? You can restore the record later.`);
    if (!confirmed) return;

    try {
      this.saving.set(true);
      await this.contactService.archiveContact(contact);
      await this.loadContactDetail(contact.contact_id);
      await this.loadContacts();
      this.toast.showToast('Contact archived.', 'success');
    } catch (error) {
      console.error('[ContactsComponent] archiveCurrentContact error:', error);
      this.toast.showToast('We were unable to archive the contact right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async restoreCurrentContact(): Promise<void> {
    const contact = this.contact();
    if (!contact || this.saving()) return;

    try {
      this.saving.set(true);
      await this.contactService.restoreContact(contact);
      await this.loadContactDetail(contact.contact_id);
      await this.loadContacts();
      this.toast.showToast('Contact restored.', 'success');
    } catch (error) {
      console.error('[ContactsComponent] restoreCurrentContact error:', error);
      this.toast.showToast('We were unable to restore the contact right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async linkContactToProject(payload: ContactProjectLinkPayload): Promise<void> {
    const contact = this.contact();
    if (!contact || this.saving()) return;

    try {
      this.saving.set(true);
      await this.contactService.linkContactToProject(contact, {
        contact_id: contact.contact_id,
        project_id: payload.project_id,
        relationship_type: payload.relationship_type,
        is_primary: payload.is_primary,
      });
      this.linkProjectModalOpen.set(false);
      await this.loadContactDetail(contact.contact_id);
      this.toast.showToast('Contact linked to project.', 'success');
    } catch (error: any) {
      console.error('[ContactsComponent] linkContactToProject error:', error);
      const isDuplicate = error?.code === '23505';
      this.toast.showToast(
        isDuplicate
          ? 'This contact is already linked to that project with the selected relationship.'
          : 'We were unable to link the contact to the project right now.',
        'error'
      );
    } finally {
      this.saving.set(false);
    }
  }

  openContact(contact: Contact): void { void this.router.navigate(['/admin/contacts', contact.contact_id]); }
  goBack(): void { void this.router.navigate(['/admin/contacts']); }
  retryList(): void { void this.loadContacts(); }
  retryDetail(): void { const id = this.currentContactId(); if (id) void this.loadContactDetail(id); }

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
      case 'client': return 'bg-blue-100 text-blue-700';
      case 'partner': return 'bg-rose-100 text-rose-700';
      case 'planner': return 'bg-violet-100 text-violet-700';
      case 'venue_contact': return 'bg-amber-100 text-amber-700';
      case 'vendor_contact': return 'bg-emerald-100 text-emerald-700';
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
