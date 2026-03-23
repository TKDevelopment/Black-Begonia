import { TestBed } from '@angular/core/testing';

import { ActivityRepositoryService } from './activity-repository.service';

describe('ActivityRepositoryService', () => {
  let service: ActivityRepositoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ActivityRepositoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
