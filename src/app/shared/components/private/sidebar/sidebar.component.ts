import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';

interface SidebarNavItem {
  label: string;
  route: string;
  exact?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly navItems: SidebarNavItem[] = [
    { label: 'Dashboard', route: '/admin/dashboard', exact: true },
    { label: 'Leads', route: '/admin/leads' },
    { label: 'Contacts', route: '/admin/contacts' },
    { label: 'Organizations', route: '/admin/organizations' },
    { label: 'Projects', route: '/admin/projects' },
    { label: 'Tasks', route: '/admin/tasks' },
  ];

  async logout(): Promise<void> {
    await this.authService.logout(true);
  }

  get userDisplayName(): string {
    const profile = this.authService.snapshot.profile;

    if (profile?.display_name?.trim()) {
      return profile.display_name;
    }

    if (profile?.first_name?.trim() || profile?.last_name?.trim()) {
      return `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim();
    }

    return profile?.email ?? 'Admin User';
  }

  get userEmail(): string {
    return this.authService.snapshot.profile?.email ?? '';
  }
}