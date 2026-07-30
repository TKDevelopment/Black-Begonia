import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { AuthService } from './core/auth/auth.service';
import { SeoRouteListenerService } from './core/seo/seo-route-listener.service';
import { WebsiteAnalyticsService } from './core/analytics/website-analytics.service';

describe('AppComponent', () => {
  const authService = {
    init: jasmine.createSpy('init').and.resolveTo(undefined),
  };
  const seoRouteListener = {
    init: jasmine.createSpy('init'),
  };
  const analytics = { init: jasmine.createSpy('init') };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: SeoRouteListenerService, useValue: seoRouteListener },
        { provide: WebsiteAnalyticsService, useValue: analytics },
      ],
    }).compileComponents();

    authService.init.calls.reset();
    seoRouteListener.init.calls.reset();
    analytics.init.calls.reset();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have the 'Black-Begonia' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('Black-Begonia');
  });

  it('should initialize SEO with the production domain', () => {
    TestBed.createComponent(AppComponent);

    expect(seoRouteListener.init).toHaveBeenCalledWith('https://blackbegoniaflorals.com');
  });

  it('should render the app shell outlets', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('app-toast')).toBeTruthy();
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('initializes analytics without awaiting it before authentication', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(analytics.init).toHaveBeenCalled();
    expect(authService.init).toHaveBeenCalled();
  });
});
