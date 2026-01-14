import { Component, EventEmitter, HostBinding, HostListener, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatOptionModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatDividerModule } from '@angular/material/divider';
import { Period, PeriodLabels } from '../../enums/period.enum';
import { Usage, UsageLabels } from '../../enums/usage.enum';
import { FilterService } from '../../services/filter/filter.service';
import { animate, style, transition, trigger } from '@angular/animations';


@Component({
  selector: 'app-filter-menu',
  standalone: true,
  imports: [
    MatIconModule, 
    MatButtonModule, 
    MatDividerModule, 
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    ReactiveFormsModule,
    CommonModule,
    MatOptionModule
  ],
  templateUrl: './filter-menu.component.html',
  styleUrl: './filter-menu.component.scss',
  animations: [
    trigger('slideInOut', [
      transition(':enter', [
        style({ transform: 'translateX(-100%)' }),
        animate('300ms cubic-bezier(0.4, 0.0, 0.2, 1)', style({ transform: 'translateX(0)' }))
      ]),
      transition(':leave', [
        animate('300ms cubic-bezier(0.4, 0.0, 0.2, 1)', style({ transform: 'translateX(-100%)' }))
      ])
    ])
  ]
})
export class FilterMenuComponent implements OnInit {
  
  @HostBinding('@slideInOut') animate = true;
  
  @HostListener('dblclick', ['$event'])
  @HostListener('click', ['$event'])
  @HostListener('mousedown', ['$event'])
  stopEventPropagation(event: MouseEvent) {
    event.stopPropagation();
  }
  
  @Output() closePanel = new EventEmitter<void>();

  periodOptions = Object.values(Period).filter(value => typeof value === 'number') as number[];
  periodLabels = PeriodLabels;

  usageOptions = Object.values(Usage).filter(value => typeof value === 'number') as number[];
  usageLabels = UsageLabels;

  periodControl = new FormControl<number[]>([], { nonNullable: true });
  usageControl = new FormControl<number[]>([], { nonNullable: true });

  constructor(private filterService: FilterService) {}

  ngOnInit() {
    // load previously selected values
    this.periodControl.setValue(this.filterService.getPeriodFilter());
    this.usageControl.setValue(this.filterService.getUsageFilter());
  }

  updateFilterSelection(): void {
    this.filterService.setFilters(this.usageControl.value, this.periodControl.value);
  }
  
  resetForm() {
    this.periodControl.reset();
    this.usageControl.reset();
    this.filterService.setFilters([], []);
  }

  isResetDisabled(): boolean {
    return !this.periodControl.value?.length && !this.usageControl.value?.length;
  }

  closeFilterMenu() {
    this.closePanel.emit();
  }
}
