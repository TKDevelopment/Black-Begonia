import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ActivatedRoute, Router } from '@angular/router';

import { CatalogItem } from '../../../core/models/catalog-item';
import {
  FloralProposal,
  FloralProposalRenderContract,
  FloralProposalLineItemType,
  FloralProposalShoppingListItem,
} from '../../../core/models/floral-proposal';
import { Lead } from '../../../core/models/lead';
import { TaxRegion } from '../../../core/models/tax-region';
import { ToastService } from '../../../core/services/toast.service';
import { CrmThemeService } from '../../../core/services/crm-theme.service';
import { ActivityRepositoryService } from '../../../core/supabase/repositories/activity-repository.service';
import { CatalogItemRepositoryService } from '../../../core/supabase/repositories/catalog-item-repository.service';
import { FloralProposalRepositoryService } from '../../../core/supabase/repositories/floral-proposal-repository.service';
import { LeadRepositoryService } from '../../../core/supabase/repositories/lead-repository.service';
import { TaxRegionRepositoryService } from '../../../core/supabase/repositories/tax-region-repository.service';
import {
  FloralProposalBuilderComponentRow,
  FloralProposalBuilderLine,
  FloralProposalRenderPayload,
  FloralProposalBuilderService,
} from '../../../core/supabase/services/floral-proposal-builder.service';
import { FloralProposalWorkflowService } from '../../../core/supabase/services/floral-proposal-workflow.service';
import { FloralProposalRendererService } from '../../../core/supabase/services/floral-proposal-renderer.service';
import { ProposalDocumentSubmissionModalComponent } from './components/proposal-document-submission-modal/proposal-document-submission-modal.component';
import { EntityDetailShellComponent } from '../../../shared/components/private/entity-detail-shell/entity-detail-shell.component';
import { ErrorStateBlockComponent } from '../../../shared/components/private/error-state-block/error-state-block.component';
import { LoadingStateBlockComponent } from '../../../shared/components/private/loading-state-block/loading-state-block.component';
import { StatusBadgeComponent } from '../../../shared/components/private/status-badge/status-badge.component';
import { formatDateOnlyForDisplay } from '../../../core/utils/date-only';

