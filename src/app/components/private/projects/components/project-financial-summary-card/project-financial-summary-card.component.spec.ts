import { TestBed } from '@angular/core/testing';

import { ProjectPaymentRecord } from '../../../../../core/models/project-payment-record';
import { ProjectFinancialSummaryCardComponent } from './project-financial-summary-card.component';

describe('ProjectFinancialSummaryCardComponent', () => {
  it('distinguishes a valid zero from unavailable values', () => {
    const component = new ProjectFinancialSummaryCardComponent();
    expect(component.formatCurrency(null)).toBe('Unavailable');
    expect(component.formatCurrency(0)).toBe('$0.00');
  });

  it('renders friendly financial labels and obligation payment statuses', async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectFinancialSummaryCardComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(ProjectFinancialSummaryCardComponent);
    fixture.componentInstance.snapshot = {
      project_proposal_invoice_snapshot_id: 'snapshot',
      project_id: 'project',
      version: 2,
      snapshot: {},
      subtotal: 1000,
      tax_rate: 0,
      tax_amount: 0,
      total_amount: 1000,
      retainer_amount: 300,
      final_balance_amount: 700,
      is_active: true,
      created_at: '',
    };
    fixture.componentInstance.summary = {
      available: true,
      proposalTotal: 1000,
      depositTarget: 300,
      finalTarget: 700,
      creditedPrincipal: 300,
      outstanding: 700,
      customerFees: 0,
      merchantFees: 3.25,
      overpayment: 0,
      needsAttention: [],
      obligations: [
        obligation('deposit', 'paid'),
        obligation('final_payment', 'due'),
      ],
    };
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Total Amount Due');
    expect(text).toContain('Deposit Amount');
    expect(text).toContain('Final Payment Amount');
    expect(text).toContain('Outstanding Balance');
    expect(text).toContain('Paid');
    expect(text).toContain('Unpaid');
    expect(text).not.toContain('Active Proposal');
    expect(text).not.toContain('Deposit Target');
    expect(text).not.toContain('Final Target');
    expect(text).not.toContain('total principal credited');
  });

  it('treats an overpaid obligation as paid and a missing obligation as unpaid', () => {
    const component = new ProjectFinancialSummaryCardComponent();
    component.summary = {
      available: true,
      proposalTotal: 1000,
      depositTarget: 300,
      finalTarget: 700,
      creditedPrincipal: 1000,
      outstanding: 0,
      customerFees: 0,
      merchantFees: 0,
      overpayment: 10,
      needsAttention: [],
      obligations: [obligation('deposit', 'overpaid')],
    };

    expect(component.paymentStatus('deposit')).toBe('Paid');
    expect(component.paymentStatus('final_payment')).toBe('Unpaid');
  });
});

function obligation(
  paymentKind: ProjectPaymentRecord['payment_kind'],
  status: ProjectPaymentRecord['status'],
): ProjectPaymentRecord {
  return {
    project_payment_record_id: `${paymentKind}-id`,
    project_id: 'project',
    payment_kind: paymentKind,
    status,
    amount_due: paymentKind === 'deposit' ? 300 : 700,
    amount_paid: status === 'paid' || status === 'overpaid' ? 300 : 0,
    payment_source: 'manual',
    created_at: '',
    updated_at: '',
  };
}
