import { TestBed } from '@angular/core/testing';
import { AnalyticsScrollService } from './analytics-scroll.service';

describe('AnalyticsScrollService', () => {
  let service: AnalyticsScrollService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AnalyticsScrollService);
  });

  afterEach(() => service.stop());

  it('fires once when the current page reaches ninety percent', () => {
    const callback = jasmine.createSpy('callback');
    spyOnProperty(document.documentElement, 'scrollHeight', 'get').and.returnValue(1000);
    spyOnProperty(window, 'innerHeight', 'get').and.returnValue(500);
    spyOnProperty(window, 'scrollY', 'get').and.returnValue(400);
    service.start(callback);
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('cleans up the previous navigation listener when restarted or stopped', () => {
    const first = jasmine.createSpy('first');
    const second = jasmine.createSpy('second');
    spyOnProperty(document.documentElement, 'scrollHeight', 'get').and.returnValue(2000);
    spyOnProperty(window, 'innerHeight', 'get').and.returnValue(500);
    spyOnProperty(window, 'scrollY', 'get').and.returnValue(0);
    service.start(first);
    service.start(second);
    service.stop();
    window.dispatchEvent(new Event('scroll'));
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });
});
