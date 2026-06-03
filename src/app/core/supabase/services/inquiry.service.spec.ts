import { TestBed } from '@angular/core/testing';

import { InquiryService } from './inquiry.service';

describe('InquiryService', () => {
  let service: InquiryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(InquiryService);
  });

  it('is injectable for future inquiry workflow behavior', () => {
    expect(service).toBeTruthy();
  });

  it('does not currently own executable inquiry success or failure workflow logic', () => {
    const prototypeMethods = Object.getOwnPropertyNames(InquiryService.prototype)
      .filter(methodName => methodName !== 'constructor');

    expect(prototypeMethods).toEqual([]);
  });
});
