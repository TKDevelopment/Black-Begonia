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
});
