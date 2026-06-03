import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, RouterLink } from '@angular/router';

import { InquirySuccessComponent } from './inquiry-success.component';

describe('InquirySuccessComponent', () => {
  let component: InquirySuccessComponent;
  let fixture: ComponentFixture<InquirySuccessComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InquirySuccessComponent],
      providers: [provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InquirySuccessComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the submitted success message and next steps', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Inquiry Submitted Successfully');
    expect(text).toContain('What happens next?');
    expect(text).toContain('We\u2019ll review your submission');
  });

  it('should provide a return-home link', () => {
    const link = fixture.debugElement
      .query(By.directive(RouterLink))
      .injector.get(RouterLink);

    expect(link.href).toBe('/');
    expect(fixture.nativeElement.textContent).toContain('Return to Home');
  });
});
