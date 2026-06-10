import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { convertToParamMap } from '@angular/router';

import {
  testFloralProposal,
  testLead,
} from '../../../../core/testing/workflow-fixtures';
import { ActivityRepositoryService } from '../../../../core/supabase/repositories/activity-repository.service';
import { FloralProposalWorkflowService } from '../../../../core/supabase/services/floral-proposal-workflow.service';
import { InternalUserRepositoryService } from '../../../../core/supabase/repositories/internal-user-repository.service';
import { LeadConversionService } from '../../../../core/supabase/services/lead-conversion.service';
import { LeadInspirationUrlRepositoryService } from '../../../../core/supabase/repositories/lead-inspiration-url-repository.service';
import { LeadRepositoryService } from '../../../../core/supabase/repositories/lead-repository.service';
import { LeadWorkflowService } from '../../../../core/supabase/services/lead-workflow.service';
import { TaskWorkflowService } from '../../../../core/supabase/services/task-workflow.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CrmThemeService } from '../../../../core/services/crm-theme.service';
import { Lead } from '../../../../core/models/lead';
import { LeadActivity } from '../../../../core/models/lead-activity';
import { Task } from '../../../../core/models/task';
import { LeadDetailComponent } from './lead-detail.component';

describe('LeadDetailComponent', () => {
  let component: LeadDetailComponent;
  let fixture: ComponentFixture<LeadDetailComponent>;
  let leadRepository: jasmine.SpyObj<LeadRepositoryService>;
  let activityRepository: jasmine.SpyObj<ActivityRepositoryService>;
  let leadWorkflow: jasmine.SpyObj<LeadWorkflowService>;
  let proposalWorkflow: jasmine.SpyObj<FloralProposalWorkflowService>;
  let inspirationRepository: jasmine.SpyObj<LeadInspirationUrlRepositoryService>;
  let internalUserRepository: jasmine.SpyObj<InternalUserRepositoryService>;
  let leadConversionService: jasmine.SpyObj<LeadConversionService>;
  let taskWorkflow: jasmine.SpyObj<TaskWorkflowService>;
  let router: jasmine.SpyObj<Router>;
  let toast: jasmine.SpyObj<ToastService>;
  let consoleErrorSpy: jasmine.Spy;

  beforeEach(async () => {
    leadRepository = jasmine.createSpyObj<LeadRepositoryService>(
      'LeadRepositoryService',
      ['getLeadById', 'updateLead', 'deleteLead']
    );
    activityRepository = jasmine.createSpyObj<ActivityRepositoryService>(
      'ActivityRepositoryService',
      [
        'getLeadActivity',
        'createLeadActivity',
        'updateLeadActivity',
        'deleteLeadActivity',
      ]
    );
    leadWorkflow = jasmine.createSpyObj<LeadWorkflowService>(
      'LeadWorkflowService',
      [
        'getAllowedNextStatuses',
        'getConsultationButtonLabel',
        'isConsultationButtonDisabled',
        'scheduleConsultation',
        'completeConsultation',
        'markContacted',
        'declineLead',
        'updateStatus',
        'reopenClosedUnbookedLead',
      ]
    );
    proposalWorkflow = jasmine.createSpyObj<FloralProposalWorkflowService>(
      'FloralProposalWorkflowService',
      ['getLeadProposals', 'canSubmitProposal', 'resendProposalAccessEmail']
    );
    inspirationRepository =
      jasmine.createSpyObj<LeadInspirationUrlRepositoryService>(
        'LeadInspirationUrlRepositoryService',
        [
          'getInspirationUrlsByLeadId',
          'uploadInspirationPhoto',
          'deleteInspirationPhoto',
        ]
      );
    internalUserRepository = jasmine.createSpyObj<InternalUserRepositoryService>(
      'InternalUserRepositoryService',
      ['getInternalUsers']
    );
    leadConversionService = jasmine.createSpyObj<LeadConversionService>(
      'LeadConversionService',
      ['convertLead']
    );
    taskWorkflow = jasmine.createSpyObj<TaskWorkflowService>(
      'TaskWorkflowService',
      ['getTasksByLeadId', 'getTaskById', 'createTask', 'updateTask']
    );
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['showToast']);

    leadRepository.getLeadById.and.resolveTo(testLead);
    leadRepository.updateLead.and.resolveTo(testLead);
    leadRepository.deleteLead.and.resolveTo();
    activityRepository.getLeadActivity.and.resolveTo([
      createActivity('created', 'Lead created'),
    ]);
    activityRepository.createLeadActivity.and.resolveTo({} as never);
    activityRepository.updateLeadActivity.and.resolveTo({} as never);
    activityRepository.deleteLeadActivity.and.resolveTo();
    leadWorkflow.getAllowedNextStatuses.and.returnValue(['contacted']);
    leadWorkflow.getConsultationButtonLabel.and.returnValue('Schedule Consultation');
    leadWorkflow.isConsultationButtonDisabled.and.returnValue(false);
    leadWorkflow.scheduleConsultation.and.resolveTo(testLead);
    leadWorkflow.completeConsultation.and.resolveTo(testLead);
    leadWorkflow.markContacted.and.resolveTo(testLead);
    leadWorkflow.declineLead.and.resolveTo(testLead);
    leadWorkflow.updateStatus.and.resolveTo(testLead);
    leadWorkflow.reopenClosedUnbookedLead.and.resolveTo(testLead);
    proposalWorkflow.getLeadProposals.and.resolveTo([testFloralProposal]);
    proposalWorkflow.canSubmitProposal.and.returnValue(false);
    proposalWorkflow.resendProposalAccessEmail.and.resolveTo();
    inspirationRepository.getInspirationUrlsByLeadId.and.resolveTo([]);
    internalUserRepository.getInternalUsers.and.resolveTo([
      {
        id: 'user-test-001',
        email: 'designer@example.test',
        first_name: 'Drew',
        last_name: 'Designer',
      },
    ]);
    leadConversionService.convertLead.and.resolveTo({
      project: { project_name: 'Avery Bloom Wedding' },
    } as never);
    taskWorkflow.getTasksByLeadId.and.resolveTo([]);
    taskWorkflow.getTaskById.and.resolveTo(createTask());
    taskWorkflow.createTask.and.resolveTo(createTask());
    taskWorkflow.updateTask.and.resolveTo(createTask());
    router.navigate.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [LeadDetailComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ leadId: testLead.lead_id }),
            },
          },
        },
        { provide: Router, useValue: router },
        { provide: LeadRepositoryService, useValue: leadRepository },
        { provide: ActivityRepositoryService, useValue: activityRepository },
        { provide: LeadWorkflowService, useValue: leadWorkflow },
        { provide: FloralProposalWorkflowService, useValue: proposalWorkflow },
        {
          provide: LeadInspirationUrlRepositoryService,
          useValue: inspirationRepository,
        },
        { provide: InternalUserRepositoryService, useValue: internalUserRepository },
        { provide: LeadConversionService, useValue: leadConversionService },
        { provide: TaskWorkflowService, useValue: taskWorkflow },
        { provide: ToastService, useValue: toast },
        { provide: CrmThemeService, useValue: { isDarkMode: false } },
      ],
    }).compileComponents();

    consoleErrorSpy = spyOn(console, 'error');
  });

  it('loads the lead detail workflow on init', async () => {
    createComponent();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.loading()).toBeFalse();
    expect(component.lead()).toEqual(testLead);
    expect(component.proposals()).toEqual([testFloralProposal]);
    expect(component.selectedProposalId()).toBe(testFloralProposal.floral_proposal_id);
    expect(component.assignedUserName()).toBe('Unassigned');
    expect(leadRepository.getLeadById).toHaveBeenCalledWith(testLead.lead_id);
    expect(activityRepository.getLeadActivity).toHaveBeenCalledWith(
      testLead.lead_id
    );
  });

  it('preserves newest-first proposal ordering from the workflow and defaults selection to the latest version', async () => {
    const oldestProposal = {
      ...testFloralProposal,
      floral_proposal_id: 'proposal-v1',
      version: 1,
    };
    const latestProposal = {
      ...testFloralProposal,
      floral_proposal_id: 'proposal-v3',
      version: 3,
      is_active: true,
    };
    proposalWorkflow.getLeadProposals.and.resolveTo([latestProposal, oldestProposal]);

    createComponent();
    await fixture.whenStable();

    expect(component.proposals().map((proposal) => proposal.version)).toEqual([3, 1]);
    expect(component.selectedProposalId()).toBe('proposal-v3');
  });

  it('navigates back to the lead list when the route has no lead id', async () => {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { paramMap: convertToParamMap({}) } },
    });

    createComponent();
    await fixture.whenStable();

    expect(router.navigate).toHaveBeenCalledWith(['/admin/leads']);
    expect(leadRepository.getLeadById).not.toHaveBeenCalled();
  });

  it('shows an error when the lead record is not found', async () => {
    leadRepository.getLeadById.and.resolveTo(null);

    createComponent();
    await fixture.whenStable();

    expect(component.loading()).toBeFalse();
    expect(component.error()).toBe('We could not find this lead record.');
    expect(component.lead()).toBeNull();
    expect(component.proposals()).toEqual([]);
  });

  it('marks a lead as contacted and refreshes detail state', async () => {
    createComponent();
    await fixture.whenStable();

    await component.markContacted();

    expect(leadWorkflow.markContacted).toHaveBeenCalledWith(testLead.lead_id);
    expect(leadRepository.getLeadById).toHaveBeenCalledTimes(2);
    expect(component.actionLoading()).toBeFalse();
  });

  it('runs consultation actions and routes proposal-ready leads to the builder', async () => {
    createComponent();
    await fixture.whenStable();

    await component.handleConsultationAction();
    expect(leadWorkflow.scheduleConsultation).toHaveBeenCalledWith(testLead);

    component.lead.set({ ...testLead, status: 'consultation_scheduled' });
    await component.handleConsultationAction();
    expect(leadWorkflow.completeConsultation).toHaveBeenCalled();

    proposalWorkflow.canSubmitProposal.and.returnValue(true);
    component.lead.set({ ...testLead, status: 'nurturing' });
    await component.handleConsultationAction();
    expect(router.navigate).toHaveBeenCalledWith([
      '/admin/leads',
      testLead.lead_id,
      'floral-proposal-builder',
    ]);
  });

  it('exposes builder-entry actions directly from lead detail when proposal submission is allowed', async () => {
    createComponent();
    await fixture.whenStable();

    proposalWorkflow.canSubmitProposal.and.returnValue(true);
    component.lead.set({ ...testLead, status: 'nurturing' });

    expect(component.canSubmitProposal()).toBeTrue();

    component.openProposalBuilder();
    expect(router.navigate).toHaveBeenCalledWith([
      '/admin/leads',
      testLead.lead_id,
      'floral-proposal-builder',
    ]);
  });

  it('opens conversion for accepted proposals and confirms conversion', async () => {
    createComponent();
    await fixture.whenStable();

    component.lead.set({ ...testLead, status: 'proposal_accepted' });
    await component.handleConsultationAction();

    expect(component.convertModalOpen()).toBeTrue();

    await component.confirmConvert({
      project_name: 'Avery Bloom Wedding',
      primary_contact_role: 'client',
    } as never);

    expect(leadConversionService.convertLead).toHaveBeenCalled();
    expect(component.convertModalOpen()).toBeFalse();
    expect(toast.showToast).toHaveBeenCalledWith(
      'Lead converted to project "Avery Bloom Wedding".',
      'success'
    );
  });

  it('declines and updates lead status through workflow services', async () => {
    createComponent();
    await fixture.whenStable();

    component.openDeclineModal();
    await component.confirmDecline('Budget mismatch');
    await component.updateLeadStatus('contacted');

    expect(leadWorkflow.declineLead).toHaveBeenCalledWith(
      testLead.lead_id,
      'Budget mismatch'
    );
    expect(component.declineModalOpen()).toBeFalse();
    expect(leadWorkflow.updateStatus).toHaveBeenCalledWith(testLead, 'contacted');
  });

  it('resends proposal access and reports resend failures', async () => {
    createComponent();
    await fixture.whenStable();

    await component.resendProposalAccess(testFloralProposal.floral_proposal_id);
    expect(proposalWorkflow.resendProposalAccessEmail).toHaveBeenCalledWith(
      testFloralProposal.floral_proposal_id
    );
    expect(toast.showToast).toHaveBeenCalledWith(
      'Proposal access email resent.',
      'success'
    );

    const error = new Error('resend failed');
    proposalWorkflow.resendProposalAccessEmail.and.rejectWith(error);
    await component.resendProposalAccess(testFloralProposal.floral_proposal_id);

    expect(component.error()).toBe('resend failed');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[LeadDetailComponent] resendProposalAccess error:',
      error
    );
  });

  it('saves lead edits with change metadata', async () => {
    createComponent();
    await fixture.whenStable();

    await component.saveLeadEdits({
      event_type: 'general',
      service_type: 'custom-installation',
      first_name: 'Avery',
      last_name: 'Bloom',
      email: 'avery.new@example.test',
      source: 'crm',
    });

    expect(leadRepository.updateLead).toHaveBeenCalledWith(
      testLead.lead_id,
      jasmine.objectContaining({
        event_type: 'general',
        service_type: 'custom-installation',
        email: 'avery.new@example.test',
        partner_first_name: null,
        guest_count: null,
      })
    );
    expect(activityRepository.createLeadActivity).toHaveBeenCalledWith(
      jasmine.objectContaining({
        activity_type: 'updated',
        activity_label: 'Lead details updated',
        metadata: jasmine.objectContaining({
          changed_fields: jasmine.arrayContaining(['event type', 'email']),
          updated_from: 'crm_lead_detail',
        }),
      })
    );
    expect(toast.showToast).toHaveBeenCalledWith(
      'Lead updated successfully.',
      'success'
    );
  });

  it('validates and saves internal notes', async () => {
    createComponent();
    await fixture.whenStable();

    await component.saveInternalNote();
    expect(component.noteDraftError()).toBe('Please enter a note before saving.');

    component.noteDraft.set('  Follow up next week. ');
    await component.saveInternalNote();

    expect(activityRepository.createLeadActivity).toHaveBeenCalledWith(
      jasmine.objectContaining({
        activity_type: 'note_added',
        activity_description: 'Follow up next week.',
        metadata: jasmine.objectContaining({
          note_source: 'crm_lead_detail',
          note_kind: 'internal',
        }),
      })
    );
    expect(component.noteDraft()).toBe('');
    expect(toast.showToast).toHaveBeenCalledWith(
      'Internal note added.',
      'success'
    );
  });

  it('opens, creates, and updates related tasks', async () => {
    const task = createTask();
    taskWorkflow.getTasksByLeadId.and.resolveTo([task]);

    createComponent();
    await fixture.whenStable();

    expect(component.relatedTaskItems).toEqual([
      jasmine.objectContaining({
        task_id: task.task_id,
        title: task.title,
        assignee_name: 'Drew Designer',
      }),
    ]);

    await component.openTask(component.relatedTaskItems[0]);
    expect(component.taskModalMode()).toBe('edit');
    expect(component.taskModalOpen()).toBeTrue();

    component.closeTaskModal(true);
    component.createTaskFromLead();
    await component.saveTask({
      title: 'Schedule follow-up',
      description: 'Call client',
      status: 'open',
      priority: 'medium',
      assigned_user_id: null,
      due_at: null,
    } as never);

    expect(taskWorkflow.createTask).toHaveBeenCalledWith(
      jasmine.objectContaining({
        related_entity_type: 'lead',
        related_entity_id: testLead.lead_id,
        lead_id: testLead.lead_id,
        project_id: null,
      })
    );
    expect(toast.showToast).toHaveBeenCalledWith('Task created.', 'success');

    component.selectedTask.set(task);
    component.taskModalMode.set('edit');
    await component.saveTask({ title: 'Updated task' } as never);
    expect(taskWorkflow.updateTask).toHaveBeenCalledWith(task, {
      title: 'Updated task',
    } as never);
  });

  it('deletes a lead after confirmation and handles linked-record failures', async () => {
    spyOn(window, 'confirm').and.returnValue(true);

    createComponent();
    await fixture.whenStable();

    await component.requestDeleteLead();

    expect(leadRepository.deleteLead).toHaveBeenCalledWith(testLead.lead_id);
    expect(toast.showToast).toHaveBeenCalledWith(
      'Lead deleted permanently.',
      'success'
    );
    expect(router.navigate).toHaveBeenCalledWith(['/admin/leads']);

    leadRepository.deleteLead.and.rejectWith({
      code: '23503',
      message: 'foreign key constraint',
    });
    await component.requestDeleteLead();

    const message =
      'This lead is still linked to existing CRM records and cannot be deleted yet.';
    expect(component.error()).toBe(message);
    expect(toast.showToast).toHaveBeenCalledWith(message, 'error');
  });

  it('reopens closed unbooked leads and blocks read-only edit actions', async () => {
    createComponent();
    await fixture.whenStable();

    component.lead.set({ ...testLead, status: 'closed_unbooked' });
    component.editLead();
    component.openDeclineModal();
    component.convertLead();

    expect(component.editModalOpen()).toBeFalse();
    expect(component.declineModalOpen()).toBeFalse();
    expect(component.convertModalOpen()).toBeFalse();

    await component.reopenClosedUnbookedLead();

    expect(leadWorkflow.reopenClosedUnbookedLead).toHaveBeenCalled();
    expect(toast.showToast).toHaveBeenCalledWith(
      'Lead reopened and moved back to Nurturing.',
      'success'
    );
  });

  it('covers helper formatting, null linked data, and unknown activity branches', async () => {
    createComponent();
    await fixture.whenStable();

    component.lead.set({ ...testLead, budget_range: null });

    expect(component.formatDate(null)).toBe('Not set');
    expect(component.formatDateTime(undefined)).toBe('Not available');
    expect(component.formatCurrency(null)).toBe('Not provided');
    expect(component.getBudgetRange()).toBe('Not provided');
    expect(component.getActivityIconClasses('unknown')).toBe('bg-stone-100 text-stone-700');
    expect(component.getActivityIconPath('unknown')).toBe(
      'M8 7.5h8M8 12h8m-8 4.5h5M5.5 7.5h.01M5.5 12h.01M5.5 16.5h.01'
    );
  });

  it('covers cancel, generic delete failure, and task open failure branches', async () => {
    const confirmSpy = spyOn(window, 'confirm').and.returnValue(false);

    createComponent();
    await fixture.whenStable();

    await component.requestDeleteLead();
    expect(confirmSpy).toHaveBeenCalled();
    expect(leadRepository.deleteLead).not.toHaveBeenCalled();

    leadRepository.deleteLead.and.rejectWith(new Error('delete failed'));
    confirmSpy.and.returnValue(true);
    await component.requestDeleteLead();

    expect(component.error()).toBe('We were unable to delete this lead right now.');
    expect(toast.showToast).toHaveBeenCalledWith(
      'We were unable to delete this lead right now.',
      'error'
    );

    taskWorkflow.getTaskById.and.resolveTo(null);
    await component.openTask({
      task_id: 'missing-task',
      title: 'Missing',
      status: 'open',
      due_at: null,
      assignee_name: 'Unassigned',
    });
    expect(toast.showToast).toHaveBeenCalledWith('We could not find that task.', 'error');

    taskWorkflow.getTaskById.and.rejectWith(new Error('task load failed'));
    await component.openTask({
      task_id: 'broken-task',
      title: 'Broken',
      status: 'open',
      due_at: null,
      assignee_name: 'Unassigned',
    });
    expect(component.error()).toBe('We were unable to open this task right now.');
  });

  it('covers workflow failure branches for consultation, notes, task saves, and lead edits', async () => {
    createComponent();
    await fixture.whenStable();

    leadWorkflow.scheduleConsultation.and.rejectWith(new Error('schedule failed'));
    await component.handleConsultationAction();
    expect(component.error()).toBe('We were unable to update the consultation workflow.');

    component.noteDraft.set('Need a follow-up');
    activityRepository.createLeadActivity.and.rejectWith(new Error('note failed'));
    await component.saveInternalNote();
    expect(component.error()).toBe('We were unable to save the internal note.');

    component.createTaskFromLead();
    taskWorkflow.createTask.and.rejectWith(new Error('task create failed'));
    await component.saveTask({
      title: 'Broken task',
      description: null,
      status: 'open',
      priority: 'medium',
      assigned_user_id: null,
      due_at: null,
    } as never);
    expect(component.error()).toBe('We were unable to save the task right now.');

    component.editLead();
    leadRepository.updateLead.and.rejectWith(new Error('update failed'));
    await component.saveLeadEdits({
      event_type: 'general',
      service_type: 'custom-installation',
      first_name: 'Avery',
      last_name: 'Bloom',
      email: 'avery@example.test',
      source: 'crm',
    });
    expect(component.error()).toBe('We were unable to save lead updates right now.');
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(LeadDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }
});

function createActivity(
  activityType: LeadActivity['activity_type'],
  label: string
): LeadActivity {
  return {
    lead_activity_id: `activity-${activityType}`,
    lead_id: testLead.lead_id,
    activity_type: activityType,
    activity_label: label,
    activity_description: label,
    performed_by: null,
    metadata: null,
    created_at: testLead.created_at,
  };
}

function createTask(): Task {
  return {
    task_id: 'task-test-001',
    title: 'Follow up',
    description: 'Call the client',
    status: 'open',
    priority: 'medium',
    due_at: '2026-06-05T12:00:00.000Z',
    completed_at: null,
    related_entity_type: 'lead',
    related_entity_id: testLead.lead_id,
    lead_id: testLead.lead_id,
    project_id: null,
    assigned_user_id: 'user-test-001',
    created_by: 'user-test-001',
    created_at: testLead.created_at,
    updated_at: testLead.updated_at,
    assigned_user: {
      id: 'user-test-001',
      email: 'designer@example.test',
      first_name: 'Drew',
      last_name: 'Designer',
    },
  };
}
