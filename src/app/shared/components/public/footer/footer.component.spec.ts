import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FooterComponent } from './footer.component';

describe('FooterComponent', () => {
  let component: FooterComponent;
  let fixture: ComponentFixture<FooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FooterComponent],
      providers: [provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the brand promise', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('BLACK BEGONIA');
    expect(compiled.textContent).toContain('LUXURY FINE ART FLORAL DESIGN');
  });

  it('keeps analytics preferences available in the footer', () => {
    const preferencesButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
    ).find((candidate) => candidate.textContent?.includes('Analytics Preferences'));
    expect(preferencesButton).toBeTruthy();
    expect(preferencesButton?.classList.contains('underline')).toBeFalse();
  });

  it('links to the privacy policy beside analytics preferences', () => {
    const footerUtilities = fixture.nativeElement.querySelector(
      '[aria-label="Privacy and analytics"]'
    ) as HTMLElement;
    const privacyPolicyLink = footerUtilities.querySelector(
      'a[href="/privacy-policy"]'
    ) as HTMLAnchorElement;
    const preferencesButton = footerUtilities.querySelector('button') as HTMLButtonElement;

    expect(privacyPolicyLink).toBeTruthy();
    expect(privacyPolicyLink.textContent?.trim()).toBe('Privacy Policy');
    expect(preferencesButton.textContent?.trim()).toBe('Analytics Preferences');
  });

  it('uses the canonical Instagram account for every footer destination', () => {
    const instagramLinks = Array.from(
      fixture.nativeElement.querySelectorAll('a[href*="instagram.com"]') as NodeListOf<HTMLAnchorElement>
    );

    expect(instagramLinks.length).toBeGreaterThan(0);
    expect(
      instagramLinks.every(
        (link) => link.href === 'https://www.instagram.com/blackbegoniaflorals/'
      )
    ).toBeTrue();
  });

  it('links the developer credit to TK DevWorks securely', () => {
    const developerLink = fixture.nativeElement.querySelector(
      'a[href="https://tkdevworks.com/"]'
    ) as HTMLAnchorElement;

    expect(developerLink.textContent?.trim()).toBe('TK DEVWORKS');
    expect(developerLink.target).toBe('_blank');
    expect(developerLink.rel).toContain('noopener');
    expect(developerLink.rel).toContain('noreferrer');
  });
});
