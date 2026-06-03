import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';

import { CatalogItem } from '../../../core/models/catalog-item';
import {
  DocumentTemplate,
  FloralProposal,
  FloralProposalRenderContract,
} from '../../../core/models/floral-proposal';
import { TaxRegion } from '../../../core/models/tax-region';
import { ToastService } from '../../../core/services/toast.service';
import { CrmThemeService } from '../../../core/services/crm-theme.service';
import { ActivityRepositoryService } from '../../../core/supabase/repositories/activity-repository.service';
import { CatalogItemRepositoryService } from '../../../core/supabase/repositories/catalog-item-repository.service';
import { DocumentTemplateRepositoryService } from '../../../core/supabase/repositories/document-template-repository.service';
import { FloralProposalRepositoryService } from '../../../core/supabase/repositories/floral-proposal-repository.service';
import { LeadRepositoryService } from '../../../core/supabase/repositories/lead-repository.service';
import { TaxRegionRepositoryService } from '../../../core/supabase/repositories/tax-region-repository.service';
import { FloralProposalWorkflowService } from '../../../core/supabase/services/floral-proposal-workflow.service';
import { FloralProposalRendererService } from '../../../core/supabase/services/floral-proposal-renderer.service';
import {
  testFloralProposal,
  testLead,
  testRenderContract,
} from '../../../core/testing/workflow-fixtures';
import { FloralProposalBuilderComponent } from './floral-proposal-builder.component';

