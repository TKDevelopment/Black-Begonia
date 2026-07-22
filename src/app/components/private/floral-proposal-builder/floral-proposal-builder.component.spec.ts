import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';

import { CatalogItem } from '../../../core/models/catalog-item';
import { FloralProposal } from '../../../core/models/floral-proposal';
import { TaxRegion } from '../../../core/models/tax-region';
import { ToastService } from '../../../core/services/toast.service';
import { CrmThemeService } from '../../../core/services/crm-theme.service';
import { ActivityRepositoryService } from '../../../core/supabase/repositories/activity-repository.service';
import { CatalogItemRepositoryService } from '../../../core/supabase/repositories/catalog-item-repository.service';
import { FloralProposalRepositoryService } from '../../../core/supabase/repositories/floral-proposal-repository.service';
import { LeadRepositoryService } from '../../../core/supabase/repositories/lead-repository.service';
import { TaxRegionRepositoryService } from '../../../core/supabase/repositories/tax-region-repository.service';
import { FloralProposalWorkflowService } from '../../../core/supabase/services/floral-proposal-workflow.service';
import { LeadConversionService } from '../../../core/supabase/services/lead-conversion.service';
import { testFloralProposal, testLead } from '../../../core/testing/workflow-fixtures';
import { FloralProposalBuilderComponent } from './floral-proposal-builder.component';

