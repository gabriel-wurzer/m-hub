import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BrandingService } from '../../services/branding/branding.service';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.scss'
})
export class PrivacyComponent implements OnInit {
  privacyHtml: string | null | undefined = undefined;

  constructor(private brandingService: BrandingService) {}

  ngOnInit(): void {
    this.brandingService.getPrivacyHtml().subscribe((html) => {
      this.privacyHtml = html ? this.normalizePrivacyHtml(html) : null;
    });
  }

  private normalizePrivacyHtml(html: string): string {
    return html.replace(
      /<mat-icon([^>]*)>([\s\S]*?)<\/mat-icon>/gi,
      (_match, attributes: string, iconName: string) =>
        `<span${this.withIconClasses(attributes)}>${iconName.trim()}</span>`
    );
  }

  private withIconClasses(attributes: string): string {
    const iconClasses = 'material-icons imprint-material-icon';

    if (/\sclass\s*=/.test(attributes)) {
      return attributes.replace(
        /\sclass\s*=\s*(['"])(.*?)\1/i,
        (_match, quote: string, classNames: string) => ` class=${quote}${classNames} ${iconClasses}${quote}`
      );
    }

    return `${attributes} class="${iconClasses}"`;
  }
}
