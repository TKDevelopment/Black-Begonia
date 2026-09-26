import { PaymentDeliveryService } from './payment-delivery.service';

describe('PaymentDeliveryService', () => {
  it('issues a checkout link for one installment and reports dispatch failures', async () => {
    const invoke = jasmine.createSpy().and.resolveTo({ data: { paymentRequestId: 'request-1', deliveryDispatch: 'processed' }, error: null });
    const service = new PaymentDeliveryService({ getClient: () => ({ functions: { invoke } }) } as any);

    expect(await service.sendInstallmentPaymentEmail('installment-1', 129000)).toBe('sent');
    expect(invoke).toHaveBeenCalledWith('issue-payment-request', {
      body: jasmine.objectContaining({
        obligationIds: ['installment-1'], principalCents: 129000, kind: 'installment',
        commandKey: jasmine.any(String),
      }),
    });

    invoke.and.resolveTo({ data: { deliveryDispatch: 'failed', deliveryError: 'Email unavailable' }, error: null });
    await expectAsync(service.sendInstallmentPaymentEmail('installment-1', 129000))
      .toBeRejectedWithError('Email unavailable');
    await expectAsync(service.sendInstallmentPaymentEmail('', 0)).toBeRejected();
  });

  it('uses audited reminder controls without changing finance or project status', async () => {
    const rpc = jasmine.createSpy().and.resolveTo({ data: { updated: 1 }, error: null });
    const service = new PaymentDeliveryService({ getClient: () => ({ rpc }) } as any);

    await service.setReminderControl(
      'project',
      'deposit',
      false,
      null,
      'Customer requested pause'
    );

    expect(rpc).toHaveBeenCalledWith('set_payment_reminder_control', {
      p_project_id: 'project',
      p_obligation_id: 'deposit',
      p_enabled: false,
      p_paused_until: null,
      p_reason: 'Customer requested pause',
    });
  });

  it('loads durable delivery outcomes for project recovery controls', async () => {
    const order = jasmine.createSpy().and.resolveTo({
      data: [{ payment_message_delivery_id: 'delivery', status: 'permanent_failed' }],
      error: null,
    });
    const query = {
      select: jasmine.createSpy(),
      eq: jasmine.createSpy(),
      order,
    };
    query.select.and.returnValue(query);
    query.eq.and.returnValue(query);
    const from = jasmine.createSpy().and.returnValue(query);
    const service = new PaymentDeliveryService({ getClient: () => ({ from }) } as any);

    const deliveries = await service.getProjectDeliveries('project');

    expect(from).toHaveBeenCalledWith('payment_message_deliveries');
    expect(query.eq).toHaveBeenCalledWith('project_id', 'project');
    expect(deliveries[0].status).toBe('permanent_failed');
  });
});
