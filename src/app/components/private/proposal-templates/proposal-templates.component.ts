import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { DocumentTemplate } from '../../../core/models/floral-proposal';
import { ToastService } from '../../../core/services/toast.service';
import { DocumentTemplateRepositoryService } from '../../../core/supabase/repositories/document-template-repository.service';
import { DocumentTemplateService } from '../../../core/supabase/services/document-template.service';
import { CrmPageHeaderComponent } from '../../../shared/components/private/crm-page-header/crm-page-header.component';
import { EntityDetailShellComponent } from '../../../shared/components/private/entity-detail-shell/entity-detail-shell.component';
import {
  AdminTableColumn,
  EntityTableShellComponent,
} from '../../../shared/components/private/entity-table-shell/entity-table-shell.component';
import { EntityTableCellDirective } from '../../../shared/components/private/entity-table-shell/entity-table-cell.directive';
import { ErrorStateBlockComponent } from '../../../shared/components/private/error-state-block/error-state-block.component';
import { LoadingStateBlockComponent } from '../../../shared/components/private/loading-state-block/loading-state-block.component';
import {
  SearchFilterBarComponent,
  SearchFilterGroup,
} from '../../../shared/components/private/search-filter-bar/search-filter-bar.component';
import {
  ProposalTemplateUpsertModalComponent,
  ProposalTemplateUpsertPayload,
} from './components/proposal-template-upsert-modal/proposal-template-upsert-modal.component';