describe('FloralProposalBuilderComponent', () => {
  let component: FloralProposalBuilderComponent;
  let fixture: ComponentFixture<FloralProposalBuilderComponent>;
  let routeParamMap = convertToParamMap({ leadId: testLead.lead_id });
  let leadRepository: jasmine.SpyObj<LeadRepositoryService>;
  let taxRegionRepository: jasmine.SpyObj<TaxRegionRepositoryService>;
  let proposalRepository: jasmine.SpyObj<FloralProposalRepositoryService>;
  let catalogRepository: jasmine.SpyObj<CatalogItemRepositoryService>;
  let activityRepository: jasmine.SpyObj<ActivityRepositoryService>;
  let proposalWorkflow: jasmine.SpyObj<FloralProposalWorkflowService>;
  let leadConversionService: jasmine.SpyObj<LeadConversionService>;
  let toast: jasmine.SpyObj<ToastService>;
  let router: jasmine.SpyObj<Router>;
  let consoleErrorSpy: jasmine.Spy;
  let themeMode: ReturnType<typeof signal<'light' | 'dark'>>;

  const taxRegion: TaxRegion = {
    tax_region_id: 'tax-region-test-001',
    name: 'Austin Test Tax',
    authority_name: 'Test Authority',
    tax_rate: 0.08,
    applies_to_products: true,
    applies_to_services: true,
    applies_to_delivery: true,
    is_active: true,
    created_at: '2026-06-02T12:00:00.000Z',
    updated_at: '2026-06-02T12:00:00.000Z',
  };

  const catalogItem: CatalogItem = {
    item_id: 'catalog-rose-001',
    name: 'Garden Rose',
    item_type: 'flower',
    unit_type: 'bunch',
    pack_quantity: 10,
    color: 'Blush',
    variety: 'Juliet',
    sku: 'ROSE-JULIET',
    base_unit_cost: 30,
    default_waste_percent: 10,
    is_active: true,
    created_at: '2026-06-02T12:00:00.000Z',
    updated_at: '2026-06-02T12:00:00.000Z',
  };

  const draftProposal: FloralProposal = {
    ...testFloralProposal,
    floral_proposal_id: 'proposal-draft-001',
    lead_id: testLead.lead_id,
    tax_region_id: taxRegion.tax_region_id,
    version: 2,
    status: 'draft',
    is_active: true,
  };

  beforeEach(async () => {
    routeParamMap = convertToParamMap({ leadId: testLead.lead_id });
    leadRepository = jasmine.createSpyObj<LeadRepositoryService>(
      'LeadRepositoryService',
      ['getLeadById']
    );
    taxRegionRepository = jasmine.createSpyObj<TaxRegionRepositoryService>(
      'TaxRegionRepositoryService',
      ['getTaxRegions']
    );
    proposalRepository = jasmine.createSpyObj<FloralProposalRepositoryService>(
      'FloralProposalRepositoryService',
      [
        'getLeadFloralProposals',
        'getFloralProposalLineItems',
        'getFloralProposalComponents',
        'getActiveLeadFloralProposal',
        'createFloralProposal',
        'updateFloralProposal',
        'replaceFloralProposalLineItems',
        'replaceFloralProposalComponents',
        'upsertShoppingList',
      ]
    );
    catalogRepository = jasmine.createSpyObj<CatalogItemRepositoryService>(
      'CatalogItemRepositoryService',
      ['getCatalogItems']
    );
    activityRepository = jasmine.createSpyObj<ActivityRepositoryService>(
      'ActivityRepositoryService',
      ['createLeadActivity']
    );
    proposalWorkflow = jasmine.createSpyObj<FloralProposalWorkflowService>(
      'FloralProposalWorkflowService',
      [
        'submitProposal',
        'uploadProposalPdf',
        'resolveStoredProposalStatus',
        'buildProposalSnapshot',
        'buildEditableProposalSnapshot',
        'uploadLineItemImage',
        'removeLineItemImage',
        'getSignedLineItemImageUrl',
        'clearMissingLineItemImage',
      ]
    );
    leadConversionService = jasmine.createSpyObj<LeadConversionService>(
      'LeadConversionService',
      ['issueDepositRequest']
    );
    leadConversionService.issueDepositRequest.and.resolveTo('queued');
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['showToast']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    themeMode = signal<'light' | 'dark'>('light');

    leadRepository.getLeadById.and.resolveTo({
      ...testLead,
      status: 'nurturing',
    });
    taxRegionRepository.getTaxRegions.and.resolveTo([
      taxRegion,
      { ...taxRegion, tax_region_id: 'inactive-tax', is_active: false },
    ]);
    proposalRepository.getLeadFloralProposals.and.resolveTo([]);
    proposalRepository.getFloralProposalLineItems.and.resolveTo([]);
    proposalRepository.getFloralProposalComponents.and.resolveTo([]);
    proposalRepository.getActiveLeadFloralProposal.and.resolveTo(null);
    proposalRepository.createFloralProposal.and.resolveTo(draftProposal);
    proposalRepository.updateFloralProposal.and.resolveTo(draftProposal);
    proposalRepository.replaceFloralProposalLineItems.and.resolveTo([
      {
        ...testFloralProposal,
        floral_proposal_line_item_id: 'saved-line-001',
      } as any,
    ]);
    proposalRepository.replaceFloralProposalComponents.and.resolveTo(undefined as any);
    proposalRepository.upsertShoppingList.and.resolveTo(undefined as any);
    activityRepository.createLeadActivity.and.resolveTo({} as any);
    catalogRepository.getCatalogItems.and.resolveTo([
      catalogItem,
      { ...catalogItem, item_id: 'inactive-catalog', is_active: false },
    ]);
    proposalWorkflow.submitProposal.and.resolveTo({
      project_id: 'project-test-001',
      lead_id: testLead.lead_id,
      floral_proposal_id: draftProposal.floral_proposal_id,
      proposal_document_version_id: 'proposal-document-version-001',
      active_invoice_snapshot_id: 'invoice-snapshot-001',
      signed_pdf_storage_path: `${testLead.lead_id}/proposal-draft-001/upload/proposal.pdf`,
      submitted_at: '2026-06-02T12:00:00.000Z',
    } as any);
    proposalWorkflow.uploadProposalPdf.and.resolveTo({
      storagePath: `${testLead.lead_id}/proposal-draft-001/upload/proposal.pdf`,
    });
    proposalWorkflow.resolveStoredProposalStatus.and.callFake((status) =>
      status === 'finalized' ? 'draft' : status
    );
    proposalWorkflow.buildProposalSnapshot.and.callFake((args: any) => ({
      ...(args.existingSnapshot ?? {}),
      proposal_status: args.proposalStatus ?? 'draft',
      finalized_at: args.lifecycle?.finalizedAt ?? null,
      edit_reopened_at: args.lifecycle?.editReopenedAt ?? null,
      default_markup_percent: args.renderPayload.default_markup_percent,
      labor_percent: args.renderPayload.labor_percent,
    }));
    proposalWorkflow.buildEditableProposalSnapshot.and.callFake((snapshot: any) => ({
      ...snapshot,
      proposal_status: 'draft',
    }));
    proposalWorkflow.uploadLineItemImage.and.resolveTo({
      storagePath: 'proposal-images/lead-test-001/line-001.jpg',
      signedUrl: 'https://example.test/line-001.jpg',
    });
    proposalWorkflow.removeLineItemImage.and.resolveTo(undefined);
    proposalWorkflow.getSignedLineItemImageUrl.and.resolveTo('https://example.test/signed.jpg');
    await TestBed.configureTestingModule({
      imports: [FloralProposalBuilderComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => routeParamMap.get(key),
              },
              queryParamMap: convertToParamMap({}),
            },
          },
        },
        { provide: Router, useValue: router },
        { provide: LeadRepositoryService, useValue: leadRepository },
        { provide: TaxRegionRepositoryService, useValue: taxRegionRepository },
        { provide: FloralProposalRepositoryService, useValue: proposalRepository },
        { provide: CatalogItemRepositoryService, useValue: catalogRepository },
        { provide: ActivityRepositoryService, useValue: activityRepository },
        { provide: FloralProposalWorkflowService, useValue: proposalWorkflow },
        { provide: LeadConversionService, useValue: leadConversionService },
        { provide: ToastService, useValue: toast },
        {
          provide: CrmThemeService,
          useValue: {
            mode: themeMode,
            isDarkMode: false,
          },
        },
      ],
    }).compileComponents();

    consoleErrorSpy = spyOn(console, 'error');
  });

  it('redirects to the lead list when no route lead id is available', () => {
    routeParamMap = convertToParamMap({});

    createComponent();

    expect(router.navigate).toHaveBeenCalledWith(['/admin/leads']);
    expect(leadRepository.getLeadById).not.toHaveBeenCalled();
  });

  it('loads lead, active configuration, catalog data, and empty builder state', async () => {
    createComponent();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.loading()).toBeFalse();
    expect(component.error()).toBeNull();
    expect(component.lead()?.lead_id).toBe(testLead.lead_id);
    expect(component.taxRegions().map((region) => region.tax_region_id)).toEqual([
      taxRegion.tax_region_id,
    ]);
    expect(component.activeCatalogItems().map((item) => item.item_id)).toEqual([
      catalogItem.item_id,
    ]);
    expect(component.title()).toBe('Floral Proposal Builder: Avery Bloom');
    expect(text()).toContain('Floral Proposal Builder');
    expect(text()).toContain('Avery Bloom');
  });

  it('shows not-found and dependency failure states while allowing retry', async () => {
    leadRepository.getLeadById.and.resolveTo(null);
    createComponent();
    await fixture.whenStable();

    expect(component.loading()).toBeFalse();
    expect(component.error()).toBe('We could not find this lead.');

    leadRepository.getLeadById.and.resolveTo({ ...testLead, status: 'nurturing' });
    await component.retry();

    expect(component.error()).toBeNull();
    expect(leadRepository.getLeadById).toHaveBeenCalledTimes(2);

    leadRepository.getLeadById.and.rejectWith(new Error('offline'));
    await component.loadBuilder(testLead.lead_id);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[FloralProposalBuilderComponent] loadBuilder error:',
      jasmine.any(Error)
    );
    expect(component.error()).toBe(
      'We were unable to load the Floral Proposal builder right now.'
    );
  });

  it('adds, updates, reorders, and removes editable line items', async () => {
    createLoadedComponent();

    component.addLineItem();
    const lineId = component.lineItems()[0].local_id;
    component.updateLineName(lineId, 'Bridal Bouquet');
    component.updateLineQuantity(lineId, '3');
    component.toggleExpanded(lineId);
    component.addLineItem();
    component.reorderLineItems({
      previousIndex: 1,
      currentIndex: 0,
    } as any);

    expect(component.lineItems()[0].display_order).toBe(0);
    expect(component.lineItems()[1].display_order).toBe(1);
    expect(component.lineItems()[1].item_name).toBe('Bridal Bouquet');
    expect(component.lineItems()[1].quantity).toBe(3);
    expect(component.lineItems()[1].expanded).toBeTrue();

    component.removeLine(lineId);

    expect(component.lineItems().some((line) => line.local_id === lineId)).toBeFalse();
  });

  it('applies catalog selections, component edits, markup changes, and shopping reserve updates', async () => {
    createLoadedComponent();
    component.addLineItem();
    const lineId = component.lineItems()[0].local_id;
    component.updateLineName(lineId, 'Centerpiece');
    component.addComponentRow(lineId);
    const componentId = component.lineItems()[0].components[0].local_id;

    component.replaceCatalogItem(lineId, componentId, catalogItem.item_id);
    component.updateComponentQuantity(lineId, componentId, '5');
    component.onDefaultMarkupChange('40');
    await fixture.whenStable();

    const row = component.lineItems()[0].components[0];
    expect(row.catalog_item_id).toBe(catalogItem.item_id);
    expect(row.catalog_item_name).toBe('Blush Juliet Garden Rose');
    expect(row.quantity_per_unit).toBe(5);
    expect(row.applied_markup_percent).toBe(40);
    expect(component.shoppingList()[0]).toEqual(
      jasmine.objectContaining({
        catalog_item_id: catalogItem.item_id,
        item_name: 'Blush Juliet Garden Rose',
      })
    );

    component.updateShoppingListReserve(component.shoppingList()[0], '25');
    await fixture.whenStable();

    expect(component.lineItems()[0].components[0].reserve_percent).toBe(25);
  });

  it('keeps recorded pricing when component text is edited and reprices only through explicit replacement', () => {
    createLoadedComponent();
    component.addLineItem();
    const lineId = component.lineItems()[0].local_id;
    component.addComponentRow(lineId);
    const componentId = component.lineItems()[0].components[0].local_id;
    component.replaceCatalogItem(lineId, componentId, catalogItem.item_id);
    const recordedCost = component.lineItems()[0].components[0].base_unit_cost;

    component.updateCatalogItemQuery(lineId, componentId, 'Custom legacy rose');

    const edited = component.lineItems()[0].components[0];
    expect(edited.catalog_item_id).toBeNull();
    expect(edited.catalog_item_name).toBe('Custom legacy rose');
    expect(edited.base_unit_cost).toBe(recordedCost);
  });

  it('edits four-decimal row prices, preserves invalid input, and resets price plus pack from catalog', async () => {
    createLoadedComponent();
    component.addLineItem();
    const lineId = component.lineItems()[0].local_id;
    component.updateLineName(lineId, 'Centerpiece');
    component.addComponentRow(lineId);
    const componentId = component.lineItems()[0].components[0].local_id;
    component.replaceCatalogItem(lineId, componentId, catalogItem.item_id);

    component.updateComponentUnitPrice(lineId, componentId, '4.1255');
    let row = component.lineItems()[0].components[0];
    expect(row.base_unit_cost).toBe(4.1255);
    expect(row.effective_pack_cost).toBe(41.26);
    expect(component.hasComponentPriceErrors()).toBeFalse();

    component.updateComponentUnitPrice(lineId, componentId, '4.12555');
    row = component.lineItems()[0].components[0];
    expect(row.base_unit_cost).toBe(4.1255);
    expect(row.unit_price_input).toBe('4.12555');
    expect(row.unit_price_error).toContain('four decimal');
    expect(component.hasComponentPriceErrors()).toBeTrue();

    component.updateComponentUnitPrice(lineId, componentId, '4');
    component.resetComponentToCatalogPrice(lineId, componentId);
    row = component.lineItems()[0].components[0];
    expect(row.base_unit_cost).toBe(3);
    expect(row.pack_quantity).toBe(10);
    expect(row.effective_pack_cost).toBe(30);
    renderLoadedFixture();
    const priceInput = fixture.nativeElement.querySelector(
      'input[aria-label="Row unit price for Blush Juliet Garden Rose"]'
    ) as HTMLInputElement;
    const resetButton = fixture.nativeElement.querySelector(
      'button[aria-label="Reset row unit price for Blush Juliet Garden Rose to current catalog price"]'
    ) as HTMLButtonElement;
    expect(priceInput.type).toBe('number');
    expect(priceInput.step).toBe('0.0001');
    expect(priceInput.getAttribute('aria-invalid')).toBe('false');
    expect(resetButton).not.toBeNull();
    await fixture.whenStable();
  });

  it('keeps a cleared native number input blank so a catalog row price can be replaced', () => {
    createLoadedComponent();
    component.addLineItem();
    const lineId = component.lineItems()[0].local_id;
    component.addComponentRow(lineId);
    const componentId = component.lineItems()[0].components[0].local_id;
    component.replaceCatalogItem(lineId, componentId, catalogItem.item_id);
    renderLoadedFixture();

    const priceInput = fixture.nativeElement.querySelector(
      '.component-price-input'
    ) as HTMLInputElement;
    expect(priceInput.value).toBe('3');

    priceInput.value = '';
    priceInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(priceInput.value).toBe('');
    expect(component.lineItems()[0].components[0].unit_price_input).toBe('');
    expect(component.lineItems()[0].components[0].unit_price_error).toBe(
      'Enter a row unit price.'
    );

    priceInput.value = '4.1255';
    priceInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(priceInput.value).toBe('4.1255');
    expect(component.lineItems()[0].components[0]).toEqual(jasmine.objectContaining({
      base_unit_cost: 4.1255,
      unit_price_input: '4.1255',
      unit_price_error: null,
      effective_pack_cost: 41.26,
    }));
  });

  it('refreshes one conservative shopping row for compatible mixed prices and splits incompatible packs', async () => {
    createLoadedComponent();
    component.addLineItem();
    const lineId = component.lineItems()[0].local_id;
    component.addComponentRow(lineId);
    component.addComponentRow(lineId);
    const [firstId, secondId] = component.lineItems()[0].components.map((row) => row.local_id);

    component.replaceCatalogItem(lineId, firstId, catalogItem.item_id);
    component.replaceCatalogItem(lineId, secondId, catalogItem.item_id);
    component.updateComponentQuantity(lineId, firstId, '6');
    component.updateComponentQuantity(lineId, secondId, '6');
    component.updateComponentUnitPrice(lineId, firstId, '3');
    component.updateComponentUnitPrice(lineId, secondId, '4');
    await fixture.whenStable();

    expect(component.shoppingList().length).toBe(1);
    expect(component.shoppingList()[0]).toEqual(jasmine.objectContaining({
      required_units: 12,
      units_per_pack: 10,
      required_pack_count: 2,
      estimated_pack_cost: 40,
      total_estimated_cost: 80,
    }));

    component.lineItems.update((lines) => lines.map((line) => ({
      ...line,
      components: line.components.map((row) =>
        row.local_id === secondId ? { ...row, pack_quantity: 12 } : row
      ),
    })));
    component.updateComponentQuantity(lineId, secondId, '6');
    await fixture.whenStable();

    expect(component.shoppingList().length).toBe(2);
    expect(component.shoppingList().every((item) => item.notes?.includes('Separate entry')))
      .toBeTrue();
  });

  it('keeps at least 95 percent of row-price edits under 200 ms for a 100-line proposal without network calls', () => {
    createLoadedComponent();
    component.addLineItem();
    const sourceLineId = component.lineItems()[0].local_id;
    component.addComponentRow(sourceLineId);
    const sourceComponentId = component.lineItems()[0].components[0].local_id;
    component.replaceCatalogItem(sourceLineId, sourceComponentId, catalogItem.item_id);
    const sourceLine = component.lineItems()[0];

    component.lineItems.set(Array.from({ length: 100 }, (_, index) => ({
      ...sourceLine,
      local_id: `performance-line-${index}`,
      display_order: index,
      components: sourceLine.components.map((row) => ({
        ...row,
        local_id: `performance-component-${index}`,
      })),
    })));

    const durations = Array.from({ length: 20 }, (_, index) => {
      const startedAt = performance.now();
      component.updateComponentUnitPrice(
        `performance-line-${index}`,
        `performance-component-${index}`,
        `${3 + index / 100}`
      );
      return performance.now() - startedAt;
    });

    expect(durations.filter((duration) => duration < 200).length).toBeGreaterThanOrEqual(19);
    expect(proposalRepository.updateFloralProposal).not.toHaveBeenCalled();
    expect(proposalRepository.replaceFloralProposalComponents).not.toHaveBeenCalled();
    expect(catalogRepository.getCatalogItems).not.toHaveBeenCalled();
  });

  it('preserves a deliberate override when the same catalog suggestion is reselected', () => {
    createLoadedComponent();
    component.addLineItem();
    const lineId = component.lineItems()[0].local_id;
    component.addComponentRow(lineId);
    const componentId = component.lineItems()[0].components[0].local_id;
    component.replaceCatalogItem(lineId, componentId, catalogItem.item_id);
    component.updateComponentUnitPrice(lineId, componentId, '4.25');

    component.updateCatalogItemQuery(lineId, componentId, 'Blush Juliet Garden Rose');
    component.commitCatalogItemSelection(lineId, componentId, 'Blush Juliet Garden Rose');

    expect(component.lineItems()[0].components[0].base_unit_cost).toBe(4.25);
  });

  it('replaces different items, supports keyboard reset, and explains unavailable reset in both themes', () => {
    createLoadedComponent();
    const currentCatalogItem: CatalogItem = {
      ...catalogItem,
      item_id: 'catalog-current-rose',
      name: 'Current Rose',
      pack_quantity: 12,
      base_unit_cost: 36,
    };
    component.catalogItems.set([catalogItem, currentCatalogItem]);
    component.addLineItem();
    const lineId = component.lineItems()[0].local_id;
    component.addComponentRow(lineId);
    const componentId = component.lineItems()[0].components[0].local_id;

    component.replaceCatalogItem(lineId, componentId, catalogItem.item_id);
    component.updateComponentUnitPrice(lineId, componentId, '4');
    component.replaceCatalogItem(lineId, componentId, currentCatalogItem.item_id);
    expect(component.lineItems()[0].components[0]).toEqual(jasmine.objectContaining({
      catalog_item_id: currentCatalogItem.item_id,
      base_unit_cost: 3,
      pack_quantity: 12,
      effective_pack_cost: 36,
    }));

    component.updateComponentUnitPrice(lineId, componentId, '5');
    renderLoadedFixture();
    let resetButton = fixture.nativeElement.querySelector('.component-price-reset') as HTMLButtonElement;
    const rowActions = resetButton.closest('.component-row-actions') as HTMLElement;
    const resetTooltip = resetButton.closest('.component-row-action-tooltip') as HTMLElement;
    const removeButton = fixture.nativeElement.querySelector(
      'button[aria-label="Remove catalog row"]'
    ) as HTMLButtonElement;
    const removeTooltip = removeButton.closest('.component-row-action-tooltip') as HTMLElement;
    expect(rowActions).not.toBeNull();
    expect(rowActions.contains(removeButton)).toBeTrue();
    expect(resetTooltip.dataset['tooltip']).toBe('Reset to Catalog Price');
    expect(removeTooltip.dataset['tooltip']).toBe('Remove Catalog Row');
    expect(resetButton.textContent?.trim()).toBe('');
    expect(resetButton.disabled).toBeFalse();
    expect(resetButton.classList).toContain('component-price-reset--available');
    const resetTooltipStyle = getComputedStyle(resetTooltip, '::after');
    expect(resetTooltipStyle.right).toBe('0px');
    resetButton.focus();
    expect(document.activeElement).toBe(resetButton);
    resetButton.click();
    fixture.detectChanges();
    resetButton = fixture.nativeElement.querySelector('.component-price-reset') as HTMLButtonElement;
    expect(component.lineItems()[0].components[0].base_unit_cost).toBe(3);
    expect(resetButton.disabled).toBeTrue();
    expect(resetButton.classList).not.toContain('component-price-reset--available');
    expect(resetButton.closest<HTMLElement>('.component-row-action-tooltip')?.dataset['tooltip'])
      .toBe('Catalog price is already applied.');

    themeMode.set('dark');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.floral-proposal-builder-page').classList)
      .toContain('crm-dark');
    resetButton = fixture.nativeElement.querySelector('.component-price-reset') as HTMLButtonElement;
    expect(resetButton).not.toBeNull();

    component.catalogItems.set([]);
    fixture.detectChanges();
    resetButton = fixture.nativeElement.querySelector('.component-price-reset') as HTMLButtonElement;
    expect(resetButton.disabled).toBeTrue();
    expect(text()).toContain('Current catalog pricing is unavailable for this retired or inactive item.');
  });

  it('uses one dynamic catalog typeahead and applies current pricing only for a selected suggestion', () => {
    createLoadedComponent();
    component.addLineItem();
    const lineId = component.lineItems()[0].local_id;
    component.addComponentRow(lineId);
    const componentId = component.lineItems()[0].components[0].local_id;

    component.updateCatalogItemQuery(lineId, componentId, 'Blush');
    renderLoadedFixture();

    const catalogInput = fixture.nativeElement.querySelector(
      `input[list="${component.getCatalogItemDatalistId(componentId)}"]`
    ) as HTMLInputElement;
    const options = Array.from(
      fixture.nativeElement.querySelectorAll(
        `#${component.getCatalogItemDatalistId(componentId)} option`
      )
    ) as HTMLOptionElement[];

    expect(catalogInput).not.toBeNull();
    expect(options.map((option) => option.value)).toEqual(['Blush Juliet Garden Rose']);
    expect(fixture.nativeElement.querySelector('select[aria-label="Replace with current catalog item"]')).toBeNull();
    expect(component.lineItems()[0].components[0].catalog_item_id).toBeNull();

    component.commitCatalogItemSelection(lineId, componentId, 'Blush Juliet Garden Rose');

    expect(component.lineItems()[0].components[0]).toEqual(
      jasmine.objectContaining({
        catalog_item_id: catalogItem.item_id,
        base_unit_cost: catalogItem.base_unit_cost / (catalogItem.pack_quantity ?? 1),
      })
    );
  });

  it('renders the streamlined revision toolbar and line-item composition layout', () => {
    createLoadedComponent();
    component.revisionWorkspace.set({} as any);
    component.revisionWarning.set(
      'This proposal was created with an older snapshot format.'
    );
    component.addLineItem();
    component.toggleExpanded(component.lineItems()[0].local_id);
    renderLoadedFixture();

    const actionRow = fixture.nativeElement.querySelector('.builder-action-row') as HTMLElement;
    const actionLabels = Array.from(actionRow.querySelectorAll('button')).map((button) =>
      button.textContent?.trim()
    );

    expect(actionRow.classList).toContain('flex-nowrap');
    expect(actionLabels).toEqual(['Save Draft', 'Discard Revision', 'Finalize Proposal']);
    expect(text()).not.toContain('Export PDF');
    expect(fixture.nativeElement.querySelector('.revision-warning-banner')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.discard-revision-button')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.line-item-type-select')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.line-item-settings-card')).toBeNull();
    expect(text()).not.toContain('Line Item Image');
    expect(text()).not.toContain('Line Description');
    expect(text()).toContain('Internal Catalog Composition');
  });

  it('saves drafts through repositories, activity logging, toast feedback, and reload', async () => {
    createSubmittableComponent();

    await component.saveDraft();

    expect(proposalRepository.createFloralProposal).toHaveBeenCalledWith(
      jasmine.objectContaining({
        lead_id: testLead.lead_id,
        tax_region_id: taxRegion.tax_region_id,
        status: 'draft',
      })
    );
    const createArgs = proposalRepository.createFloralProposal.calls.mostRecent().args[0] as any;
    expect(createArgs.template_id).toBeUndefined();
    expect(proposalRepository.replaceFloralProposalLineItems).toHaveBeenCalled();
    expect(proposalRepository.replaceFloralProposalComponents).toHaveBeenCalled();
    expect(proposalRepository.upsertShoppingList).toHaveBeenCalled();
    expect(activityRepository.createLeadActivity).toHaveBeenCalledWith(
      jasmine.objectContaining({
        lead_id: testLead.lead_id,
        activity_label: 'Floral Proposal v2 draft saved',
      })
    );
    expect(toast.showToast).toHaveBeenCalledWith(
      'Floral Proposal draft saved.',
      'success'
    );
    expect(component.saving()).toBeFalse();
  });

  it('surfaces save failures without leaving the builder in a saving state', async () => {
    proposalRepository.createFloralProposal.and.rejectWith(new Error('insert failed'));
    createSubmittableComponent();

    await component.saveDraft();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[FloralProposalBuilderComponent] saveDraft error:',
      jasmine.any(Error)
    );
    expect(toast.showToast).toHaveBeenCalledWith(
      'We were unable to save the Floral Proposal draft right now.',
      'error'
    );
    expect(component.saving()).toBeFalse();
  });

  it('opens finalization without locking and cancel keeps the draft editable', async () => {
    createSubmittableComponent();

    await component.finalizeProposal();

    expect(component.submissionModalOpen()).toBeTrue();
    expect(proposalRepository.createFloralProposal).not.toHaveBeenCalled();
    expect(component.canEdit()).toBeTrue();

    component.closeDocumentSubmission();
    expect(component.submissionModalOpen()).toBeFalse();
    expect(component.canFinalize()).toBeTrue();
  });

  it('persists, uploads, and submits florist-supplied PDF documents atomically', async () => {
    createSubmittableComponent();
    spyOn(window, 'confirm').and.returnValue(true);
    const pdfFile = new File(['%PDF-test'], 'proposal.pdf', {
      type: 'application/pdf',
    });

    await component.finalizeProposal();
    component.onSubmissionFileSelected(pdfFile);
    await component.submitProposalDocument(false);

    expect(proposalRepository.createFloralProposal).toHaveBeenCalledWith(
      jasmine.objectContaining({
        lead_id: testLead.lead_id,
        final_balance_amount: jasmine.any(Number),
        retainer_amount: jasmine.any(Number),
      })
    );
    expect(proposalWorkflow.uploadProposalPdf).toHaveBeenCalledWith(
      jasmine.objectContaining({
        leadId: testLead.lead_id,
        proposalId: draftProposal.floral_proposal_id,
        file: pdfFile,
        idempotencyKey: jasmine.any(String),
        projectId: null,
      })
    );
    expect(proposalWorkflow.submitProposal).toHaveBeenCalledWith(
      jasmine.objectContaining({
        mode: 'initial_booking',
        leadId: testLead.lead_id,
        projectId: null,
        floralProposalId: draftProposal.floral_proposal_id,
        pdfFileName: 'proposal.pdf',
        sendDepositRequest: false,
      })
    );
    expect(toast.showToast).toHaveBeenCalledWith(
      'Project created as Awaiting Deposit. The deposit email was deferred.',
      'success'
    );
    expect(router.navigate).toHaveBeenCalledWith([
      '/admin/projects',
      'project-test-001',
    ]);
    expect(component.submissionModalOpen()).toBeFalse();
    expect(component.saving()).toBeFalse();
  });

  it('flushes and reuses the pending project revision attempt before navigating to project details', async () => {
    createSubmittableComponent();
    const workspace = {
      project_proposal_revision_workspace_id: 'workspace-001', project_id: 'project-test-001',
      baseline_invoice_snapshot_id: 'snapshot-001', source_lead_id: testLead.lead_id,
      schema_version: 2, draft_snapshot: {} as any, subtotal: 100, tax_rate: .08, tax_amount: 8,
      total_amount: 108, retainer_amount: 32.4, final_balance_amount: 108, created_at: '', updated_at: '',
    } as any;
    const pending = {
      ...workspace, pending_submission_key: 'request-001',
      pending_pdf_storage_path: 'projects/project-test-001/proposal-revisions/request-001-revision.pdf',
      pending_pdf_file_name: 'revision.pdf',
    };
    component.activeProjectId.set('project-test-001');
    component.revisionProject.set({ project_id: 'project-test-001', project_name: 'Wedding', service_type: 'wedding', status: 'booked', event_date: testLead.event_date, created_at: '', updated_at: '' } as any);
    component.revisionWorkspace.set(workspace);
    spyOn(component.projectProposalRevision, 'flushAutosave').and.resolveTo(workspace);
    spyOn(component.projectProposalRevision, 'prepareSubmission').and.resolveTo(pending);
    const file = new File(['%PDF-test'], 'revision.pdf', { type: 'application/pdf' });
    component.onSubmissionFileSelected(file);

    await component.submitProposalDocument();

    expect(proposalRepository.createFloralProposal).not.toHaveBeenCalled();
    expect(component.projectProposalRevision.flushAutosave).toHaveBeenCalled();
    expect(component.projectProposalRevision.prepareSubmission).toHaveBeenCalledWith(workspace, 'revision.pdf');
    expect(proposalWorkflow.submitProposal).toHaveBeenCalledWith(jasmine.objectContaining({
      mode: 'project_revision', revisionWorkspaceId: 'workspace-001', baselineSnapshotId: 'snapshot-001',
      idempotencyKey: 'request-001',
    }));
    expect(toast.showToast).toHaveBeenCalledWith('Revised proposal activated.', 'success');
    expect(router.navigate).toHaveBeenCalledWith(['/admin/projects', 'project-test-001']);
  });

  it('keeps a revision when discard is canceled and deletes only after explicit confirmation', async () => {
    createLoadedComponent();
    const workspace = {
      project_proposal_revision_workspace_id: 'workspace-001', project_id: 'project-test-001',
      baseline_invoice_snapshot_id: 'snapshot-001', schema_version: 2, draft_snapshot: {} as any,
      subtotal: 0, tax_rate: 0, tax_amount: 0, total_amount: 0, retainer_amount: 0,
      final_balance_amount: 0, created_at: '', updated_at: '',
    } as any;
    component.activeProjectId.set('project-test-001');
    component.revisionWorkspace.set(workspace);
    const discard = spyOn(component.projectProposalRevision, 'discard').and.resolveTo();
    spyOn(window, 'confirm').and.returnValues(false, true);

    await component.discardRevision();
    expect(discard).not.toHaveBeenCalled();
    expect(component.revisionWorkspace()).toBe(workspace);

    await component.discardRevision();
    expect(discard).toHaveBeenCalledWith(workspace);
    expect(component.revisionWorkspace()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/admin/projects', 'project-test-001']);
  });

  it('reports observable finalization milestones while the modal remains locked', async () => {
    createSubmittableComponent();
    spyOn(window, 'confirm').and.returnValue(true);
    const pdfFile = new File(['%PDF-test'], 'proposal.pdf', {
      type: 'application/pdf',
    });
    proposalRepository.createFloralProposal.and.callFake(async () => {
      expect(component.submissionProgress()).toBe('Saving proposal invoice details...');
      expect(component.saving()).toBeTrue();
      return draftProposal;
    });
    proposalWorkflow.uploadProposalPdf.and.callFake(async () => {
      expect(component.submissionProgress()).toBe('Uploading the signed proposal PDF securely...');
      return { storagePath: 'lead/proposal/proposal.pdf' };
    });
    proposalWorkflow.submitProposal.and.callFake(async () => {
      expect(component.submissionProgress()).toBe('Storing the signed document and booking the project...');
      return {
        project_id: 'project-test-001',
        lead_id: testLead.lead_id,
        floral_proposal_id: draftProposal.floral_proposal_id,
        proposal_document_version_id: 'proposal-document-version-001',
        active_invoice_snapshot_id: 'invoice-snapshot-001',
        signed_pdf_storage_path: 'lead/proposal/proposal.pdf',
        submitted_at: '2026-06-02T12:00:00.000Z',
      };
    });

    await component.finalizeProposal();
    component.onSubmissionFileSelected(pdfFile);
    await component.submitProposalDocument();

    expect(component.submissionModalOpen()).toBeFalse();
    expect(component.submissionProgress()).toBeNull();
    expect(component.saving()).toBeFalse();
  });

  it('validates finalize and submission prerequisites and surfaces submit failures', async () => {
    createLoadedComponent();

    await component.finalizeProposal();
    expect(toast.showToast).toHaveBeenCalledWith(
      'Choose a tax region before finalizing the Floral Proposal.',
      'error'
    );

    component.selectedTaxRegionId.set(taxRegion.tax_region_id);
    await component.finalizeProposal();
    expect(toast.showToast).toHaveBeenCalledWith(
      'Add at least one line item before finalizing the Floral Proposal.',
      'error'
    );

    createSubmittableComponent();
    await component.finalizeProposal();
    await component.submitProposalDocument();

    expect(component.submissionError()).toBe(
      'Upload a valid PDF proposal document before submitting.'
    );

    proposalWorkflow.submitProposal.and.rejectWith(new Error('submit failed'));
    spyOn(window, 'confirm').and.returnValue(true);
    component.onSubmissionFileSelected(
      new File(['%PDF-test'], 'replacement.pdf', {
        type: 'application/pdf',
      })
    );
    await component.submitProposalDocument();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[FloralProposalBuilderComponent] submitProposalDocument error:',
      jasmine.any(Error)
    );
    expect(component.submissionError()).toBe('submit failed');
    expect(component.canEdit()).toBeTrue();
  });

  it('allows declined proposals to return through the single finalization action', async () => {
    createFinalizedComponent({
      status: 'declined',
      snapshot: {
        proposal_status: 'finalized',
      },
    });

    expect(component.canEdit()).toBeTrue();
    await component.finalizeProposal();
    expect(component.submissionModalOpen()).toBeTrue();
  });

  it('uploads, removes, and rejects invalid line-item image interactions', async () => {
    createSubmittableComponent();
    const lineId = component.lineItems()[0].local_id;
    const input = {
      files: [new File(['image'], 'bouquet.jpg', { type: 'image/jpeg' })],
      value: 'C:\\fakepath\\bouquet.jpg',
    } as unknown as HTMLInputElement;

    await component.onLineImageSelected(lineId, { target: input } as unknown as Event);

    expect(proposalWorkflow.uploadLineItemImage).toHaveBeenCalledWith(
      testLead.lead_id,
      lineId,
      jasmine.any(File)
    );
    expect(component.lineItems()[0].image_storage_path).toBe(
      'proposal-images/lead-test-001/line-001.jpg'
    );
    expect(input.value).toBe('');
    expect(toast.showToast).toHaveBeenCalledWith(
      'Line item image uploaded.',
      'success'
    );

    await component.removeLineImage(lineId);

    expect(proposalWorkflow.removeLineItemImage).toHaveBeenCalledWith(
      'proposal-images/lead-test-001/line-001.jpg'
    );
    expect(component.lineItems()[0].image_storage_path).toBeNull();
    expect(toast.showToast).toHaveBeenCalledWith(
      'Line item image removed.',
      'success'
    );

    const dragEvent = buildDragEvent('notes.txt', 'text/plain');
    await component.onLineImageDrop(lineId, dragEvent);

    expect(proposalWorkflow.uploadLineItemImage).toHaveBeenCalledTimes(1);
  });

  it('covers workflow gating, helper formatting, and read-only guard branches', async () => {
    leadRepository.getLeadById.and.resolveTo({
      ...testLead,
      status: 'new',
    });

    createComponent();
    await fixture.whenStable();

    expect(component.error()).toBe(
      'This lead is not ready for Floral Proposal building yet. Complete consultation and move the lead into Nurturing first.'
    );
    expect(component.getProposalStatusTone('expired')).toBe('danger');
    expect(component.getProposalStatusTone('accepted')).toBe('success');
    expect(component.formatCurrency(null)).toBe('$0.00');
    expect(component.formatPercent(null)).toBe('0.00%');
    expect(component.formatDateTime(null)).toBe('Not available');
    expect(component.formatStatusLabel('proposal_submitted')).toBe('Proposal Submitted');
    expect(component.getLineImageFileName(null)).toBe('');
    expect(component.lineHasImage({
      image_storage_path: null,
      image_signed_url: 'https://example.test/image.jpg',
    } as any)).toBeTrue();

    createFinalizedComponent();
    component.lead.set({ ...testLead, status: 'proposal_accepted' });

    await component.saveDraft();
    await component.finalizeProposal();
    await component.submitProposalDocument();

    expect(proposalRepository.createFloralProposal).not.toHaveBeenCalled();
    expect(proposalWorkflow.uploadProposalPdf).not.toHaveBeenCalled();
    expect(proposalWorkflow.submitProposal).not.toHaveBeenCalled();
  });

  it('covers line-item image failure paths', async () => {
    createSubmittableComponent();
    const lineId = component.lineItems()[0].local_id;

    const input = {
      files: [new File(['image'], 'bouquet.jpg', { type: 'image/jpeg' })],
      value: 'C:\\fakepath\\bouquet.jpg',
    } as unknown as HTMLInputElement;

    proposalWorkflow.uploadLineItemImage.and.rejectWith(new Error('upload failed'));
    await component.onLineImageSelected(lineId, { target: input } as unknown as Event);
    expect(toast.showToast).toHaveBeenCalledWith(
      'We were unable to upload the line item image right now.',
      'error'
    );

    component.lineItems.set(
      component.lineItems().map((line) =>
        line.local_id === lineId
          ? {
              ...line,
              image_storage_path: 'proposal-images/lead-test-001/line-001.jpg',
              image_alt_text: 'Bouquet',
              image_caption: null,
              image_signed_url: 'https://example.test/line-001.jpg',
            }
          : line
      )
    );
    proposalWorkflow.removeLineItemImage.and.rejectWith(new Error('remove failed'));
    await component.removeLineImage(lineId);
    expect(toast.showToast).toHaveBeenCalledWith(
      'We were unable to remove the line item image right now.',
      'error'
    );
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(FloralProposalBuilderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function createLoadedComponent(): void {
    createBareComponent();
    component.loading.set(false);
    component.error.set(null);
    component.lead.set({ ...testLead, status: 'nurturing' });
    component.taxRegions.set([taxRegion]);
    component.catalogItems.set([catalogItem]);
    component.proposals.set([]);
    component.activeProposal.set(null);
    component.lineItems.set([]);
    component.shoppingList.set([]);
    component.selectedTaxRegionId.set('');
    component.editModeEnabled.set(false);
    component.submissionModalOpen.set(false);
    component.submissionError.set(null);
    component.submissionFile.set(null);
  }

  function createSubmittableComponent(): void {
    createLoadedComponent();
    createSubmittableState();
  }

  function createSubmittableState(): void {
    component.lineItems.set([]);
    component.selectedTaxRegionId.set(taxRegion.tax_region_id);
    component.addLineItem();
    const lineId = component.lineItems()[0].local_id;
    component.updateLineName(lineId, 'Bridal Bouquet');
    component.addComponentRow(lineId);
    const componentId = component.lineItems()[0].components[0].local_id;
    component.replaceCatalogItem(lineId, componentId, catalogItem.item_id);
    component.updateComponentQuantity(lineId, componentId, '5');
  }

  function createFinalizedComponent(
    overrides: Partial<FloralProposal> = {}
  ): void {
    createSubmittableComponent();
    const finalizedProposal: FloralProposal = {
      ...draftProposal,
      floral_proposal_id: 'proposal-finalized-001',
      status: 'draft',
      snapshot: {
        proposal_status: 'finalized',
        default_markup_percent: 300,
        labor_percent: 0,
      },
      ...overrides,
    };
    component.proposals.set([finalizedProposal]);
    component.activeProposal.set(finalizedProposal);
    component.editModeEnabled.set(false);
    component.submissionModalOpen.set(false);
    component.submissionError.set(null);
    component.submissionFile.set(null);
  }

  function createBareComponent(): void {
    fixture = TestBed.createComponent(FloralProposalBuilderComponent);
    component = fixture.componentInstance;
  }

  function buildDragEvent(fileName: string, type: string): DragEvent {
    return {
      preventDefault: jasmine.createSpy('preventDefault'),
      stopPropagation: jasmine.createSpy('stopPropagation'),
      dataTransfer: {
        files: [new File(['content'], fileName, { type })],
      },
    } as unknown as DragEvent;
  }

  function text(): string {
    return fixture.nativeElement.textContent.replace(/\s+/g, ' ').trim();
  }

  function renderLoadedFixture(): void {
    fixture.detectChanges();
    component.loading.set(false);
    component.error.set(null);
    component.lead.set({ ...testLead, status: 'nurturing' });
    fixture.detectChanges();
  }
});

