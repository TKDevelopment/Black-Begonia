import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/components/toast/toast.component';
import { AuthService } from './core/auth/auth.service';
import { SeoRouteListenerService } from './core/seo/seo-route-listener.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'Black-Begonia';

  private readonly seoListener = inject(SeoRouteListenerService);

  constructor(private readonly authService: AuthService) {
    this.seoListener.init('https://blackbegoniaflorals.com');
  }

  async ngOnInit(): Promise<void> {
    await this.authService.init();
  }
}