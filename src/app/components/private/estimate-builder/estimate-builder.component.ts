import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { Lead } from '../../../core/models/lead';
import { Arrangement } from '../../../core/models/arrangement';
import { ArrangementComponent } from '../../../core/models/arrangement-component';
import {
  Estimate,
  EstimateLineItem,
  EstimateLineItemType,
  ShoppingListItem,
} from '../../../core/models/estimate';
import { TaxRegion } from '../../../core/models/tax-region';
import { LeadRepositoryService } from '../../../core/supabase/repositories/lead-repository.service';
import { TaxRegionRepositoryService } from '../../../core/supabase/repositories/tax-region-repository.service';
import { EstimateRepositoryService } from '../../../core/supabase/repositories/estimate-repository.service';
import { ArrangementRepositoryService } from '../../../core/supabase/repositories/arrangement-repository.service';
import { ArrangementComponentRepositoryService } from '../../../core/supabase/repositories/arrangement-component-repository.service';
import { VendorItemPackRepositoryService } from '../../../core/supabase/repositories/vendor-item-pack-repository.service';
import { ActivityRepositoryService } from '../../../core/supabase/repositories/activity-repository.service';
import { EstimateBuilderLine, EstimateBuilderService } from '../../../core/supabase/services/estimate-builder.service';
import { LoadingStateBlockComponent } from '../../../shared/components/private/loading-state-block/loading-state-block.component';
import { ErrorStateBlockComponent } from '../../../shared/components/private/error-state-block/error-state-block.component';
import { EntityDetailShellComponent } from '../../../shared/components/private/entity-detail-shell/entity-detail-shell.component';
import { StatusBadgeComponent } from '../../../shared/components/private/status-badge/status-badge.component';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-estimate-builder',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LoadingStateBlockComponent,
    ErrorStateBlockComponent,
    EntityDetailShellComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './estimate-builder.component.html',
})
export class EstimateBuilderComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly leadRepository = inject(LeadRepositoryService);
  private readonly taxRegionRepository = inject(TaxRegionRepositoryService);
  private readonly estimateRepository = inject(EstimateRepositoryService);
  private readonly arrangementRepository = inject(ArrangementRepositoryService);
  private readonly arrangementComponentRepository = inject(ArrangementComponentRepositoryService);
  private readonly vendorItemPackRepository = inject(VendorItemPackRepositoryService);
  private readonly activityRepository = inject(ActivityRepositoryService);
  private readonly estimateBuilderService = inject(EstimateBuilderService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly lead = signal<Lead | null>(null);
  readonly estimates = signal<Estimate[]>([]);
  readonly activeEstimate = signal<Estimate | null>(null);
  readonly taxRegions = signal<TaxRegion[]>([]);
  readonly arrangements = signal<Arrangement[]>([]);
  readonly lineItems = signal<EstimateBuilderLine[]>([]);
  readonly selectedTaxRegionId = signal<string>('');
  readonly selectedLineType = signal<EstimateLineItemType>('arrangement');
  readonly selectedArrangementId = signal<string>('');
  readonly customLineName = signal('');
  readonly customLineDescription = signal('');
  readonly customLineQuantity = signal('1');
  readonly customLineUnitPrice = signal('0.00');
  readonly shoppingList = signal<ShoppingListItem[]>([]);
  readonly componentsByArrangementId = signal<Record<string, ArrangementComponent[]>>({});

  readonly selectedTaxRegion = computed(() => {
    const id = this.selectedTaxRegionId();
    return this.taxRegions().find((region) => region.tax_region_id === id) ?? null;
  });

  readonly totals = computed(() => this.estimateBuilderService.calculateTotals(this.lineItems(), this.selectedTaxRegion()));
  readonly canSubmit = computed(() => this.lineItems().length > 0 && !!this.selectedTaxRegionId() && !this.isReadOnly());
  readonly canEdit = computed(() => !this.isReadOnly() && !this.saving());
  readonly activeArrangements = computed(() => this.arrangements().filter((arrangement) => arrangement.is_active));
  readonly shoppingListSubtotal = computed(() =>
    Number(
      this.shoppingList()
        .reduce((sum, item) => sum + (item.total_estimated_cost ?? 0), 0)
        .toFixed(2)
    )
  );
  readonly selectableLineTypes: EstimateLineItemType[] = [
    'arrangement',
    'custom',
    'delivery',
    'install',
    'teardown',
    'fee',
    'discount',
  ];

  readonly title = computed(() => {
    const lead = this.lead();
    return lead ? `Estimate Builder: ${lead.first_name} ${lead.last_name}` : 'Estimate Builder';
  });

  readonly subtitle = computed(() => {
    const lead = this.lead();
    if (!lead) {
      return 'Build pricing, totals, and purchasing demand from arrangement recipes.';
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
      const [lead, taxRegions, arrangements, estimates] = await Promise.all([
        this.leadRepository.getLeadById(leadId),
        this.taxRegionRepository.getTaxRegions(),
        this.arrangementRepository.getArrangements(),
        this.estimateRepository.getLeadEstimates(leadId),
      ]);

      if (!lead) {
        this.error.set('We could not find this lead.');
        return;
      }

      this.lead.set(lead);
      this.taxRegions.set(taxRegions.filter((region) => region.is_active || estimates.some((estimate) => estimate.tax_region_id === region.tax_region_id)));
      this.arrangements.set(arrangements);
      this.estimates.set(estimates);

      const activeEstimate = estimates.find((estimate) => estimate.is_active) ?? null;
      this.activeEstimate.set(activeEstimate);
      this.selectedTaxRegionId.set(activeEstimate?.tax_region_id ?? '');

      if (activeEstimate) {
        await this.hydrateExistingEstimate(activeEstimate);
      } else {
        this.lineItems.set([]);
        this.shoppingList.set([]);
        this.componentsByArrangementId.set({});
      }

      if (!this.isEstimateWorkflowAllowed(lead.status)) {
        this.error.set('This lead is not ready for estimate building yet. A proposal must be accepted first.');
      }
    } catch (error) {
      console.error('[EstimateBuilderComponent] loadBuilder error:', error);
      this.error.set('We were unable to load the estimate builder right now.');
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

  async addArrangementLine(): Promise<void> {
    if (!this.canEdit()) return;

    const arrangementId = this.selectedArrangementId();
    if (!arrangementId) {
      this.toast.showToast('Select an arrangement to add it to the estimate.', 'error');
      return;
    }

    const arrangement = this.activeArrangements().find((item) => item.arrangement_id === arrangementId);
    if (!arrangement) {
      this.toast.showToast('We could not load that arrangement right now.', 'error');
      return;
    }

    await this.ensureArrangementComponents(arrangement.arrangement_id);
    this.lineItems.update((items) => [...items, this.estimateBuilderService.createArrangementLine(arrangement)]);
    this.selectedArrangementId.set('');
    this.refreshShoppingList();
  }

  addManualLine(): void {
    if (!this.canEdit()) return;

    const lineType = this.selectedLineType();
    if (lineType === 'arrangement') {
      void this.addArrangementLine();
      return;
    }

    const name = this.customLineName().trim();
    const quantity = Number(this.customLineQuantity());
    const unitPrice = Number(this.customLineUnitPrice());

    if (!name) {
      this.toast.showToast('Give this line item a name before adding it.', 'error');
      return;
    }

    if (Number.isNaN(quantity) || quantity <= 0) {
      this.toast.showToast('Quantity must be greater than zero.', 'error');
      return;
    }

    if (Number.isNaN(unitPrice) || unitPrice < 0) {
      this.toast.showToast('Unit price must be a valid non-negative amount.', 'error');
      return;
    }

    this.lineItems.update((items) => [
      ...items,
      this.estimateBuilderService.createManualLine(
        lineType,
        name,
        quantity,
        unitPrice,
        this.customLineDescription().trim() || null
      ),
    ]);
    this.resetManualLineForm();
    this.refreshShoppingList();
  }

  updateLineQuantity(lineId: string, rawValue: string): void {
    if (!this.canEdit()) return;
    const parsed = Number(rawValue);
    this.lineItems.update((items) => items.map((item) => {
      if (item.local_id !== lineId) return item;
      return this.estimateBuilderService.recalculateLine({ ...item, quantity: Number.isNaN(parsed) ? 0 : parsed });
    }));
    this.refreshShoppingList();
  }

  updateLineUnitPrice(lineId: string, rawValue: string): void {
    if (!this.canEdit()) return;
    const parsed = Number(rawValue);
    this.lineItems.update((items) => items.map((item) => {
      if (item.local_id !== lineId) return item;
      return this.estimateBuilderService.recalculateLine({ ...item, unit_price: Number.isNaN(parsed) ? 0 : parsed });
    }));
    this.refreshShoppingList();
  }

  removeLine(lineId: string): void {
    if (!this.canEdit()) return;
    this.lineItems.update((items) => items.filter((item) => item.local_id !== lineId));
    this.refreshShoppingList();
  }

  onTaxRegionChange(value: string): void {
    this.selectedTaxRegionId.set(value);
  }

  onLineTypeChange(value: EstimateLineItemType): void {
    this.selectedLineType.set(value);
  }

  async saveDraft(): Promise<void> {
    const lead = this.lead();
    if (!lead || this.saving() || this.isReadOnly()) return;

    try {
      this.saving.set(true);
      const estimate = await this.persistEstimate('draft');
      this.activeEstimate.set(estimate);
      this.estimates.update((items) => {
        const next = items.filter((item) => item.estimate_id !== estimate.estimate_id);
        return [estimate, ...next].sort((a, b) => b.version - a.version);
      });
      this.toast.showToast('Estimate draft saved.', 'success');
    } catch (error) {
      console.error('[EstimateBuilderComponent] saveDraft error:', error);
      this.toast.showToast('We were unable to save the estimate draft right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  async submitEstimate(): Promise<void> {
    const lead = this.lead();
    if (!lead || this.saving() || this.isReadOnly()) return;

    if (!this.selectedTaxRegionId()) {
      this.toast.showToast('Choose a tax region before submitting the estimate.', 'error');
      return;
    }

    if (!this.lineItems().length) {
      this.toast.showToast('Add at least one arrangement before submitting the estimate.', 'error');
      return;
    }

    try {
      this.saving.set(true);
      const estimate = await this.persistEstimate('submitted');
      await this.leadRepository.updateLead(lead.lead_id, {
        status: 'estimate_submitted',
      });
      await this.activityRepository.createLeadActivity({
        lead_id: lead.lead_id,
        activity_type: 'status_change',
        activity_label: 'Estimate submitted',
        activity_description: `Estimate v${estimate.version} was submitted from the CRM estimate builder.`,
        metadata: {
          previous_status: lead.status,
          next_status: 'estimate_submitted',
          estimate_id: estimate.estimate_id,
          estimate_version: estimate.version,
          subtotal: estimate.subtotal,
          tax_total: estimate.tax_total,
          grand_total: estimate.grand_total,
        },
      });

      this.toast.showToast('Estimate submitted successfully.', 'success');
      await this.loadBuilder(lead.lead_id);
    } catch (error) {
      console.error('[EstimateBuilderComponent] submitEstimate error:', error);
      this.toast.showToast('We were unable to submit the estimate right now.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  getEstimateStatusTone(status: Estimate['status']): 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'purple' {
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

  isReadOnly(): boolean {
    const status = this.lead()?.status;
    return status === 'estimate_accepted' || status === 'converted';
  }

  exportEstimatePdf(): void {
    const lead = this.lead();
    const estimate = this.activeEstimate();

    if (!lead || !estimate) {
      this.toast.showToast('Save the estimate first so there is a version ready to export.', 'error');
      return;
    }

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=900');
    if (!printWindow) {
      this.toast.showToast('We were unable to open the estimate export window.', 'error');
      return;
    }

    const html = this.buildEstimatePrintHtml();
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  }

  private async hydrateExistingEstimate(estimate: Estimate): Promise<void> {
    const lineItems = await this.estimateRepository.getEstimateLineItems(estimate.estimate_id);
    const arrangementIds = Array.from(
      new Set(lineItems.map((item) => item.arrangement_id).filter((value): value is string => !!value))
    );

    await Promise.all(arrangementIds.map((arrangementId) => this.ensureArrangementComponents(arrangementId)));

    this.lineItems.set(lineItems.map((lineItem) => this.mapEstimateLineItemToBuilderLine(lineItem)));
    this.refreshShoppingList();
  }

  private mapEstimateLineItemToBuilderLine(lineItem: EstimateLineItem): EstimateBuilderLine {
    const arrangement = lineItem.line_type === 'arrangement'
      ? this.arrangements().find((item) => item.arrangement_id === lineItem.arrangement_id) ?? ({
          arrangement_id: lineItem.arrangement_id ?? lineItem.estimate_line_item_id,
          name: lineItem.name,
          category: lineItem.arrangement?.category ?? null,
          description: lineItem.description ?? null,
          design_notes: null,
          labor_settings_id: null,
          design_labor_hours: 0,
          markup_percent: 30,
          calculated_cost: 0,
          suggested_sell_price: lineItem.unit_price,
          manual_override_sell_price: lineItem.unit_price,
          is_active: true,
          created_at: '',
          updated_at: '',
        } as Arrangement)
      : null;

    return {
      local_id: lineItem.estimate_line_item_id,
      line_type: lineItem.line_type,
      arrangement_id: arrangement?.arrangement_id ?? null,
      arrangement,
      name: lineItem.name,
      description: lineItem.description ?? null,
      quantity: lineItem.quantity,
      unit_price: lineItem.unit_price,
      line_subtotal: lineItem.line_subtotal,
    };
  }

  private async ensureArrangementComponents(arrangementId: string): Promise<void> {
    if (this.componentsByArrangementId()[arrangementId]) return;

    const components = await this.arrangementComponentRepository.getArrangementComponents(arrangementId);
    this.componentsByArrangementId.update((value) => ({ ...value, [arrangementId]: components }));
  }

  private refreshShoppingList(): void {
    const snapshots = this.estimateBuilderService.buildLineItemSnapshots(this.lineItems(), this.componentsByArrangementId());
    const itemIds = Array.from(
      new Set(snapshots.flat().map((snapshot) => snapshot.item_id).filter((value): value is string => !!value))
    );

    if (!itemIds.length) {
      this.shoppingList.set([]);
      return;
    }

    void this.vendorItemPackRepository.getDefaultPacksForItems(itemIds).then((packs) => {
      const shoppingList = this.estimateBuilderService.buildShoppingList(snapshots, packs);
      this.shoppingList.set(shoppingList);
    }).catch((error) => {
      console.error('[EstimateBuilderComponent] refreshShoppingList error:', error);
      this.shoppingList.set([]);
    });
  }

  private async persistEstimate(status: Estimate['status']): Promise<Estimate> {
    const lead = this.lead();
    if (!lead) {
      throw new Error('Lead is required to save an estimate.');
    }

    const totals = this.totals();
    let estimate = this.activeEstimate();

    if (!estimate) {
      const nextVersion = Math.max(0, ...this.estimates().map((item) => item.version)) + 1;
      estimate = await this.estimateRepository.createEstimate({
        lead_id: lead.lead_id,
        version: nextVersion,
        status,
        is_active: true,
        tax_region_id: this.selectedTaxRegionId() || null,
        subtotal: totals.subtotal,
        discount_total: totals.discountTotal,
        fee_total: totals.feeTotal,
        tax_total: totals.taxTotal,
        grand_total: totals.grandTotal,
        terms_version: 'v1',
        privacy_policy_version: 'v1',
      });

      await this.activityRepository.createLeadActivity({
        lead_id: lead.lead_id,
        activity_type: 'updated',
        activity_label: 'Estimate draft created',
        activity_description: `Estimate v${estimate.version} was created in draft mode.`,
        metadata: {
          estimate_id: estimate.estimate_id,
          estimate_version: estimate.version,
          estimate_status: status,
        },
      });
    } else {
      estimate = await this.estimateRepository.updateEstimate(estimate.estimate_id, {
        status,
        tax_region_id: this.selectedTaxRegionId() || null,
        subtotal: totals.subtotal,
        discount_total: totals.discountTotal,
        fee_total: totals.feeTotal,
        tax_total: totals.taxTotal,
        grand_total: totals.grandTotal,
      });
    }

    const lineItemPayloads = this.estimateBuilderService.buildEstimateLineItems(this.lineItems());
    const savedLineItems = await this.estimateRepository.replaceEstimateLineItems(estimate.estimate_id, lineItemPayloads);
    const snapshots = this.estimateBuilderService.buildLineItemSnapshots(this.lineItems(), this.componentsByArrangementId());
    await this.estimateRepository.replaceLineItemComponentSnapshots(estimate.estimate_id, savedLineItems, snapshots);

    const itemIds = Array.from(
      new Set(snapshots.flat().map((snapshot) => snapshot.item_id).filter((value): value is string => !!value))
    );
    const packs = itemIds.length ? await this.vendorItemPackRepository.getDefaultPacksForItems(itemIds) : [];
    const shoppingList = this.estimateBuilderService.buildShoppingList(snapshots, packs);
    await this.estimateRepository.upsertShoppingList(estimate.estimate_id, shoppingList);
    this.shoppingList.set(shoppingList);

    return estimate;
  }

  private isEstimateWorkflowAllowed(status: Lead['status']): boolean {
    return status === 'proposal_accepted'
      || status === 'estimate_submitted'
      || status === 'estimate_declined'
      || status === 'estimate_accepted'
      || status === 'converted';
  }

  private resetManualLineForm(): void {
    this.selectedLineType.set('arrangement');
    this.customLineName.set('');
    this.customLineDescription.set('');
    this.customLineQuantity.set('1');
    this.customLineUnitPrice.set('0.00');
    this.selectedArrangementId.set('');
  }

  private buildEstimatePrintHtml(): string {
    const lead = this.lead();
    const estimate = this.activeEstimate();
    const taxRegion = this.selectedTaxRegion();
    const totals = this.totals();
    const lines = this.lineItems();

    if (!lead || !estimate) {
      return '<html><body><p>Estimate unavailable.</p></body></html>';
    }

    const lineRows = lines
      .map(
        (line) => `
          <tr>
            <td>${line.name}</td>
            <td>${this.formatStatusLabel(line.line_type)}</td>
            <td>${line.quantity}</td>
            <td>${this.formatCurrency(line.unit_price)}</td>
            <td>${this.formatCurrency(line.line_subtotal)}</td>
          </tr>
        `
      )
      .join('');

    return `
      <html>
        <head>
          <title>Estimate v${estimate.version}</title>
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
              <h1>Estimate</h1>
              <p class="meta">Version ${estimate.version}<br />Prepared for ${lead.first_name} ${lead.last_name}<br />${lead.email}</p>
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
                <th>Line Item</th>
                <th>Type</th>
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
            <div class="totals-row"><span>Discounts</span><span>${this.formatCurrency(totals.discountTotal)}</span></div>
            <div class="totals-row"><span>Fees</span><span>${this.formatCurrency(totals.feeTotal)}</span></div>
            <div class="totals-row"><span>Tax</span><span>${this.formatCurrency(totals.taxTotal)}</span></div>
            <div class="totals-row total"><span>Total</span><span>${this.formatCurrency(totals.grandTotal)}</span></div>
          </div>

          <div class="note">
            This estimate is generated from the saved CRM estimate data for planning and client review. Terms, privacy policy, and signature acceptance will be captured in the customer-facing estimate workflow.
          </div>
        </body>
      </html>
    `;
  }
}

