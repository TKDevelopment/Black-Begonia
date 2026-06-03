import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../auth/auth.service';
import { PrivateLayoutComponent } from './private-layout.component';

describe('PrivateLayoutComponent', () => {
  let component: PrivateLayoutComponent;
  let fixture: ComponentFixture<PrivateLayoutComponent>;
  const authService = {
    isReady: true,
    isAuthenticated: true,
    isInternalUser: true,
    snapshot: {
      loading: false,
      profile: {
        email: 'admin@example.test',
        first_name: 'Test',
        last_name: 'Admin',
        display_name: 'Test Admin',
      },
    },
    init: jasmine.createSpy('init').and.resolveTo(undefined),
    logout: jasmine.createSpy('logout').and.resolveTo(undefined),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrivateLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrivateLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the private navigation shell', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('app-sidebar')).toBeTruthy();
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('should toggle the mobile sidebar', () => {
    component.openMobileSidebar();
    expect(component.mobileSidebarOpen).toBeTrue();

    component.closeMobileSidebar();
    expect(component.mobileSidebarOpen).toBeFalse();
  });
});
