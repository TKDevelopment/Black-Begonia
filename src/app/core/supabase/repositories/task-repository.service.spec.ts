import { TestBed } from '@angular/core/testing';

import { testTask } from '../../testing/workflow-fixtures';
import {
  createSupabaseClientWithQuery,
  supabaseFailure,
  supabaseSuccess,
} from '../../testing/supabase-testing';
import { SupabaseService } from '../clients/supabase.service';
import { TaskRepositoryService } from './task-repository.service';

describe('TaskRepositoryService', () => {
  let service: TaskRepositoryService;
  let supabaseService: jasmine.SpyObj<SupabaseService>;
  let consoleErrorSpy: jasmine.Spy;

  const taskRow = {
    ...testTask,
    assigned_user: [testTask.assigned_user],
    created_by_user: [testTask.created_by_user],
    lead: [{ lead_id: 'lead-test-001', first_name: 'Avery', last_name: 'Bloom' }],
  };

  beforeEach(() => {
    supabaseService = jasmine.createSpyObj<SupabaseService>('SupabaseService', ['getClient']);

    TestBed.configureTestingModule({
      providers: [
        TaskRepositoryService,
        { provide: SupabaseService, useValue: supabaseService },
      ],
    });

    service = TestBed.inject(TaskRepositoryService);
    consoleErrorSpy = spyOn(console, 'error');
  });

  it('loads tasks ordered newest first and maps joined arrays', async () => {
    const { client, query } = createSupabaseClientWithQuery(supabaseSuccess([taskRow]));
    supabaseService.getClient.and.returnValue(client as never);

    const tasks = await service.getTasks();

    expect(client.from).toHaveBeenCalledWith('tasks');
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(tasks[0]).toEqual(testTask);
  });

  it('loads tasks by lead id', async () => {
    const { client, query } = createSupabaseClientWithQuery(supabaseSuccess([taskRow]));
    supabaseService.getClient.and.returnValue(client as never);

    await service.getTasksByLeadId('lead-test-001');

    expect(query.eq).toHaveBeenCalledWith('lead_id', 'lead-test-001');
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('returns empty lists and logs when task queries fail', async () => {
    const response = supabaseFailure('tasks failed');
    const { client } = createSupabaseClientWithQuery(response);
    supabaseService.getClient.and.returnValue(client as never);

    await expectAsync(service.getTasks()).toBeResolvedTo([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[TaskRepositoryService] getTasks error:',
      response.error
    );
  });

  it('loads a task by id and returns null when not found', async () => {
    const { client, query } = createSupabaseClientWithQuery(supabaseSuccess(taskRow));
    supabaseService.getClient.and.returnValue(client as never);

    const task = await service.getTaskById(testTask.task_id);

    expect(query.eq).toHaveBeenCalledWith('task_id', testTask.task_id);
    expect(query.maybeSingle).toHaveBeenCalled();
    expect(task).toEqual(testTask);

    const empty = createSupabaseClientWithQuery(supabaseSuccess(null));
    supabaseService.getClient.and.returnValue(empty.client as never);
    await expectAsync(service.getTaskById('missing')).toBeResolvedTo(null);
  });

  it('normalizes create payloads and sets completion dates for complete tasks', async () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-06-02T15:00:00.000Z'));
    const { client, query } = createSupabaseClientWithQuery(supabaseSuccess(taskRow));
    supabaseService.getClient.and.returnValue(client as never);

    await service.createTask({
      title: ' Follow up ',
      description: ' ',
      related_entity_type: 'lead',
      related_entity_id: 'lead-test-001',
      lead_id: 'lead-test-001',
      project_id: null,
      assigned_user_id: null,
      created_by: 'user-test-001',
      priority: 'high',
      status: 'complete',
      due_at: '2026-06-05',
    });

    expect(query.insert).toHaveBeenCalledWith({
      title: 'Follow up',
      description: null,
      related_entity_type: 'lead',
      related_entity_id: 'lead-test-001',
      lead_id: 'lead-test-001',
      project_id: null,
      assigned_user_id: null,
      created_by: 'user-test-001',
      priority: 'high',
      status: 'complete',
      due_at: '2026-06-05T00:00:00.000Z',
      completed_at: '2026-06-02T15:00:00.000Z',
    });
    jasmine.clock().uninstall();
  });

  it('clears completion dates when updating a task away from complete', async () => {
    const { client, query } = createSupabaseClientWithQuery(supabaseSuccess(taskRow));
    supabaseService.getClient.and.returnValue(client as never);

    await service.updateTask(testTask.task_id, {
      title: ' Revised ',
      status: 'open',
      due_at: null,
    });

    expect(query.update).toHaveBeenCalledWith({
      title: 'Revised',
      status: 'open',
      due_at: null,
      completed_at: null,
    });
    expect(query.eq).toHaveBeenCalledWith('task_id', testTask.task_id);
  });

  it('throws when task mutations fail', async () => {
    const response = supabaseFailure('task insert failed');
    const { client } = createSupabaseClientWithQuery(response);
    supabaseService.getClient.and.returnValue(client as never);

    await expectAsync(
      service.createTask({
        title: 'Follow up',
        priority: 'medium',
        status: 'open',
      })
    ).toBeRejectedWith(response.error as Error);
  });
});
