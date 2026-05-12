import { Injectable, Provider } from '@angular/core';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, MatDateFormats, NativeDateAdapter } from '@angular/material/core';

export const MHUB_DATE_FORMATS: MatDateFormats = {
  parse: {
    dateInput: 'dd.MM.yyyy'
  },
  display: {
    dateInput: 'dd.MM.yyyy',
    monthYearLabel: { year: 'numeric', month: 'short' },
    dateA11yLabel: { year: 'numeric', month: 'long', day: 'numeric' },
    monthYearA11yLabel: { year: 'numeric', month: 'long' }
  }
};

@Injectable()
export class MhubDateAdapter extends NativeDateAdapter {
  override parse(value: any, parseFormat?: any): Date | null {
    if (typeof value === 'string') {
      const trimmedValue = value.trim();
      const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmedValue);

      if (match) {
        const day = Number(match[1]);
        const month = Number(match[2]) - 1;
        const year = Number(match[3]);
        const parsedDate = new Date(0, month, day);
        parsedDate.setFullYear(year);

        return parsedDate.getFullYear() === year
          && parsedDate.getMonth() === month
          && parsedDate.getDate() === day
          ? parsedDate
          : this.invalid();
      }
    }

    return super.parse(value, parseFormat);
  }

  override format(date: Date, displayFormat: Object): string {
    if (displayFormat === MHUB_DATE_FORMATS.display.dateInput) {
      return [
        this.padDatePart(date.getDate()),
        this.padDatePart(date.getMonth() + 1),
        String(date.getFullYear()).padStart(4, '0')
      ].join('.');
    }

    return super.format(date, displayFormat);
  }

  private padDatePart(value: number): string {
    return String(value).padStart(2, '0');
  }
}

export const MHUB_DATE_PROVIDERS: Provider[] = [
  { provide: MAT_DATE_LOCALE, useValue: 'de-AT' },
  { provide: DateAdapter, useClass: MhubDateAdapter },
  { provide: MAT_DATE_FORMATS, useValue: MHUB_DATE_FORMATS }
];
