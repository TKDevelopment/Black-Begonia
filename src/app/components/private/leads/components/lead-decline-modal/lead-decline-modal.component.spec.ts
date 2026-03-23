import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeadDeclineModalComponent } from './lead-decline-modal.component';

describe('LeadDeclineModalComponent', () => {
  let component: LeadDeclineModalComponent;
  let fixture: ComponentFixture<LeadDeclineModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeadDeclineModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeadDeclineModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
