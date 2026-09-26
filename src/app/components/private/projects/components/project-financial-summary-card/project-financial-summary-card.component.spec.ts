import { TestBed } from '@angular/core/testing';

import { ProjectFinancialSummaryCardComponent } from './project-financial-summary-card.component';

describe('ProjectFinancialSummaryCardComponent', () => {
  it('distinguishes a valid zero from unavailable values', () => {
    const component = new ProjectFinancialSummaryCardComponent();
    expect(component.formatCurrency(null)).toBe('Unavailable');
    expect(component.formatCurrency(0)).toBe('$0.00');
  });

  it('shows the revised total and outstanding balance without duplicate installment cards', async () => {
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
      proposalTotal: 4500,
      depositTarget: 300,
      finalTarget: 700,
      creditedPrincipal: 3210,
      outstanding: 1290,
      customerFees: 0,
      merchantFees: 3.25,
      overpayment: 0,
      needsAttention: [],
      obligations: [],
    };
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Total Amount Due');
    expect(text).toContain('$4,500.00');
    expect(text).toContain('$1,290.00');
    expect(text).toContain('Outstanding Balance');
    expect(text).not.toContain('Deposit Amount');
    expect(text).not.toContain('Final Payment Amount');
    expect(text).not.toContain('Active Proposal');
    expect(text).not.toContain('Deposit Target');
    expect(text).not.toContain('Final Target');
    expect(text).not.toContain('total principal credited');
  });

});
