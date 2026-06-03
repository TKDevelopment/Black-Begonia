import { SimpleChange } from '@angular/core';

import { testOrganization } from '../../../../../core/testing/workflow-fixtures';
import { OrganizationUpsertModalComponent } from './organization-upsert-modal.component';

describe('OrganizationUpsertModalComponent', () => {
  let component: OrganizationUpsertModalComponent;

  beforeEach(() => {
    component = new OrganizationUpsertModalComponent();
  });

  it('hydrates defaults and edit organization values when opened', () => {
    component.open = true;
    component.ngOnChanges({ open: new SimpleChange(false, true, false) });
    expect(component.organizationType()).toBe('vendor');
    expect(component.country()).toBe('US');

    component.mode = 'edit';
    component.organization = testOrganization;
    component.ngOnChanges({
      organization: new SimpleChange(null, testOrganization, false),
    });

    expect(component.title).toBe('Edit Organization');
    expect(component.confirmLabel).toBe('Save Changes');
    expect(component.name()).toBe(testOrganization.name);
    expect(component.organizationType()).toBe(testOrganization.organization_type);
  });

  it('validates required fields before emitting', () => {
    const confirmSpy = spyOn(component.confirm, 'emit');

    component.name.set('');
    component.onConfirm();

    expect(component.validationError()).toBe('Organization name and type are required.');
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('emits a trimmed and normalized payload', () => {
    const confirmSpy = spyOn(component.confirm, 'emit');
    component.name.set(' Test Venue Collective ');
    component.organizationType.set('venue');
    component.email.set(' EVENTS@EXAMPLE.TEST ');
    component.phone.set(' 555-0120 ');
    component.website.set(' https://venue.example.test ');
    component.addressLine1.set(' 200 Fixture Street ');
    component.addressLine2.set('');
    component.city.set(' Austin ');
    component.state.set(' TX ');
    component.postalCode.set(' 78702 ');
    component.country.set('');
    component.notes.set(' Notes ');

    component.onConfirm();

    expect(confirmSpy).toHaveBeenCalledWith({
      name: 'Test Venue Collective',
      organization_type: 'venue',
      email: 'events@example.test',
      phone: '555-0120',
      website: 'https://venue.example.test',
      address_line_1: '200 Fixture Street',
      address_line_2: null,
      city: 'Austin',
      state: 'TX',
      postal_code: '78702',
      country: 'US',
      notes: 'Notes',
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
