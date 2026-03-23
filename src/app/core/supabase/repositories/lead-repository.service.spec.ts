import { TestBed } from '@angular/core/testing';

import { LeadRepositoryService } from './lead-repository.service';

describe('LeadRepositoryService', () => {
  let service: LeadRepositoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LeadRepositoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
