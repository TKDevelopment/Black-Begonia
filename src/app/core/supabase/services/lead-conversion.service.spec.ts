import { testContact, testLead } from '../../testing/workflow-fixtures';
import { LeadConversionService } from './lead-conversion.service';

describe('LeadConversionService', () => {
  const project: any = {
    project_id: 'project-1',
    project_name: 'Avery Event',
    service_type: 'wedding',
    status: 'awaiting_deposit',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };

  function setup(dispatch: 'processed' | 'failed' = 'processed') {
    const rpc = jasmine.createSpy().and.resolveTo({
      data: {
        project,
        primaryContactId: 'contact-1',
        partnerContactId: null,
        plannerContactId: null,
        depositObligationId: 'deposit-1',
      },
      error: null,
    });
    const invoke = jasmine.createSpy().and.resolveTo({
      data: { deliveryDispatch: dispatch },
      error: null,
    });
    const single = jasmine.createSpy().and.resolveTo({
      data: { outstanding_amount: 300 },
      error: null,
    });
    const projectRepository: any = {
      client: {
        rpc,
        functions: { invoke },
        from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
      },
    };
    const contactRepository: any = {
      getContactById: jasmine
        .createSpy()
        .and.resolveTo({ ...testContact, contact_id: 'contact-1' }),
    };
    const service = new LeadConversionService(
      contactRepository,
      projectRepository
    );

    return { service, rpc, invoke };
  }

  it('rejects conversion unless the proposal has been accepted', async () => {
    const { service, rpc } = setup();

    await expectAsync(
      service.convertLead(testLead, {
        project_name: 'No',
        send_deposit_request: false,
      })
    ).toBeRejectedWithError(/accepted Floral Proposal/);

    expect(rpc).not.toHaveBeenCalled();
  });

  it('uses one transactional conversion RPC and leaves email declined', async () => {
    const { service, rpc, invoke } = setup();

    const result = await service.convertLead(
      { ...testLead, status: 'proposal_accepted' },
      {
        project_name: 'Avery Event',
        internal_notes: 'Ready to book.',
        send_deposit_request: false,
      }
    );

    expect(rpc).toHaveBeenCalledWith(
      'convert_lead_to_project_with_payments',
      jasmine.objectContaining({
        p_lead_id: testLead.lead_id,
        p_project_fields: {
          project_name: 'Avery Event',
          internal_notes: 'Ready to book.',
        },
        p_command_key: jasmine.any(String),
      })
    );
    expect(invoke).not.toHaveBeenCalled();
    expect(result.requestDelivery).toBe('not_requested');
    expect(result.project.status).toBe('awaiting_deposit');
  });

  it('propagates atomic conversion failures without dispatching email', async () => {
    const { service, rpc, invoke } = setup();
    rpc.and.resolveTo({ data: null, error: new Error('conversion failed') });

    await expectAsync(
      service.convertLead(
        { ...testLead, status: 'proposal_accepted' },
        { project_name: 'Avery Event', send_deposit_request: true }
      )
    ).toBeRejectedWithError('conversion failed');

    expect(invoke).not.toHaveBeenCalled();
  });

  it('issues the exact deposit request after atomic conversion', async () => {
    const { service, invoke } = setup();

    const result = await service.convertLead(
      { ...testLead, status: 'proposal_accepted' },
      { project_name: 'Avery Event', send_deposit_request: true }
    );

    expect(invoke).toHaveBeenCalledWith('issue-payment-request', {
      body: jasmine.objectContaining({
        obligationIds: ['deposit-1'],
        principalCents: 30000,
        kind: 'deposit',
      }),
    });
    expect(result.requestDelivery).toBe('queued');
  });

  it('returns the converted project when delivery dispatch fails', async () => {
    const { service } = setup('failed');

    const result = await service.convertLead(
      { ...testLead, status: 'proposal_accepted' },
      { project_name: 'Avery Event', send_deposit_request: true }
    );

    expect(result.project.project_id).toBe('project-1');
    expect(result.requestDelivery).toBe('failed');
    expect(result.requestError).toContain('manual retry');
  });

  it('keeps the converted project when request invocation throws', async () => {
    const { service, invoke } = setup();
    invoke.and.rejectWith(new Error('mail provider unavailable'));

    const result = await service.convertLead(
      { ...testLead, status: 'proposal_accepted' },
      { project_name: 'Avery Event', send_deposit_request: true }
    );

    expect(result.project.project_id).toBe('project-1');
    expect(result.requestDelivery).toBe('failed');
    expect(result.requestError).toBe('mail provider unavailable');
  });

  it('builds a default project name from lead details', () => {
    const { service } = setup();

    const name = service.buildDefaultProjectName({
      ...testLead,
      service_type: 'wedding full service',
      event_date: '2026-10-24',
    });

    expect(name).toContain('Avery Bloom');
    expect(name).toContain('Wedding Full Service');
    expect(name).toContain('Oct 24, 2026');
    expect(name).toContain(' • ');
  });
});
