import { TestBed } from '@angular/core/testing';

import { TaskWorkflowService } from './task-workflow.service';

describe('TaskWorkflowServiceService', () => {
  let service: TaskWorkflowService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TaskWorkflowService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