describe('FloralProposalBuilderComponent', () => {
  let component: FloralProposalBuilderComponent;
  let fixture: ComponentFixture<FloralProposalBuilderComponent>;
  let routeParamMap = convertToParamMap({ leadId: testLead.lead_id });
  let leadRepository: jasmine.SpyObj<LeadRepositoryService>;
  let taxRegionRepository: jasmine.SpyObj<TaxRegionRepositoryService>;
  let templateRepository: jasmine.SpyObj<DocumentTemplateRepositoryService>;
  let proposalRepository: jasmine.SpyObj<FloralProposalRepositoryService>;
  let catalogRepository: jasmine.SpyObj<CatalogItemRepositoryService>;
  let activityRepository: jasmine.SpyObj<ActivityRepositoryService>;
  let proposalWorkflow: jasmine.SpyObj<FloralProposalWorkflowService>;
  let proposalRenderer: jasmine.SpyObj<FloralProposalRendererService>;
  let toast: jasmine.SpyObj<ToastService>;
  let router: jasmine.SpyObj<Router>;
  let consoleErrorSpy: jasmine.Spy;

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

  const template: DocumentTemplate = {
    template_id: 'template-test-001',
    template_key: 'test-template',
    name: 'Test Template',
    description: 'Synthetic proposal template.',
    renderer_key: 'wedding-full-service',
    template_kind: 'floral_proposal',
    is_default: false,
    template_config: {},
    content: {},
    is_active: true,
    created_at: '2026-06-02T12:00:00.000Z',
    updated_at: '2026-06-02T12:00:00.000Z',
  } as DocumentTemplate;

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
    template_id: template.template_id,
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
    templateRepository = jasmine.createSpyObj<DocumentTemplateRepositoryService>(
      'DocumentTemplateRepositoryService',
      ['getDocumentTemplates']
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
        'createRenderContract',
        'buildSubmissionPayload',
        'previewProposalPdf',
        'submitProposal',
        'uploadLineItemImage',
        'removeLineItemImage',
        'getSignedLineItemImageUrl',
        'clearMissingLineItemImage',
      ]
    );
    proposalRenderer = jasmine.createSpyObj<FloralProposalRendererService>(
      'FloralProposalRendererService',
      ['renderHtml']
    );
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['showToast']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);

    leadRepository.getLeadById.and.resolveTo({
      ...testLead,
      status: 'nurturing',
    });
    taxRegionRepository.getTaxRegions.and.resolveTo([
      taxRegion,
      { ...taxRegion, tax_region_id: 'inactive-tax', is_active: false },
    ]);
    templateRepository.getDocumentTemplates.and.resolveTo([
      template,
      { ...template, template_id: 'inactive-template', is_active: false },
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
    proposalWorkflow.createRenderContract.and.resolveTo(testRenderContract);
    proposalWorkflow.buildSubmissionPayload.and.returnValue({ payload: 'submission' } as any);
    proposalWorkflow.previewProposalPdf.and.resolveTo({
      pdfBase64: 'JVBERi0=',
      objectUrl: 'blob:proposal-preview',
    });
    proposalWorkflow.submitProposal.and.resolveTo({
      version: 3,
    } as any);
    proposalWorkflow.uploadLineItemImage.and.resolveTo({
      storagePath: 'proposal-images/lead-test-001/line-001.jpg',
      signedUrl: 'https://example.test/line-001.jpg',
    });
    proposalWorkflow.removeLineItemImage.and.resolveTo(undefined);
    proposalWorkflow.getSignedLineItemImageUrl.and.resolveTo('https://example.test/signed.jpg');
    proposalRenderer.renderHtml.and.returnValue('<html><body>Proposal</body></html>');

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
            },
          },
        },
        { provide: Router, useValue: router },
        { provide: LeadRepositoryService, useValue: leadRepository },
        { provide: TaxRegionRepositoryService, useValue: taxRegionRepository },
        { provide: DocumentTemplateRepositoryService, useValue: templateRepository },
        { provide: FloralProposalRepositoryService, useValue: proposalRepository },
        { provide: CatalogItemRepositoryService, useValue: catalogRepository },
        { provide: ActivityRepositoryService, useValue: activityRepository },
        { provide: FloralProposalWorkflowService, useValue: proposalWorkflow },
        { provide: FloralProposalRendererService, useValue: proposalRenderer },
        { provide: ToastService, useValue: toast },
        {
          provide: CrmThemeService,
          useValue: {
            mode: signal<'light' | 'dark'>('light'),
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
    expect(component.templates().map((item) => item.template_id)).toEqual([
      template.template_id,
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

    component.updateCatalogItemQuery(lineId, componentId, 'Blush Juliet Garden Rose');
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

  it('saves drafts through repositories, activity logging, toast feedback, and reload', async () => {
    createSubmittableComponent();

    await component.saveDraft();

    expect(proposalRepository.createFloralProposal).toHaveBeenCalledWith(
      jasmine.objectContaining({
        lead_id: testLead.lead_id,
        template_id: template.template_id,
        tax_region_id: taxRegion.tax_region_id,
        status: 'draft',
      })
    );
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

  it('previews and submits proposals with persisted PDF payload state', async () => {
    createSubmittableComponent();

    await component.openPreview();

    expect(component.previewOpen()).toBeTrue();
    expect(component.previewLoading()).toBeFalse();
    expect(component.previewContract()).toEqual(testRenderContract);
    expect(component.previewPdfBase64()).toBe('JVBERi0=');
    expect(component.previewPdfObjectUrl()).toBe('blob:proposal-preview');
    expect(proposalWorkflow.previewProposalPdf).toHaveBeenCalledWith({
      payload: 'submission',
    } as any);

    createSubmittableState();
    await component.submitFloralProposal();

    expect(proposalWorkflow.submitProposal).toHaveBeenCalledWith(
      jasmine.objectContaining({
        payload: 'submission',
        pdf_base64: 'JVBERi0=',
      })
    );
    expect(toast.showToast).toHaveBeenCalledWith(
      'Floral Proposal v3 submitted successfully.',
      'success'
    );
    expect(component.previewOpen()).toBeFalse();
    expect(component.saving()).toBeFalse();
  });

  it('validates submit prerequisites and resets preview state on preview failure', async () => {
    createLoadedComponent();

    await component.submitFloralProposal();
    expect(toast.showToast).toHaveBeenCalledWith(
      'Choose a Floral Proposal template before submitting.',
      'error'
    );

    createSubmittableState();
    proposalWorkflow.previewProposalPdf.and.rejectWith(new Error('render failed'));
    await component.openPreview();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[FloralProposalBuilderComponent] openPreview error:',
      jasmine.any(Error)
    );
    expect(component.previewOpen()).toBeFalse();
    expect(component.previewPdfBase64()).toBeNull();
    expect(toast.showToast).toHaveBeenCalledWith(
      'We were unable to prepare the Floral Proposal preview right now.',
      'error'
    );
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

  it('exports printable proposal HTML and guards empty exports', () => {
    const printSpy = jasmine.createSpy('print');
    const printWindow = {
      document: {
        open: jasmine.createSpy('open'),
        write: jasmine.createSpy('write'),
        close: jasmine.createSpy('close'),
      },
      focus: jasmine.createSpy('focus'),
      print: printSpy,
    };
    spyOn(window, 'open').and.returnValue(printWindow as any);
    jasmine.clock().install();

    try {
      createLoadedComponent();
      component.exportFloralProposalPdf();
      expect(toast.showToast).toHaveBeenCalledWith(
        'Add line items before exporting the Floral Proposal.',
        'error'
      );

      createSubmittableState();
      component.exportFloralProposalPdf();
      jasmine.clock().tick(251);

      expect(window.open).toHaveBeenCalled();
      expect(printWindow.document.write).toHaveBeenCalledWith(
        '<html><body>Proposal</body></html>'
      );
      expect(printSpy).toHaveBeenCalled();
    } finally {
      jasmine.clock().uninstall();
    }
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

    createLoadedComponent();
    component.lead.set({ ...testLead, status: 'proposal_accepted' });

    await component.saveDraft();
    await component.openPreview();
    await component.submitFloralProposal();

    expect(proposalRepository.createFloralProposal).not.toHaveBeenCalled();
    expect(proposalWorkflow.previewProposalPdf).not.toHaveBeenCalled();
    expect(proposalWorkflow.submitProposal).not.toHaveBeenCalled();
  });

  it('covers missing submit prerequisites and proposal submission failure', async () => {
    createLoadedComponent();
    component.selectedTemplateId.set(template.template_id);
    component.addLineItem();
    component.updateLineName(component.lineItems()[0].local_id, 'Bouquet');

    await component.submitFloralProposal();
    expect(toast.showToast).toHaveBeenCalledWith(
      'Choose a tax region before submitting.',
      'error'
    );

    createSubmittableState();
    proposalWorkflow.submitProposal.and.rejectWith(new Error('submit failed'));
    await component.submitFloralProposal();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[FloralProposalBuilderComponent] submitFloralProposal error:',
      jasmine.any(Error)
    );
    expect(toast.showToast).toHaveBeenCalledWith(
      'We were unable to submit the Floral Proposal right now.',
      'error'
    );
  });

  it('covers export popup failure and line-item image failure paths', async () => {
    createSubmittableComponent();
    const lineId = component.lineItems()[0].local_id;

    spyOn(window, 'open').and.returnValue(null);
    component.exportFloralProposalPdf();
    expect(toast.showToast).toHaveBeenCalledWith(
      'We were unable to open the Floral Proposal export window.',
      'error'
    );

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
    component.templates.set([template]);
    component.catalogItems.set([catalogItem]);
    component.proposals.set([]);
    component.activeProposal.set(null);
    component.lineItems.set([]);
    component.shoppingList.set([]);
  }

  function createSubmittableComponent(): void {
    createLoadedComponent();
    createSubmittableState();
  }

  function createSubmittableState(): void {
    component.lineItems.set([]);
    component.selectedTemplateId.set(template.template_id);
    component.selectedTaxRegionId.set(taxRegion.tax_region_id);
    component.addLineItem();
    const lineId = component.lineItems()[0].local_id;
    component.updateLineName(lineId, 'Bridal Bouquet');
    component.addComponentRow(lineId);
    const componentId = component.lineItems()[0].components[0].local_id;
    component.updateCatalogItemQuery(lineId, componentId, 'Blush Juliet Garden Rose');
    component.updateComponentQuantity(lineId, componentId, '5');
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
});
