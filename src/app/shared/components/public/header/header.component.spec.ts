import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle the mobile menu', () => {
    expect(component.menuOpen).toBeFalse();

    component.toggleMenu();

    expect(component.menuOpen).toBeTrue();
  });

  it('shows only the home logo and social links in restricted payment mode', () => {
    fixture.componentRef.setInput('navigationRestricted', true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const logo = compiled.querySelector('[data-testid="public-logo"]');
    const navigation = compiled.querySelector('[data-testid="public-navigation"]');
    const menuButton = compiled.querySelector('[aria-label="Toggle menu"]');
    const socialLinks = compiled.querySelectorAll('[data-testid="public-social-link"]');

    expect(logo).toBeTruthy();
    expect(navigation).toBeNull();
    expect(menuButton).toBeNull();
    expect(socialLinks.length).toBe(2);
  });
});
