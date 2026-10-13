import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { BaseBuilding } from '../../models/building';

/** Material groups below this share (in %) are insignificant for the similarity comparison. */
export const MIN_RELEVANT_MATERIAL_SHARE = 10;

/** Allowed deviation (in percentage points) per relevant material group. */
export const MATERIAL_SHARE_TOLERANCE = 5;

const MATERIAL_GROUPS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export type MaterialGroupRange = { group: number, share: number, min: number, max: number };

/** Snapshot of the reference building, taken when the similarity filter is activated. */
export type MaterialReference = { buildingId: string, groups: MaterialGroupRange[] };

export type Filters = { usages: number[], periods: number[], materialReference: MaterialReference | null };

/**
 * Returns the material groups of a building with a share of at least MIN_RELEVANT_MATERIAL_SHARE,
 * each with its target window of +- MATERIAL_SHARE_TOLERANCE percentage points. Largest share first.
 * @param building Building with bmg1_share..bmg9_share (0-100).
 */
export function getRelevantMaterialGroups(building: BaseBuilding): MaterialGroupRange[] {
  return MATERIAL_GROUPS.flatMap(group => {
    const share = building[`bmg${group}_share`];
    if (share == null || share < MIN_RELEVANT_MATERIAL_SHARE) return [];

    return [{
      group,
      share,
      min: share - MATERIAL_SHARE_TOLERANCE,
      max: Math.min(share + MATERIAL_SHARE_TOLERANCE, 100),
    }];
  }).sort((a, b) => b.share - a.share);
}

@Injectable({
  providedIn: 'root'
})
export class FilterService {

  private filtersSubject = new BehaviorSubject<Filters>({ usages: [], periods: [], materialReference: null });
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
      ...current,
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

  /**
   * Activates the similar material composition filter for the given building, or deactivates it with null.
   * The relevant material groups are frozen at this point, so selecting another building keeps the filter stable.
   *
   * @param building Reference building, or null to deactivate the filter.
   */
  setMaterialReference(building: BaseBuilding | null) {
    const current = this.filtersSubject.value;
    const materialReference = building
      ? { buildingId: building.bw_geb_id, groups: getRelevantMaterialGroups(building) }
      : null;

    if (materialReference?.buildingId !== current.materialReference?.buildingId) {
      this.filtersSubject.next({ ...current, materialReference });
      console.log('setMaterialReference:', materialReference);
    }
  }

  getUsageFilter(): number[] {
    return this.filtersSubject.value.usages;
  }

  getPeriodFilter(): number[] {
    return this.filtersSubject.value.periods;
  }

  getMaterialReference(): MaterialReference | null {
    return this.filtersSubject.value.materialReference;
  }
}
