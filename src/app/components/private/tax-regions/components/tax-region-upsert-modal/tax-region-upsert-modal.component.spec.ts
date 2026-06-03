import { SimpleChange } from '@angular/core';

import { testTaxRegion } from '../../../../../core/testing/workflow-fixtures';
import { TaxRegionUpsertModalComponent } from './tax-region-upsert-modal.component';

describe('TaxRegionUpsertModalComponent', () => {
  let component: TaxRegionUpsertModalComponent;

  beforeEach(() => {
    component = new TaxRegionUpsertModalComponent();
  });

  it('hydrates defaults and edit region values when opened', () => {
    component.open = true;
    component.ngOnChanges({ open: new SimpleChange(false, true, false) });
    expect(component.name()).toBe('');
    expect(component.appliesToProducts()).toBeTrue();

    component.mode = 'edit';
    component.taxRegion = testTaxRegion;
    component.ngOnChanges({ taxRegion: new SimpleChange(null, testTaxRegion, false) });

    expect(component.title).toBe('Edit Tax Region');
    expect(component.confirmLabel).toBe('Save Changes');
    expect(component.name()).toBe(testTaxRegion.name);
    expect(component.taxRatePercent()).toBe('8.25');
  });

  it('validates required name and non-negative tax rate', () => {
    const confirmSpy = spyOn(component.confirm, 'emit');

    component.name.set('');
    component.onConfirm();
    expect(component.validationError()).toBe('Region name is required.');

    component.name.set('Austin');
    component.taxRatePercent.set('-1');
    component.onConfirm();
    expect(component.validationError()).toBe(
      'Tax rate must be a valid non-negative percentage.'
    );
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('emits normalized payload values', () => {
    const confirmSpy = spyOn(component.confirm, 'emit');
    component.name.set(' Austin Test Tax ');
    component.authorityName.set(' ');
    component.taxRatePercent.set('8.255');
    component.appliesToProducts.set(true);
    component.appliesToServices.set(false);
    component.appliesToDelivery.set(true);
    component.isActive.set(false);

    component.onConfirm();

    expect(confirmSpy).toHaveBeenCalledWith({
      name: 'Austin Test Tax',
      authority_name: null,
      tax_rate: 0.0826,
      applies_to_products: true,
      applies_to_services: false,
      applies_to_delivery: true,
      is_active: false,
    });
  });

  it('guards close while saving and emits close when idle', () => {
    const closeSpy = spyOn(component.close, 'emit');

    component.saving = true;
    component.onClose();
    expect(closeSpy).not.toHaveBeenCalled();

    component.saving = false;
    component.validationError.set('Error');
    component.onClose();
    expect(component.validationError()).toBeNull();
    expect(closeSpy).toHaveBeenCalled();
  });
});
