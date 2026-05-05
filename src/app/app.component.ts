import { Component, OnInit, PLATFORM_ID, inject, Injector } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
  private readonly platformId = inject(PLATFORM_ID);
  private readonly injector = inject(Injector);

  constructor() {
    this.seoListener.init('https://blackbegoniaflorals.com');
  }

  async ngOnInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    await this.injector.get(AuthService).init();
  }
}
