import { Location } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EntityDetailShellComponent } from './entity-detail-shell.component';

describe('EntityDetailShellComponent', () => {
  let component: EntityDetailShellComponent;
  let fixture: ComponentFixture<EntityDetailShellComponent>;
  let location: jasmine.SpyObj<Location>;

  beforeEach(async () => {
    location = jasmine.createSpyObj<Location>('Location', ['back']);

    await TestBed.configureTestingModule({
      imports: [EntityDetailShellComponent],
      providers: [{ provide: Location, useValue: location }],
    })
    .compileComponents();

    fixture = TestBed.createComponent(EntityDetailShellComponent);
    component = fixture.componentInstance;
    component.title = 'Lead detail';
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit the back event by default', () => {
    const emitted: void[] = [];
    component.back.subscribe(() => emitted.push(undefined));

    component.onBack();

    expect(emitted.length).toBe(1);
    expect(location.back).not.toHaveBeenCalled();
  });

  it('should use browser back when configured', () => {
    const emitted: void[] = [];
    component.useBrowserBack = true;
    component.back.subscribe(() => emitted.push(undefined));

    component.onBack();

    expect(location.back).toHaveBeenCalled();
    expect(emitted.length).toBe(0);
  });

  it('should render loading placeholders while loading', () => {
    component.loading = true;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.crm-detail-loading-card')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.crm-detail-main')).toBeNull();
  });

  it('should hide the sidebar when full width is enabled', () => {
    component.fullWidth = true;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.crm-detail-sidebar')).toBeNull();
  });
});
