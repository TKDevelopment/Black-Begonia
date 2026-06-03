import { TestBed } from '@angular/core/testing';

import {
  DocumentTemplate,
  FloralProposalRenderContract,
} from '../../models/floral-proposal';
import { testFloralProposal, testLead } from '../../testing/workflow-fixtures';
import { ProposalTemplateDocumentService } from '../../proposal-templates/proposal-template-document.service';
import { SupabaseService } from '../clients/supabase.service';
import { FloralProposalRepositoryService } from '../repositories/floral-proposal-repository.service';
import { DocumentTemplateService } from './document-template.service';
import { FloralProposalRenderPayload } from './floral-proposal-builder.service';
import { FloralProposalRendererService } from './floral-proposal-renderer.service';
import {
  FloralProposalWorkflowService,
  SubmitFloralProposalPayload,
} from './floral-proposal-workflow.service';

describe('FloralProposalWorkflowService', () => {
  let service: FloralProposalWorkflowService;
  let repository: jasmine.SpyObj<FloralProposalRepositoryService>;
  let renderer: jasmine.SpyObj<FloralProposalRendererService>;
  let templateDocumentService: jasmine.SpyObj<ProposalTemplateDocumentService>;
  let documentTemplateService: jasmine.SpyObj<DocumentTemplateService>;
  let storageFromSpy: jasmine.Spy;
  let functionsInvokeSpy: jasmine.Spy;

  const storageApi = {
    createSignedUrl: jasmine.createSpy('createSignedUrl'),
    upload: jasmine.createSpy('upload'),
    remove: jasmine.createSpy('remove'),
  };

  const client = {
    storage: {
      from: jasmine.createSpy('from'),
    },
    functions: {
      invoke: jasmine.createSpy('invoke'),
    },
  };

  const renderPayload: FloralProposalRenderPayload = {
    template_id: 'template-test-001',
    template_name: 'Editorial Test',
    tax_region_id: 'tax-region-test-001',
    tax_region_name: 'Austin Test Tax',
    tax_rate: 0.08,
    default_markup_percent: 30,
    labor_percent: 20,
    line_items: [
      {
        display_order: 0,
        line_item_type: 'product',
        line_type_label: 'Product',
        item_name: 'Ceremony Meadow',
        description: 'Lush aisle florals',
        quantity: 2,
        unit_price: 300,
        subtotal: 600,
        image_storage_path: 'lead-test-001/line-test-001/meadow.jpg',
        image_signed_url: null,
        image_alt_text: 'Ceremony meadow',
        image_caption: 'A meadow arrangement',
        components: [
          {
            local_id: 'component-test-001',
            display_order: 0,
            catalog_item_id: 'catalog-rose-001',
            catalog_item_name: 'Garden Rose',
            quantity_per_unit: 10,
            extended_quantity: 20,
            base_unit_cost: 3,
            applied_markup_percent: 50,
            sell_unit_price: 4.5,
            subtotal: 45,
            reserve_percent: 10,
            pack_quantity: 10,
            purchase_unit_cost: 30,
            item_type: 'flower',
            unit_type: 'bunch',
            color: 'Blush',
            variety: 'Juliet',
            snapshot: { sku: 'ROSE-JULIET' },
          },
        ],
      },
      {
        display_order: 1,
        line_item_type: 'fee',
        line_type_label: 'Fee',
        item_name: 'Delivery',
        description: null,
        quantity: 1,
        unit_price: 50,
        subtotal: 50,
        image_storage_path: null,
        image_signed_url: null,
        image_alt_text: null,
        image_caption: null,
        components: [],
      },
    ],
    shopping_list: [
      {
        catalog_item_id: 'catalog-rose-001',
        item_name: 'Garden Rose',
        item_type: 'flower',
        unit_type: 'bunch',
        required_units: 20,
        reserve_percent: 10,
        reserve_units: 10,
        total_units_to_buy: 30,
      },
    ],
    totals: {
      subtotal: 770,
      taxAmount: 61.6,
      totalAmount: 831.6,
    },
    breakdown: {
      productsTotal: 600,
      laborTotal: 120,
      calculatedLaborAmount: 120,
      manualLaborTotal: 0,
      feesTotal: 50,
      discountsTotal: 0,
      subtotal: 770,
      taxAmount: 61.6,
      totalAmount: 831.6,
    },
  };

  const template: DocumentTemplate = {
    template_id: 'template-test-001',
    name: 'Editorial Test',
    template_key: 'wedding-full-service',
    template_kind: 'floral_proposal',
    is_active: true,
    is_default: true,
    logo_storage_path: 'logos/test-logo.png',
    logo_url: null,
    template_config: {},
    created_at: '2026-06-02T12:00:00.000Z',
    updated_at: '2026-06-02T12:00:00.000Z',
  };

  beforeEach(() => {
    repository = jasmine.createSpyObj<FloralProposalRepositoryService>(
      'FloralProposalRepositoryService',
      ['getLeadFloralProposals', 'clearLineItemImage']
    );
    renderer = jasmine.createSpyObj<FloralProposalRendererService>(
      'FloralProposalRendererService',
      ['renderHtml']
    );
    templateDocumentService = jasmine.createSpyObj<ProposalTemplateDocumentService>(
      'ProposalTemplateDocumentService',
      [
        'getPublishedDocument',
        'getStoredConfig',
        'applyResolvedAssetUrlsToConfig',
        'buildTemplateConfig',
      ]
    );
    documentTemplateService = jasmine.createSpyObj<DocumentTemplateService>(
      'DocumentTemplateService',
      ['refreshTemplateAssets']
    );

    storageApi.createSignedUrl.calls.reset();
    storageApi.upload.calls.reset();
    storageApi.remove.calls.reset();
    client.storage.from.calls.reset();
    client.functions.invoke.calls.reset();
    client.storage.from.and.returnValue(storageApi);
    storageFromSpy = client.storage.from;
    functionsInvokeSpy = client.functions.invoke;

    renderer.renderHtml.and.returnValue('<html>proposal</html>');
    templateDocumentService.getPublishedDocument.and.returnValue({
      id: 'document-test-001',
      name: 'Editorial Test',
      serviceType: 'wedding',
      status: 'published',
      pagePreset: 'letter',
      pages: [],
      theme: {
        primaryColor: '#111111',
        accentColor: '#cc8899',
        canvasColor: '#f8f8f8',
        pageColor: '#ffffff',
        borderColor: '#dddddd',
        mutedColor: '#777777',
        headingFontFamily: 'Playfair Display',
        bodyFontFamily: 'Inter',
      },
      metadata: {
        createdWith: 'proposal-scene-editor',
        version: 1,
        updatedAt: '2026-06-02T12:00:00.000Z',
      },
    });
    templateDocumentService.getStoredConfig.and.returnValue(null);

    TestBed.configureTestingModule({
      providers: [
        FloralProposalWorkflowService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => client,
          },
        },
        { provide: FloralProposalRepositoryService, useValue: repository },
        { provide: FloralProposalRendererService, useValue: renderer },
        { provide: ProposalTemplateDocumentService, useValue: templateDocumentService },
        { provide: DocumentTemplateService, useValue: documentTemplateService },
      ],
    });

    service = TestBed.inject(FloralProposalWorkflowService);
  });

  it('loads lead proposals and signs stored proposal PDFs', async () => {
    repository.getLeadFloralProposals.and.resolveTo([
      { ...testFloralProposal, pdf_storage_path: 'proposal-pdfs/test.pdf' },
      {
        ...testFloralProposal,
        floral_proposal_id: 'proposal-url-only-001',
        pdf_storage_path: null,
        pdf_url: 'https://example.test/proposal.pdf',
      },
    ]);
    storageApi.createSignedUrl.and.resolveTo({
      data: { signedUrl: 'https://signed.example.test/test.pdf' },
      error: null,
    });

    const proposals = await service.getLeadProposals(testLead.lead_id);

    expect(repository.getLeadFloralProposals).toHaveBeenCalledWith(testLead.lead_id);
    expect(storageFromSpy).toHaveBeenCalledWith('floral-proposals');
    expect(storageApi.createSignedUrl).toHaveBeenCalledWith('proposal-pdfs/test.pdf', 3600);
    expect(proposals[0].signed_url).toBe('https://signed.example.test/test.pdf');
    expect(proposals[1].signed_url).toBe('https://example.test/proposal.pdf');
  });

  it('falls back to existing proposal PDF URLs when signing fails', async () => {
    spyOn(console, 'error');
    repository.getLeadFloralProposals.and.resolveTo([
      {
        ...testFloralProposal,
        pdf_storage_path: 'proposal-pdfs/test.pdf',
        pdf_url: 'https://example.test/fallback.pdf',
      },
    ]);
    storageApi.createSignedUrl.and.resolveTo({
      data: null,
      error: { message: 'storage failed' },
    });

    const proposals = await service.getLeadProposals(testLead.lead_id);

    expect(proposals[0].signed_url).toBe('https://example.test/fallback.pdf');
    expect(console.error).toHaveBeenCalled();
  });

  it('allows proposal submission only for nurturing or previously declined proposal leads', () => {
    expect(service.canSubmitProposal('nurturing')).toBeTrue();
    expect(service.canSubmitProposal('proposal_declined')).toBeTrue();
    expect(service.canSubmitProposal('new')).toBeFalse();
    expect(service.canSubmitProposal('converted')).toBeFalse();
  });

  it('uploads line item images using sanitized names and signed previews', async () => {
    spyOn(Date, 'now').and.returnValue(123456);
    storageApi.upload.and.resolveTo({ error: null });
    storageApi.createSignedUrl.and.resolveTo({
      data: { signedUrl: 'https://signed.example.test/image.jpg' },
      error: null,
    });
    const file = new File(['image'], ' Ceremony  Meadow.JPG ', {
      type: 'image/jpeg',
    });

    const result = await service.uploadLineItemImage('lead-001', 'line-001', file);

    expect(storageFromSpy).toHaveBeenCalledWith('floral-proposal-line-items');
    expect(storageApi.upload).toHaveBeenCalledWith(
      'lead-001/line-001/123456-ceremony-meadow.jpg',
      file,
      { cacheControl: '3600', upsert: false }
    );
    expect(result).toEqual({
      storagePath: 'lead-001/line-001/123456-ceremony-meadow.jpg',
      signedUrl: 'https://signed.example.test/image.jpg',
    });
  });

  it('throws friendly errors for upload and line item image removal failures', async () => {
    spyOn(console, 'error');
    storageApi.upload.and.resolveTo({ error: { message: 'upload failed' } });
    storageApi.remove.and.resolveTo({ error: { message: 'remove failed' } });

    await expectAsync(
      service.uploadLineItemImage(
        'lead-001',
        'line-001',
        new File(['image'], 'image.jpg')
      )
    ).toBeRejectedWithError('We could not upload the line item image right now.');
    await expectAsync(
      service.removeLineItemImage('lead-001/line-001/image.jpg')
    ).toBeRejectedWithError('We could not remove the line item image right now.');

    expect(console.error).toHaveBeenCalled();
  });

  it('normalizes signed image paths and clears missing image references', async () => {
    storageApi.createSignedUrl.and.resolveTo({
      data: { signedUrl: 'https://signed.example.test/normalized.jpg' },
      error: null,
    });
    repository.clearLineItemImage.and.resolveTo();

    const signedUrl = await service.getSignedLineItemImageUrl(
      'https://example.test/storage/v1/object/public/floral-proposal-line-items/lead-001/line-001/image.jpg'
    );
    await service.clearMissingLineItemImage('line-item-001');

    expect(storageApi.createSignedUrl).toHaveBeenCalledWith(
      'lead-001/line-001/image.jpg',
      3600
    );
    expect(signedUrl).toBe('https://signed.example.test/normalized.jpg');
    expect(repository.clearLineItemImage).toHaveBeenCalledWith('line-item-001');
  });

  it('returns null for missing signed line item images when allowed', async () => {
    storageApi.createSignedUrl.and.resolveTo({
      data: null,
      error: { message: 'Object not found' },
    });

    await expectAsync(
      service.getSignedLineItemImageUrl('missing/image.jpg')
    ).toBeResolvedTo(null);
  });

  it('submits proposals through the edge function with a portal URL', async () => {
    functionsInvokeSpy.and.resolveTo({
      data: {
        success: true,
        floral_proposal_id: 'proposal-submitted-001',
        version: 3,
      },
      error: null,
    });

    const result = await service.submitProposal(minimalSubmissionPayload());

    expect(functionsInvokeSpy).toHaveBeenCalledWith('submit-floral-proposal', {
      body: jasmine.objectContaining({
        lead_id: testLead.lead_id,
        portal_url: jasmine.stringMatching(/\/proposal\/auth$/),
      }),
    });
    expect(result).toEqual({
      floral_proposal_id: 'proposal-submitted-001',
      version: 3,
    });
  });

  it('throws friendly errors when submit and resend edge functions fail', async () => {
    spyOn(console, 'error');
    functionsInvokeSpy.and.resolveTo({
      data: null,
      error: { message: 'function failed' },
    });

    await expectAsync(
      service.submitProposal(minimalSubmissionPayload())
    ).toBeRejectedWithError('We could not submit the Floral Proposal right now.');
    await expectAsync(
      service.resendProposalAccessEmail('proposal-test-001')
    ).toBeRejectedWithError('We could not resend Floral Proposal access right now.');

    expect(console.error).toHaveBeenCalled();
  });

  it('previews proposal PDFs from base64 responses and rejects invalid responses', async () => {
    spyOn(URL, 'createObjectURL').and.returnValue('blob:proposal-preview');
    functionsInvokeSpy.and.resolveTo({
      data: {
        success: true,
        pdf_base64: btoa('%PDF-test'),
      },
      error: null,
    });

    const preview = await service.previewProposalPdf(minimalSubmissionPayload());

    expect(functionsInvokeSpy).toHaveBeenCalledWith('preview-floral-proposal-pdf', {
      body: minimalSubmissionPayload(),
    });
    expect(preview.objectUrl).toBe('blob:proposal-preview');
    expect(preview.pdfBase64).toBe(btoa('%PDF-test'));

    functionsInvokeSpy.and.resolveTo({
      data: { success: false, error: 'Preview failed.' },
      error: null,
    });
    await expectAsync(
      service.previewProposalPdf(minimalSubmissionPayload())
    ).toBeRejectedWithError('Preview failed.');
  });

  it('resends proposal access emails and rejects missing proposal ids', async () => {
    functionsInvokeSpy.and.resolveTo({
      data: { success: true },
      error: null,
    });

    await service.resendProposalAccessEmail('proposal-test-001');

    expect(functionsInvokeSpy).toHaveBeenCalledWith('resend-floral-proposal-email', {
      body: jasmine.objectContaining({
        floral_proposal_id: 'proposal-test-001',
        portal_url: jasmine.stringMatching(/\/proposal\/auth$/),
      }),
    });
    await expectAsync(
      service.resendProposalAccessEmail('')
    ).toBeRejectedWithError('A Floral Proposal is required to resend access.');
  });

  it('creates render contracts with hydrated template, signed assets, totals, and renderer asset metadata', async () => {
    storageApi.createSignedUrl.and.resolveTo({
      data: { signedUrl: 'https://signed.example.test/asset.jpg' },
      error: null,
    });

    const contract = await service.createRenderContract({
      lead: testLead,
      proposal: testFloralProposal,
      template,
      taxRegion: {
        tax_region_id: 'tax-region-test-001',
        name: 'Austin Test Tax',
        tax_rate: 0.08,
        applies_to_products: true,
        applies_to_services: true,
        applies_to_delivery: true,
        is_active: true,
        created_at: '2026-06-02T12:00:00.000Z',
        updated_at: '2026-06-02T12:00:00.000Z',
      },
      renderPayload,
    });

    expect(contract.proposal_id).toBe(testFloralProposal.floral_proposal_id);
    expect(contract.lead).toEqual(
      jasmine.objectContaining({
        lead_id: testLead.lead_id,
        first_name: testLead.first_name,
        email: testLead.email,
        ceremony_venue_name: testLead.ceremony_venue_name,
      })
    );
    expect(contract.template).toEqual(
      jasmine.objectContaining({
        template_id: template.template_id,
        name: template.name,
        renderer_key: 'wedding-full-service',
        logo_url: 'https://signed.example.test/asset.jpg',
        primary_color: '#111111',
        accent_color: '#cc8899',
      })
    );
    expect(contract.line_items[0].image_signed_url).toBe(
      'https://signed.example.test/asset.jpg'
    );
    expect(contract.totals).toEqual({
      products_total: 600,
      labor_total: 120,
      fees_total: 50,
      discounts_total: 0,
      subtotal: 770,
      tax_amount: 61.6,
      total_amount: 831.6,
    });
    expect(contract.renderer_assets.line_item_images[0]).toEqual(
      jasmine.objectContaining({
        display_order: 0,
        item_name: 'Ceremony Meadow',
        signed_url: 'https://signed.example.test/asset.jpg',
      })
    );
  });

  it('builds submission payloads with rendered HTML, terms, privacy versions, and product components', () => {
    const contract: FloralProposalRenderContract = {
      proposal_id: 'proposal-test-001',
      proposal_version: 2,
      generated_at: '2026-06-02T12:00:00.000Z',
      lead: {
        lead_id: testLead.lead_id,
        first_name: testLead.first_name,
        last_name: testLead.last_name,
        email: testLead.email,
        service_type: testLead.service_type,
        status: testLead.status,
      },
      template: {
        template_id: 'template-test-001',
        name: 'Editorial Test',
      },
      tax_region: {
        tax_region_id: 'tax-region-test-001',
        name: 'Austin Test Tax',
        tax_rate: 0.08,
      },
      pricing: {
        default_markup_percent: 30,
        labor_percent: 20,
      },
      line_items: [
        {
          display_order: 0,
          line_item_type: 'product',
          line_type_label: 'Product',
          item_name: 'Ceremony Meadow',
          description: 'Lush aisle florals',
          quantity: 2,
          unit_price: 300,
          subtotal: 600,
          image_storage_path: 'proposal-images/meadow.jpg',
          image_alt_text: 'Ceremony meadow',
          image_caption: 'A meadow arrangement',
          components: [
            {
              display_order: 0,
              catalog_item_id: 'catalog-rose-001',
              catalog_item_name: 'Garden Rose',
              quantity_per_unit: 10,
              extended_quantity: 20,
              base_unit_cost: 3,
              applied_markup_percent: 50,
              sell_unit_price: 4.5,
              subtotal: 45,
              reserve_percent: 10,
              snapshot: { sku: 'ROSE-JULIET' },
            },
          ],
        },
        {
          display_order: 1,
          line_item_type: 'fee',
          line_type_label: 'Fee',
          item_name: 'Delivery',
          quantity: 1,
          unit_price: 50,
          subtotal: 50,
          components: [],
        },
      ],
      shopping_list: renderPayload.shopping_list,
      totals: {
        products_total: 600,
        labor_total: 120,
        fees_total: 50,
        discounts_total: 0,
        subtotal: 770,
        tax_amount: 61.6,
        total_amount: 831.6,
      },
      renderer_assets: {
        line_item_images: [],
      },
    };

    const payload = service.buildSubmissionPayload({
      lead: testLead,
      renderContract: contract,
      termsVersion: 'terms-2026-06',
      privacyPolicyVersion: 'privacy-2026-06',
    });

    expect(payload).toEqual(
      jasmine.objectContaining({
        floral_proposal_id: 'proposal-test-001',
        lead_id: testLead.lead_id,
        template_id: 'template-test-001',
        tax_region_id: 'tax-region-test-001',
        subtotal: 770,
        tax_rate: 0.08,
        tax_amount: 61.6,
        total_amount: 831.6,
        terms_version: 'terms-2026-06',
        privacy_policy_version: 'privacy-2026-06',
        render_html: '<html>proposal</html>',
      })
    );
    expect(payload.line_items[0].components?.length).toBe(1);
    expect(payload.line_items[1].components).toEqual([]);
    expect(payload.snapshot).toEqual({ render_contract: contract });
    expect(renderer.renderHtml).toHaveBeenCalledWith(contract);
  });

  function minimalSubmissionPayload(): SubmitFloralProposalPayload {
    return {
      lead_id: testLead.lead_id,
      line_items: [],
      subtotal: 100,
      tax_rate: 0.08,
      tax_amount: 8,
      total_amount: 108,
    };
  }
});
