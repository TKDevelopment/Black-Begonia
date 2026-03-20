import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './components/shared/toast/toast.component';
import { AuthService } from './services/auth.service';
import { SeoRouteListenerService } from './core/seo-route-listener.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'Black-Begonia';
  private listener = inject(SeoRouteListenerService);
  
  constructor(private authService: AuthService) {
    this.listener.init('https://blackbegoniaflorals.com');
  }

  async ngOnInit(): Promise<void> {
    await this.authService.init();
  }
}
