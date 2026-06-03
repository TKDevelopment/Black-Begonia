import { TestBed } from '@angular/core/testing';

import { testActivityLogEntry } from '../../testing/workflow-fixtures';
import {
  createSupabaseClientWithQuery,
  supabaseFailure,
  supabaseSuccess,
} from '../../testing/supabase-testing';
import { SupabaseService } from '../clients/supabase.service';
import { ActivityLogRepositoryService } from './activity-log-repository.service';

describe('ActivityLogRepositoryService', () => {
  let service: ActivityLogRepositoryService;
  let supabaseService: jasmine.SpyObj<SupabaseService>;
  let consoleErrorSpy: jasmine.Spy;

  beforeEach(() => {
    supabaseService = jasmine.createSpyObj<SupabaseService>('SupabaseService', ['getClient']);

    TestBed.configureTestingModule({
      providers: [
        ActivityLogRepositoryService,
        { provide: SupabaseService, useValue: supabaseService },
      ],
    });

    service = TestBed.inject(ActivityLogRepositoryService);
    consoleErrorSpy = spyOn(console, 'error');
  });

  it('loads entity activity by entity type and id newest first', async () => {
    const { client, query } = createSupabaseClientWithQuery(
      supabaseSuccess([testActivityLogEntry])
    );
    supabaseService.getClient.and.returnValue(client as never);

    const entries = await service.getEntityActivity('lead', 'lead-test-001');

    expect(client.from).toHaveBeenCalledWith('activity_log');
    expect(query.eq).toHaveBeenCalledWith('entity_type', 'lead');
    expect(query.eq).toHaveBeenCalledWith('entity_id', 'lead-test-001');
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(entries).toEqual([testActivityLogEntry]);
  });

  it('returns an empty list and logs when entity activity fails', async () => {
    const response = supabaseFailure('activity log failed');
    const { client } = createSupabaseClientWithQuery(response);
    supabaseService.getClient.and.returnValue(client as never);

    await expectAsync(service.getEntityActivity('lead', 'lead-test-001')).toBeResolvedTo([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ActivityLogRepositoryService] getEntityActivity error:',
      response.error
    );
  });

  it('creates activity log entries with default nullable fields and metadata', async () => {
    const { client, query } = createSupabaseClientWithQuery(supabaseSuccess(null));
    supabaseService.getClient.and.returnValue(client as never);

    await service.createActivityLog({
      entity_type: 'lead',
      entity_id: 'lead-test-001',
      activity_type: 'created',
      activity_label: 'Lead created',
    });

    expect(query.insert).toHaveBeenCalledWith({
      entity_type: 'lead',
      entity_id: 'lead-test-001',
      activity_type: 'created',
      activity_label: 'Lead created',
      description: null,
      performed_by: null,
      metadata: {},
    });
  });

  it('throws when activity log creation fails', async () => {
    const response = supabaseFailure('activity log insert failed');
    const { client } = createSupabaseClientWithQuery(response);
    supabaseService.getClient.and.returnValue(client as never);

    await expectAsync(
      service.createActivityLog({
        entity_type: 'lead',
        entity_id: 'lead-test-001',
        activity_type: 'created',
        activity_label: 'Lead created',
      })
    ).toBeRejectedWith(response.error as Error);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ActivityLogRepositoryService] createActivityLog error:',
      response.error
    );
  });
});
