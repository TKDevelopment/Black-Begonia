import { SimpleChange } from '@angular/core';

import { testProject } from '../../../../../core/testing/workflow-fixtures';
import { OrganizationProjectLinkModalComponent } from './organization-project-link-modal.component';

describe('OrganizationProjectLinkModalComponent', () => {
  let component: OrganizationProjectLinkModalComponent;

  beforeEach(() => {
    component = new OrganizationProjectLinkModalComponent();
  });

  it('resets form state when opened', () => {
    component.projectId.set(testProject.project_id);
    component.relationshipType.set('planner_company');
    component.validationError.set('Error');

    component.open = true;
    component.ngOnChanges({ open: new SimpleChange(false, true, false) });

    expect(component.projectId()).toBe('');
    expect(component.relationshipType()).toBe('vendor');
    expect(component.validationError()).toBeNull();
  });

  it('requires a project before emitting', () => {
    const confirmSpy = spyOn(component.confirm, 'emit');

    component.onConfirm();

    expect(component.validationError()).toBe(
      'Select a project before linking this organization.'
    );
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('emits selected project relationship values', () => {
    const confirmSpy = spyOn(component.confirm, 'emit');
    component.projectId.set(testProject.project_id);
    component.relationshipType.set('venue');

    component.onConfirm();

    expect(component.validationError()).toBeNull();
    expect(confirmSpy).toHaveBeenCalledWith({
      project_id: testProject.project_id,
      relationship_type: 'venue',
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
    expect(component.formatLabel('planner_company')).toBe('Planner Company');
    expect(component.formatProjectLabel(testProject)).toContain(testProject.project_name);
  });
});
