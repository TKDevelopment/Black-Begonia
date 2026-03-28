import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';

import { CatalogItem } from '../../../core/models/catalog-item';
import {
  DocumentTemplate,
  FloralProposal,
  FloralProposalRenderContract,
  FloralProposalLineItemType,
  FloralProposalShoppingListItem,
  PricingSettings,
} from '../../../core/models/floral-proposal';
import { Lead } from '../../../core/models/lead';
import { TaxRegion } from '../../../core/models/tax-region';
import { ToastService } from '../../../core/services/toast.service';
import { CrmThemeService } from '../../../core/services/crm-theme.service';
import { ActivityRepositoryService } from '../../../core/supabase/repositories/activity-repository.service';
import { CatalogItemRepositoryService } from '../../../core/supabase/repositories/catalog-item-repository.service';
import { DocumentTemplateRepositoryService } from '../../../core/supabase/repositories/document-template-repository.service';
import { FloralProposalRepositoryService } from '../../../core/supabase/repositories/floral-proposal-repository.service';
import { LeadRepositoryService } from '../../../core/supabase/repositories/lead-repository.service';
import { PricingSettingsRepositoryService } from '../../../core/supabase/repositories/pricing-settings-repository.service';
import { TaxRegionRepositoryService } from '../../../core/supabase/repositories/tax-region-repository.service';
import { VendorItemPackRepositoryService } from '../../../core/supabase/repositories/vendor-item-pack-repository.service';
import {
  FloralProposalBuilderComponentRow,
  FloralProposalBuilderLine,
  FloralProposalRenderPayload,
  FloralProposalBuilderService,
} from '../../../core/supabase/services/floral-proposal-builder.service';
import { FloralProposalWorkflowService } from '../../../core/supabase/services/floral-proposal-workflow.service';
import { FloralProposalRendererService } from '../../../core/supabase/services/floral-proposal-renderer.service';
import { EntityDetailShellComponent } from '../../../shared/components/private/entity-detail-shell/entity-detail-shell.component';
import { ErrorStateBlockComponent } from '../../../shared/components/private/error-state-block/error-state-block.component';
import { LoadingStateBlockComponent } from '../../../shared/components/private/loading-state-block/loading-state-block.component';
import { StatusBadgeComponent } from '../../../shared/components/private/status-badge/status-badge.component';

