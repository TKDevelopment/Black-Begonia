import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { SidebarComponent } from '../../../shared/components/private/sidebar/sidebar.component';
import { CrmThemeService } from '../../services/crm-theme.service';

@Component({
  selector: 'app-private-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent],
  templateUrl: './private-layout.component.html',
})
export class PrivateLayoutComponent implements OnInit {
  mobileSidebarOpen = false;

  constructor(
    public authService: AuthService,
    public crmThemeService: CrmThemeService,
  ) {}

  async ngOnInit(): Promise<void> {
    if (!this.authService.isReady) {
      await this.authService.init();
    }
  }

  openMobileSidebar(): void {
    this.mobileSidebarOpen = true;
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen = false;
  }
}
