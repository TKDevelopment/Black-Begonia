import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InquirySuccessComponent } from './inquiry-success.component';

describe('InquirySuccessComponent', () => {
  let component: InquirySuccessComponent;
  let fixture: ComponentFixture<InquirySuccessComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InquirySuccessComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InquirySuccessComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
