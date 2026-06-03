import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

import { ToastService } from '../../../core/services/toast.service';
import { ToastComponent } from './toast.component';

describe('ToastComponent', () => {
  let component: ToastComponent;
  let fixture: ComponentFixture<ToastComponent>;
  let toastService: ToastService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToastComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ToastComponent);
    component = fixture.componentInstance;
    toastService = TestBed.inject(ToastService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show and fade in when a toast is emitted', fakeAsync(() => {
    toastService.showToast('Proposal saved', 'success');

    expect(component.message).toBe('Proposal saved');
    expect(component.type).toBe('success');
    expect(component.visible).toBeTrue();

    tick(50);

    expect(component.fadedIn).toBeTrue();
  }));

  it('should hide after the display duration', fakeAsync(() => {
    toastService.showToast('Something failed', 'error');
    tick(50);

    tick(4000);
    expect(component.fadedIn).toBeFalse();

    tick(500);
    expect(component.visible).toBeFalse();
  }));
});