@Component({
  selector: 'app-floral-proposal-builder',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    LoadingStateBlockComponent,
    ErrorStateBlockComponent,
    EntityDetailShellComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './floral-proposal-builder.component.html',
})
export class FloralProposalBuilderComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly leadRepository = inject(LeadRepositoryService);
  private readonly taxRegionRepository = inject(TaxRegionRepositoryService);
  private readonly floralProposalRepository = inject(FloralProposalRepositoryService);
  private readonly catalogItemRepository = inject(CatalogItemRepositoryService);
  private readonly vendorItemPackRepository = inject(VendorItemPackRepositoryService);
  private readonly activityRepository = inject(ActivityRepositoryService);
  private readonly documentTemplateRepository = inject(DocumentTemplateRepositoryService);
  private readonly pricingSettingsRepository = inject(PricingSettingsRepositoryService);
  private readonly proposalWorkflow = inject(FloralProposalWorkflowService);
  private readonly floralProposalRenderer = inject(FloralProposalRendererService);
  private readonly floralProposalBuilderService = inject(FloralProposalBuilderService);
  private readonly toast = inject(ToastService);
  readonly crmThemeService = inject(CrmThemeService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly previewOpen = signal(false);
  readonly previewLoading = signal(false);
  readonly previewContract = signal<FloralProposalRenderContract | null>(null);
  readonly previewPdfObjectUrl = signal<string | null>(null);
  readonly previewPdfBase64 = signal<string | null>(null);
  readonly lead = signal<Lead | null>(null);
  readonly proposals = signal<FloralProposal[]>([]);
  readonly activeProposal = signal<FloralProposal | null>(null);
  readonly taxRegions = signal<TaxRegion[]>([]);
  readonly templates = signal<DocumentTemplate[]>([]);
  readonly catalogItems = signal<CatalogItem[]>([]);
  readonly pricingSettings = signal<PricingSettings | null>(null);
  readonly lineItems = signal<FloralProposalBuilderLine[]>([]);
  readonly shoppingList = signal<FloralProposalShoppingListItem[]>([]);
  readonly selectedTaxRegionId = signal<string>('');
  readonly selectedTemplateId = signal<string>('');
  readonly defaultMarkupPercent = signal(300);
  readonly draggingLineId = signal<string | null>(null);
  readonly dragOverImageLineId = signal<string | null>(null);

  readonly selectedTaxRegion = computed(() => {
    const id = this.selectedTaxRegionId();
    return this.taxRegions().find((region) => region.tax_region_id === id) ?? null;
  });

  readonly selectedTemplate = computed(() => {
    const id = this.selectedTemplateId();
    return this.templates().find((template) => template.template_id === id) ?? null;
  });

  readonly activeCatalogItems = computed(() =>
    this.catalogItems().filter((item) => item.is_active)
  );

  readonly totals = computed(() =>
    this.floralProposalBuilderService.calculateTotals(this.lineItems(), this.selectedTaxRegion())
  );

  readonly renderPayload = computed(() => this.buildRenderPayload());
  readonly totalsBreakdown = computed(() => this.renderPayload().breakdown);

  readonly canEdit = computed(() => {
    const lead = this.lead();
    return !!lead && !this.isReadOnly(lead.status) && !this.saving();
  });

  readonly canSubmit = computed(() => {
    return (
      this.canEdit() &&
      !!this.selectedTemplateId() &&
      !!this.selectedTaxRegionId() &&
      this.lineItems().some((line) => line.item_name.trim().length > 0)
    );
  });

  readonly shoppingListSubtotal = computed(() =>
    Number(
      this.shoppingList()
        .reduce((sum, item) => sum + (item.total_estimated_cost ?? 0), 0)
        .toFixed(2)
    )
  );

  readonly title = computed(() => {
    const lead = this.lead();
    return lead
      ? `Floral Proposal Builder: ${lead.first_name} ${lead.last_name}`
      : 'Floral Proposal Builder';
  });

  readonly subtitle = computed(() => {
    const lead = this.lead();
    if (!lead) {
      return 'Build a client-facing Floral Proposal with internal catalog-item composition and live shopping-list rollups.';
    }

    return `${this.formatStatusLabel(lead.status)} lead - ${this.formatStatusLabel(
      lead.service_type
    )}`;
  });

  readonly previewHtml = computed(() => {
    const previewContract = this.previewContract();
    return previewContract
      ? this.floralProposalRenderer.renderHtml(previewContract)
      : this.buildProposalPrintHtmlFromRenderPayload(this.renderPayload());
  });
  readonly previewPdfUrl = computed<SafeResourceUrl | null>(() => {
    const objectUrl = this.previewPdfObjectUrl();
    return objectUrl
      ? this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl)
      : null;
  });

  ngOnInit(): void {
    const leadId = this.route.snapshot.paramMap.get('leadId');
    if (!leadId) {
      void this.router.navigate(['/admin/leads']);
      return;
    }

    void this.loadBuilder(leadId);
  }

  async loadBuilder(leadId: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const [lead, taxRegions, templates, proposals, catalogItems, pricingSettings] =
        await Promise.all([
          this.leadRepository.getLeadById(leadId),
          this.taxRegionRepository.getTaxRegions(),
          this.documentTemplateRepository.getDocumentTemplates(),
          this.floralProposalRepository.getLeadFloralProposals(leadId),
          this.catalogItemRepository.getCatalogItems(),
          this.pricingSettingsRepository.getActivePricingSettings(),
        ]);

      if (!lead) {
        this.error.set('We could not find this lead.');
        return;
      }

      this.lead.set(lead);
      this.taxRegions.set(taxRegions.filter((region) => region.is_active));
      this.templates.set(templates.filter((template) => template.is_active));
      this.catalogItems.set(catalogItems);
      this.pricingSettings.set(pricingSettings);
      this.proposals.set(proposals);

      const activeProposal = proposals.find((proposal) => proposal.is_active) ?? proposals[0] ?? null;
      this.activeProposal.set(activeProposal);
      this.selectedTaxRegionId.set(activeProposal?.tax_region_id ?? '');
      this.selectedTemplateId.set(activeProposal?.template_id ?? '');
      this.defaultMarkupPercent.set(
        this.getInitialDefaultMarkupPercent(activeProposal, pricingSettings)
      );

      if (activeProposal) {
        const [lineItems, components] = await Promise.all([
          this.floralProposalRepository.getFloralProposalLineItems(activeProposal.floral_proposal_id),
          this.floralProposalRepository.getFloralProposalComponents(activeProposal.floral_proposal_id),
        ]);

        const hydratedLines = this.floralProposalBuilderService.hydrateBuilderLines(
          lineItems,
          components
        );
        this.lineItems.set(await this.populateLineItemSignedUrls(hydratedLines));
      } else {
        this.lineItems.set([]);
      }

      await this.refreshShoppingList();

      if (!this.isWorkflowAllowed(lead.status)) {
        this.error.set(
          'This lead is not ready for Floral Proposal building yet. Complete consultation and move the lead into Nurturing first.'
        );
      }
    } catch (error) {
      console.error('[FloralProposalBuilderComponent] loadBuilder error:', error);
      this.error.set('We were unable to load the Floral Proposal builder right now.');
    } finally {
      this.loading.set(false);
    }
  }

  async retry(): Promise<void> {
    const leadId = this.lead()?.lead_id ?? this.route.snapshot.paramMap.get('leadId');
    if (!leadId) return;
    await this.loadBuilder(leadId);
  }

  goBack(): void {
    const leadId = this.lead()?.lead_id;
    if (!leadId) {
      void this.router.navigate(['/admin/leads']);
      return;
    }

    void this.router.navigate(['/admin/leads', leadId]);
  }

  addLineItem(): void {
    if (!this.canEdit()) return;

    this.lineItems.update((lines) => [
      ...lines,
      this.floralProposalBuilderService.createEmptyLine(lines.length),
    ]);
  }

  reorderLineItems(event: CdkDragDrop<FloralProposalBuilderLine[]>): void {
    if (!this.canEdit() || event.previousIndex === event.currentIndex) {
      this.draggingLineId.set(null);
      return;
    }

    const nextLines = [...this.lineItems()];
    moveItemInArray(nextLines, event.previousIndex, event.currentIndex);
    this.lineItems.set(
      nextLines.map((line, index) => ({
        ...line,
        display_order: index,
      }))
    );
    this.draggingLineId.set(null);
  }

  removeLine(lineId: string): void {
    if (!this.canEdit()) return;

    this.lineItems.update((lines) =>
      lines
        .filter((line) => line.local_id !== lineId)
        .map((line, index) => ({ ...line, display_order: index }))
    );
    void this.refreshShoppingList();
  }

  toggleExpanded(lineId: string): void {
    if (this.draggingLineId()) {
      return;
    }

    this.lineItems.update((lines) =>
      lines.map((line) =>
        line.local_id === lineId ? { ...line, expanded: !line.expanded } : line
      )
    );
  }

  onLineDragStarted(lineId: string): void {
    this.draggingLineId.set(lineId);
  }

  onLineDragEnded(): void {
    this.draggingLineId.set(null);
  }

  updateLineName(lineId: string, value: string): void {
    this.patchLine(lineId, { item_name: value });
  }

  updateLineQuantity(lineId: string, value: string): void {
    const quantity = Math.max(Number(value || 0), 0);
    this.patchAndRecalculateLine(lineId, { quantity });
  }

  updateLineType(lineId: string, value: FloralProposalLineItemType): void {
    this.patchAndRecalculateLine(lineId, { line_item_type: value });
  }



  updateManualUnitPrice(lineId: string, value: string): void {
    const unitPrice = Math.max(Number(value || 0), 0);
    this.patchAndRecalculateLine(lineId, { unit_price: unitPrice });
  }

  addComponentRow(lineId: string): void {
    if (!this.canEdit()) return;

    this.lineItems.update((lines) =>
      lines.map((line) => {
        if (line.local_id !== lineId) return line;

        const nextComponent = this.floralProposalBuilderService.createEmptyComponentRow(
          line.components.length,
          this.defaultMarkupPercent()
        );

        return {
          ...line,
          expanded: true,
          components: [...line.components, nextComponent],
        };
      })
    );
  }

  removeComponentRow(lineId: string, componentId: string): void {
    if (!this.canEdit()) return;

    this.lineItems.update((lines) =>
      lines.map((line) => {
        if (line.local_id !== lineId) return line;

        return this.floralProposalBuilderService.recalculateLine({
          ...line,
          components: line.components
            .filter((component) => component.local_id !== componentId)
            .map((component, index) => ({ ...component, display_order: index })),
        });
      })
    );

    void this.refreshShoppingList();
  }

  commitCatalogItemSelection(lineId: string, componentId: string, rawValue: string): void {
    if (!this.canEdit()) return;

    this.lineItems.update((lines) =>
      lines.map((line) => {
        if (line.local_id !== lineId) return line;

        const nextComponents = line.components.map((component) => {
          if (component.local_id !== componentId) return component;

          const matchedItem = this.findCatalogItemByName(rawValue);
          if (!matchedItem) {
            return {
              ...component,
              catalog_item_id: null,
              catalog_item_name: rawValue,
              item_type: component.item_type ?? null,
              unit_type: component.unit_type ?? null,
            };
          }

          return this.floralProposalBuilderService.applyCatalogItemToComponent(
            component,
            matchedItem,
            line.quantity,
            this.defaultMarkupPercent()
          );
        });

        return this.floralProposalBuilderService.recalculateLine({
          ...line,
          components: nextComponents,
        });
      })
    );

    void this.refreshShoppingList();
  }

  updateComponentQuantity(lineId: string, componentId: string, rawValue: string): void {
    const quantityPerUnit = Math.max(Number(rawValue || 0), 0);
    this.patchComponent(lineId, componentId, { quantity_per_unit: quantityPerUnit });
  }

  updateComponentMarkup(lineId: string, componentId: string, rawValue: string): void {
    const appliedMarkupPercent = Math.max(Number(rawValue || 0), 0);
    this.patchComponent(lineId, componentId, { applied_markup_percent: appliedMarkupPercent });
  }

  handleComponentQuantityAdvance(event: Event, lineId: string, componentId: string): void {
    const keyboardEvent = event as KeyboardEvent;
    const line = this.lineItems().find((item) => item.local_id === lineId);
    const isLast = !!line && line.components[line.components.length - 1]?.local_id === componentId;

    if (keyboardEvent.key === 'Enter' && isLast) {
      keyboardEvent.preventDefault();
      this.addComponentRow(lineId);
    }
  }

  onTemplateChange(value: string): void {
    this.selectedTemplateId.set(value);
  }

  onDefaultMarkupChange(value: string): void {
    const nextValue = Math.max(Number(value || 0), 0);
    this.defaultMarkupPercent.set(nextValue);
    this.lineItems.update((lines) =>
      lines.map((line) =>
        this.floralProposalBuilderService.recalculateLine({
          ...line,
          components: line.components.map((component) => ({
            ...component,
            applied_markup_percent: nextValue,
          })),
        })
      )
    );
    void this.refreshShoppingList();
  }

  onTaxRegionChange(value: string): void {
    this.selectedTaxRegionId.set(value);
  }

  async saveDraft(): Promise<void> {
    const lead = this.lead();
    if (!lead || this.saving() || this.isReadOnly(lead.status)) return;

    try {
      this.saving.set(true);
      const proposal = await this.persistDraft();
      this.activeProposal.set(proposal);
      this.toast.showToast('Floral Proposal draft saved.', 'success');
      await this.loadBuilder(lead.lead_id);
    } catch (error) {
      console.error('[FloralProposalBuilderComponent] saveDraft error:', error);
      this.toast.showToast('We were unable to save the Floral Proposal draft right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async openPreview(): Promise<void> {
    const lead = this.lead();
    if (!lead || this.saving() || !this.canSubmit()) return;

    this.previewOpen.set(true);
    this.previewLoading.set(true);
    this.previewContract.set(null);
    this.previewPdfBase64.set(null);
    this.resetPreviewPdfUrl(null);

    try {
      this.saving.set(true);
      const proposal = await this.persistDraft();
      this.activeProposal.set(proposal);
      const previewContract = await this.buildServerRenderContract(proposal);
      this.previewContract.set(previewContract);
      const previewPayload = this.proposalWorkflow.buildSubmissionPayload({
        lead,
        renderContract: previewContract,
        termsVersion: 'v1',
        privacyPolicyVersion: 'v1',
      });
      const previewPdf =
        await this.proposalWorkflow.previewProposalPdf(previewPayload);
      this.previewPdfBase64.set(previewPdf.pdfBase64);
      this.resetPreviewPdfUrl(previewPdf.objectUrl);
      await this.loadBuilder(lead.lead_id);
    } catch (error) {
      console.error('[FloralProposalBuilderComponent] openPreview error:', error);
      this.previewOpen.set(false);
      this.previewLoading.set(false);
      this.previewContract.set(null);
      this.previewPdfBase64.set(null);
      this.resetPreviewPdfUrl(null);
      this.toast.showToast('We were unable to prepare the Floral Proposal preview right now.', 'error');
    } finally {
      this.previewLoading.set(false);
      this.saving.set(false);
    }
  }

  closePreview(): void {
    if (this.saving() || this.previewLoading()) return;
    this.previewContract.set(null);
    this.previewPdfBase64.set(null);
    this.resetPreviewPdfUrl(null);
    this.previewOpen.set(false);
  }

  async submitFloralProposal(): Promise<void> {
    const lead = this.lead();
    if (!lead || this.saving() || this.isReadOnly(lead.status)) return;

    if (!this.selectedTemplateId()) {
      this.toast.showToast('Choose a Floral Proposal template before submitting.', 'error');
      return;
    }

    if (!this.selectedTaxRegionId()) {
      this.toast.showToast('Choose a tax region before submitting.', 'error');
      return;
    }

    if (!this.renderPayload().line_items.length) {
      this.toast.showToast('Add at least one line item before submitting the Floral Proposal.', 'error');
      return;
    }

    try {
      this.saving.set(true);
      const activeProposal = this.activeProposal();
      const renderContract =
        this.previewContract() ??
        (await this.buildServerRenderContract(activeProposal));
      const submissionPayload = this.proposalWorkflow.buildSubmissionPayload({
        lead,
        renderContract,
        termsVersion: 'v1',
        privacyPolicyVersion: 'v1',
      });
      const previewPdfBase64 = this.previewPdfBase64();
      const result = await this.proposalWorkflow.submitProposal({
        ...submissionPayload,
        pdf_base64: previewPdfBase64,
      });

      this.previewOpen.set(false);
      this.previewLoading.set(false);
      this.previewContract.set(null);
      this.previewPdfBase64.set(null);
      this.resetPreviewPdfUrl(null);
      this.toast.showToast(`Floral Proposal v${result.version} submitted successfully.`, 'success');
      await this.loadBuilder(lead.lead_id);
    } catch (error) {
      console.error('[FloralProposalBuilderComponent] submitFloralProposal error:', error);
      this.toast.showToast('We were unable to submit the Floral Proposal right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  getProposalStatusTone(status: FloralProposal['status']): 'neutral' | 'warning' | 'success' | 'danger' {
    switch (status) {
      case 'submitted':
        return 'warning';
      case 'accepted':
        return 'success';
      case 'declined':
      case 'expired':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  formatCurrency(value: number | null | undefined): string {
    if (value == null) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  }

  formatPercent(value: number | null | undefined): string {
    if (value == null) return '0.00%';
    return `${(value * 100).toFixed(2)}%`;
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

  formatStatusLabel(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  getLineImageFileName(storagePath: string | null | undefined): string {
    if (!storagePath) {
      return '';
    }

    const segments = storagePath.split('/');
    return segments[segments.length - 1] ?? '';
  }

  lineHasImage(line: FloralProposalBuilderLine): boolean {
    return Boolean(line.image_storage_path || line.image_signed_url);
  }

  exportFloralProposalPdf(): void {
    const lead = this.lead();
    const renderPayload = this.buildRenderPayload();

    if (!lead || !renderPayload.line_items.length) {
      this.toast.showToast('Add line items before exporting the Floral Proposal.', 'error');
      return;
    }

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=900');
    if (!printWindow) {
      this.toast.showToast('We were unable to open the Floral Proposal export window.', 'error');
      return;
    }

    const html = this.buildProposalPrintHtmlFromRenderPayload(renderPayload);
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  }

  private resetPreviewPdfUrl(nextUrl: string | null): void {
    const previousUrl = this.previewPdfObjectUrl();
    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
    }
    this.previewPdfObjectUrl.set(nextUrl);
  }

  private async uploadLineItemImage(lineId: string, file: File): Promise<void> {
    const lead = this.lead();
    if (!lead) {
      throw new Error('Lead is required to upload a line item image.');
    }

    this.saving.set(true);
    try {
      const { storagePath, signedUrl } = await this.proposalWorkflow.uploadLineItemImage(
        lead.lead_id,
        lineId,
        file
      );

      this.patchLineImageState(lineId, {
        image_storage_path: storagePath,
        image_alt_text: this.lineItems().find((line) => line.local_id === lineId)?.item_name || null,
        image_caption: null,
        image_signed_url: signedUrl,
      });
      this.toast.showToast('Line item image uploaded.', 'success');
    } finally {
      this.saving.set(false);
    }
  }

  async onLineImageSelected(lineId: string, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file || !this.canEdit()) {
      if (input) input.value = '';
      return;
    }

    try {
      await this.uploadLineItemImage(lineId, file);
    } catch (error) {
      console.error('[FloralProposalBuilderComponent] onLineImageSelected error:', error);
      this.toast.showToast('We were unable to upload the line item image right now.', 'error');
    } finally {
      if (input) input.value = '';
      this.saving.set(false);
    }
  }

  onLineImageDragOver(lineId: string, event: DragEvent): void {
    if (!this.canEdit()) return;
    event.preventDefault();
    event.stopPropagation();
    this.dragOverImageLineId.set(lineId);
  }

  onLineImageDragLeave(lineId: string, event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.dragOverImageLineId() === lineId) {
      this.dragOverImageLineId.set(null);
    }
  }

  async onLineImageDrop(lineId: string, event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.dragOverImageLineId.set(null);

    if (!this.canEdit()) return;

    const file = event.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    try {
      await this.uploadLineItemImage(lineId, file);
    } catch (error) {
      console.error('[FloralProposalBuilderComponent] onLineImageDrop error:', error);
      this.toast.showToast('We were unable to upload the line item image right now.', 'error');
    }
  }

  async removeLineImage(lineId: string): Promise<void> {
    const line = this.lineItems().find((item) => item.local_id === lineId);
    if (!line || !this.canEdit()) return;

    try {
      this.saving.set(true);
      if (line.image_storage_path) {
        await this.proposalWorkflow.removeLineItemImage(line.image_storage_path);
      }

      this.patchLineImageState(lineId, {
        image_storage_path: null,
        image_alt_text: null,
        image_caption: null,
        image_signed_url: null,
      });
      this.toast.showToast('Line item image removed.', 'success');
    } catch (error) {
      console.error('[FloralProposalBuilderComponent] removeLineImage error:', error);
      this.toast.showToast('We were unable to remove the line item image right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  getCatalogItemOptions(component: FloralProposalBuilderComponentRow): CatalogItem[] {
    const query = component.catalog_item_name.trim().toLowerCase();
    if (!query) {
      return this.activeCatalogItems().slice(0, 15);
    }

    return this.activeCatalogItems()
      .filter((item) =>
        [item.name, item.sku ?? '', item.color ?? '', item.variety ?? '']
          .join(' ')
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 15);
  }

  trackByLine = (_: number, line: FloralProposalBuilderLine) => line.local_id;
  trackByComponent = (_: number, component: FloralProposalBuilderComponentRow) => component.local_id;
  trackByTemplate = (_: number, template: DocumentTemplate) => template.template_id;
  trackByTaxRegion = (_: number, taxRegion: TaxRegion) => taxRegion.tax_region_id;
  trackByCatalogItem = (_: number, item: CatalogItem) => item.item_id;

  private async persistDraft(): Promise<FloralProposal> {
    const lead = this.lead();
    if (!lead) {
      throw new Error('Lead is required to save a Floral Proposal draft.');
    }

    const renderPayload = this.buildRenderPayload();
    const normalizedLines = this.normalizeLinesForPersistence();
    const nextVersion = Math.max(0, ...this.proposals().map((proposal) => proposal.version)) + 1;
    const existingActiveProposal =
      this.activeProposal() ??
      (await this.floralProposalRepository.getActiveLeadFloralProposal(lead.lead_id));
    const shouldReuseDraft =
      existingActiveProposal?.is_active === true && existingActiveProposal.status === 'draft';

    let proposal: FloralProposal;

    if (shouldReuseDraft && existingActiveProposal) {
      proposal = await this.floralProposalRepository.updateFloralProposal(
        existingActiveProposal.floral_proposal_id,
        {
          template_id: renderPayload.template_id ?? null,
          tax_region_id: renderPayload.tax_region_id ?? null,
          subtotal: renderPayload.totals.subtotal,
          tax_rate: renderPayload.tax_rate,
          tax_amount: renderPayload.totals.taxAmount,
          total_amount: renderPayload.totals.totalAmount,
          snapshot: this.buildProposalSnapshot(renderPayload),
          updated_at: new Date().toISOString(),
        }
      );
    } else {
      if (existingActiveProposal?.is_active) {
        await this.floralProposalRepository.updateFloralProposal(
          existingActiveProposal.floral_proposal_id,
          {
            is_active: false,
          }
        );
      }

      proposal = await this.floralProposalRepository.createFloralProposal({
        lead_id: lead.lead_id,
        template_id: renderPayload.template_id ?? null,
        tax_region_id: renderPayload.tax_region_id ?? null,
        version: nextVersion,
        customer_email: lead.email,
        passcode_hash: 'draft',
        status: 'draft',
        subtotal: renderPayload.totals.subtotal,
        tax_rate: renderPayload.tax_rate,
        tax_amount: renderPayload.totals.taxAmount,
        total_amount: renderPayload.totals.totalAmount,
        terms_version: 'v1',
        privacy_policy_version: 'v1',
        snapshot: this.buildProposalSnapshot(renderPayload),
        created_by: lead.assigned_user_id ?? null,
      });
    }

    const savedLineItems = await this.floralProposalRepository.replaceFloralProposalLineItems(
      proposal.floral_proposal_id,
      this.floralProposalBuilderService.buildLineItemPayloads(normalizedLines)
    );
    await this.floralProposalRepository.replaceFloralProposalComponents(
      savedLineItems,
      this.floralProposalBuilderService.buildComponentPayloadMap(savedLineItems, normalizedLines)
    );
    await this.floralProposalRepository.upsertShoppingList(
      proposal.floral_proposal_id,
      renderPayload.shopping_list
    );

    await this.activityRepository.createLeadActivity({
      lead_id: lead.lead_id,
      activity_type: 'updated',
      activity_label: shouldReuseDraft
        ? `Floral Proposal v${proposal.version} draft updated`
        : `Floral Proposal v${proposal.version} draft saved`,
      activity_description: shouldReuseDraft
        ? 'The active draft Floral Proposal was updated from the CRM builder.'
        : 'A draft Floral Proposal was saved from the CRM builder.',
      metadata: {
        floral_proposal_id: proposal.floral_proposal_id,
        proposal_version: proposal.version,
        proposal_status: 'draft',
        draft_action: shouldReuseDraft ? 'updated' : 'created',
      },
    });

    return proposal;
  }

  private patchLine(lineId: string, updates: Partial<FloralProposalBuilderLine>): void {
    if (!this.canEdit()) return;

    this.lineItems.update((lines) =>
      lines.map((line) => (line.local_id === lineId ? { ...line, ...updates } : line))
    );
  }

  private patchLineImageState(
    lineId: string,
    updates: Partial<FloralProposalBuilderLine>
  ): void {
    this.lineItems.update((lines) =>
      lines.map((line) => (line.local_id === lineId ? { ...line, ...updates } : line))
    );
  }

  private patchAndRecalculateLine(
    lineId: string,
    updates: Partial<FloralProposalBuilderLine>
  ): void {
    if (!this.canEdit()) return;

    this.lineItems.update((lines) =>
      lines.map((line) => {
        if (line.local_id !== lineId) return line;
        return this.floralProposalBuilderService.recalculateLine({ ...line, ...updates });
      })
    );

    void this.refreshShoppingList();
  }

  private patchComponent(
    lineId: string,
    componentId: string,
    updates: Partial<FloralProposalBuilderComponentRow>
  ): void {
    if (!this.canEdit()) return;

    this.lineItems.update((lines) =>
      lines.map((line) => {
        if (line.local_id !== lineId) return line;

        return this.floralProposalBuilderService.recalculateLine({
          ...line,
          components: line.components.map((component) =>
            component.local_id === componentId ? { ...component, ...updates } : component
          ),
        });
      })
    );

    void this.refreshShoppingList();
  }

  private async refreshShoppingList(): Promise<void> {
    const itemIds = Array.from(
      new Set(
        this.lineItems()
          .flatMap((line) => line.components)
          .map((component) => component.catalog_item_id)
          .filter((value): value is string => !!value)
      )
    );

    if (!itemIds.length) {
      this.shoppingList.set([]);
      return;
    }

    try {
      const packs = await this.vendorItemPackRepository.getDefaultPacksForItems(itemIds);
      const shoppingList = this.floralProposalBuilderService.buildShoppingList(
        this.lineItems(),
        packs
      );
      this.shoppingList.set(shoppingList);
    } catch (error) {
      console.error('[FloralProposalBuilderComponent] refreshShoppingList error:', error);
      this.shoppingList.set([]);
    }
  }

  private async populateLineItemSignedUrls(
    lines: FloralProposalBuilderLine[]
  ): Promise<FloralProposalBuilderLine[]> {
    return Promise.all(
      lines.map(async (line) => {
        if (!line.image_storage_path) {
          return { ...line, image_signed_url: null };
        }

        try {
          const signedUrl = await this.proposalWorkflow.getSignedLineItemImageUrl(
            line.image_storage_path
          );
          return {
            ...line,
            image_signed_url: signedUrl,
          };
        } catch (error) {
          console.error(
            '[FloralProposalBuilderComponent] populateLineItemSignedUrls error:',
            error
          );
          return {
            ...line,
            image_signed_url: null,
          };
        }
      })
    );
  }

  private findCatalogItemByName(value: string): CatalogItem | null {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;

    return (
      this.activeCatalogItems().find((item) => item.name.trim().toLowerCase() === normalized) ??
      null
    );
  }

  private getNormalizedLines(): FloralProposalBuilderLine[] {
    return this.normalizeLinesForPersistence().filter((line) => line.item_name.trim().length > 0);
  }

  private normalizeLinesForPersistence(): FloralProposalBuilderLine[] {
    return this.lineItems().map((line, index) =>
      this.floralProposalBuilderService.recalculateLine({
        ...line,
        display_order: index,
      })
    );
  }

  private buildRenderPayload(): FloralProposalRenderPayload {
    return this.floralProposalBuilderService.buildRenderPayload({
      lines: this.lineItems(),
      taxRegion: this.selectedTaxRegion(),
      templateId: this.selectedTemplateId() || null,
      templateName: this.selectedTemplate()?.name ?? null,
      defaultMarkupPercent: this.defaultMarkupPercent(),
      shoppingList: this.shoppingList(),
    });
  }

  private buildProposalSnapshot(
    renderPayload = this.buildRenderPayload(),
    renderContract?: FloralProposalRenderContract | null
  ): Record<string, unknown> {
    return {
      template_id: renderPayload.template_id,
      template_name: renderPayload.template_name,
      tax_region_id: renderPayload.tax_region_id,
      tax_region_name: renderPayload.tax_region_name,
      default_markup_percent: renderPayload.default_markup_percent,
      tax_rate: renderPayload.tax_rate,
      line_items: renderPayload.line_items.map((line) => ({
        display_order: line.display_order,
        line_item_type: line.line_item_type,
        item_name: line.item_name,
        quantity: line.quantity,
        unit_price: line.unit_price,
        subtotal: line.subtotal,
        image_storage_path: line.image_storage_path ?? null,
        image_alt_text: line.image_alt_text ?? null,
        image_caption: line.image_caption ?? null,
        components: line.components.map((component) => ({
          catalog_item_id: component.catalog_item_id ?? null,
          catalog_item_name: component.catalog_item_name,
          quantity_per_unit: component.quantity_per_unit,
          extended_quantity: component.extended_quantity,
          base_unit_cost: component.base_unit_cost,
          applied_markup_percent: component.applied_markup_percent,
          sell_unit_price: component.sell_unit_price,
          subtotal: component.subtotal,
        })),
      })),
      shopping_list: renderPayload.shopping_list,
      totals: renderPayload.totals,
      breakdown: renderPayload.breakdown,
      render_contract: renderContract ?? null,
    };
  }

  private async buildServerRenderContract(
    proposal?: FloralProposal | null
  ): Promise<FloralProposalRenderContract> {
    const lead = this.lead();
    if (!lead) {
      throw new Error('Lead is required to build the Floral Proposal render contract.');
    }

    return this.proposalWorkflow.createRenderContract({
      lead,
      proposal: proposal ?? this.activeProposal(),
      template: this.selectedTemplate(),
      taxRegion: this.selectedTaxRegion(),
      renderPayload: this.renderPayload(),
    });
  }

  private isWorkflowAllowed(status: Lead['status']): boolean {
    return (
      status === 'nurturing' ||
      status === 'proposal_declined' ||
      status === 'proposal_submitted' ||
      status === 'proposal_accepted' ||
      status === 'converted'
    );
  }

  private isReadOnly(status: Lead['status']): boolean {
    return status === 'proposal_submitted' || status === 'proposal_accepted' || status === 'converted';
  }

  private getInitialDefaultMarkupPercent(
    proposal: FloralProposal | null,
    pricingSettings: PricingSettings | null
  ): number {
    const snapshotValue = proposal?.snapshot?.['default_markup_percent'];
    if (typeof snapshotValue === 'number' && Number.isFinite(snapshotValue)) {
      return snapshotValue;
    }

    return pricingSettings?.default_markup_percent ?? 300;
  }

  private buildProposalPrintHtmlFromRenderPayload(renderPayload: FloralProposalRenderPayload): string {
    const contract = this.previewContract();
    if (contract) {
      return this.floralProposalRenderer.renderHtml(contract);
    }

    const lead = this.lead();
    if (!lead) {
      return '<html><body><p>Floral Proposal unavailable.</p></body></html>';
    }

    const fallbackContract: FloralProposalRenderContract = {
      proposal_id: this.activeProposal()?.floral_proposal_id ?? null,
      proposal_version: this.activeProposal()?.version ?? null,
      generated_at: new Date().toISOString(),
      lead: {
        lead_id: lead.lead_id,
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email,
        service_type: lead.service_type,
        event_type: lead.event_type ?? null,
        event_date: lead.event_date ?? null,
        status: lead.status,
      },
      template: {
        template_id: this.selectedTemplate()?.template_id ?? renderPayload.template_id ?? null,
        name: this.selectedTemplate()?.name ?? renderPayload.template_name ?? null,
      },
      tax_region: {
        tax_region_id: renderPayload.tax_region_id ?? null,
        name: renderPayload.tax_region_name ?? null,
        tax_rate: renderPayload.tax_rate,
      },
      pricing: {
        default_markup_percent: renderPayload.default_markup_percent,
      },
      line_items: renderPayload.line_items,
      shopping_list: renderPayload.shopping_list,
      totals: {
        products_total: renderPayload.breakdown.productsTotal,
        fees_total: renderPayload.breakdown.feesTotal,
        discounts_total: renderPayload.breakdown.discountsTotal,
        subtotal: renderPayload.breakdown.subtotal,
        tax_amount: renderPayload.totals.taxAmount,
        total_amount: renderPayload.totals.totalAmount,
      },
      renderer_assets: {
        line_item_images: renderPayload.line_items.map((line) => ({
          display_order: line.display_order,
          item_name: line.item_name,
          storage_path: line.image_storage_path ?? null,
          signed_url: line.image_signed_url ?? null,
          alt_text: line.image_alt_text ?? null,
          caption: line.image_caption ?? null,
        })),
      },
    };

    return this.floralProposalRenderer.renderHtml(fallbackContract);
  }
}