@Component({
  selector: 'app-floral-proposal-builder',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    ProposalDocumentSubmissionModalComponent,
    LoadingStateBlockComponent,
    ErrorStateBlockComponent,
    EntityDetailShellComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './floral-proposal-builder.component.html',
  styleUrl: './floral-proposal-builder.component.scss',
})
export class FloralProposalBuilderComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly leadRepository = inject(LeadRepositoryService);
  private readonly taxRegionRepository = inject(TaxRegionRepositoryService);
  private readonly floralProposalRepository = inject(FloralProposalRepositoryService);
  private readonly catalogItemRepository = inject(CatalogItemRepositoryService);
  private readonly activityRepository = inject(ActivityRepositoryService);
  private readonly proposalWorkflow = inject(FloralProposalWorkflowService);
  private readonly floralProposalRenderer = inject(FloralProposalRendererService);
  private readonly floralProposalBuilderService = inject(FloralProposalBuilderService);
  private readonly toast = inject(ToastService);
  readonly crmThemeService = inject(CrmThemeService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly submissionModalOpen = signal(false);
  readonly submissionError = signal<string | null>(null);
  readonly submissionFile = signal<File | null>(null);
  readonly submissionProgress = signal<string | null>(null);
  readonly editModeEnabled = signal(false);
  readonly activeProjectId = signal<string | null>(null);
  readonly lead = signal<Lead | null>(null);
  readonly proposals = signal<FloralProposal[]>([]);
  readonly activeProposal = signal<FloralProposal | null>(null);
  readonly taxRegions = signal<TaxRegion[]>([]);
  readonly catalogItems = signal<CatalogItem[]>([]);
  readonly lineItems = signal<FloralProposalBuilderLine[]>([]);
  readonly shoppingList = signal<FloralProposalShoppingListItem[]>([]);
  readonly selectedTaxRegionId = signal<string>('');
  readonly defaultMarkupPercent = signal(300);
  readonly laborPercent = signal(0);
  readonly draggingLineId = signal<string | null>(null);
  readonly dragOverImageLineId = signal<string | null>(null);
  readonly isDarkMode = computed(() => this.crmThemeService.mode() === 'dark');

  readonly selectedTaxRegion = computed(() => {
    const id = this.selectedTaxRegionId();
    return this.taxRegions().find((region) => region.tax_region_id === id) ?? null;
  });

  readonly activeCatalogItems = computed(() =>
    this.catalogItems().filter((item) => item.is_active)
  );

  readonly totals = computed(() =>
    this.floralProposalBuilderService.calculateTotals(
      this.lineItems(),
      this.selectedTaxRegion(),
      this.laborPercent()
    )
  );

  readonly renderPayload = computed(() => this.buildRenderPayload());
  readonly totalsBreakdown = computed(() => this.renderPayload().breakdown);

  readonly canEdit = computed(() => {
    const lead = this.lead();
    const proposal = this.activeProposal();

    if (!lead || this.saving() || this.isReadOnly(lead.status)) {
      return false;
    }

    if (!proposal) {
      return true;
    }

    return proposal.status === 'draft' || proposal.status === 'declined';
  });

  readonly canFinalize = computed(() => {
    return (
      this.canEdit() &&
      !!this.selectedTaxRegionId() &&
      this.lineItems().some((line) => line.item_name.trim().length > 0)
    );
  });

  readonly submissionFileName = computed(() => this.submissionFile()?.name ?? '');

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
  ngOnInit(): void {
    const leadId = this.route.snapshot.paramMap.get('leadId');
    this.activeProjectId.set(this.route.snapshot.queryParamMap.get('projectId'));
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
      const [lead, taxRegions, proposals, catalogItems] =
        await Promise.all([
          this.leadRepository.getLeadById(leadId),
          this.taxRegionRepository.getTaxRegions(),
          this.floralProposalRepository.getLeadFloralProposals(leadId),
          this.catalogItemRepository.getCatalogItems(),
        ]);

      if (!lead) {
        this.error.set('We could not find this lead.');
        return;
      }

      this.lead.set(lead);
      this.taxRegions.set(taxRegions.filter((region) => region.is_active));
      this.catalogItems.set(catalogItems);
      this.proposals.set(proposals);
      this.editModeEnabled.set(false);
      this.submissionModalOpen.set(false);
      this.submissionError.set(null);
      this.submissionFile.set(null);
      this.submissionProgress.set(null);

      const activeProposal = proposals.find((proposal) => proposal.is_active) ?? proposals[0] ?? null;
      this.activeProposal.set(activeProposal);
      this.selectedTaxRegionId.set(activeProposal?.tax_region_id ?? '');
      this.defaultMarkupPercent.set(this.getInitialDefaultMarkupPercent(activeProposal));
      this.laborPercent.set(this.getInitialLaborPercent(activeProposal));

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

  updateLineDescription(lineId: string, value: string): void {
    this.patchLine(lineId, { description: value });
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

  updateCatalogItemQuery(lineId: string, componentId: string, rawValue: string): void {
    if (!this.canEdit()) return;

    this.lineItems.update((lines) =>
      lines.map((line) => {
        if (line.local_id !== lineId) return line;

        const nextComponents = line.components.map((component) => {
          if (component.local_id !== componentId) return component;

          const matchedItem = this.findCatalogItemForQuery(rawValue);
          if (!matchedItem) {
            return {
              ...component,
              catalog_item_id: null,
              catalog_item_name: rawValue,
              base_unit_cost: 0,
              reserve_percent: component.reserve_percent ?? this.getDefaultReservePercent(),
              pack_quantity: null,
              purchase_unit_cost: 0,
              item_type: null,
              unit_type: null,
              color: null,
              variety: null,
            };
          }

          return {
            ...this.floralProposalBuilderService.applyCatalogItemToComponent(
              component,
              matchedItem,
              line.quantity,
              this.defaultMarkupPercent(),
              this.getDefaultReservePercent()
            ),
            catalog_item_name: this.formatCatalogItemOptionLabel(matchedItem),
          };
        });

        return this.floralProposalBuilderService.recalculateLine({
          ...line,
          components: nextComponents,
        });
      })
    );

    void this.refreshShoppingList();
  }

  commitCatalogItemSelection(lineId: string, componentId: string, rawValue: string): void {
    this.updateCatalogItemQuery(lineId, componentId, rawValue);
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

  onLaborPercentChange(value: string): void {
    this.laborPercent.set(Math.max(Number(value || 0), 0));
  }

  onTaxRegionChange(value: string): void {
    this.selectedTaxRegionId.set(value);
  }

  updateShoppingListReserve(item: FloralProposalShoppingListItem, rawValue: string): void {
    const reservePercent = Math.max(Number(rawValue || 0), 0);
    const itemKey = this.getShoppingListItemKey(item);

    this.lineItems.update((lines) =>
      lines.map((line) =>
        this.floralProposalBuilderService.recalculateLine({
          ...line,
          components: line.components.map((component) =>
            this.getComponentShoppingKey(component) === itemKey
              ? { ...component, reserve_percent: reservePercent }
              : component
          ),
        })
      )
    );

    void this.refreshShoppingList();
  }

  async saveDraft(): Promise<void> {
    const lead = this.lead();
    if (!lead || this.saving() || this.isReadOnly(lead.status)) return;

    try {
      this.saving.set(true);
      const proposal = await this.persistProposal('draft');
      this.activeProposal.set(proposal);
      this.editModeEnabled.set(false);
      this.toast.showToast('Floral Proposal draft saved.', 'success');
      await this.loadBuilder(lead.lead_id);
    } catch (error) {
      console.error('[FloralProposalBuilderComponent] saveDraft error:', error);
      this.toast.showToast('We were unable to save the Floral Proposal draft right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async finalizeProposal(): Promise<void> {
    const lead = this.lead();
    if (!lead || this.saving() || this.isReadOnly(lead.status)) return;

    if (!this.selectedTaxRegionId()) {
      this.toast.showToast('Choose a tax region before finalizing the Floral Proposal.', 'error');
      return;
    }

    if (!this.renderPayload().line_items.length) {
      this.toast.showToast('Add at least one line item before finalizing the Floral Proposal.', 'error');
      return;
    }

    if (!lead.event_date) {
      this.toast.showToast('Add an event date before finalizing the Floral Proposal.', 'error');
      return;
    }

    this.submissionModalOpen.set(true);
    this.submissionError.set(null);
    this.submissionFile.set(null);
    this.submissionProgress.set(null);
  }

  closeDocumentSubmission(): void {
    if (this.saving()) return;
    this.submissionModalOpen.set(false);
    this.submissionError.set(null);
    this.submissionFile.set(null);
    this.submissionProgress.set(null);
  }

  onSubmissionFileSelected(file: File | null): void {
    if (this.saving()) return;
    if (!file) {
      this.submissionFile.set(null);
      return;
    }

    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
      this.submissionError.set('Upload a valid PDF proposal document.');
      this.submissionFile.set(null);
      return;
    }

    if (file.size === 0) {
      this.submissionError.set('The proposal PDF cannot be empty.');
      this.submissionFile.set(null);
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      this.submissionError.set('The proposal PDF must be 50 MB or smaller.');
      this.submissionFile.set(null);
      return;
    }

    this.submissionError.set(null);
    this.submissionFile.set(file);
  }

  async submitProposalDocument(): Promise<void> {
    const lead = this.lead();
    const file = this.submissionFile();

    if (!lead || !this.canFinalize() || this.saving()) {
      return;
    }

    if (!file) {
      this.submissionError.set('Upload a valid PDF proposal document before submitting.');
      return;
    }

    const confirmed = window.confirm(
      'Submit this signed proposal and services agreement PDF? This will store the document and convert the lead into a booked project.'
    );

    if (!confirmed) {
      return;
    }

    try {
      this.saving.set(true);
      this.submissionError.set(null);
      this.submissionProgress.set('Saving proposal invoice details...');
      const proposal = await this.persistProposal('draft');
      this.activeProposal.set(proposal);
      const idempotencyKey = crypto.randomUUID();
      this.submissionProgress.set('Uploading the signed proposal PDF securely...');
      const upload = await this.proposalWorkflow.uploadProposalPdf({
        leadId: lead.lead_id,
        proposalId: proposal.floral_proposal_id,
        idempotencyKey,
        file,
        projectId: this.activeProjectId(),
      });
      this.submissionProgress.set('Storing the signed document and booking the project...');
      const activeProjectId = this.activeProjectId();
      const result = await this.proposalWorkflow.submitProposal({
        mode: activeProjectId ? 'project_revision' : 'initial_booking',
        leadId: lead.lead_id,
        projectId: activeProjectId,
        floralProposalId: proposal.floral_proposal_id,
        pdfStoragePath: upload.storagePath,
        pdfFileName: file.name,
        idempotencyKey,
      });

      this.submissionProgress.set('Booked project created. Opening project workspace...');
      this.toast.showToast('Signed proposal stored and lead converted to a booked project.', 'success');
      this.submissionModalOpen.set(false);
      await this.router.navigate(['/admin/projects'], {
        queryParams: { projectId: result.project_id },
      });
    } catch (error) {
      console.error('[FloralProposalBuilderComponent] submitProposalDocument error:', error);
      const message = error instanceof Error
        ? error.message
        : 'We were unable to submit the proposal document right now.';
      this.submissionError.set(message);
      this.submissionProgress.set(null);
      this.toast.showToast(message, 'error');
    } finally {
      this.saving.set(false);
      this.submissionProgress.set(null);
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

  formatDate(value: string | null | undefined): string {
    return formatDateOnlyForDisplay(value, 'Not set', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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
    const query = this.normalizeCatalogItemQuery(component.catalog_item_name);
    if (!query) {
      return this.activeCatalogItems().slice(0, 15);
    }

    return this.activeCatalogItems()
      .filter((item) => this.matchesCatalogItemQuery(item, query))
      .slice(0, 15);
  }

  getCatalogItemDatalistId(componentId: string): string {
    return `catalog-item-options-${componentId}`;
  }

  formatCatalogItemOptionLabel(item: CatalogItem): string {
    return [item.color?.trim(), item.variety?.trim(), item.name.trim()]
      .filter((part) => !!part)
      .join(' ');
  }

  trackByLine = (_: number, line: FloralProposalBuilderLine) => line.local_id;
  trackByComponent = (_: number, component: FloralProposalBuilderComponentRow) => component.local_id;
  trackByTaxRegion = (_: number, taxRegion: TaxRegion) => taxRegion.tax_region_id;
  trackByCatalogItem = (_: number, item: CatalogItem) => item.item_id;

  private async persistProposal(
    status: 'draft' | 'finalized'
  ): Promise<FloralProposal> {
    const lead = this.lead();
    if (!lead) {
      throw new Error('Lead is required to save a Floral Proposal.');
    }

    const renderPayload = this.buildRenderPayload();
    const finalBalanceAmount = Number(renderPayload.totals.totalAmount.toFixed(2));
    const retainerAmount = Number((finalBalanceAmount * 0.3).toFixed(2));
    const finalBalanceDueDate = lead.event_date
      ? this.subtractCalendarDays(lead.event_date, 30)
      : null;
    const normalizedLines = this.normalizeLinesForPersistence();
    const nextVersion = Math.max(0, ...this.proposals().map((proposal) => proposal.version)) + 1;
    const existingActiveProposal =
      this.activeProposal() ??
      (await this.floralProposalRepository.getActiveLeadFloralProposal(lead.lead_id));
    const existingSnapshot = (existingActiveProposal?.snapshot ?? {}) as Record<string, unknown>;
    const storedStatus = this.proposalWorkflow.resolveStoredProposalStatus(status);
    const shouldReuseProposal =
      existingActiveProposal?.is_active === true &&
      existingActiveProposal.status === 'draft';
    const lifecycleTimestamp = new Date().toISOString();
    const snapshot = this.proposalWorkflow.buildProposalSnapshot({
      renderPayload,
      proposalStatus: status,
      existingSnapshot,
      lifecycle: {
        finalizedAt: status === 'finalized' ? lifecycleTimestamp : null,
        editReopenedAt: this.editModeEnabled() ? lifecycleTimestamp : null,
      },
    });

    let proposal: FloralProposal;

    if (shouldReuseProposal && existingActiveProposal) {
      proposal = await this.floralProposalRepository.updateFloralProposal(
        existingActiveProposal.floral_proposal_id,
        {
          status: storedStatus,
          tax_region_id: renderPayload.tax_region_id ?? null,
          subtotal: renderPayload.totals.subtotal,
          tax_rate: renderPayload.tax_rate,
          tax_amount: renderPayload.totals.taxAmount,
          total_amount: renderPayload.totals.totalAmount,
          final_balance_amount: finalBalanceAmount,
          retainer_amount: retainerAmount,
          final_balance_due_date: finalBalanceDueDate,
          retainer_due_date: existingActiveProposal.retainer_due_date ?? null,
          finalized_at:
            (snapshot['finalized_at'] as string | null | undefined) ?? null,
          edit_reopened_at:
            (snapshot['edit_reopened_at'] as string | null | undefined) ?? null,
          snapshot,
          updated_at: lifecycleTimestamp,
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
        tax_region_id: renderPayload.tax_region_id ?? null,
        version: nextVersion,
        customer_email: lead.email,
        status: storedStatus,
        subtotal: renderPayload.totals.subtotal,
        tax_rate: renderPayload.tax_rate,
        tax_amount: renderPayload.totals.taxAmount,
        total_amount: renderPayload.totals.totalAmount,
        final_balance_amount: finalBalanceAmount,
        retainer_amount: retainerAmount,
        final_balance_due_date: finalBalanceDueDate,
        retainer_due_date: null,
        terms_version: 'v1',
        privacy_policy_version: 'v1',
        finalized_at:
          (snapshot['finalized_at'] as string | null | undefined) ?? null,
        edit_reopened_at:
          (snapshot['edit_reopened_at'] as string | null | undefined) ?? null,
        snapshot,
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
      activity_label: shouldReuseProposal
        ? `Floral Proposal v${proposal.version} ${status} updated`
        : `Floral Proposal v${proposal.version} ${status} saved`,
      activity_description: shouldReuseProposal
        ? `The active Floral Proposal was updated and marked ${status} from the CRM builder.`
        : `A Floral Proposal was saved as ${status} from the CRM builder.`,
      metadata: {
        floral_proposal_id: proposal.floral_proposal_id,
        proposal_version: proposal.version,
        proposal_status: status,
        draft_action: shouldReuseProposal ? 'updated' : 'created',
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
    try {
      const shoppingList = this.floralProposalBuilderService.buildShoppingList(
        this.lineItems()
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

            if (!signedUrl) {
              if (this.isPersistedLineItemId(line.local_id)) {
                await this.proposalWorkflow.clearMissingLineItemImage(line.local_id);
              }

              return {
                ...line,
                image_storage_path: null,
                image_alt_text: null,
                image_caption: null,
                image_signed_url: null,
              };
            }

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

  private isPersistedLineItemId(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    );
  }

  private findCatalogItemForQuery(value: string): CatalogItem | null {
    const normalized = this.normalizeCatalogItemQuery(value);
    if (!normalized) return null;

    const exactLabelMatch =
      this.activeCatalogItems().find(
        (item) => this.normalizeCatalogItemQuery(this.formatCatalogItemOptionLabel(item)) === normalized
      ) ?? null;

    if (exactLabelMatch) {
      return exactLabelMatch;
    }

    const exactNameMatches = this.activeCatalogItems().filter(
      (item) => this.normalizeCatalogItemQuery(item.name) === normalized
    );

    if (exactNameMatches.length === 1) {
      return exactNameMatches[0];
    }

    const filteredMatches = this.activeCatalogItems().filter((item) =>
      this.matchesCatalogItemQuery(item, normalized)
    );

    return filteredMatches.length === 1 ? filteredMatches[0] : null;
  }

  private matchesCatalogItemQuery(item: CatalogItem, normalizedQuery: string): boolean {
    const queryTokens = normalizedQuery.split(' ').filter((token) => token.length > 0);
    if (!queryTokens.length) {
      return true;
    }

    const haystack = this.normalizeCatalogItemQuery(
      [
        item.name,
        item.color ?? '',
        item.variety ?? '',
        item.sku ?? '',
        this.formatCatalogItemOptionLabel(item),
      ].join(' ')
    );

    return queryTokens.every((token) => haystack.includes(token));
  }

  private normalizeCatalogItemQuery(value: string | null | undefined): string {
    return (value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
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
      defaultMarkupPercent: this.defaultMarkupPercent(),
      laborPercent: this.laborPercent(),
      shoppingList: this.shoppingList(),
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
    if (this.activeProjectId()) {
      return false;
    }

    return status === 'proposal_submitted' || status === 'proposal_accepted' || status === 'converted';
  }

  private getInitialDefaultMarkupPercent(
    proposal: FloralProposal | null
  ): number {
    const snapshotValue = proposal?.snapshot?.['default_markup_percent'];
    if (typeof snapshotValue === 'number' && Number.isFinite(snapshotValue)) {
      return snapshotValue;
    }

    return 300;
  }

  private getInitialLaborPercent(proposal: FloralProposal | null): number {
    const snapshotValue = proposal?.snapshot?.['labor_percent'];
    if (typeof snapshotValue === 'number' && Number.isFinite(snapshotValue)) {
      return snapshotValue;
    }

    return 0;
  }

  private getDefaultReservePercent(): number {
    return 0;
  }

  private getComponentShoppingKey(component: FloralProposalBuilderComponentRow): string {
    return (
      component.catalog_item_id ??
      `${component.catalog_item_name}:${component.unit_type ?? 'other'}`
    );
  }

  private getShoppingListItemKey(item: FloralProposalShoppingListItem): string {
    return item.catalog_item_id ?? `${item.item_name}:${item.unit_type ?? 'other'}`;
  }

  private subtractCalendarDays(dateValue: string, days: number): string {
    const [year, month, day] = dateValue.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().slice(0, 10);
  }

  private buildProposalPrintHtmlFromRenderPayload(renderPayload: FloralProposalRenderPayload): string {
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
        partner_first_name: lead.partner_first_name ?? null,
        partner_last_name: lead.partner_last_name ?? null,
        email: lead.email,
        phone: lead.phone ?? null,
        service_type: lead.service_type,
        event_type: lead.event_type ?? null,
        event_date: lead.event_date ?? null,
        ceremony_venue_name: lead.ceremony_venue_name ?? null,
        ceremony_venue_city: lead.ceremony_venue_city ?? null,
        ceremony_venue_state: lead.ceremony_venue_state ?? null,
        ceremony_start_time: lead.ceremony_start_time ?? null,
        reception_venue_name: lead.reception_venue_name ?? null,
        reception_venue_city: lead.reception_venue_city ?? null,
        reception_venue_state: lead.reception_venue_state ?? null,
        reception_start_time: lead.reception_start_time ?? null,
        event_start_time: lead.event_start_time ?? null,
        status: lead.status,
      },
      template: {
        template_id: null,
        name: 'Floral Proposal',
      },
      tax_region: {
        tax_region_id: renderPayload.tax_region_id ?? null,
        name: renderPayload.tax_region_name ?? null,
        tax_rate: renderPayload.tax_rate,
      },
      pricing: {
        default_markup_percent: renderPayload.default_markup_percent,
        labor_percent: renderPayload.labor_percent,
      },
      line_items: renderPayload.line_items,
      shopping_list: renderPayload.shopping_list,
      totals: {
        products_total: renderPayload.breakdown.productsTotal,
        labor_total: renderPayload.breakdown.laborTotal,
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


