import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { provideServerRouting, RenderMode, ServerRoute } from '@angular/ssr';
import { appConfig } from './app.config';

export const serverRoutes: ServerRoute[] = [
  { path: 'workshops/:seriesSlug/:workshopDate/terms-and-conditions', renderMode: RenderMode.Server },
  { path: 'workshops/:seriesSlug/:workshopDate/reserve', renderMode: RenderMode.Server },
  { path: 'workshops/:seriesSlug/:workshopDate', renderMode: RenderMode.Server },
  { path: 'workshops/:seriesSlug', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Server },
];

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    provideServerRouting(serverRoutes),
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
