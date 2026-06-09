import { TestBed } from '@angular/core/testing';

import { testFloralProposal, testLead } from '../../testing/workflow-fixtures';
import { SupabaseService } from '../clients/supabase.service';
import { FloralProposalRepositoryService } from '../repositories/floral-proposal-repository.service';
import { FloralProposalRenderPayload } from './floral-proposal-builder.service';
import {
  FloralProposalWorkflowService,
  SubmitFloralProposalPayload,
} from './floral-proposal-workflow.service';

describe('FloralProposalWorkflowService', () => {
  let service: FloralProposalWorkflowService;
  let repository: jasmine.SpyObj<FloralProposalRepositoryService>;
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

  beforeEach(() => {
    repository = jasmine.createSpyObj<FloralProposalRepositoryService>(
      'FloralProposalRepositoryService',
      ['getLeadFloralProposals', 'clearLineItemImage']
    );

    storageApi.createSignedUrl.calls.reset();
    storageApi.upload.calls.reset();
    storageApi.remove.calls.reset();
    client.storage.from.calls.reset();
    client.functions.invoke.calls.reset();
    client.storage.from.and.returnValue(storageApi);
    storageFromSpy = client.storage.from;
    functionsInvokeSpy = client.functions.invoke;

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

  it('builds manual submission payloads with finalized snapshot metadata and product components', () => {
    const payload = service.buildManualSubmissionPayload({
      lead: testLead,
      proposal: {
        ...testFloralProposal,
        floral_proposal_id: 'proposal-test-001',
        version: 2,
      },
      renderPayload,
      pdfBase64: 'JVBERi0=',
      pdfFileName: 'proposal.pdf',
      termsVersion: 'terms-2026-06',
      privacyPolicyVersion: 'privacy-2026-06',
    });

    expect(payload).toEqual(
      jasmine.objectContaining({
        floral_proposal_id: 'proposal-test-001',
        lead_id: testLead.lead_id,
        tax_region_id: 'tax-region-test-001',
        subtotal: 770,
        tax_rate: 0.08,
        tax_amount: 61.6,
        total_amount: 831.6,
        terms_version: 'terms-2026-06',
        privacy_policy_version: 'privacy-2026-06',
        pdf_base64: 'JVBERi0=',
        pdf_file_name: 'proposal.pdf',
      })
    );
    expect(payload.line_items[0].components?.length).toBe(1);
    expect(payload.line_items[1].components).toEqual([]);
    expect(payload.snapshot).toEqual(
      jasmine.objectContaining({
        proposal_status: 'finalized',
        proposal_version: 2,
        tax_region_name: 'Austin Test Tax',
      })
    );
    expect(payload).not.toEqual(jasmine.objectContaining({
      render_contract: jasmine.anything(),
    } as any));
  });

  it('builds finalized and reopened proposal snapshots for the builder workflow', () => {
    const finalizedSnapshot = service.buildProposalSnapshot({
      renderPayload,
      proposalStatus: 'finalized',
      existingSnapshot: {
        finalized_at: '2026-06-02T12:00:00.000Z',
      },
      lifecycle: {
        finalizedAt: '2026-06-02T12:00:00.000Z',
      },
    });
    const reopenedSnapshot = service.buildEditableProposalSnapshot(
      finalizedSnapshot,
      '2026-06-02T13:00:00.000Z'
    );

    expect(service.resolveStoredProposalStatus('finalized')).toBe('draft');
    expect(finalizedSnapshot).toEqual(
      jasmine.objectContaining({
        proposal_status: 'finalized',
        finalized_at: '2026-06-02T12:00:00.000Z',
        tax_region_id: 'tax-region-test-001',
      })
    );
    expect(reopenedSnapshot).toEqual(
      jasmine.objectContaining({
        proposal_status: 'draft',
        finalized_at: '2026-06-02T12:00:00.000Z',
        edit_reopened_at: '2026-06-02T13:00:00.000Z',
      })
    );
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
