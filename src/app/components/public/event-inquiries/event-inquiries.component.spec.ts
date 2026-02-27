import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventInquiriesComponent } from './event-inquiries.component';

describe('EventInquiriesComponent', () => {
  let component: EventInquiriesComponent;
  let fixture: ComponentFixture<EventInquiriesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventInquiriesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EventInquiriesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
