import { ComponentFixture, TestBed } from '@angular/core/testing';

import { testFloralProposal } from '../../../../../core/testing/workflow-fixtures';
import { FloralProposalResponseSummary } from '../../../../../core/models/floral-proposal';
import { LeadProposalHistoryCardComponent } from './lead-proposal-history-card.component';

describe('LeadProposalHistoryCardComponent', () => {
  let component: LeadProposalHistoryCardComponent;
  let fixture: ComponentFixture<LeadProposalHistoryCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeadProposalHistoryCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LeadProposalHistoryCardComponent);
    component = fixture.componentInstance;
  });

  it('renders an empty state and submit action when no proposals exist', () => {
    const emitted: void[] = [];
    component.canSubmitProposal = true;
    component.submitProposal.subscribe((value) => emitted.push(value));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'No Floral Proposals have been attached to this lead yet.'
    );

    component.onSubmitProposal();

    expect(emitted.length).toBe(1);
  });

  it('selects the requested proposal or falls back to the first proposal', () => {
    const archivedProposal = {
      ...testFloralProposal,
      floral_proposal_id: 'proposal-archived',
      version: 1,
      is_active: false,
    };
    const activeProposal = {
      ...testFloralProposal,
      floral_proposal_id: 'proposal-active',
      version: 2,
      is_active: true,
    };
    component.proposals = [archivedProposal, activeProposal];
    component.selectedProposalId = 'proposal-active';

    expect(component.selectedProposal()).toEqual(activeProposal);

    const fallbackFixture = TestBed.createComponent(
      LeadProposalHistoryCardComponent
    );
    const fallbackComponent = fallbackFixture.componentInstance;
    fallbackComponent.proposals = [archivedProposal, activeProposal];
    fallbackComponent.selectedProposalId = 'missing-proposal';

    expect(fallbackComponent.selectedProposal()).toEqual(activeProposal);
  });

  it('renders proposal versions, active state, and latest client response', () => {
    component.proposals = [
      {
        ...testFloralProposal,
        floral_proposal_id: 'proposal-active',
        version: 2,
        is_active: true,
      },
    ];
    component.selectedProposalId = 'proposal-active';
    component.proposalResponses = {
      'proposal-active': [
        createResponse('accept', 'Looks perfect.', '2026-06-02T12:00:00.000Z'),
      ],
    };
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Proposal v2');
    expect(fixture.nativeElement.textContent).toContain('Active');
    expect(fixture.nativeElement.textContent).toContain('Accepted');
    expect(fixture.nativeElement.textContent).toContain('Looks perfect.');
  });

  it('emits selection and submit events', () => {
    const selected: string[] = [];
    const submitted: void[] = [];
    component.selectProposal.subscribe((id) => selected.push(id));
    component.submitProposal.subscribe((value) => submitted.push(value));

    component.onSelect('proposal-001');
    component.onSubmitProposal();

    expect(selected).toEqual(['proposal-001']);
    expect(submitted.length).toBe(1);
  });

  it('formats dates for proposal history rows', () => {
    expect(component.formatDateTime('2026-06-02T12:00:00.000Z')).toContain(
      '2026'
    );
  });

  it('returns the latest response for a proposal', () => {
    component.proposalResponses = {
      'proposal-001': [
        createResponse('decline', 'Needs changes.', '2026-06-03T12:00:00.000Z'),
      ],
    };

    expect(component.getLatestResponse('proposal-001')).toEqual(
      jasmine.objectContaining({ action: 'decline' })
    );
    expect(component.getLatestResponse('proposal-missing')).toBeNull();
  });
});

function createResponse(
  action: 'accept' | 'decline',
  feedback: string,
  createdAt: string
): FloralProposalResponseSummary {
  return {
    proposal_id: 'proposal-active',
    action,
    feedback,
    created_at: createdAt,
  };
}
