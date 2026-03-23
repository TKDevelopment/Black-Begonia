import { ComponentFixture, TestBed } from '@angular/core/testing';

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
});
