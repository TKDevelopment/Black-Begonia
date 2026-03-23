import { TestBed } from '@angular/core/testing';

import { InternalUserRepositoryService } from './internal-user-repository.service';

describe('InternalUserRepositoryService', () => {
  let service: InternalUserRepositoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(InternalUserRepositoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
