import { TestBed } from '@angular/core/testing';

import { testProposalResponseActivity } from '../../testing/workflow-fixtures';
import {
  createSupabaseClientWithQuery,
  supabaseFailure,
  supabaseSuccess,
} from '../../testing/supabase-testing';
import { SupabaseService } from '../clients/supabase.service';
import { ActivityRepositoryService } from './activity-repository.service';

describe('ActivityRepositoryService', () => {
  let service: ActivityRepositoryService;
  let supabaseService: jasmine.SpyObj<SupabaseService>;
  let consoleErrorSpy: jasmine.Spy;

  beforeEach(() => {
    supabaseService = jasmine.createSpyObj<SupabaseService>('SupabaseService', ['getClient']);

    TestBed.configureTestingModule({
      providers: [
        ActivityRepositoryService,
        { provide: SupabaseService, useValue: supabaseService },
      ],
    });

    service = TestBed.inject(ActivityRepositoryService);
    consoleErrorSpy = spyOn(console, 'error');
  });

  it('loads lead activity for a lead newest first', async () => {
    const { client, query } = createSupabaseClientWithQuery(
      supabaseSuccess([testProposalResponseActivity])
    );
    supabaseService.getClient.and.returnValue(client as never);

    const activity = await service.getLeadActivity('lead-test-001');

    expect(client.from).toHaveBeenCalledWith('lead_activity');
    expect(query.eq).toHaveBeenCalledWith('lead_id', 'lead-test-001');
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(activity).toEqual([testProposalResponseActivity]);
  });

  it('loads proposal response activities without a lead filter', async () => {
    const { client, query } = createSupabaseClientWithQuery(
      supabaseSuccess([testProposalResponseActivity])
    );
    supabaseService.getClient.and.returnValue(client as never);

    await service.getProposalResponseActivities();

    expect(query.eq).not.toHaveBeenCalled();
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('maps the submitting florist profile for project revision activity', async () => {
    const row = {
      activity_log_id: 'activity-1', entity_type: 'project', entity_id: 'project-1',
      activity_type: 'proposal_revision_submitted', activity_label: 'Revision submitted',
      performed_by: 'user-1', profiles: { display_name: 'Lead Florist', email: 'owner@example.com' },
      metadata: { new_version: 2 }, created_at: '2026-01-01T00:00:00Z',
    };
    const { client, query } = createSupabaseClientWithQuery(supabaseSuccess([row]));
    supabaseService.getClient.and.returnValue(client as never);
    const result = await service.getProjectActivity('project-1');
    expect(query.eq).toHaveBeenCalledWith('entity_type', 'project');
    expect(result[0].performed_by_display_name).toBe('Lead Florist');
    expect(result[0].performed_by_email).toBe('owner@example.com');
  });

  it('returns empty lists and logs when activity queries fail', async () => {
    const response = supabaseFailure('activity failed');
    const { client } = createSupabaseClientWithQuery(response);
    supabaseService.getClient.and.returnValue(client as never);

    await expectAsync(service.getLeadActivity('lead-test-001')).toBeResolvedTo([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ActivityRepositoryService] getLeadActivity error:',
      response.error
    );
  });

  it('returns an empty list when lead activity has no rows', async () => {
    const { client } = createSupabaseClientWithQuery(supabaseSuccess(null));
    supabaseService.getClient.and.returnValue(client as never);

    await expectAsync(service.getLeadActivity('lead-test-001')).toBeResolvedTo([]);
  });

  it('creates lead activity with default nullable fields and metadata', async () => {
    const { client, query } = createSupabaseClientWithQuery(supabaseSuccess(null));
    supabaseService.getClient.and.returnValue(client as never);

    await service.createLeadActivity({
      lead_id: 'lead-test-001',
      activity_type: 'note_added',
      activity_label: 'Note added',
    });

    expect(query.insert).toHaveBeenCalledWith({
      lead_id: 'lead-test-001',
      activity_type: 'note_added',
      activity_label: 'Note added',
      activity_description: null,
      performed_by: null,
      metadata: {},
    });
  });

  it('updates lead activity and defaults missing metadata to an empty object', async () => {
    const { client, query } = createSupabaseClientWithQuery(supabaseSuccess(null));
    supabaseService.getClient.and.returnValue(client as never);

    await service.updateLeadActivity('activity-1', {
      activity_label: 'Updated',
      activity_description: null,
    });

    expect(query.update).toHaveBeenCalledWith({
      activity_label: 'Updated',
      activity_description: null,
      metadata: {},
    });
    expect(query.eq).toHaveBeenCalledWith('lead_activity_id', 'activity-1');
  });

  it('deletes lead activity by id', async () => {
    const { client, query } = createSupabaseClientWithQuery(supabaseSuccess(null));
    supabaseService.getClient.and.returnValue(client as never);

    await service.deleteLeadActivity('activity-1');

    expect(query.delete).toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith('lead_activity_id', 'activity-1');
  });

  it('throws when lead activity mutations fail', async () => {
    const response = supabaseFailure('activity insert failed');
    const { client } = createSupabaseClientWithQuery(response);
    supabaseService.getClient.and.returnValue(client as never);

    await expectAsync(
      service.createLeadActivity({
        lead_id: 'lead-test-001',
        activity_type: 'note_added',
        activity_label: 'Note added',
      })
    ).toBeRejectedWith(response.error as Error);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ActivityRepositoryService] createLeadActivity error:',
      response.error
    );
  });
});
