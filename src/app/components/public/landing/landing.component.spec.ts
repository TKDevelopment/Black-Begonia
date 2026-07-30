import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LandingComponent } from './landing.component';

describe('LandingComponent', () => {
  let component: LandingComponent;
  let fixture: ComponentFixture<LandingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LandingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('presents service areas as an editorial directory grouped by state', () => {
    const element: HTMLElement = fixture.nativeElement;
    const directory = element.querySelector('[data-testid="service-area-directory"]');
    const stateHeadings = Array.from(
      directory?.querySelectorAll('[data-testid="service-area-state"]') ?? []
    ).map((heading) => heading.textContent?.trim());

    expect(directory).not.toBeNull();
    expect(stateHeadings).toEqual([
      'Rhode Island',
      'Connecticut',
      'Massachusetts'
    ]);
    expect(directory?.querySelectorAll('a').length).toBe(11);
  });
});
