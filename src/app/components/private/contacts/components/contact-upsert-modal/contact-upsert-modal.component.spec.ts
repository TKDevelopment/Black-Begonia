import { SimpleChange } from '@angular/core';

import { testContact } from '../../../../../core/testing/workflow-fixtures';
import { ContactUpsertModalComponent } from './contact-upsert-modal.component';

describe('ContactUpsertModalComponent', () => {
  let component: ContactUpsertModalComponent;

  beforeEach(() => {
    component = new ContactUpsertModalComponent();
  });

  it('hydrates create defaults and edit contact values when opened', () => {
    component.open = true;
    component.ngOnChanges({ open: new SimpleChange(false, true, false) });
    expect(component.firstName()).toBe('');
    expect(component.country()).toBe('US');
    expect(component.contactType()).toBe('client');

    component.mode = 'edit';
    component.contact = testContact;
    component.ngOnChanges({ contact: new SimpleChange(null, testContact, false) });
    expect(component.title).toBe('Edit Contact');
    expect(component.confirmLabel).toBe('Save Changes');
    expect(component.firstName()).toBe(testContact.first_name);
    expect(component.email()).toBe(testContact.email ?? '');
  });

  it('validates required fields before emitting', () => {
    const confirmSpy = spyOn(component.confirm, 'emit');

    component.firstName.set('');
    component.lastName.set('Client');
    component.onConfirm();

    expect(component.validationError()).toBe(
      'First name, last name, and contact type are required.'
    );
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('emits a trimmed and normalized payload', () => {
    const confirmSpy = spyOn(component.confirm, 'emit');
    component.firstName.set(' Rowan ');
    component.lastName.set(' Client ');
    component.email.set(' ROWAN.CLIENT@EXAMPLE.TEST ');
    component.phone.set(' 555-0110 ');
    component.secondaryPhone.set(' ');
    component.preferredContactMethod.set(' email ');
    component.addressLine1.set(' 100 Test Lane ');
    component.city.set(' Austin ');
    component.state.set(' TX ');
    component.postalCode.set(' 78701 ');
    component.country.set('');
    component.contactType.set('client');
    component.notes.set(' Notes ');

    component.onConfirm();

    expect(confirmSpy).toHaveBeenCalledWith({
      first_name: 'Rowan',
      last_name: 'Client',
      email: 'rowan.client@example.test',
      phone: '555-0110',
      secondary_phone: null,
      preferred_contact_method: 'email',
      address_line_1: '100 Test Lane',
      address_line_2: null,
      city: 'Austin',
      state: 'TX',
      postal_code: '78701',
      country: 'US',
      contact_type: 'client',
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
