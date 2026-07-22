import { SimpleChange } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ProjectPaymentRecord } from '../../../../../core/models/project-payment-record';
import { ProjectPaymentLogModalComponent } from './project-payment-log-modal.component';

describe('ProjectPaymentLogModalComponent', () => {
  let component: ProjectPaymentLogModalComponent;
  const deposit: ProjectPaymentRecord = {
    project_payment_record_id: 'deposit', project_id: 'project', payment_kind: 'deposit', status: 'due',
    amount_due: 300, amount_paid: 0, target_amount: 300, outstanding_amount: 300,
    payment_source: 'manual', created_at: '2026-01-01', updated_at: '2026-01-01',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ProjectPaymentLogModalComponent] });
    component = TestBed.createComponent(ProjectPaymentLogModalComponent).componentInstance;
    component.obligations = [deposit];
    component.open = true;
    component.ngOnChanges({ open: new SimpleChange(false, true, true) });
  });

  it('initializes Record Payment with the outstanding installment and stable command key', () => {
    expect(component.obligation_id).toBe('deposit');
    expect(component.amount).toBe(300);
    expect(component.command_key).toBeTruthy();
  });

  it('preselects a planned method but allows the actual method to change', () => {
    component.obligations = [{ ...deposit, plannedMethod: 'check' }];
    component.open = false;
    component.ngOnChanges({ open: new SimpleChange(true, false, false) });
    component.open = true;
    component.ngOnChanges({ open: new SimpleChange(false, true, false) });
    expect(component.payment_method).toBe('check');
    component.payment_method = 'cash';
    expect(component.payment_method).toBe('cash');
  });

  it('retains entered values and command identity when a spillover warning arrives', () => {
    component.notes = 'Split this receipt';
    const commandKey = component.command_key;
    component.warning = { state: 'spillover_warning', spilloverAmount: 10, proposedAllocations: [] };
    component.ngOnChanges({ warning: new SimpleChange(null, component.warning, false) });
    expect(component.notes).toBe('Split this receipt');
    expect(component.command_key).toBe(commandKey);
  });

  it('requires explicit spillover confirmation before resubmitting', () => {
    component.received_at = '2026-01-15';
    component.warning = { state: 'spillover_warning', spilloverAmount: 10, proposedAllocations: [] };
    component.submit();
    expect(component.error).toContain('Confirm the proposed spillover');
  });

  it('emits actual receipt evidence and warning confirmations', () => {
    const values: any[] = [];
    component.confirm.subscribe((value) => values.push(value));
    component.received_at = '2026-01-15';
    component.payment_method = 'check';
    component.confirm_spillover = true;
    component.submit();
    expect(values[0]).toEqual(jasmine.objectContaining({
      obligation_id: 'deposit', amount: 300, payment_method: 'check', confirm_spillover: true,
      command_key: component.command_key,
    }));
  });

  it('keeps zero-dollar installments visible but ineligible', () => {
    const zero = { ...deposit, target_amount: 0, amount_due: 0, outstanding_amount: 0, status: 'not_due' as const };
    expect(component.canRecord(zero)).toBeFalse();
  });

  it('rejects zero, future dates, and invalid methods', () => {
    component.amount = 0;
    component.submit();
    expect(component.error).toContain('greater than zero');
    component.amount = 10;
    component.received_at = '2999-01-01';
    component.submit();
    expect(component.error).toContain('not in the future');
    component.received_at = '2026-01-01';
    component.payment_method = 'bad' as any;
    component.submit();
    expect(component.error).toContain('valid payment method');
  });
});
