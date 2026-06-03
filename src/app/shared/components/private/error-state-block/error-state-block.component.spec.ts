import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { ErrorStateBlockComponent } from './error-state-block.component';

describe('ErrorStateBlockComponent', () => {
  let component: ErrorStateBlockComponent;
  let fixture: ComponentFixture<ErrorStateBlockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorStateBlockComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ErrorStateBlockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit retry when the retry button is clicked', () => {
    const emitted: void[] = [];
    component.retryLabel = 'Reload';
    component.retry.subscribe(() => emitted.push(undefined));
    fixture.detectChanges();

    fixture.debugElement.query(By.css('button')).triggerEventHandler('click');

    expect(emitted.length).toBe(1);
  });

  it('should hide retry action when disabled', () => {
    component.showRetry = false;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});
