import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GeneralInquiriesComponent } from './general-inquiries.component';

describe('GeneralInquiriesComponent', () => {
  let component: GeneralInquiriesComponent;
  let fixture: ComponentFixture<GeneralInquiriesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GeneralInquiriesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GeneralInquiriesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
