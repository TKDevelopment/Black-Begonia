import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { DocumentTemplate } from '../../../core/models/floral-proposal';
import { ToastService } from '../../../core/services/toast.service';
import { DocumentTemplateStudioBridgeService } from '../../../core/templates/document-template-studio-bridge.service';
import { TEMPLATE_BLOCK_REGISTRY } from '../../../core/templates/template-block-registry';
import { TemplateDocumentRendererService } from '../../../core/templates/template-document-renderer.service';
import {
  TemplateBlock,
  TemplateDefinition,
  TemplatePreviewProfile,
  ValidationIssue,
} from '../../../core/templates/template-studio.models';
import { TemplateStudioStore } from '../../../core/templates/template-studio.store';
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
    FormsModule,
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
  readonly blockRegistry = TEMPLATE_BLOCK_REGISTRY;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly documentTemplateRepository = inject(DocumentTemplateRepositoryService);
  private readonly documentTemplateService = inject(DocumentTemplateService);
  private readonly documentTemplateStudioBridge = inject(DocumentTemplateStudioBridgeService);
  private readonly templateDocumentRenderer = inject(TemplateDocumentRendererService);
  private readonly templateStudioStore = inject(TemplateStudioStore);
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
  readonly logoSaving = signal(false);
  readonly createModalOpen = signal(false);
  readonly editModalOpen = signal(false);

  readonly currentTemplateId = signal<string | null>(null);
  readonly templates = signal<DocumentTemplate[]>([]);
  readonly template = signal<DocumentTemplate | null>(null);
  readonly templateLogoUrl = signal<string | null>(null);
  readonly templateDefinition = signal<TemplateDefinition | null>(null);
  readonly templateStudioErrors = signal<ValidationIssue[]>([]);
  readonly templateStudioWarnings = signal<ValidationIssue[]>([]);

  readonly searchTerm = signal('');
  readonly statusFilter = signal<'active' | 'inactive' | 'all'>('active');
  readonly sortFilter = signal<'name' | 'created_desc' | 'created_asc'>('name');

  readonly isDetailView = computed(() => !!this.currentTemplateId());
  readonly templateBlockSummaries = computed(() =>
    (this.templateStudioStore.workingDraft() ?? this.templateDefinition())
      ?.blocks
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((block) => ({
        ...block,
        label: TEMPLATE_BLOCK_REGISTRY[block.type]?.label ?? this.formatLabel(block.type),
        variantLabel: this.formatLabel(block.layout_variant),
      })) ?? []
  );
  readonly templateValidationSummary = computed(() => ({
    errors: this.templateStudioErrors().length,
    warnings: this.templateStudioWarnings().length,
  }));
  readonly enabledTemplateBlockCount = computed(
    () => this.templateBlockSummaries().filter((block) => block.enabled).length
  );
  readonly activePreviewProfileLabel = computed(
    () => this.templatePreviewProfiles()[0]?.label ?? 'None'
  );
  readonly studioDraft = computed(() => this.templateStudioStore.workingDraft());
  readonly selectedStudioBlock = computed(() => this.templateStudioStore.selectedBlock());
  readonly selectedStudioBlockControlGroups = computed(() => {
    const block = this.selectedStudioBlock();
    if (!block) return [];
    return TEMPLATE_BLOCK_REGISTRY[block.type]?.controls ?? [];
  });
  readonly templatePreviewMarkup = computed(() => {
    const draft = this.templateStudioStore.workingDraft();
    const profile = this.templatePreviewProfiles()[0];
    if (!draft || !profile) {
      return '';
    }

    const result = this.templateDocumentRenderer.render({
      template: draft,
      proposal: profile.proposal_render_model,
      mode: 'preview',
    });
    return `
      <html>
        <head>
          <style>${result.css}</style>
        </head>
        <body style="margin:0;background:#f7f4f1;">
          ${result.html}
        </body>
      </html>
    `;
  });
  readonly previewRenderStatus = computed(() => this.templateStudioStore.snapshot().preview.render_status);
  readonly templatePreviewProfiles = signal<TemplatePreviewProfile[]>([
    {
      id: 'wedding-editorial',
      label: 'Wedding Editorial',
      proposal_render_model: {
        schema_version: '1.0',
        proposal: {
          id: 'sample-proposal',
          number: 'FP-2026-001',
          title: 'Spring Garden Wedding Proposal',
          status: 'previewed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          valid_until: null,
          currency: 'USD',
        },
        branding: {
          business_name: 'Black Begonia Floral',
          logo_url: null,
          website: 'https://blackbegonia.example',
          email: 'studio@blackbegonia.example',
          phone: '(555) 100-2000',
          instagram: '@blackbegoniafloral',
          address_lines: ['Portland, Oregon'],
        },
        client: {
          primary_contact: {
            first_name: 'Avery',
            last_name: 'Hart',
            full_name: 'Avery Hart',
            email: 'avery@example.com',
            phone: '(555) 222-3344',
          },
          partner_contact: {
            full_name: 'Jordan Hart',
          },
        },
        event: {
          type: 'Wedding',
          date: new Date().toISOString(),
          venue_name: 'The Conservatory',
          venue_city: 'Portland',
          venue_state: 'OR',
          guest_count: 120,
          planner_name: 'Willow Events',
          planner_email: 'hello@willowevents.example',
          planner_phone: '(555) 444-5566',
        },
        intro: {
          greeting: 'Hello Avery,',
          welcome_message:
            'Thank you for inviting us into your celebration. This proposal reflects a lush garden-forward floral direction with layered spring texture.',
          closing_message:
            'We would be honored to bring this floral story to life for your day.',
          signature_name: 'Tristan Knott',
          signature_title: 'Creative Director',
        },
        gallery: {
          hero_image_url: null,
          mood_images: [
            { id: 'm1', url: 'https://example.com/mood-1.jpg', caption: 'Ceremony palette' },
            { id: 'm2', url: 'https://example.com/mood-2.jpg', caption: 'Reception mood' },
          ],
        },
        line_items: [
          {
            id: 'li-1',
            name: 'Bridal Bouquet',
            category: 'Personal Flowers',
            description: 'Garden rose bouquet with reflexed blooms and silk ribbon wrap.',
            quantity: 1,
            unit_label: 'arrangement',
            image_url: null,
            notes: null,
            pricing: {
              unit_price: 325,
              line_total: 325,
              price_visible: true,
            },
          },
          {
            id: 'li-2',
            name: 'Reception Centerpieces',
            category: 'Reception',
            description: 'Compote centerpieces with layered local florals and taper candles.',
            quantity: 12,
            unit_label: 'tables',
            image_url: null,
            notes: null,
            pricing: {
              unit_price: 165,
              line_total: 1980,
              price_visible: true,
            },
          },
        ],
        inclusions: [
          { id: 'inc-1', label: 'Delivery and on-site setup' },
          { id: 'inc-2', label: 'Breakdown of personal flowers packaging' },
        ],
        investment: {
          subtotal: 2305,
          tax_total: 184.4,
          service_fee_total: 150,
          grand_total: 2639.4,
          deposit_amount: 750,
          payment_schedule: [
            { label: 'Retainer', amount: 750, due_date: new Date().toISOString() },
            { label: 'Final Balance', amount: 1889.4, due_date: new Date().toISOString() },
          ],
        },
        terms: {
          payment_terms: 'A signed agreement and retainer are required to reserve your date.',
          cancellation_policy: 'Retainers are non-refundable once the date is reserved.',
          revision_policy: 'One major revision round is included prior to final sign-off.',
          notes: null,
        },
        cta: {
          acceptance_label: 'Approve Proposal',
          acceptance_instructions: 'Reply to this proposal or sign digitally to move forward.',
          proposal_access_url: null,
        },
        meta: {
          generated_at: new Date().toISOString(),
          sample_data: true,
        },
      },
    },
  ]);

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
        this.templateLogoUrl.set(null);
        this.detailError.set('We could not find this proposal template.');
        return;
      }

      this.template.set(template);
      this.templateLogoUrl.set(await this.resolveTemplateLogoUrl(template));
      this.hydrateTemplateStudio(template);
    } catch (error) {
      console.error('[ProposalTemplatesComponent] loadTemplateDetail error:', error);
      this.template.set(null);
      this.templateLogoUrl.set(null);
      this.templateDefinition.set(null);
      this.templateStudioErrors.set([]);
      this.templateStudioWarnings.set([]);
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

  openTemplateStudio(): void {
    const template = this.template();
    if (!template) return;
    void this.router.navigate(['/admin/proposal-templates', template.template_id, 'studio']);
  }

  closeEditModal(): void {
    this.editModalOpen.set(false);
  }

  async createTemplate(payload: ProposalTemplateUpsertPayload): Promise<void> {
    if (this.saving()) return;

    try {
      this.saving.set(true);
      const templateDefinition = this.buildTemplateDefinitionFromPayload(payload);
      const validation = this.documentTemplateStudioBridge.validateTemplateDefinition(templateDefinition);
      if (validation.errors.length > 0) {
        this.toast.showToast('Template Studio validation failed. Please review the template configuration.', 'error');
        return;
      }

      const template = await this.documentTemplateService.createTemplateStudioDocumentTemplate({
        ...payload,
        header_content: {},
        footer_content: {},
        body_config: {},
        template_config: {
          preview_note: 'Structured floral proposal template',
        },
        agreement_clauses: [],
      }, templateDefinition);
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
      const templateDefinition = this.buildTemplateDefinitionFromPayload(payload, template);
      const validation = this.documentTemplateStudioBridge.validateTemplateDefinition(templateDefinition);
      if (validation.errors.length > 0) {
        this.toast.showToast('Template Studio validation failed. Please review the template configuration.', 'error');
        return;
      }

      await this.documentTemplateService.updateTemplateStudioDocumentTemplate(template, templateDefinition, payload);
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

  async saveTemplateStudioDraft(): Promise<void> {
    const template = this.template();
    const draft = this.templateStudioStore.workingDraft();
    if (!template || !draft || this.saving()) return;

    const validation = this.documentTemplateStudioBridge.validateTemplateDefinition(draft);
    this.templateStudioErrors.set(validation.errors);
    this.templateStudioWarnings.set(validation.warnings);
    this.templateStudioStore.updateValidation(validation.errors, validation.warnings);

    if (validation.errors.length > 0) {
      this.toast.showToast('Template Studio has validation errors. Please resolve them before saving.', 'error');
      return;
    }

    try {
      this.saving.set(true);
      const updatedTemplate = await this.documentTemplateService.updateTemplateStudioDocumentTemplate(
        template,
        draft
      );
      this.template.set(updatedTemplate);
      this.templateDefinition.set(draft);
      this.templateStudioStore.markSaved(draft);
      await this.loadTemplateDetail(template.template_id);
      await this.loadTemplates();
      this.toast.showToast('Template Studio draft saved.', 'success');
    } catch (error) {
      console.error('[ProposalTemplatesComponent] saveTemplateStudioDraft error:', error);
      this.toast.showToast('We were unable to save the Template Studio draft right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async onTemplateLogoSelected(event: Event): Promise<void> {
    const template = this.template();
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!template || !file || this.logoSaving()) {
      if (input) input.value = '';
      return;
    }

    try {
      this.logoSaving.set(true);

      if (template.logo_storage_path) {
        await this.documentTemplateService.removeTemplateLogo(template.logo_storage_path);
      }

      const { storagePath, signedUrl } = await this.documentTemplateService.uploadTemplateLogo(
        template.template_id,
        file
      );

      await this.documentTemplateService.updateDocumentTemplate(template.template_id, {
        logo_storage_path: storagePath,
        logo_url: null,
      });

      this.templateLogoUrl.set(signedUrl);
      await this.loadTemplateDetail(template.template_id);
      await this.loadTemplates();
      this.toast.showToast('Template logo uploaded.', 'success');
    } catch (error) {
      console.error('[ProposalTemplatesComponent] onTemplateLogoSelected error:', error);
      this.toast.showToast('We were unable to upload the template logo right now.', 'error');
    } finally {
      if (input) input.value = '';
      this.logoSaving.set(false);
    }
  }

  async removeTemplateLogo(): Promise<void> {
    const template = this.template();
    if (!template || !template.logo_storage_path || this.logoSaving()) return;

    try {
      this.logoSaving.set(true);
      await this.documentTemplateService.removeTemplateLogo(template.logo_storage_path);
      await this.documentTemplateService.updateDocumentTemplate(template.template_id, {
        logo_storage_path: null,
        logo_url: null,
      });
      this.templateLogoUrl.set(null);
      await this.loadTemplateDetail(template.template_id);
      await this.loadTemplates();
      this.toast.showToast('Template logo removed.', 'success');
    } catch (error) {
      console.error('[ProposalTemplatesComponent] removeTemplateLogo error:', error);
      this.toast.showToast('We were unable to remove the template logo right now.', 'error');
    } finally {
      this.logoSaving.set(false);
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
    const definition = this.documentTemplateStudioBridge.getTemplateDefinition(template);
    const enabledCount = definition.blocks.filter((block) => block.enabled).length;
    return `${enabledCount} blocks / v${definition.version} / ${this.formatLabel(
      template.header_layout
    )}`;
  }

  formatLabel(value: string): string {
    return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  getTemplateStudioHealthTone(): 'rose' | 'amber' | 'emerald' {
    if (this.templateStudioErrors().length > 0) return 'rose';
    if (this.templateStudioWarnings().length > 0) return 'amber';
    return 'emerald';
  }

  getValidationIssuesForBlock(blockId: string): ValidationIssue[] {
    return [...this.templateStudioErrors(), ...this.templateStudioWarnings()].filter(
      (issue) => issue.block_id === blockId
    );
  }

  selectStudioBlock(blockId: string): void {
    this.templateStudioStore.selectBlock(blockId);
  }

  updateSelectedBlockEnabled(enabled: boolean): void {
    const block = this.selectedStudioBlock();
    if (!block) return;
    this.templateStudioStore.updateBlock(block.id, 'enabled', enabled);
    this.refreshStudioValidationAndPreview();
  }

  updateSelectedBlockVariant(variant: string): void {
    const block = this.selectedStudioBlock();
    if (!block) return;
    this.templateStudioStore.updateBlock(block.id, 'layout_variant', variant as TemplateBlock['layout_variant']);
    this.refreshStudioValidationAndPreview();
  }

  updateSelectedBlockContent(key: string, value: string | boolean | number): void {
    const block = this.selectedStudioBlock();
    if (!block) return;
    this.templateStudioStore.updateBlockNestedValue(block.id, 'content', key, value);
    this.refreshStudioValidationAndPreview();
  }

  updateSelectedBlockStyle(key: string, value: string | number): void {
    const block = this.selectedStudioBlock();
    if (!block) return;
    this.templateStudioStore.updateBlockNestedValue(block.id, 'styles', key, value);
    this.refreshStudioValidationAndPreview();
  }

  updateThemeColor(key: 'primary' | 'accent' | 'canvas' | 'surface' | 'text' | 'muted_text' | 'border', value: string): void {
    this.templateStudioStore.updateTokenNestedValue('colors', key, value);
    this.refreshStudioValidationAndPreview();
  }

  updateThemeFont(key: 'heading_font_family' | 'body_font_family', value: string): void {
    const draft = this.templateStudioStore.workingDraft();
    if (!draft) return;
    this.templateStudioStore.replaceWorkingDraft({
      ...draft,
      tokens: {
        ...draft.tokens,
        typography: {
          ...draft.tokens.typography,
          [key]: value,
        },
      },
      metadata: {
        ...draft.metadata,
        updated_at: new Date().toISOString(),
      },
    });
    this.refreshStudioValidationAndPreview();
  }

  updateAdvancedCss(value: string): void {
    this.templateStudioStore.updateAdvancedCss(value);
    this.refreshStudioValidationAndPreview();
  }

  getBlockControlValue(groupKey: string, controlKey: string): string | number | boolean | null {
    const block = this.selectedStudioBlock();
    if (!block) return null;

    const path = controlKey.split('.');
    if (path[0] === 'content') {
      return (block.content as Record<string, unknown>)[path[1]] as string | number | boolean | null;
    }
    if (path[0] === 'styles') {
      return ((block.styles ?? {}) as Record<string, unknown>)[path[1]] as string | number | boolean | null;
    }
    if (controlKey === 'layout_variant') {
      return block.layout_variant;
    }
    if (controlKey === 'enabled') {
      return block.enabled;
    }
    return null;
  }

  getSelectControlOptions(control: unknown): Array<{ label: string; value: string }> {
    if (!control || typeof control !== 'object' || !('options' in control)) {
      return [];
    }

    const options = (control as { options?: Array<{ label: string; value: string }> }).options;
    return options ?? [];
  }

  controlTrackBy(index: number, _item?: unknown): number {
    return index;
  }

  private async resolveTemplateLogoUrl(template: DocumentTemplate): Promise<string | null> {
    if (template.logo_url) {
      return template.logo_url;
    }

    if (!template.logo_storage_path) {
      return null;
    }

    try {
      return await this.documentTemplateService.getSignedTemplateLogoUrl(template.logo_storage_path);
    } catch (error) {
      console.error('[ProposalTemplatesComponent] resolveTemplateLogoUrl error:', error);
      return null;
    }
  }

  private hydrateTemplateStudio(template: DocumentTemplate): void {
    const definition = this.documentTemplateStudioBridge.getTemplateDefinition(template);
    const validation = this.documentTemplateStudioBridge.validateTemplateDefinition(definition);

    this.templateDefinition.set(definition);
    this.templateStudioErrors.set(validation.errors);
    this.templateStudioWarnings.set(validation.warnings);
    this.templateStudioStore.initializeDraft(definition, {
      mode: 'edit',
      sampleProfile: this.templatePreviewProfiles()[0] ?? null,
    });
    this.templateStudioStore.updateValidation(validation.errors, validation.warnings);
    this.templateStudioStore.updateRenderStatus(
      validation.errors.length === 0 ? 'ready' : 'error',
      validation.warnings.map((issue) => issue.message)
    );
  }

  private refreshStudioValidationAndPreview(): void {
    const draft = this.templateStudioStore.workingDraft();
    if (!draft) return;

    const validation = this.documentTemplateStudioBridge.validateTemplateDefinition(draft);
    this.templateStudioErrors.set(validation.errors);
    this.templateStudioWarnings.set(validation.warnings);
    this.templateStudioStore.updateValidation(validation.errors, validation.warnings);

    const profile = this.templatePreviewProfiles()[0];
    if (!profile) {
      this.templateStudioStore.updateRenderStatus('idle', []);
      return;
    }

    const preview = this.templateDocumentRenderer.render({
      template: draft,
      proposal: profile.proposal_render_model,
      mode: 'preview',
    });

    this.templateStudioStore.updateRenderStatus(
      validation.errors.length === 0 ? 'ready' : 'error',
      [...validation.warnings.map((issue) => issue.message), ...preview.warnings],
      preview.html
    );
  }

  private buildTemplateDefinitionFromPayload(
    payload: ProposalTemplateUpsertPayload,
    currentTemplate?: DocumentTemplate | null
  ): TemplateDefinition {
    const baseTemplate =
      currentTemplate ??
      ({
        template_id: `draft-${payload.template_key}`,
        name: payload.name,
        template_key: payload.template_key,
        template_kind: 'floral_proposal',
        is_active: payload.is_active,
        is_default: payload.is_default,
        logo_storage_path: null,
        logo_url: null,
        primary_color: payload.primary_color ?? null,
        accent_color: payload.accent_color ?? null,
        heading_font_family: payload.heading_font_family ?? null,
        body_font_family: payload.body_font_family ?? null,
        header_layout: payload.header_layout,
        line_item_layout: payload.line_item_layout,
        footer_layout: payload.footer_layout,
        show_cover_page: payload.show_cover_page,
        show_intro_message: payload.show_intro_message,
        intro_title: payload.intro_title ?? null,
        intro_body: payload.intro_body ?? null,
        show_terms_section: payload.show_terms_section,
        show_privacy_section: payload.show_privacy_section,
        show_signature_section: payload.show_signature_section,
        agreement_clauses: [],
        header_content: {},
        footer_content: {},
        body_config: {},
        template_config: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } satisfies DocumentTemplate);

    const definition = this.documentTemplateStudioBridge.getTemplateDefinition(baseTemplate);

    return {
      ...definition,
      id: currentTemplate?.template_id ?? definition.id,
      name: payload.name,
      slug: payload.template_key,
      status: payload.is_active ? 'draft' : 'archived',
      tokens: {
        ...definition.tokens,
        colors: {
          ...definition.tokens.colors,
          primary: payload.primary_color ?? definition.tokens.colors.primary,
          accent: payload.accent_color ?? definition.tokens.colors.accent,
        },
        typography: {
          ...definition.tokens.typography,
          heading_font_family:
            payload.heading_font_family ?? definition.tokens.typography.heading_font_family,
          body_font_family:
            payload.body_font_family ?? definition.tokens.typography.body_font_family,
        },
      },
      blocks: definition.blocks.map((block) => {
        switch (block.type) {
          case 'cover':
            return {
              ...block,
              enabled: payload.show_cover_page,
              layout_variant:
                payload.header_layout === 'minimal'
                  ? 'minimal'
                  : payload.header_layout === 'classic'
                    ? 'romantic'
                    : 'editorial',
            };
          case 'intro-note':
            return {
              ...block,
              enabled: payload.show_intro_message,
              content: {
                ...block.content,
                section_title: payload.intro_title ?? block.content.section_title,
                message_mode: payload.intro_body ? 'custom' : block.content.message_mode,
                custom_message: payload.intro_body ?? block.content.custom_message ?? null,
              },
            };
          case 'proposal-items':
            return {
              ...block,
              layout_variant:
                payload.line_item_layout === 'image_right'
                  ? 'cards'
                  : payload.line_item_layout === 'stacked'
                    ? 'editorial-list'
                    : 'stacked',
            };
          case 'terms-and-next-steps':
            return {
              ...block,
              enabled: payload.show_terms_section || payload.show_privacy_section,
              content: {
                ...block.content,
                show_payment_terms: payload.show_terms_section,
                show_cancellation_policy: payload.show_terms_section,
                show_revision_policy: payload.show_privacy_section,
                show_acceptance_instructions: payload.show_signature_section,
              },
            };
          case 'signature-closing':
            return {
              ...block,
              enabled: payload.show_signature_section,
              layout_variant: payload.footer_layout === 'formal' ? 'editorial' : 'simple',
            };
          default:
            return block;
        }
      }),
      metadata: {
        ...definition.metadata,
        updated_at: new Date().toISOString(),
      },
    };
  }
}
