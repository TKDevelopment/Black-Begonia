import { SimpleChange } from '@angular/core';

import { testCatalogItem } from '../../../../../core/testing/workflow-fixtures';
import { CatalogItemUpsertModalComponent } from './catalog-item-upsert-modal.component';

describe('CatalogItemUpsertModalComponent', () => {
  let component: CatalogItemUpsertModalComponent;

  beforeEach(() => {
    component = new CatalogItemUpsertModalComponent();
  });

  it('hydrates defaults and edit item values when opened', () => {
    component.open = true;
    component.ngOnChanges({ open: new SimpleChange(false, true, false) });
    expect(component.itemType()).toBe('flower');
    expect(component.unitType()).toBe('stem');
    expect(component.isActive()).toBeTrue();

    component.mode = 'edit';
    component.item = testCatalogItem;
    component.ngOnChanges({ item: new SimpleChange(null, testCatalogItem, false) });

    expect(component.title).toBe('Edit Catalog Item');
    expect(component.confirmLabel).toBe('Save Changes');
    expect(component.name()).toBe(testCatalogItem.name);
    expect(component.packQuantity()).toBe(String(testCatalogItem.pack_quantity));
  });

  it('validates required name, base cost, and pack quantity', () => {
    const confirmSpy = spyOn(component.confirm, 'emit');

    component.name.set('');
    component.onConfirm();
    expect(component.validationError()).toBe('Item name is required.');

    component.name.set('Rose');
    component.baseUnitCost.set('-1');
    component.onConfirm();
    expect(component.validationError()).toBe(
      'Base unit cost must be a valid non-negative number.'
    );

    component.baseUnitCost.set('3.00');
    component.unitType.set('bunch');
    component.packQuantity.set('');
    component.onConfirm();
    expect(component.validationError()).toContain('Pack quantity must be a valid number');
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('emits normalized payload values', () => {
    const confirmSpy = spyOn(component.confirm, 'emit');
    component.name.set(' Garden Rose ');
    component.itemType.set('flower');
    component.unitType.set('bunch');
    component.packQuantity.set('10.234');
    component.color.set(' Blush ');
    component.variety.set('');
    component.sku.set(' ROSE-JULIET ');
    component.baseUnitCost.set('30.126');
    component.isActive.set(false);

    component.onConfirm();

    expect(confirmSpy).toHaveBeenCalledWith({
      name: 'Garden Rose',
      item_type: 'flower',
      unit_type: 'bunch',
      pack_quantity: 10.23,
      color: 'Blush',
      variety: null,
      sku: 'ROSE-JULIET',
      base_unit_cost: 30.13,
      is_active: false,
    });
  });

  it('clears pack quantity when a unit type does not require it and guards close', () => {
    const closeSpy = spyOn(component.close, 'emit');

    component.packQuantity.set('10');
    component.onUnitTypeChange('hour');
    expect(component.packQuantity()).toBe('');
    expect(component.requiresPackQuantity('hour')).toBeFalse();
    expect(component.formatLabel('hardgood')).toBe('Hardgood');

    component.saving = true;
    component.onClose();
    expect(closeSpy).not.toHaveBeenCalled();

    component.saving = false;
    component.onClose();
    expect(closeSpy).toHaveBeenCalled();
  });
});
