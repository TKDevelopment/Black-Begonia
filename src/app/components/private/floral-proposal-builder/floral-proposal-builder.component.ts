import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';

import { Lead } from '../../../core/models/lead';
import { CatalogItem } from '../../../core/models/catalog-item';
import {
  DocumentTemplate,
  FloralProposal,
  FloralProposalLineItemType,
  FloralProposalShoppingListItem,
  PricingSettings,
} from '../../../core/models/floral-proposal';
import { TaxRegion } from '../../../core/models/tax-region';
import { LeadRepositoryService } from '../../../core/supabase/repositories/lead-repository.service';
import { TaxRegionRepositoryService } from '../../../core/supabase/repositories/tax-region-repository.service';
import { VendorItemPackRepositoryService } from '../../../core/supabase/repositories/vendor-item-pack-repository.service';
import { ActivityRepositoryService } from '../../../core/supabase/repositories/activity-repository.service';
import { CatalogItemRepositoryService } from '../../../core/supabase/repositories/catalog-item-repository.service';
import { FloralProposalRepositoryService } from '../../../core/supabase/repositories/floral-proposal-repository.service';
import { DocumentTemplateRepositoryService } from '../../../core/supabase/repositories/document-template-repository.service';
import { PricingSettingsRepositoryService } from '../../../core/supabase/repositories/pricing-settings-repository.service';
import {
  FloralProposalBuilderService,
  FloralProposalBuilderComponentRow,
  FloralProposalBuilderLine,
} from '../../../core/supabase/services/floral-proposal-builder.service';
import { FloralProposalWorkflowService } from '../../../core/supabase/services/floral-proposal-workflow.service';
import { LoadingStateBlockComponent } from '../../../shared/components/private/loading-state-block/loading-state-block.component';
import { ErrorStateBlockComponent } from '../../../shared/components/private/error-state-block/error-state-block.component';
import { EntityDetailShellComponent } from '../../../shared/components/private/entity-detail-shell/entity-detail-shell.component';
import { StatusBadgeComponent } from '../../../shared/components/private/status-badge/status-badge.component';
import { ToastService } from '../../../core/services/toast.service';

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
  private readonly leadRepository = inject(LeadRepositoryService);
  private readonly taxRegionRepository = inject(TaxRegionRepositoryService);
  private readonly floralProposalRepository = inject(FloralProposalRepositoryService);
  private readonly catalogItemRepository = inject(CatalogItemRepositoryService);
  private readonly vendorItemPackRepository = inject(VendorItemPackRepositoryService);
  private readonly activityRepository = inject(ActivityRepositoryService);
  private readonly documentTemplateRepository = inject(DocumentTemplateRepositoryService);
  private readonly pricingSettingsRepository = inject(PricingSettingsRepositoryService);
  private readonly proposalWorkflow = inject(FloralProposalWorkflowService);
  private readonly floralProposalBuilderService = inject(FloralProposalBuilderService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
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
  readonly draggingLineId = signal<string | null>(null);

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
    this.floralProposalBuilderService.calculateTotals(
      this.lineItems(),
      this.selectedTaxRegion()
    )
  );

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

    return `${this.formatStatusLabel(lead.status)} lead · ${lead.service_type}`;
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

      if (activeProposal) {
        const [lineItems, components] = await Promise.all([
          this.floralProposalRepository.getFloralProposalLineItems(activeProposal.floral_proposal_id),
          this.floralProposalRepository.getFloralProposalComponents(activeProposal.floral_proposal_id),
        ]);

        this.lineItems.set(
          this.floralProposalBuilderService.hydrateBuilderLines(lineItems, components)
        );
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

  updateLineNotes(lineId: string, value: string): void {
    this.patchLine(lineId, { notes: value || null });
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
          this.pricingSettings()
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

        const nextLine = this.floralProposalBuilderService.recalculateLine({
          ...line,
          components: line.components
            .filter((component) => component.local_id !== componentId)
            .map((component, index) => ({ ...component, display_order: index })),
        });

        return nextLine;
      })
    );

    void this.refreshShoppingList();
  }

  commitCatalogItemSelection(
    lineId: string,
    componentId: string,
    rawValue: string
  ): void {
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
            this.pricingSettings()
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

  updateComponentQuantity(
    lineId: string,
    componentId: string,
    rawValue: string
  ): void {
    const quantityPerUnit = Math.max(Number(rawValue || 0), 0);
    this.patchComponent(lineId, componentId, { quantity_per_unit: quantityPerUnit });
  }

  updateComponentMarkup(
    lineId: string,
    componentId: string,
    rawValue: string
  ): void {
    const appliedMarkupPercent = Math.max(Number(rawValue || 0), 0);
    this.patchComponent(lineId, componentId, { applied_markup_percent: appliedMarkupPercent });
  }

  updateComponentReserve(
    lineId: string,
    componentId: string,
    rawValue: string
  ): void {
    const reservePercent = Math.max(Number(rawValue || 0), 0);
    this.patchComponent(lineId, componentId, { reserve_percent: reservePercent });
  }

  handleComponentQuantityAdvance(
    event: Event,
    lineId: string,
    componentId: string
  ): void {
    const keyboardEvent = event as KeyboardEvent;
    const line = this.lineItems().find((item) => item.local_id === lineId);
    const isLast =
      !!line && line.components[line.components.length - 1]?.local_id === componentId;

    if (keyboardEvent.key === 'Enter' && isLast) {
      keyboardEvent.preventDefault();
      this.addComponentRow(lineId);
    }
  }

  onTemplateChange(value: string): void {
    this.selectedTemplateId.set(value);
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

    const normalizedLines = this.getNormalizedLines();
    if (!normalizedLines.length) {
      this.toast.showToast('Add at least one line item before submitting the Floral Proposal.', 'error');
      return;
    }

    try {
      this.saving.set(true);
      const totals = this.totals();
      const result = await this.proposalWorkflow.submitProposal({
        lead_id: lead.lead_id,
        template_id: this.selectedTemplateId(),
        tax_region_id: this.selectedTaxRegionId(),
        line_items: normalizedLines.map((line, index) => ({
          display_order: index,
          line_item_type: line.line_item_type,
          item_name: line.item_name.trim(),
          quantity: line.quantity,
          unit_price: line.unit_price,
          subtotal: line.subtotal,
          notes: line.notes ?? null,
          snapshot: {
            line_type_label: this.floralProposalBuilderService.formatLineTypeLabel(line.line_item_type),
          },
          components: line.line_item_type === 'product'
            ? line.components
                .filter((component) => component.catalog_item_name.trim().length > 0)
                .map((component, componentIndex) => ({
                  display_order: componentIndex,
                  catalog_item_id: component.catalog_item_id ?? null,
                  catalog_item_name: component.catalog_item_name.trim(),
                  quantity_per_unit: component.quantity_per_unit,
                  extended_quantity: component.extended_quantity,
                  base_unit_cost: component.base_unit_cost,
                  applied_markup_percent: component.applied_markup_percent,
                  sell_unit_price: component.sell_unit_price,
                  subtotal: component.subtotal,
                  reserve_percent: component.reserve_percent,
                  snapshot: {
                    item_type: component.item_type ?? null,
                    unit_type: component.unit_type ?? null,
                    color: component.color ?? null,
                    variety: component.variety ?? null,
                  },
                }))
            : [],
        })),
        shopping_list_items: this.shoppingList(),
        subtotal: totals.subtotal,
        tax_rate: this.selectedTaxRegion()?.tax_rate ?? 0,
        tax_amount: totals.taxAmount,
        total_amount: totals.totalAmount,
        terms_version: 'v1',
        privacy_policy_version: 'v1',
        snapshot: this.buildProposalSnapshot(),
      });

      this.toast.showToast(
        `Floral Proposal v${result.version} submitted successfully.`,
        'success'
      );
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

  exportFloralProposalPdf(): void {
    const lead = this.lead();
    const totals = this.totals();
    const lines = this.getNormalizedLines();

    if (!lead || !lines.length) {
      this.toast.showToast('Add line items before exporting the Floral Proposal.', 'error');
      return;
    }

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=900');
    if (!printWindow) {
      this.toast.showToast('We were unable to open the Floral Proposal export window.', 'error');
      return;
    }

    const html = this.buildProposalPrintHtml();
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
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

    const totals = this.totals();
    const snapshot = this.buildProposalSnapshot();
    const normalizedLines = this.getNormalizedLines();
    const nextVersion = Math.max(0, ...this.proposals().map((proposal) => proposal.version)) + 1;

    const proposal = await this.floralProposalRepository.createFloralProposal({
      lead_id: lead.lead_id,
      template_id: this.selectedTemplateId() || null,
      tax_region_id: this.selectedTaxRegionId() || null,
      version: nextVersion,
      customer_email: lead.email,
      passcode_hash: 'draft',
      status: 'draft',
      subtotal: totals.subtotal,
      tax_rate: this.selectedTaxRegion()?.tax_rate ?? 0,
      tax_amount: totals.taxAmount,
      total_amount: totals.totalAmount,
      terms_version: 'v1',
      privacy_policy_version: 'v1',
      snapshot,
      created_by: lead.assigned_user_id ?? null,
    });

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
      this.shoppingList()
    );

    await this.activityRepository.createLeadActivity({
      lead_id: lead.lead_id,
      activity_type: 'updated',
      activity_label: `Floral Proposal v${proposal.version} draft saved`,
      activity_description: 'A draft Floral Proposal was saved from the CRM builder.',
      metadata: {
        floral_proposal_id: proposal.floral_proposal_id,
        proposal_version: proposal.version,
        proposal_status: 'draft',
      },
    });

    return proposal;
  }

  private patchLine(
    lineId: string,
    updates: Partial<FloralProposalBuilderLine>
  ): void {
    if (!this.canEdit()) return;

    this.lineItems.update((lines) =>
      lines.map((line) =>
        line.local_id === lineId ? { ...line, ...updates } : line
      )
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

        const nextLine = this.floralProposalBuilderService.recalculateLine({
          ...line,
          components: line.components.map((component) =>
            component.local_id === componentId
              ? { ...component, ...updates }
              : component
          ),
        });

        return nextLine;
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

  private findCatalogItemByName(value: string): CatalogItem | null {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;

    return (
      this.activeCatalogItems().find(
        (item) => item.name.trim().toLowerCase() === normalized
      ) ?? null
    );
  }

  private getNormalizedLines(): FloralProposalBuilderLine[] {
    return this.lineItems()
      .map((line, index) =>
        this.floralProposalBuilderService.recalculateLine({
          ...line,
          display_order: index,
        })
      )
      .filter((line) => line.item_name.trim().length > 0);
  }

  private buildProposalSnapshot(): Record<string, unknown> {
    return {
      template_id: this.selectedTemplateId() || null,
      template_name: this.selectedTemplate()?.name ?? null,
      tax_region_id: this.selectedTaxRegionId() || null,
      tax_region_name: this.selectedTaxRegion()?.name ?? null,
      tax_rate: this.selectedTaxRegion()?.tax_rate ?? 0,
      line_items: this.getNormalizedLines().map((line) => ({
        display_order: line.display_order,
        line_item_type: line.line_item_type,
        item_name: line.item_name,
        quantity: line.quantity,
        unit_price: line.unit_price,
        subtotal: line.subtotal,
        notes: line.notes ?? null,
        components: line.components
          .filter((component) => component.catalog_item_name.trim().length > 0)
          .map((component) => ({
            catalog_item_id: component.catalog_item_id ?? null,
            catalog_item_name: component.catalog_item_name,
            quantity_per_unit: component.quantity_per_unit,
            extended_quantity: component.extended_quantity,
            base_unit_cost: component.base_unit_cost,
            applied_markup_percent: component.applied_markup_percent,
            sell_unit_price: component.sell_unit_price,
            subtotal: component.subtotal,
            reserve_percent: component.reserve_percent,
          })),
      })),
      shopping_list: this.shoppingList(),
      totals: this.totals(),
    };
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

  private buildProposalPrintHtml(): string {
    const lead = this.lead();
    const proposal = this.activeProposal();
    const template = this.selectedTemplate();
    const taxRegion = this.selectedTaxRegion();
    const totals = this.totals();
    const lines = this.getNormalizedLines();

    if (!lead) {
      return '<html><body><p>Floral Proposal unavailable.</p></body></html>';
    }

    const lineRows = lines
      .map(
        (line) => `
          <tr>
            <td>${line.item_name}</td>
            <td>${line.quantity}</td>
            <td>${this.formatCurrency(line.unit_price)}</td>
            <td>${this.formatCurrency(line.subtotal)}</td>
          </tr>
        `
      )
      .join('');

    return `
      <html>
        <head>
          <title>Floral Proposal ${proposal ? `v${proposal.version}` : ''}</title>
          <style>
            body { font-family: Georgia, serif; margin: 40px; color: #1f1f1f; }
            h1, h2, h3 { margin: 0; }
            .eyebrow { letter-spacing: 0.28em; text-transform: uppercase; font-size: 11px; color: #c46f67; margin-bottom: 10px; }
            .header { display: flex; justify-content: space-between; align-items: start; gap: 24px; margin-bottom: 28px; }
            .meta { font-size: 13px; color: #57534e; line-height: 1.7; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; }
            th, td { border-bottom: 1px solid #e7e5e4; padding: 12px 8px; text-align: left; font-size: 13px; }
            th { text-transform: uppercase; letter-spacing: 0.12em; font-size: 11px; color: #78716c; }
            .totals { width: 320px; margin-left: auto; margin-top: 28px; }
            .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
            .totals-row.total { border-top: 1px solid #d6d3d1; margin-top: 8px; padding-top: 12px; font-weight: 700; font-size: 16px; }
            .note { margin-top: 36px; font-size: 12px; color: #57534e; line-height: 1.8; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <p class="eyebrow">Black Begonia Florals</p>
              <h1>Floral Proposal</h1>
              <p class="meta">${template?.name ?? 'Structured Template'}<br />Prepared for ${lead.first_name} ${lead.last_name}<br />${lead.email}</p>
            </div>
            <div class="meta">
              <strong>Lead Status:</strong> ${this.formatStatusLabel(lead.status)}<br />
              <strong>Event Date:</strong> ${lead.event_date ?? 'Not set'}<br />
              <strong>Tax Region:</strong> ${taxRegion?.name ?? 'Not selected'}<br />
              <strong>Generated:</strong> ${this.formatDateTime(new Date().toISOString())}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${lineRows}
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-row"><span>Subtotal</span><span>${this.formatCurrency(totals.subtotal)}</span></div>
            <div class="totals-row"><span>Tax</span><span>${this.formatCurrency(totals.taxAmount)}</span></div>
            <div class="totals-row total"><span>Total</span><span>${this.formatCurrency(totals.totalAmount)}</span></div>
          </div>

          <div class="note">
            This Floral Proposal is generated from the saved CRM proposal data for client review. Internal catalog-item composition and shopping-list details are intentionally omitted from the customer-facing document.
          </div>
        </body>
      </html>
    `;
  }
}










