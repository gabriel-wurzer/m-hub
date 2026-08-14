import { Component, EventEmitter, Output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { map } from 'rxjs';
import { FilterService } from '../../../services/filter/filter.service';

@Component({
  selector: 'app-filter-button',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './filter-button.component.html',
  styleUrl: './filter-button.component.scss'
})
export class FilterButtonComponent {
  @Output() togglePanel = new EventEmitter<void>();

  isFilterActive = toSignal(
    this.filterService.filters$.pipe(
      map(filters => filters.usages.length > 0 || filters.periods.length > 0)
    ),
    { initialValue: false }
  );

  constructor(private filterService: FilterService) {}

  onButtonClick() {
    this.togglePanel.emit();
  }
}
