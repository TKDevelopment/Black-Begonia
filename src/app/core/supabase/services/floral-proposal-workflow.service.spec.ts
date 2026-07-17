import { TestBed } from '@angular/core/testing';

import { testFloralProposal, testLead } from '../../testing/workflow-fixtures';
import { SupabaseService } from '../clients/supabase.service';
import { FloralProposalRepositoryService } from '../repositories/floral-proposal-repository.service';
import { FloralProposalRenderPayload } from './floral-proposal-builder.service';
import {
  FloralProposalWorkflowService,
  FinalizeFloralProposalRequest,
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

  it('loads lead proposal versions without generating public proposal URLs', async () => {
    repository.getLeadFloralProposals.and.resolveTo([testFloralProposal]);

    const proposals = await service.getLeadProposals(testLead.lead_id);

    expect(repository.getLeadFloralProposals).toHaveBeenCalledWith(testLead.lead_id);
    expect(storageFromSpy).not.toHaveBeenCalledWith('floral-proposals');
    expect(proposals).toEqual([testFloralProposal]);
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

  it('uploads proposal PDFs to the private proposal bucket before orchestration', async () => {
    storageApi.upload.and.resolveTo({ error: null });
    const file = new File(['%PDF-test'], 'Final Proposal.PDF', { type: 'application/pdf' });

    const result = await service.uploadProposalPdf({
      leadId: 'lead-001',
      proposalId: 'proposal-001',
      idempotencyKey: 'request-001',
      file,
    });

    expect(client.storage.from).toHaveBeenCalledWith('floral-proposals');
    expect(result.storagePath).toBe(
      'pending-leads/lead-001/proposal-documents/proposal-001/request-001-final-proposal.pdf'
    );
    expect(storageApi.upload).toHaveBeenCalledWith(
      result.storagePath,
      file,
      jasmine.objectContaining({ contentType: 'application/pdf', upsert: false })
    );
  });

  it('uploads project proposal revisions under the owning project path', async () => {
    storageApi.upload.and.resolveTo({ error: null });
    const file = new File(['%PDF-test'], 'Revision 2.pdf', { type: 'application/pdf' });

    const result = await service.uploadProposalPdf({
      leadId: 'lead-001',
      projectId: 'project-001',
      proposalId: 'proposal-001',
      idempotencyKey: 'request-002',
      file,
    });

    expect(result.storagePath).toBe(
      'projects/project-001/proposal-documents/proposal-001/request-002-revision-2.pdf'
    );
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

  it('submits the stored signed proposal PDF through the manual booking edge contract', async () => {
    functionsInvokeSpy.and.resolveTo({
      data: {
        success: true,
        project_id: 'project-001',
        lead_id: 'lead-001',
        floral_proposal_id: 'proposal-submitted-001',
        proposal_document_version_id: 'document-version-001',
        active_invoice_snapshot_id: 'snapshot-001',
        signed_pdf_storage_path: 'pending-leads/lead-001/proposal-documents/proposal-001/proposal.pdf',
        submitted_at: '2026-06-02T12:00:00.000Z',
      },
      error: null,
    });

    const result = await service.submitProposal(minimalSubmissionPayload());

    expect(functionsInvokeSpy).toHaveBeenCalledWith('submit-floral-proposal', {
      body: {
        mode: 'initial_booking',
        lead_id: 'lead-001',
        project_id: null,
        floral_proposal_id: 'proposal-001',
        pdf_storage_path: 'pending-leads/lead-001/proposal-documents/proposal-001/proposal.pdf',
        pdf_file_name: 'proposal.pdf',
        idempotency_key: 'request-001',
      },
    });
    expect(result).toEqual({
      project_id: 'project-001',
      lead_id: 'lead-001',
      floral_proposal_id: 'proposal-submitted-001',
      proposal_document_version_id: 'document-version-001',
      active_invoice_snapshot_id: 'snapshot-001',
      signed_pdf_storage_path: 'pending-leads/lead-001/proposal-documents/proposal-001/proposal.pdf',
      submitted_at: '2026-06-02T12:00:00.000Z',
    });
  });

  it('throws friendly errors when the submit edge function fails', async () => {
    spyOn(console, 'error');
    functionsInvokeSpy.and.resolveTo({
      data: null,
      error: { message: 'function failed' },
    });

    await expectAsync(
      service.submitProposal(minimalSubmissionPayload())
    ).toBeRejectedWithError('We could not submit the Floral Proposal right now.');

    expect(console.error).toHaveBeenCalled();
  });

  it('surfaces actionable submit errors returned by the edge function', async () => {
    spyOn(console, 'error');
    functionsInvokeSpy.and.resolveTo({
      data: null,
      error: {
        context: new Response(
          JSON.stringify({ error: 'Complete the following lead data: complete ceremony address.' }),
          { status: 422, headers: { 'Content-Type': 'application/json' } }
        ),
      },
    });

    await expectAsync(
      service.submitProposal(minimalSubmissionPayload())
    ).toBeRejectedWithError(
      'Complete the following lead data: complete ceremony address.'
    );
  });

  it('explains how to recover when Supabase returns a 546 resource limit', async () => {
    spyOn(console, 'error');
    functionsInvokeSpy.and.resolveTo({
      data: null,
      error: { context: new Response(null, { status: 546 }) },
    });

    await expectAsync(
      service.submitProposal(minimalSubmissionPayload())
    ).toBeRejectedWithError(
      'The proposal service exceeded its processing limit. Deploy the latest submission function, then retry Finalize Proposal.'
    );
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

  function minimalSubmissionPayload(): FinalizeFloralProposalRequest {
    return {
      leadId: 'lead-001',
      floralProposalId: 'proposal-001',
      pdfStoragePath: 'pending-leads/lead-001/proposal-documents/proposal-001/proposal.pdf',
      pdfFileName: 'proposal.pdf',
      idempotencyKey: 'request-001',
    };
  }
});