@Component({
  selector: 'app-proposal-templates',
  standalone: true,
  imports: [
    CommonModule,
    CrmPageHeaderComponent,
    SearchFilterBarComponent,
    EntityTableShellComponent,
    EntityTableCellDirective,
    EntityDetailShellComponent,
    LoadingStateBlockComponent,
    ErrorStateBlockComponent,
    ProposalTemplateUpsertModalComponent,
  ],
  templateUrl: './proposal-templates.component.html',
})
export class ProposalTemplatesComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly documentTemplateRepository = inject(DocumentTemplateRepositoryService);
  private readonly documentTemplateService = inject(DocumentTemplateService);
  private readonly toast = inject(ToastService);

  readonly columns: AdminTableColumn[] = [
    { key: 'name', label: 'Template' },
    { key: 'layout', label: 'Layout' },
    { key: 'style', label: 'Style' },
    { key: 'created_at', label: 'Created' },
  ];

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly detailLoading = signal(true);
  readonly detailError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly createModalOpen = signal(false);
  readonly editModalOpen = signal(false);

  readonly currentTemplateId = signal<string | null>(null);
  readonly templates = signal<DocumentTemplate[]>([]);
  readonly template = signal<DocumentTemplate | null>(null);

  readonly searchTerm = signal('');
  readonly statusFilter = signal<'active' | 'inactive' | 'all'>('active');
  readonly sortFilter = signal<'name' | 'created_desc' | 'created_asc'>('name');

  readonly isDetailView = computed(() => !!this.currentTemplateId());

  readonly filteredTemplates = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();

    const filtered = this.templates().filter((template) => {
      const haystack = [
        template.name,
        template.template_key,
        template.header_layout,
        template.line_item_layout,
        template.footer_layout,
      ]
        .join(' ')
        .toLowerCase();
      const matchesSearch = !term || haystack.includes(term);
      const matchesStatus =
        status === 'all' || (status === 'active' ? template.is_active : !template.is_active);
      return matchesSearch && matchesStatus;
    });

    return filtered.sort((a, b) => {
      switch (this.sortFilter()) {
        case 'created_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'created_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default:
          return a.name.localeCompare(b.name);
      }
    });
  });

  readonly filters = computed<SearchFilterGroup[]>(() => [
    {
      key: 'status',
      label: 'Status',
      value: this.statusFilter(),
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'All Templates', value: 'all' },
      ],
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
  ]);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const templateId = params.get('templateId');
      this.currentTemplateId.set(templateId);
      if (templateId) {
        void this.loadTemplateDetail(templateId);
      } else {
        void this.loadTemplates();
      }
    });
  }

  async loadTemplates(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      this.templates.set(await this.documentTemplateRepository.getDocumentTemplates());
    } catch (error) {
      console.error('[ProposalTemplatesComponent] loadTemplates error:', error);
      this.error.set('We were unable to load proposal templates right now.');
      this.templates.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async loadTemplateDetail(templateId: string): Promise<void> {
    this.detailLoading.set(true);
    this.detailError.set(null);

    try {
      const template = await this.documentTemplateRepository.getDocumentTemplateById(templateId);
      if (!template) {
        this.template.set(null);
        this.detailError.set('We could not find this proposal template.');
        return;
      }

      this.template.set(template);
    } catch (error) {
      console.error('[ProposalTemplatesComponent] loadTemplateDetail error:', error);
      this.template.set(null);
      this.detailError.set('We were unable to load this proposal template right now.');
    } finally {
      this.detailLoading.set(false);
    }
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
  }

  onFilterChange(event: { key: string; value: string }): void {
    if (event.key === 'status') this.statusFilter.set(event.value as 'active' | 'inactive' | 'all');
    if (event.key === 'sort') this.sortFilter.set(event.value as 'name' | 'created_desc' | 'created_asc');
  }

  resetFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set('active');
    this.sortFilter.set('name');
  }

  openCreateModal(): void {
    this.createModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.createModalOpen.set(false);
  }

  openEditModal(): void {
    this.editModalOpen.set(true);
  }

  closeEditModal(): void {
    this.editModalOpen.set(false);
  }

  async createTemplate(payload: ProposalTemplateUpsertPayload): Promise<void> {
    if (this.saving()) return;

    try {
      this.saving.set(true);
      const template = await this.documentTemplateService.createDocumentTemplate({
        ...payload,
        header_content: {},
        footer_content: {},
        body_config: {},
        template_config: {
          preview_note: 'Structured floral proposal template',
        },
        agreement_clauses: [],
      });
      this.createModalOpen.set(false);
      this.toast.showToast('Proposal template created successfully.', 'success');
      await this.loadTemplates();
      await this.router.navigate(['/admin/proposal-templates', template.template_id]);
    } catch (error) {
      console.error('[ProposalTemplatesComponent] createTemplate error:', error);
      this.toast.showToast('We were unable to create the proposal template right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async saveTemplateEdits(payload: ProposalTemplateUpsertPayload): Promise<void> {
    const template = this.template();
    if (!template || this.saving()) return;

    try {
      this.saving.set(true);
      await this.documentTemplateService.updateDocumentTemplate(template.template_id, payload);
      this.editModalOpen.set(false);
      await this.loadTemplateDetail(template.template_id);
      await this.loadTemplates();
      this.toast.showToast('Proposal template updated successfully.', 'success');
    } catch (error) {
      console.error('[ProposalTemplatesComponent] saveTemplateEdits error:', error);
      this.toast.showToast('We were unable to save template changes right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async deactivateCurrentTemplate(): Promise<void> {
    const template = this.template();
    if (!template || this.saving()) return;

    const confirmed = window.confirm(
      `Deactivate ${template.name}? Florists will no longer be able to choose it for new Floral Proposals.`
    );
    if (!confirmed) return;

    try {
      this.saving.set(true);
      await this.documentTemplateService.deactivateTemplate(template);
      await this.loadTemplateDetail(template.template_id);
      await this.loadTemplates();
      this.toast.showToast('Proposal template deactivated.', 'success');
    } catch (error) {
      console.error('[ProposalTemplatesComponent] deactivateCurrentTemplate error:', error);
      this.toast.showToast('We were unable to deactivate the proposal template right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async activateCurrentTemplate(): Promise<void> {
    const template = this.template();
    if (!template || this.saving()) return;

    try {
      this.saving.set(true);
      await this.documentTemplateService.activateTemplate(template);
      await this.loadTemplateDetail(template.template_id);
      await this.loadTemplates();
      this.toast.showToast('Proposal template activated.', 'success');
    } catch (error) {
      console.error('[ProposalTemplatesComponent] activateCurrentTemplate error:', error);
      this.toast.showToast('We were unable to activate the proposal template right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  openTemplate(template: DocumentTemplate): void {
    void this.router.navigate(['/admin/proposal-templates', template.template_id]);
  }

  goBack(): void {
    void this.router.navigate(['/admin/proposal-templates']);
  }

  retryList(): void {
    void this.loadTemplates();
  }

  retryDetail(): void {
    const id = this.currentTemplateId();
    if (id) void this.loadTemplateDetail(id);
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Not available';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  getLayoutSummary(template: DocumentTemplate): string {
    return `${this.formatLabel(template.header_layout)} / ${this.formatLabel(
      template.line_item_layout
    )} / ${this.formatLabel(template.footer_layout)}`;
  }

  formatLabel(value: string): string {
    return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
