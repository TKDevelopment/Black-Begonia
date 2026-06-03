import { TestBed } from '@angular/core/testing';

import { ToastService } from '../../core/services/toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should emit success toasts by default', (done) => {
    service.toast$.subscribe((toast) => {
      expect(toast).toEqual({ message: 'Saved', type: 'success' });
      done();
    });

    service.showToast('Saved');
  });

  it('should emit requested toast type', (done) => {
    service.toast$.subscribe((toast) => {
      expect(toast).toEqual({ message: 'Failed', type: 'error' });
      done();
    });

    service.showToast('Failed', 'error');
  });
});
