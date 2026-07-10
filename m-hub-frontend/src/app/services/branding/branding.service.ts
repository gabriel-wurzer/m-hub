import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, ReplaySubject, firstValueFrom } from 'rxjs';

export interface BrandingConfig {
  appName: string;
  menuLetters: string[];
  logoPath: string;
}

const DEFAULT_BRANDING: BrandingConfig = {
  appName: 'm-hub',
  menuLetters: ['m', 'h', 'u', 'b'],
  logoPath: '/assets/images/mhub_logo_grey.svg'
};

@Injectable({
  providedIn: 'root'
})
export class BrandingService {
  private readonly brandingSubject = new ReplaySubject<BrandingConfig>(1);
  private readonly imprintHtmlSubject = new ReplaySubject<string | null>(1);
  private readonly assetCacheBuster = Date.now().toString();
  private brandingLoaded = false;

  constructor(private http: HttpClient) {}

  async loadBrandingAssets(): Promise<void> {
    if (this.brandingLoaded) {
      return;
    }

    const [branding, imprintHtml] = await Promise.all([
      this.loadBrandingConfig(),
      this.loadImprintHtml()
    ]);

    this.brandingSubject.next(branding);
    this.imprintHtmlSubject.next(imprintHtml);
    this.brandingLoaded = true;
  }

  getBranding(): Observable<BrandingConfig> {
    return this.brandingSubject.asObservable();
  }

  getImprintHtml(): Observable<string | null> {
    return this.imprintHtmlSubject.asObservable();
  }

  private async loadBrandingConfig(): Promise<BrandingConfig> {
    try {
      const branding = await firstValueFrom(
        this.http.get<Partial<BrandingConfig>>(this.getBrandingAssetUrl('branding.json'), {
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache'
          }
        })
      );

      return this.normalizeBranding(branding);
    } catch {
      return DEFAULT_BRANDING;
    }
  }

  private async loadImprintHtml(): Promise<string | null> {
    try {
      return await firstValueFrom(
        this.http.get(this.getBrandingAssetUrl('imprint.html'), {
          responseType: 'text',
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache'
          }
        })
      );
    } catch {
      return null;
    }
  }

  private normalizeBranding(branding: Partial<BrandingConfig>): BrandingConfig {
    const appName = branding.appName?.trim() || DEFAULT_BRANDING.appName;
    const menuLetters = Array.isArray(branding.menuLetters)
      ? branding.menuLetters.map((letter) => String(letter).trim()).filter(Boolean)
      : [];

    return {
      appName,
      menuLetters,
      logoPath: this.withRuntimeCacheBuster(branding.logoPath?.trim() || DEFAULT_BRANDING.logoPath)
    };
  }

  private getBrandingAssetUrl(fileName: string): string {
    return `/assets/branding/${fileName}?v=${this.assetCacheBuster}`;
  }

  private withRuntimeCacheBuster(assetPath: string): string {
    if (!assetPath.startsWith('/assets/branding/')) {
      return assetPath;
    }

    const separator = assetPath.includes('?') ? '&' : '?';
    return `${assetPath}${separator}cb=${this.assetCacheBuster}`;
  }
}
