import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BrandingService } from '../../services/branding/branding.service';

@Component({
  selector: 'app-imprint',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './imprint.component.html',
  styleUrl: './imprint.component.scss'
})
export class ImprintComponent implements OnInit {
  imprintHtml: string | null | undefined = undefined;

  constructor(private brandingService: BrandingService) {}

  ngOnInit(): void {
    this.brandingService.getImprintHtml().subscribe((html) => {
      this.imprintHtml = html ? this.normalizeImprintHtml(html) : null;
    });
  }

  private normalizeImprintHtml(html: string): string {
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
