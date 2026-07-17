import { ComponentFixture, TestBed } from '@angular/core/testing';

import { testLead } from '../../../../../core/testing/workflow-fixtures';
import { LeadSummaryCardComponent } from './lead-summary-card.component';

describe('LeadSummaryCardComponent', () => {
  let component: LeadSummaryCardComponent;
  let fixture: ComponentFixture<LeadSummaryCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeadSummaryCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeadSummaryCardComponent);
    component = fixture.componentInstance;
    component.lead = testLead;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should derive initials from the lead name', () => {
    expect(component.getInitials()).toBe('AB');
  });
});
