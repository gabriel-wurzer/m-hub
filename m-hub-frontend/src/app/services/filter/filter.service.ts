import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

type Filters = { usages: number[], periods: number[] };

@Injectable({
  providedIn: 'root'
})
export class FilterService {

  private filtersSubject = new BehaviorSubject<Filters>({ usages: [], periods: [] });
  filters$ = this.filtersSubject.asObservable();

  /**
   * Updates the current filter state by setting both usage and period filters in a single, batched operation.
   * Prevents redundant emissions if the new filter values are identical to the current ones.
   * 
   * @param usages Array of selected usage category options.
   * @param periods Array of selected building period options.
   */
  setFilters(usages: number[], periods: number[]) {
    const current = this.filtersSubject.value;
    const updated = {
      usages,
      periods,
    };

    if (
      JSON.stringify(updated.usages) !== JSON.stringify(current.usages) ||
      JSON.stringify(updated.periods) !== JSON.stringify(current.periods)
    ) {
      this.filtersSubject.next(updated);
      console.log('setFilters (batched):', updated);
    }
  }

  getUsageFilter(): number[] {
    return this.filtersSubject.value.usages;
  }

  getPeriodFilter(): number[] {
    return this.filtersSubject.value.periods;
  }
}
