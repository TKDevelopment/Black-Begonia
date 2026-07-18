import { ProjectFinancialSummaryCardComponent } from './project-financial-summary-card.component';

describe('ProjectFinancialSummaryCardComponent', () => {
  it('distinguishes a valid zero active total from unavailable state', () => {
    const component = new ProjectFinancialSummaryCardComponent();
    expect(component.formatCurrency(null)).toBe('Unavailable');
    expect(component.formatCurrency(0)).toBe('$0.00');
    component.snapshot = {
      project_proposal_invoice_snapshot_id: 'snapshot-active', project_id: 'project-1', version: 2,
      snapshot: {}, subtotal: 0, tax_rate: 0, tax_amount: 0, total_amount: 0,
      retainer_amount: 0, final_balance_amount: 0, is_active: true, created_at: '',
    };
    expect(component.outstandingBalance).toBe(0);
  });

  it('calculates payments only against the supplied validated active snapshot', () => {
    const component = new ProjectFinancialSummaryCardComponent();
    component.snapshot = {
      project_proposal_invoice_snapshot_id: 'snapshot-active', project_id: 'project-1', version: 2,
      snapshot: {}, subtotal: 100, tax_rate: .06, tax_amount: 6, total_amount: 106,
      retainer_amount: 30, final_balance_amount: 106, is_active: true, created_at: '',
    };
    component.payments = [{ payment_record_id: 'payment-1', project_id: 'project-1', payment_kind: 'deposit', amount_paid: 30, status: 'paid', created_at: '', updated_at: '' } as any];
    expect(component.outstandingBalance).toBe(76);
  });
});
