import { ComponentFixture, TestBed } from '@angular/core/testing';

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
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
