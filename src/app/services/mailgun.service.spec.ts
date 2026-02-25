import { TestBed } from '@angular/core/testing';

import { MailgunService } from './mailgun.service';

describe('MailgunService', () => {
  let service: MailgunService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MailgunService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
