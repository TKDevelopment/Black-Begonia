import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';
import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;
  const authService = {
    snapshot: {
      profile: {
        email: 'admin@example.test',
        first_name: 'Test',
        last_name: 'Admin',
        display_name: 'Test Admin',
      },
    },
    logout: jasmine.createSpy('logout').and.resolveTo(undefined),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose the user display name from the auth snapshot', () => {
    expect(component.userDisplayName).toBe('Test Admin');
  });

  it('keeps proposal settings focused on catalog and tax regions only', () => {
    expect(component.groupedNav).toEqual([
      jasmine.objectContaining({
        label: 'Proposal Settings',
        children: [
          jasmine.objectContaining({ label: 'Catalog', route: '/admin/catalog-items' }),
          jasmine.objectContaining({ label: 'Tax Regions', route: '/admin/tax-regions' }),
        ],
      }),
    ]);
    expect(component.groupedNav[0].children.some((item) => item.route.includes('proposal-templates'))).toBeFalse();
  });

  it('exposes the guarded Payments table destination', () => {
    expect(component.navItems).toContain(jasmine.objectContaining({ label: 'Payments', route: '/admin/payments' }));
    expect(fixture.nativeElement.textContent).toContain('Payments');
  });
});
