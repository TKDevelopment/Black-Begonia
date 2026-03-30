import { TestBed } from '@angular/core/testing';

import { LeadWorkflowService } from './lead-workflow.service';

describe('LeadWorkflowService', () => {
  let service: LeadWorkflowService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LeadWorkflowService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
