import { Component, Input, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';

import { BuildingPart } from '../../models/building-part';
import { Building } from '../../models/building';
import { Period, PeriodLabels } from '../../enums/period.enum';
import { Usage, UsageLabels } from '../../enums/usage.enum';
import { DocumentListComponent } from "../document-list/document-list.component";


@Component({
  selector: 'app-structure-details',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDividerModule, MatExpansionModule, MatProgressSpinnerModule, MatListModule, DocumentListComponent],
  templateUrl: './structure-details.component.html',
  styleUrl: './structure-details.component.scss'
})
export class StructureDetailsComponent implements OnInit {

  @Input() entity!: Building | BuildingPart | null;

  errorMessage = '';

  // check on init if entity is building or building part
  isBuilding = false;
  building?: Building;
  buildingPart?: BuildingPart;

  periodOptions = Object.values(Period).filter(value => typeof value === 'number') as number[];
  periodLabels = PeriodLabels;

  usageOptions = Object.values(Usage).filter(value => typeof value === 'number') as number[];
  usageLabels = UsageLabels;


  isLoading = false;

  ngOnInit() {
    if (!this.entity) return;
  
    this.setupEntity();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['entity']) {
      this.setupEntity();
    }
  }

  private setupEntity() {
    this.building = undefined;
    this.buildingPart = undefined;

    if (!this.entity) return;

    'bw_geb_id' in this.entity
      ? (this.isBuilding = true, this.building = this.entity as Building)
      : (this.isBuilding = false, this.buildingPart = this.entity as BuildingPart);
  }

  get periodLabel(): string {
    if (this.building && this.building.bp) {
      const bpValues = this.building.bp.split(',').map(val => val.trim());
      const labels = bpValues.map(bpStr => {
        const bpValue = Number(bpStr);
        return (!isNaN(bpValue) && this.periodLabels[bpValue]) ? this.periodLabels[bpValue] : 'Bauperiode unbekannt';
      });
      return labels.join(', ');
    }
    return 'Bauperiode unbekannt';
  }
  
  get usageLabel(): string {
    if (this.building && this.building.dom_nutzung != null) {
      return this.usageLabels[this.building.dom_nutzung] || 'Nutzung unbekannt';
    }
    return 'Nutzung unbekannt';
  }

}
