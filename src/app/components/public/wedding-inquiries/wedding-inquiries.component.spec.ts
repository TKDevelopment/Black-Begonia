import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WeddingInquiriesComponent } from './wedding-inquiries.component';

describe('WeddingInquiriesComponent', () => {
  let component: WeddingInquiriesComponent;
  let fixture: ComponentFixture<WeddingInquiriesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeddingInquiriesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WeddingInquiriesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
