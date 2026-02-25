import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../components/shared/sidebar/sidebar.component';
import { AuthService } from '../../services/auth.service';
import { filter, firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-private-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent],
  templateUrl: './private-layout.component.html',
  styleUrl: './private-layout.component.scss'
})
export class PrivateLayoutComponent implements OnInit {
  isReady = false;
  isAuthenticated = false;

  constructor(private auth: AuthService, private router: Router) {}

  async ngOnInit() {
    await firstValueFrom(this.auth.sessionReady$);
    const user = await firstValueFrom(this.auth.user$.pipe(filter(user => user !== null)));

    this.isAuthenticated = !!user;
    this.isReady = true;

    if (!this.isAuthenticated) {
      console.warn('🚫 User not authenticated, redirecting to /auth/login');
      this.router.navigate(['/auth/login']);
    }
  }
}
