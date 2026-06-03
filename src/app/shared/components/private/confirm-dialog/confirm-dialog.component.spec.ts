import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { ConfirmDialogComponent } from './confirm-dialog.component';

describe('ConfirmDialogComponent', () => {
  let component: ConfirmDialogComponent;
  let fixture: ComponentFixture<ConfirmDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConfirmDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not render dialog content while closed', () => {
    expect(fixture.nativeElement.textContent).not.toContain('Confirm Action');
  });

  it('should render configured copy when open', () => {
    component.open = true;
    component.title = 'Delete lead';
    component.description = 'This cannot be undone.';
    component.confirmLabel = 'Delete';
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Delete lead');
    expect(text).toContain('This cannot be undone.');
    expect(text).toContain('Delete');
  });

  it('should emit close and confirm actions when not loading', () => {
    const closed: void[] = [];
    const confirmed: void[] = [];
    component.open = true;
    component.close.subscribe(() => closed.push(undefined));
    component.confirm.subscribe(() => confirmed.push(undefined));
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('button'));
    buttons[1].triggerEventHandler('click');
    buttons[2].triggerEventHandler('click');

    expect(closed.length).toBe(1);
    expect(confirmed.length).toBe(1);
  });

  it('should block close and confirm actions while loading', () => {
    const closed: void[] = [];
    const confirmed: void[] = [];
    component.loading = true;
    component.close.subscribe(() => closed.push(undefined));
    component.confirm.subscribe(() => confirmed.push(undefined));

    component.onClose();
    component.onConfirm();

    expect(closed.length).toBe(0);
    expect(confirmed.length).toBe(0);
  });

  it('should expose tone-specific confirm button classes', () => {
    component.tone = 'danger';
    expect(component.confirmButtonClasses).toContain('bg-rose-600');

    component.tone = 'success';
    expect(component.confirmButtonClasses).toContain('bg-emerald-600');

    component.tone = 'default';
    expect(component.confirmButtonClasses).toContain('bg-[#ea938c]');
  });
});
