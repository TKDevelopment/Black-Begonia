import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { SidebarComponent } from '../../../shared/components/private/sidebar/sidebar.component';

@Component({
  selector: 'app-private-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent],
  templateUrl: './private-layout.component.html',
})
export class PrivateLayoutComponent implements OnInit {
  constructor(public authService: AuthService) {}

  async ngOnInit(): Promise<void> {
    if (!this.authService.isReady) {
      await this.authService.init();
    }
  }
}