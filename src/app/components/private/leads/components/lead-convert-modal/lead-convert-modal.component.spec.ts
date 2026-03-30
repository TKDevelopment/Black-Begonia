import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeadConvertModalComponent } from './lead-convert-modal.component';

describe('LeadConvertModalComponent', () => {
  let component: LeadConvertModalComponent;
  let fixture: ComponentFixture<LeadConvertModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeadConvertModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeadConvertModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
