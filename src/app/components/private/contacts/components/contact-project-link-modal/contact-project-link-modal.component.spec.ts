import { SimpleChange } from '@angular/core';

import { testProject } from '../../../../../core/testing/workflow-fixtures';
import { ContactProjectLinkModalComponent } from './contact-project-link-modal.component';

describe('ContactProjectLinkModalComponent', () => {
  let component: ContactProjectLinkModalComponent;

  beforeEach(() => {
    component = new ContactProjectLinkModalComponent();
  });

  it('resets form state when opened', () => {
    component.projectId.set(testProject.project_id);
    component.relationshipType.set('planner');
    component.isPrimary.set(true);
    component.validationError.set('Error');

    component.open = true;
    component.ngOnChanges({ open: new SimpleChange(false, true, false) });

    expect(component.projectId()).toBe('');
    expect(component.relationshipType()).toBe('client');
    expect(component.isPrimary()).toBeFalse();
    expect(component.validationError()).toBeNull();
  });

  it('requires a project before emitting', () => {
    const confirmSpy = spyOn(component.confirm, 'emit');

    component.onConfirm();

    expect(component.validationError()).toBe(
      'Select a project before linking this contact.'
    );
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('emits selected project relationship values', () => {
    const confirmSpy = spyOn(component.confirm, 'emit');
    component.projectId.set(testProject.project_id);
    component.relationshipType.set('billing_contact');
    component.isPrimary.set(true);

    component.onConfirm();

    expect(component.validationError()).toBeNull();
    expect(confirmSpy).toHaveBeenCalledWith({
      project_id: testProject.project_id,
      relationship_type: 'billing_contact',
      is_primary: true,
    });
  });

  it('guards close while saving and formats labels', () => {
    const closeSpy = spyOn(component.close, 'emit');

    component.saving = true;
    component.onClose();
    expect(closeSpy).not.toHaveBeenCalled();

    component.saving = false;
    component.onClose();
    expect(closeSpy).toHaveBeenCalled();
    expect(component.formatLabel('billing_contact')).toBe('Billing Contact');
    expect(component.formatProjectLabel(testProject)).toContain(testProject.project_name);
  });
});
