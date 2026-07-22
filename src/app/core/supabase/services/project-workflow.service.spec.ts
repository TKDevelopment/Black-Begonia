import { ProjectWorkflowService } from './project-workflow.service';

describe('ProjectWorkflowService payment commands', () => {
  const project: any = { project_id: 'project', status: 'awaiting_deposit' };

  it('converts dollars to cents and preserves the command key and confirmations', async () => {
    const rpc = jasmine.createSpy().and.resolveTo({ data: { state: 'spillover_warning', spilloverAmount: 10, proposedAllocations: [] }, error: null });
    const repository: any = { client: { rpc }, getProjectById: jasmine.createSpy().and.resolveTo(project) };
    const service = new ProjectWorkflowService(repository, {} as any);
    const result = await service.recordPayment(project, {
      obligation_id: 'deposit', payment_kind: 'deposit', amount: 12.34,
      received_at: '2026-01-01T12:00:00Z', payment_method: 'cash', command_key: 'command',
      confirm_spillover: true, confirm_overpayment: false,
    });
    expect(rpc).toHaveBeenCalledWith('record_manual_payment', jasmine.objectContaining({
      p_amount_cents: 1234, p_command_key: 'command', p_confirm_spillover: true, p_confirm_overpayment: false,
    }));
    expect(result.result.state).toBe('spillover_warning');
  });

  it('maps affected installment ids from a recorded result', async () => {
    const rpc = jasmine.createSpy().and.resolveTo({ data: {
      state: 'recorded', replayed: false, transactionId: 'receipt', paymentReference: 'BBP-1',
      allocations: [], affectedObligationIds: ['deposit', 'final'], overpaymentAmount: 0,
    }, error: null });
    const repository: any = { client: { rpc }, getProjectById: jasmine.createSpy().and.resolveTo(project) };
    const service = new ProjectWorkflowService(repository, {} as any);
    const result = await service.recordPayment(project, {
      obligation_id: 'deposit', payment_kind: 'deposit', amount: 12.34,
      received_at: '2026-01-01T12:00:00Z', payment_method: 'cash', command_key: 'command',
    });
    expect(result.result.state === 'recorded' && result.result.affectedObligationIds).toEqual(['deposit', 'final']);
  });

  it('validates required positive receipt evidence', async () => {
    const service = new ProjectWorkflowService({} as any, {} as any);
    await expectAsync(service.recordPayment(project, { obligation_id: '', payment_kind: 'deposit', amount: 0, received_at: '', payment_method: null as any })).toBeRejected();
  });

  it('sanitizes unexpected RPC persistence errors', async () => {
    const rpc = jasmine.createSpy().and.resolveTo({
      data: null,
      error: { message: 'new row violates secret_internal_constraint', details: 'sensitive row data' },
    });
    const service = new ProjectWorkflowService({ client: { rpc } } as any, {} as any);
    await expectAsync(service.recordPayment(project, {
      obligation_id: 'deposit', payment_kind: 'deposit', amount: 10,
      received_at: '2026-01-01T12:00:00Z', payment_method: 'cash', command_key: 'command',
    })).toBeRejectedWithError('The payment could not be recorded. No financial changes were saved.');
  });
});
