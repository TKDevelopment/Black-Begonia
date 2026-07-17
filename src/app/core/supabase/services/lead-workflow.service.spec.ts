import { TestBed } from '@angular/core/testing';

import { testLead } from '../../testing/workflow-fixtures';
import { ActivityRepositoryService } from '../repositories/activity-repository.service';
import { LeadRepositoryService } from '../repositories/lead-repository.service';
import { LeadWorkflowService } from './lead-workflow.service';

describe('LeadWorkflowService', () => {
  let service: LeadWorkflowService;
  let leadRepository: jasmine.SpyObj<LeadRepositoryService>;
  let activityRepository: jasmine.SpyObj<ActivityRepositoryService>;

  beforeEach(() => {
    leadRepository = jasmine.createSpyObj<LeadRepositoryService>(
      'LeadRepositoryService',
      ['updateLead'],
    );
    activityRepository = jasmine.createSpyObj<ActivityRepositoryService>(
      'ActivityRepositoryService',
      ['createLeadActivity'],
    );
    activityRepository.createLeadActivity.and.resolveTo();

    TestBed.configureTestingModule({
      providers: [
        { provide: LeadRepositoryService, useValue: leadRepository },
        { provide: ActivityRepositoryService, useValue: activityRepository },
      ],
    });
    service = TestBed.inject(LeadWorkflowService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should mark a lead contacted and log the activity', async () => {
    const updatedLead = { ...testLead, status: 'contacted' as const };
    leadRepository.updateLead.and.resolveTo(updatedLead);

    const result = await service.markContacted(testLead.lead_id);

    expect(result).toBe(updatedLead);
    expect(leadRepository.updateLead).toHaveBeenCalledWith(
      testLead.lead_id,
      jasmine.objectContaining({ status: 'contacted' }),
    );
    expect(activityRepository.createLeadActivity).toHaveBeenCalledWith(
      jasmine.objectContaining({
        lead_id: testLead.lead_id,
        activity_type: 'contact_attempted',
        activity_label: 'Lead marked as contacted',
      }),
    );
  });

  it('should update status when the transition is allowed', async () => {
    const updatedLead = { ...testLead, status: 'consultation_scheduled' as const };
    leadRepository.updateLead.and.resolveTo(updatedLead);

    const result = await service.updateStatus(testLead, 'consultation_scheduled');

    expect(result).toBe(updatedLead);
    expect(leadRepository.updateLead).toHaveBeenCalledWith(testLead.lead_id, {
      status: 'consultation_scheduled',
    });
    expect(activityRepository.createLeadActivity).toHaveBeenCalledWith(
      jasmine.objectContaining({
        activity_type: 'status_change',
        metadata: {
          previous_status: 'new',
          next_status: 'consultation_scheduled',
        },
      }),
    );
  });

  it('should reject invalid status transitions before persisting', async () => {
    await expectAsync(service.updateStatus(testLead, 'converted')).toBeRejectedWithError(
      'Invalid lead status transition from "new" to "converted".',
    );

    expect(leadRepository.updateLead).not.toHaveBeenCalled();
    expect(activityRepository.createLeadActivity).not.toHaveBeenCalled();
  });

  it('should decline a lead with reason metadata', async () => {
    const updatedLead = { ...testLead, status: 'declined' as const };
    leadRepository.updateLead.and.resolveTo(updatedLead);

    const result = await service.declineLead(testLead.lead_id, 'Budget mismatch');

    expect(result).toBe(updatedLead);
    expect(leadRepository.updateLead).toHaveBeenCalledWith(
      testLead.lead_id,
      jasmine.objectContaining({
        status: 'declined',
        decline_reason: 'Budget mismatch',
      }),
    );
    expect(activityRepository.createLeadActivity).toHaveBeenCalledWith(
      jasmine.objectContaining({
        activity_type: 'declined',
        activity_description: 'Budget mismatch',
      }),
    );
  });

  it('should schedule and complete consultations only from allowed statuses', async () => {
    const scheduledLead = {
      ...testLead,
      status: 'consultation_scheduled' as const,
    };
    const nurturingLead = {
      ...testLead,
      status: 'nurturing' as const,
    };
    leadRepository.updateLead.and.resolveTo(scheduledLead);

    await service.scheduleConsultation(testLead);

    expect(leadRepository.updateLead).toHaveBeenCalledWith(
      testLead.lead_id,
      jasmine.objectContaining({ status: 'consultation_scheduled' }),
    );

    leadRepository.updateLead.and.resolveTo(nurturingLead);
    const result = await service.completeConsultation(scheduledLead);

    expect(result).toBe(nurturingLead);
    expect(leadRepository.updateLead).toHaveBeenCalledWith(
      testLead.lead_id,
      jasmine.objectContaining({ status: 'nurturing' }),
    );

    await expectAsync(
      service.scheduleConsultation({ ...testLead, status: 'declined' }),
    ).toBeRejectedWithError('Cannot schedule consultation from status "declined".');
    await expectAsync(service.completeConsultation(testLead)).toBeRejectedWithError(
      'Cannot complete consultation from status "new".',
    );
  });

  it('should reopen only closed unbooked leads', async () => {
    const closedLead = { ...testLead, status: 'closed_unbooked' as const };
    const reopenedLead = { ...testLead, status: 'nurturing' as const };
    leadRepository.updateLead.and.resolveTo(reopenedLead);

    const result = await service.reopenClosedUnbookedLead(closedLead);

    expect(result).toBe(reopenedLead);
    expect(activityRepository.createLeadActivity).toHaveBeenCalledWith(
      jasmine.objectContaining({
        activity_label: 'Lead reopened',
        metadata: {
          previous_status: 'closed_unbooked',
          next_status: 'nurturing',
          reopened_from: 'closed_unbooked',
        },
      }),
    );

    await expectAsync(service.reopenClosedUnbookedLead(testLead)).toBeRejectedWithError(
      'Cannot reopen a lead from status "new".',
    );
  });

  it('should expose consultation labels, disabled states, and allowed next statuses', () => {
    expect(service.canScheduleConsultation('new')).toBeTrue();
    expect(service.canScheduleConsultation('nurturing')).toBeFalse();
    expect(service.isConsultationButtonDisabled('converted')).toBeTrue();
    expect(service.isConsultationButtonDisabled('proposal_accepted')).toBeFalse();
    expect(service.getConsultationButtonLabel('proposal_accepted')).toBe(
      'Convert to Project',
    );
    expect(service.getConsultationButtonLabel('proposal_submitted')).toBe(
      'Floral Proposal Sent',
    );
    expect(service.getAllowedNextStatuses('proposal_submitted')).toEqual([
      'proposal_submitted',
      'proposal_declined',
      'proposal_accepted',
      'declined',
      'closed_unbooked',
    ]);
  });
});
