import { ProjectProposalDocumentsSectionComponent } from './project-proposal-documents-section.component';

describe('ProjectProposalDocumentsSectionComponent', () => {
  it('uses stored active and superseded lifecycle state instead of newest-version inference', () => {
    const component = new ProjectProposalDocumentsSectionComponent();
    const olderActive = { project_proposal_document_version_id: 'd1', version: 1, is_active: true, status: 'submitted' } as any;
    const newerSuperseded = { project_proposal_document_version_id: 'd2', version: 2, is_active: false, status: 'superseded' } as any;
    component.documents = [olderActive, newerSuperseded];
    expect(component.isDisplayActive(olderActive)).toBeTrue();
    expect(component.isDisplayActive(newerSuperseded)).toBeFalse();
    expect(component.displayStatus(newerSuperseded)).toBe('Superseded / Inactive');
  });
});
