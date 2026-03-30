import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { CrmThemeService } from '../../../../core/services/crm-theme.service';

interface SidebarNavItem {
  label: string;
  route: string;
  exact?: boolean;
}

interface SidebarNavGroup {
  label: string;
  children: SidebarNavItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  @Input() isMobile = false;
  @Output() navigate = new EventEmitter<void>();
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly crmThemeService = inject(CrmThemeService);
  readonly proposalSettingsOpen = signal(
    this.router.url.startsWith('/admin/proposal-templates') ||
    this.router.url.startsWith('/admin/catalog-items') ||
      this.router.url.startsWith('/admin/tax-regions')
  );

  readonly navItems: SidebarNavItem[] = [
    { label: 'Dashboard', route: '/admin/dashboard', exact: true },
    { label: 'Leads', route: '/admin/leads' },
    { label: 'Contacts', route: '/admin/contacts' },
    { label: 'Organizations', route: '/admin/organizations' },
    { label: 'Projects', route: '/admin/projects' },
    { label: 'Tasks', route: '/admin/tasks' },
  ];

  readonly groupedNav: SidebarNavGroup[] = [
    {
      label: 'Proposal Settings',
      children: [
        { label: 'Templates', route: '/admin/proposal-templates' },
        { label: 'Catalog', route: '/admin/catalog-items' },
        { label: 'Tax Regions', route: '/admin/tax-regions' },
      ],
    },
  ];

  async logout(): Promise<void> {
    this.navigate.emit();
    await this.authService.logout(true);
  }

  toggleTheme(): void {
    this.crmThemeService.toggle();
  }

  toggleProposalSettings(): void {
    this.proposalSettingsOpen.update((open) => !open);
  }

  isRouteActive(route: string, exact = false): boolean {
    return this.router.isActive(route, exact ? {
      paths: 'exact',
      queryParams: 'ignored',
      fragment: 'ignored',
      matrixParams: 'ignored',
    } : {
      paths: 'subset',
      queryParams: 'ignored',
      fragment: 'ignored',
      matrixParams: 'ignored',
    });
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

  onNavigate(): void {
    this.navigate.emit();
  }
}




