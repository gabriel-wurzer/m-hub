import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideEchartsCore } from 'ngx-echarts';
import * as echarts from 'echarts';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { AuthenticationInterceptor } from './services/authentication/authentication.interceptor';
import { BrandingService } from './services/branding/branding.service';

function initializeBranding(brandingService: BrandingService): () => Promise<void> {
  return () => brandingService.loadBrandingAssets();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes), 
    provideAnimationsAsync(),
    provideEchartsCore({ echarts }),
    provideHttpClient(withInterceptorsFromDi()), 
    {
      provide: APP_INITIALIZER,
      useFactory: initializeBranding,
      deps: [BrandingService],
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthenticationInterceptor,
      multi: true
    }
  ]
};
