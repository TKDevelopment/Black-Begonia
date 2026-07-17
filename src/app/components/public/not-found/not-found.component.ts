import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 py-24 text-center">
      <p class="font-oswald text-xs uppercase tracking-[0.3em] text-[#ea938c]">Not Found</p>
      <h1 class="mt-4 font-cormorant text-5xl text-stone-900">This page is not available.</h1>
      <p class="mt-4 max-w-xl text-base leading-7 text-stone-600">
        The link may be expired, retired, or unavailable.
      </p>
      <a routerLink="/" class="mt-8 inline-flex items-center justify-center rounded-xl bg-stone-900 px-5 py-3 text-sm font-medium text-white">
        Return Home
      </a>
    </section>
  `,
})
export class NotFoundComponent {}
