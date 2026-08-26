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

  it('separates proposal configuration from CRM privacy settings', () => {
    const proposalSettings = component.groupedNav.find(
      (group) => group.label === 'Proposal Settings'
    );
    const crmSettings = component.groupedNav.find(
      (group) => group.label === 'CRM Settings'
    );

    expect(proposalSettings?.children).toEqual([
      jasmine.objectContaining({ label: 'Catalog', route: '/admin/catalog-items' }),
      jasmine.objectContaining({ label: 'Tax Regions', route: '/admin/tax-regions' }),
    ]);
    expect(proposalSettings?.children.some((item) => item.route.includes('proposal-templates')))
      .toBeFalse();
    expect(crmSettings?.children).toEqual([
      jasmine.objectContaining({
        label: 'Privacy & Retention',
        route: '/admin/settings/workshop-privacy-policy',
      }),
    ]);

    expect(component.isNavGroupOpen('CRM Settings')).toBeFalse();
    component.toggleNavGroup('CRM Settings');
    expect(component.isNavGroupOpen('CRM Settings')).toBeTrue();
  });

  it('exposes the guarded Payments table destination', () => {
    expect(component.navItems).toContain(jasmine.objectContaining({ label: 'Payments', route: '/admin/payments' }));
    expect(fixture.nativeElement.textContent).toContain('Payments');
  });

  it('exposes Workshops as a primary CRM destination', () => {
    expect(component.navItems).toContain(
      jasmine.objectContaining({ label: 'Workshops', route: '/admin/workshops' })
    );
    expect(fixture.nativeElement.textContent).toContain('Workshops');
  });
});
