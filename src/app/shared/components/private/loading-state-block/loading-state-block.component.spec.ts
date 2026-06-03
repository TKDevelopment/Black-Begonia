import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoadingStateBlockComponent } from './loading-state-block.component';

describe('LoadingStateBlockComponent', () => {
  let component: LoadingStateBlockComponent;
  let fixture: ComponentFixture<LoadingStateBlockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadingStateBlockComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoadingStateBlockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render custom loading copy', () => {
    component.title = 'Loading leads';
    component.description = 'Gathering current lead records.';
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Loading leads');
    expect(compiled.textContent).toContain('Gathering current lead records.');
  });
});
