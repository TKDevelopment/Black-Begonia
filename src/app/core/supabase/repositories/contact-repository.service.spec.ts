import { TestBed } from '@angular/core/testing';

import { ContactRepositoryService } from './contact-repository.service';

describe('ContactRepositoryService', () => {
  let service: ContactRepositoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ContactRepositoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
