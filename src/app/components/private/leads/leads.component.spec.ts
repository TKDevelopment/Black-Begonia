import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import {
  testFloralProposal,
  testLead,
} from '../../../core/testing/workflow-fixtures';
import { ActivityRepositoryService } from '../../../core/supabase/repositories/activity-repository.service';
import { FloralProposalRepositoryService } from '../../../core/supabase/repositories/floral-proposal-repository.service';
import { LeadRepositoryService } from '../../../core/supabase/repositories/lead-repository.service';
import { ToastService } from '../../../core/services/toast.service';
import { Lead } from '../../../core/models/lead';
import { LeadActivity } from '../../../core/models/lead-activity';
import { FloralProposal } from '../../../core/models/floral-proposal';
import { LeadsComponent } from './leads.component';

describe('LeadsComponent', () => {
  let component: LeadsComponent;
  let fixture: ComponentFixture<LeadsComponent>;
  let leadRepository: jasmine.SpyObj<LeadRepositoryService>;
  let proposalRepository: jasmine.SpyObj<FloralProposalRepositoryService>;
  let activityRepository: jasmine.SpyObj<ActivityRepositoryService>;
  let router: jasmine.SpyObj<Router>;
  let toast: jasmine.SpyObj<ToastService>;
  let consoleErrorSpy: jasmine.Spy;

  beforeEach(async () => {
    leadRepository = jasmine.createSpyObj<LeadRepositoryService>(
      'LeadRepositoryService',
      ['getLeads', 'createGeneralLead', 'createWeddingLead']
    );
    proposalRepository = jasmine.createSpyObj<FloralProposalRepositoryService>(
      'FloralProposalRepositoryService',
      ['getAllProposals']
    );
    activityRepository = jasmine.createSpyObj<ActivityRepositoryService>(
      'ActivityRepositoryService',
      ['getProposalResponseActivities', 'createLeadActivity']
    );
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['showToast']);

    leadRepository.getLeads.and.resolveTo([testLead]);
    proposalRepository.getAllProposals.and.resolveTo([testFloralProposal]);
    activityRepository.getProposalResponseActivities.and.resolveTo([]);
    router.navigate.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [LeadsComponent],
      providers: [
        { provide: LeadRepositoryService, useValue: leadRepository },
        { provide: FloralProposalRepositoryService, useValue: proposalRepository },
        { provide: ActivityRepositoryService, useValue: activityRepository },
        { provide: Router, useValue: router },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    consoleErrorSpy = spyOn(console, 'error');
  });

  it('loads leads, proposals, and proposal responses on init', async () => {
    createComponent();

    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.loading()).toBeFalse();
    expect(component.leads()).toEqual([testLead]);
    expect(component.proposals()).toEqual([testFloralProposal]);
    expect(component.filteredLeads()).toEqual([testLead]);
    expect(leadRepository.getLeads).toHaveBeenCalled();
    expect(proposalRepository.getAllProposals).toHaveBeenCalled();
    expect(activityRepository.getProposalResponseActivities).toHaveBeenCalled();
  });

  it('shows loading while lead data is pending', () => {
    let resolveLeads!: (value: Lead[]) => void;
    leadRepository.getLeads.and.returnValue(
      new Promise<Lead[]>((resolve) => {
        resolveLeads = resolve;
      })
    );

    createComponent();

    expect(component.loading()).toBeTrue();

    resolveLeads([testLead]);
  });

  it('renders the empty state when there are no matching leads', async () => {
    leadRepository.getLeads.and.resolveTo([]);

    createComponent();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No leads found');
    expect(fixture.nativeElement.textContent).toContain(
      'Try adjusting your filters or create a new lead to get started.'
    );
  });

  it('resets list state when loading fails', async () => {
    const error = new Error('load failed');
    proposalRepository.getAllProposals.and.rejectWith(error);

    createComponent();
    await fixture.whenStable();

    expect(component.loading()).toBeFalse();
    expect(component.leads()).toEqual([]);
    expect(component.proposals()).toEqual([]);
    expect(component.proposalResponseActivities()).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[LeadsComponent] loadLeads error:',
      error
    );
  });

  it('filters by search text and explicit hidden statuses', async () => {
    const convertedLead = {
      ...testLead,
      lead_id: 'lead-converted',
      first_name: 'Converted',
      last_name: 'Lead',
      email: 'converted@example.test',
      status: 'converted',
    } as Lead;
    leadRepository.getLeads.and.resolveTo([testLead, convertedLead]);

    createComponent();
    await fixture.whenStable();

    expect(component.filteredLeads()).toEqual([testLead]);

    component.onSearchChange('converted');
    expect(component.filteredLeads()).toEqual([]);

    component.onFilterChange({ key: 'status', value: 'converted' });
    expect(component.filteredLeads()).toEqual([convertedLead]);
  });

  it('builds event and service type filter options from loaded leads', async () => {
    leadRepository.getLeads.and.resolveTo([
      testLead,
      {
        ...testLead,
        lead_id: 'lead-general',
        event_type: 'corporate',
        service_type: 'custom-installation',
      },
    ]);

    createComponent();
    await fixture.whenStable();

    const eventFilter = component.filters().find((filter) => filter.key === 'event_type');
    const serviceFilter = component.filters().find(
      (filter) => filter.key === 'service_type'
    );

    expect(eventFilter?.options.map((option) => option.value)).toContain(
      'corporate'
    );
    expect(serviceFilter?.options.map((option) => option.value)).toContain(
      'custom-installation'
    );
  });

  it('selects the active or newest proposal for each lead', async () => {
    const inactiveNewerProposal = {
      ...testFloralProposal,
      floral_proposal_id: 'proposal-newer-inactive',
      version: 3,
      is_active: false,
    } as FloralProposal;
    proposalRepository.getAllProposals.and.resolveTo([
      inactiveNewerProposal,
      testFloralProposal,
    ]);

    createComponent();
    await fixture.whenStable();

    expect(component.getProposalForLead(testLead.lead_id)).toEqual(
      testFloralProposal
    );
  });

  it('maps the newest proposal response activity by lead', async () => {
    activityRepository.getProposalResponseActivities.and.resolveTo([
      createProposalResponseActivity('old-response', 'accept', 'Looks good', '2026-06-01T12:00:00.000Z'),
      createProposalResponseActivity('new-response', 'decline', 'Please revise', '2026-06-02T12:00:00.000Z'),
      {
        ...createProposalResponseActivity('ignored-response', 'accept', null, '2026-06-03T12:00:00.000Z'),
        metadata: { response_action: 'accept' },
      },
    ]);

    createComponent();
    await fixture.whenStable();

    expect(component.getProposalResponseForLead(testLead.lead_id)).toEqual(
      jasmine.objectContaining({
      proposal_id: 'new-response',
      action: 'decline',
      feedback: 'Please revise',
      created_at: '2026-06-02T12:00:00.000Z',
    })
    );
  });

  it('opens selected leads through the admin route', async () => {
    createComponent();

    component.openLead(testLead);

    expect(router.navigate).toHaveBeenCalledWith([
      '/admin/leads',
      testLead.lead_id,
    ]);
  });

  it('formats date-only event dates without shifting the selected day', async () => {
    createComponent();
    await fixture.whenStable();

    expect(component.formatEventDate('2026-11-28')).toBe('Nov 28, 2026');
  });

  it('creates a manual general lead and refreshes the list', async () => {
    leadRepository.createGeneralLead.and.resolveTo(testLead);
    activityRepository.createLeadActivity.and.resolveTo({} as never);

    createComponent();
    await fixture.whenStable();

    component.openCreateLeadModal();
    await component.createLead({
      event_type: 'general',
      service_type: 'custom-installation',
      first_name: 'Iris',
      last_name: 'Miller',
      email: 'iris@example.test',
      source: 'crm',
    });

    expect(leadRepository.createGeneralLead).toHaveBeenCalledWith(
      jasmine.objectContaining({
        event_type: 'general',
        service_type: 'custom-installation',
        first_name: 'Iris',
        last_name: 'Miller',
        email: 'iris@example.test',
        source: 'crm',
      })
    );
    expect(activityRepository.createLeadActivity).toHaveBeenCalledWith(
      jasmine.objectContaining({
        lead_id: testLead.lead_id,
        activity_type: 'created',
        metadata: jasmine.objectContaining({
          created_from: 'crm_leads_page',
          event_type: 'general',
          service_type: 'custom-installation',
        }),
      })
    );
    expect(component.createModalOpen()).toBeFalse();
    expect(toast.showToast).toHaveBeenCalledWith(
      'Lead created successfully.',
      'success'
    );
    expect(router.navigate).toHaveBeenCalledWith([
      '/admin/leads',
      testLead.lead_id,
    ]);
  });

  it('sets an error and releases saving state when lead creation fails', async () => {
    const error = new Error('create failed');
    leadRepository.createWeddingLead.and.rejectWith(error);

    createComponent();
    await fixture.whenStable();

    await component.createLead({
      event_type: 'wedding',
      service_type: 'wedding-full-service',
      first_name: 'Iris',
      last_name: 'Miller',
      email: 'iris@example.test',
    });

    expect(component.error()).toBe('We were unable to create the lead right now.');
    expect(component.createSaving()).toBeFalse();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[LeadsComponent] createLead error:',
      error
    );
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(LeadsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }
});

function createProposalResponseActivity(
  proposalId: string,
  action: 'accept' | 'decline',
  feedback: string | null,
  createdAt: string
): LeadActivity {
  return {
    lead_activity_id: `activity-${proposalId}`,
    lead_id: testLead.lead_id,
    activity_type: 'proposal_viewed',
    activity_label: 'Proposal response',
    activity_description: null,
    performed_by: null,
    metadata: {
      floral_proposal_id: proposalId,
      response_action: action,
      feedback,
    },
    created_at: createdAt,
  };
}
