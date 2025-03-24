import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FilterService {

  private periodFilterSubject = new BehaviorSubject<number[]>([]);
  private usageFilterSubject = new BehaviorSubject<number[]>([]);

  periodFilter$ = this.periodFilterSubject.asObservable();
  usageFilter$ = this.usageFilterSubject.asObservable();

  getPeriodFilter(): number[] {
    return this.periodFilterSubject.value;
  }

  setPeriodFilter(selectedPeriods: number[]): void {
    this.periodFilterSubject.next(selectedPeriods);
    console.log('current period selection: ', this.periodFilterSubject.value)
  }


  getUsageFilter(): number[] {
    return this.usageFilterSubject.value;
  }

  setUsageFilter(selectedUsages: number[]): void {
    this.usageFilterSubject.next(selectedUsages);
    console.log('current usage selection: ', this.usageFilterSubject.value)
  }
}
