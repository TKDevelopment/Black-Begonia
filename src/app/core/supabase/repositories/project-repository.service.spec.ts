import { TestBed } from '@angular/core/testing';

import { ProjectRepositoryService } from './project-repository.service';

describe('ProjectRepositoryService', () => {
  let service: ProjectRepositoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProjectRepositoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
