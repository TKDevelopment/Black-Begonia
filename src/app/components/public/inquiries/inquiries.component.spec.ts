import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, RouterLink } from '@angular/router';

import { InquiriesComponent } from './inquiries.component';

describe('InquiriesComponent', () => {
  let component: InquiriesComponent;
  let fixture: ComponentFixture<InquiriesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InquiriesComponent],
      providers: [provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InquiriesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render wedding and general inquiry choices', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('WEDDING INQUIRIES');
    expect(text).toContain('GENERAL INQUIRIES');
  });

  it('should link each inquiry choice to the correct form route', () => {
    const links = fixture.debugElement
      .queryAll(By.directive(RouterLink))
      .map((debugElement) => debugElement.attributes['ng-reflect-router-link']);

    expect(links).toContain('/inquiries/weddings');
    expect(links).toContain('/inquiries/general');
  });
});
