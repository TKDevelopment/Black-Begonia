import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ActivatedRoute, Router } from '@angular/router';

import { CatalogItem } from '../../../core/models/catalog-item';
import {
  FloralProposal,
  FloralProposalLineItemType,
  FloralProposalShoppingListItem,
} from '../../../core/models/floral-proposal';
import { Lead } from '../../../core/models/lead';
import { Project } from '../../../core/models/project';
import {
  EditableProposalSnapshotV2,
  ProjectProposalRevisionWorkspace,
} from '../../../core/models/project-proposal-revision-workspace';
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
import { ProjectProposalRevisionService } from '../../../core/supabase/services/project-proposal-revision.service';
import { LeadConversionService } from '../../../core/supabase/services/lead-conversion.service';
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
  private readonly leadConversionService = inject(LeadConversionService);
  private readonly floralProposalBuilderService = inject(FloralProposalBuilderService);
  readonly projectProposalRevision = inject(ProjectProposalRevisionService);
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
  readonly revisionProject = signal<Project | null>(null);
  readonly revisionWorkspace = signal<ProjectProposalRevisionWorkspace | null>(null);
  readonly revisionWarning = signal<string | null>(null);
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
    if (this.revisionWorkspace()) {
      return !this.saving();
    }
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
      !this.hasComponentPriceErrors() &&
      !!this.selectedTaxRegionId() &&
      this.lineItems().some((line) => line.item_name.trim().length > 0)
    );
  });

  readonly hasComponentPriceErrors = computed(() =>
    this.lineItems().some((line) =>
      line.components.some((component) => !!component.unit_price_error)
    )
  );

  readonly submissionFileName = computed(() => this.submissionFile()?.name ?? '');

  readonly shoppingListSubtotal = computed(() =>
    Number(
      this.shoppingList()
        .reduce((sum, item) => sum + (item.total_estimated_cost ?? 0), 0)
        .toFixed(2)
    )
  );

  readonly title = computed(() => {
    const project = this.revisionProject();
    if (project) return `Revise Proposal: ${project.project_name}`;
    const lead = this.lead();
    return lead
      ? `Floral Proposal Builder: ${lead.first_name} ${lead.last_name}`
      : 'Floral Proposal Builder';
  });

  readonly subtitle = computed(() => {
    const project = this.revisionProject();
    if (project) return `${this.formatStatusLabel(project.status)} project · changes autosave as a private draft`;
    const lead = this.lead();
    if (!lead) {
      return 'Build a client-facing Floral Proposal with internal catalog-item composition and live shopping-list rollups.';
    }

    return `${this.formatStatusLabel(lead.status)} lead - ${this.formatStatusLabel(
      lead.service_type
    )}`;
  });
  private readonly revisionAutosave = effect(() => {
    const workspace = untracked(this.revisionWorkspace);
    if (!workspace || this.loading() || this.hasComponentPriceErrors()) return;
    this.projectProposalRevision.queueAutosave(workspace, this.buildRevisionDraft(workspace));
  });

  ngOnInit(): void {
    const projectId = this.route.snapshot.paramMap.get('projectId');
    if (projectId) {
      this.activeProjectId.set(projectId);
      void this.loadProjectRevision(projectId);
      return;
    }
    const leadId = this.route.snapshot.paramMap.get('leadId');
    if (!leadId) {
      void this.router.navigate(['/admin/leads']);
      return;
    }

    void this.loadBuilder(leadId);
  }

  async loadProjectRevision(projectId: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const loaded = await this.projectProposalRevision.loadOrInitialize(projectId);
      const [sourceLead, taxRegions, catalogItems] = await Promise.all([
        loaded.workspace.source_lead_id
          ? this.leadRepository.getLeadById(loaded.workspace.source_lead_id)
          : Promise.resolve(null),
        this.taxRegionRepository.getTaxRegions(),
        this.catalogItemRepository.getCatalogItems(),
      ]);
      const draft = loaded.workspace.draft_snapshot;
      this.revisionProject.set(loaded.project);
      this.revisionWarning.set(loaded.compatibilityWarning);
      this.lead.set(sourceLead ?? this.projectLeadContext(loaded.project));
      this.catalogItems.set(catalogItems);
      this.taxRegions.set(this.withRecordedTaxRegion(taxRegions, draft));
      this.selectedTaxRegionId.set(draft.tax_region.tax_region_id ?? '');
      this.defaultMarkupPercent.set(draft.default_markup_percent);
      this.laborPercent.set(draft.labor_percent);
      this.lineItems.set(await this.populateLineItemSignedUrls(draft.line_items.map((line) => ({
        ...line,
        expanded: false,
        image_signed_url: null,
        components: line.components.map((component) => ({
          ...component,
          local_id: this.createLocalId('component'),
          item_type: component.item_type as CatalogItem['item_type'] | null | undefined,
          unit_type: component.unit_type as CatalogItem['unit_type'] | null | undefined,
        })),
      }))));
      await this.refreshShoppingList();
      this.revisionWorkspace.set(loaded.workspace);
    } catch (error) {
      console.error('[FloralProposalBuilderComponent] loadProjectRevision error:', error);
      this.error.set(error instanceof Error ? error.message : 'We could not load this proposal revision.');
    } finally {
      this.loading.set(false);
    }
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
    const projectId = this.activeProjectId();
    if (projectId) {
      await this.loadProjectRevision(projectId);
      return;
    }
    const leadId = this.lead()?.lead_id ?? this.route.snapshot.paramMap.get('leadId');
    if (!leadId) return;
    await this.loadBuilder(leadId);
  }

  async goBack(): Promise<void> {
    const projectId = this.activeProjectId();
    if (projectId) {
      try {
        await this.projectProposalRevision.flushAutosave();
        await this.router.navigate(['/admin/projects', projectId]);
      } catch (error) {
        this.toast.showToast(error instanceof Error ? error.message : 'Save the revision before leaving.', 'error');
      }
      return;
    }
    const leadId = this.lead()?.lead_id;
    if (!leadId) {
      void this.router.navigate(['/admin/leads']);
      return;
    }

    void this.router.navigate(['/admin/leads', leadId]);
  }

  async discardRevision(): Promise<void> {
    const workspace = this.revisionWorkspace();
    if (!workspace || this.saving()) return;
    if (!window.confirm('Discard this entire proposal revision draft? The active submitted proposal will remain unchanged.')) return;
    try {
      this.saving.set(true);
      await this.projectProposalRevision.discard(workspace);
      this.revisionWorkspace.set(null);
      await this.router.navigate(['/admin/projects', workspace.project_id]);
    } catch (error) {
      this.toast.showToast(error instanceof Error ? error.message : 'The revision could not be discarded.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async retryRevisionSave(): Promise<void> {
    const workspace = this.revisionWorkspace();
    if (!workspace || this.saving() || this.hasComponentPriceErrors()) return;
    try {
      const saved = await this.projectProposalRevision.retryAutosave(workspace, this.buildRevisionDraft(workspace));
      if (saved) this.revisionWorkspace.set(saved);
    } catch (error) {
      this.toast.showToast(error instanceof Error ? error.message : 'The revision still could not be saved.', 'error');
    }
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

          return {
            ...component,
            last_catalog_item_id:
              component.catalog_item_id ?? component.last_catalog_item_id ?? null,
            catalog_item_id: null,
            catalog_item_name: rawValue,
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
    const normalizedValue = this.normalizeCatalogItemQuery(rawValue);
    const selectedItem = this.activeCatalogItems().find(
      (item) =>
        this.normalizeCatalogItemQuery(this.formatCatalogItemOptionLabel(item)) === normalizedValue
    );

    if (selectedItem) {
      this.replaceCatalogItem(lineId, componentId, selectedItem.item_id);
      return;
    }

    this.updateCatalogItemQuery(lineId, componentId, rawValue.trim());
  }

  replaceCatalogItem(lineId: string, componentId: string, catalogItemId: string): void {
    if (!this.canEdit() || !catalogItemId) return;
    const item = this.activeCatalogItems().find((candidate) => candidate.item_id === catalogItemId);
    if (!item) return;
    this.lineItems.update((lines) => lines.map((line) => {
      if (line.local_id !== lineId) return line;
      return this.floralProposalBuilderService.recalculateLine({
        ...line,
        components: line.components.map((component) => {
          if (component.local_id !== componentId) return component;
          const isSameItem =
            component.catalog_item_id === item.item_id ||
            component.last_catalog_item_id === item.item_id;
          if (isSameItem) {
            return {
              ...component,
              catalog_item_id: item.item_id,
              last_catalog_item_id: item.item_id,
              catalog_item_name: this.formatCatalogItemOptionLabel(item),
            };
          }
          return {
            ...this.floralProposalBuilderService.applyCatalogItemToComponent(
              component, item, line.quantity, this.defaultMarkupPercent(), this.getDefaultReservePercent()
            ),
            catalog_item_name: this.formatCatalogItemOptionLabel(item),
          };
        }),
      });
    }));
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

  updateComponentUnitPrice(
    lineId: string,
    componentId: string,
    rawValue: string | number | null | undefined
  ): void {
    const inputValue = rawValue === null || rawValue === undefined ? '' : String(rawValue);
    const validation = this.floralProposalBuilderService.validateRowUnitCost(inputValue);
    this.patchComponent(lineId, componentId, {
      ...(validation.valid && validation.value !== null
        ? { base_unit_cost: validation.value }
        : {}),
      unit_price_input: inputValue,
      unit_price_error: validation.error,
    });
  }

  resetComponentToCatalogPrice(lineId: string, componentId: string): void {
    if (!this.canEdit()) return;
    const line = this.lineItems().find((candidate) => candidate.local_id === lineId);
    const component = line?.components.find((candidate) => candidate.local_id === componentId);
    const catalogItemId = component?.catalog_item_id ?? component?.last_catalog_item_id;
    const item = this.activeCatalogItems().find((candidate) => candidate.item_id === catalogItemId);
    if (!line || !component || !item) return;

    this.lineItems.update((lines) => lines.map((candidateLine) => {
      if (candidateLine.local_id !== lineId) return candidateLine;
      return this.floralProposalBuilderService.recalculateLine({
        ...candidateLine,
        components: candidateLine.components.map((candidateComponent) =>
          candidateComponent.local_id === componentId
            ? {
                ...this.floralProposalBuilderService.applyCatalogItemToComponent(
                  candidateComponent,
                  item,
                  candidateLine.quantity,
                  this.defaultMarkupPercent(),
                  this.getDefaultReservePercent()
                ),
                catalog_item_name: this.formatCatalogItemOptionLabel(item),
              }
            : candidateComponent
        ),
      });
    }));
    void this.refreshShoppingList();
  }

  canResetCatalogPrice(component: FloralProposalBuilderComponentRow): boolean {
    const catalogItemId = component.catalog_item_id ?? component.last_catalog_item_id;
    return !!catalogItemId && this.activeCatalogItems().some((item) => item.item_id === catalogItemId);
  }

  needsCatalogPriceReset(component: FloralProposalBuilderComponentRow): boolean {
    const catalogItemId = component.catalog_item_id ?? component.last_catalog_item_id;
    const item = this.activeCatalogItems().find((candidate) => candidate.item_id === catalogItemId);
    if (!item) return false;
    if (component.unit_price_error) return true;

    const catalogDefaults = this.floralProposalBuilderService.applyCatalogItemToComponent(
      component,
      item,
      1,
      this.defaultMarkupPercent(),
      this.getDefaultReservePercent()
    );

    return component.base_unit_cost !== catalogDefaults.base_unit_cost ||
      component.pack_quantity !== catalogDefaults.pack_quantity ||
      component.purchase_unit_cost !== catalogDefaults.purchase_unit_cost;
  }

  getCatalogPriceResetTooltip(component: FloralProposalBuilderComponentRow): string {
    if (!this.canResetCatalogPrice(component)) {
      return this.getResetUnavailableReason(component);
    }
    return this.needsCatalogPriceReset(component)
      ? 'Reset to Catalog Price'
      : 'Catalog price is already applied.';
  }

  getResetUnavailableReason(component: FloralProposalBuilderComponentRow): string {
    if (!component.catalog_item_id && !component.last_catalog_item_id) {
      return 'Select a current catalog item before resetting its price.';
    }
    return 'Current catalog pricing is unavailable for this retired or inactive item.';
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
    if (this.hasComponentPriceErrors()) {
      this.toast.showToast('Correct the highlighted row unit prices before saving.', 'error');
      return;
    }
    const workspace = this.revisionWorkspace();
    if (workspace) {
      try {
        this.saving.set(true);
        const saved = await this.projectProposalRevision.flushAutosave();
        if (saved) this.revisionWorkspace.set(saved);
        this.toast.showToast('Proposal revision draft saved.', 'success');
      } catch (error) {
        this.toast.showToast(error instanceof Error ? error.message : 'The revision draft could not be saved.', 'error');
      } finally {
        this.saving.set(false);
      }
      return;
    }
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
    if (!lead || this.saving() || (!this.revisionWorkspace() && this.isReadOnly(lead.status))) return;

    if (!this.selectedTaxRegionId()) {
      this.toast.showToast('Choose a tax region before finalizing the Floral Proposal.', 'error');
      return;
    }

    if (!this.renderPayload().line_items.length) {
      this.toast.showToast('Add at least one line item before finalizing the Floral Proposal.', 'error');
      return;
    }

    if (!(this.revisionProject()?.event_date ?? lead.event_date)) {
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

  async submitProposalDocument(sendDepositRequest = false): Promise<void> {
    const lead = this.lead();
    const file = this.submissionFile();

    if (!lead || !this.canFinalize() || this.saving()) {
      return;
    }

    if (!file) {
      this.submissionError.set('Upload a valid PDF proposal document before submitting.');
      return;
    }

    try {
      this.saving.set(true);
      this.submissionError.set(null);
      const revisionWorkspace = this.revisionWorkspace();
      if (revisionWorkspace) {
        this.submissionProgress.set('Saving the latest revision draft...');
        const saved = await this.projectProposalRevision.flushAutosave();
        const prepared = await this.projectProposalRevision.prepareSubmission(
          saved ?? revisionWorkspace,
          file.name
        );
        this.revisionWorkspace.set(prepared);
        this.submissionProgress.set('Uploading the revised proposal PDF securely...');
        await this.proposalWorkflow.uploadProposalPdf({
          leadId: lead.lead_id,
          proposalId: prepared.project_proposal_revision_workspace_id,
          idempotencyKey: prepared.pending_submission_key!,
          file,
          projectId: prepared.project_id,
          storagePath: prepared.pending_pdf_storage_path!,
        });
        this.submissionProgress.set('Activating the new proposal snapshot and document...');
        const result = await this.proposalWorkflow.submitProposal({
          mode: 'project_revision',
          leadId: prepared.source_lead_id ?? null,
          projectId: prepared.project_id,
          floralProposalId: null,
          revisionWorkspaceId: prepared.project_proposal_revision_workspace_id,
          baselineSnapshotId: prepared.baseline_invoice_snapshot_id,
          pdfStoragePath: prepared.pending_pdf_storage_path!,
          pdfFileName: file.name,
          idempotencyKey: prepared.pending_submission_key!,
        });
        this.toast.showToast('Revised proposal activated.', 'success');
        this.submissionModalOpen.set(false);
        await this.router.navigate(['/admin/projects', result.project_id]);
        return;
      }
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
        sendDepositRequest,
      });

      let depositDelivery: 'not_requested' | 'queued' | 'failed' = 'not_requested';
      let depositDeliveryError: string | null = null;
      if (
        sendDepositRequest &&
        result.deposit_obligation_id &&
        result.deposit_principal_cents
      ) {
        this.submissionProgress.set('Queueing the secure deposit payment email...');
        try {
          depositDelivery = await this.leadConversionService.issueDepositRequest(
            result.deposit_obligation_id,
            result.deposit_principal_cents
          );
        } catch (error) {
          depositDelivery = 'failed';
          depositDeliveryError = error instanceof Error
            ? error.message
            : 'The deposit email needs a manual retry.';
        }
      }

      this.submissionProgress.set('Awaiting Deposit project created. Opening project workspace...');
      this.toast.showToast(
        depositDelivery === 'queued'
          ? 'Project created as Awaiting Deposit and the deposit email was queued.'
          : depositDelivery === 'failed'
            ? `Project created as Awaiting Deposit, but the deposit email failed: ${depositDeliveryError}`
            : 'Project created as Awaiting Deposit. The deposit email was deferred.',
        depositDelivery === 'failed' ? 'error' : 'success'
      );
      this.submissionModalOpen.set(false);
      await this.router.navigate(['/admin/projects', result.project_id]);
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

  private buildRevisionDraft(workspace: ProjectProposalRevisionWorkspace): EditableProposalSnapshotV2 {
    const renderPayload = this.buildRenderPayload();
    const total = Number(renderPayload.totals.totalAmount.toFixed(2));
    return this.floralProposalBuilderService.buildEditableProjectSnapshot({
      renderPayload,
      lines: this.lineItems(),
      retainerAmount: Number((total * 0.3).toFixed(2)),
      finalBalanceAmount: total,
      retainerDueDate: workspace.retainer_due_date ?? null,
      finalBalanceDueDate: workspace.final_balance_due_date ?? null,
      existing: workspace.draft_snapshot,
    });
  }

  private withRecordedTaxRegion(
    regions: TaxRegion[],
    draft: EditableProposalSnapshotV2
  ): TaxRegion[] {
    const recordedId = draft.tax_region.tax_region_id;
    if (!recordedId || regions.some((region) => region.tax_region_id === recordedId)) {
      return regions;
    }
    const timestamp = new Date(0).toISOString();
    return [{
      tax_region_id: recordedId,
      name: `${draft.tax_region.name ?? 'Recorded tax region'} (inactive)`,
      tax_rate: draft.tax_region.tax_rate,
      applies_to_products: true,
      applies_to_services: true,
      applies_to_delivery: true,
      is_active: false,
      created_at: timestamp,
      updated_at: timestamp,
    }, ...regions];
  }

  private projectLeadContext(project: Project): Lead {
    const now = new Date().toISOString();
    return {
      lead_id: project.source_lead_id ?? `project-${project.project_id}`,
      service_type: project.service_type,
      event_type: project.event_type ?? null,
      first_name: project.project_name,
      last_name: '',
      email: '',
      event_date: project.event_date ?? null,
      ceremony_venue_name: project.ceremony_venue_name ?? null,
      ceremony_venue_city: project.ceremony_venue_city ?? null,
      ceremony_venue_state: project.ceremony_venue_state ?? null,
      reception_venue_name: project.reception_venue_name ?? null,
      reception_venue_city: project.reception_venue_city ?? null,
      reception_venue_state: project.reception_venue_state ?? null,
      budget_range: project.budget_range ?? null,
      guest_count: project.guest_count ?? null,
      source: 'project_revision',
      status: 'converted',
      created_at: project.created_at ?? now,
      updated_at: project.updated_at ?? now,
      consultation_scheduled_at: null,
      consultation_completed_at: null,
      planner_name: null,
      planner_phone: null,
      planner_email: null,
    };
  }

  private createLocalId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`;
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
    const identity = component.catalog_item_id ??
      `${component.catalog_item_name.trim().toLowerCase()}:${component.item_type ?? 'other'}`;
    return `${identity}|${component.unit_type ?? 'other'}|${component.pack_quantity ?? 'individual'}`;
  }

  private getShoppingListItemKey(item: FloralProposalShoppingListItem): string {
    const identity = item.catalog_item_id ??
      `${item.item_name.trim().toLowerCase()}:${item.item_type ?? 'other'}`;
    return `${identity}|${item.unit_type ?? 'other'}|${item.units_per_pack ?? 'individual'}`;
  }

  private subtractCalendarDays(dateValue: string, days: number): string {
    const [year, month, day] = dateValue.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().slice(0, 10);
  }

}


