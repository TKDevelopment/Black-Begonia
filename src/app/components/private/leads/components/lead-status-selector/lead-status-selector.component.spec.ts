import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeadStatusSelectorComponent } from './lead-status-selector.component';

describe('LeadStatusSelectorComponent', () => {
  let component: LeadStatusSelectorComponent;
  let fixture: ComponentFixture<LeadStatusSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeadStatusSelectorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeadStatusSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
