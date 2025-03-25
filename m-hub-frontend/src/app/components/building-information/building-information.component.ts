import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Building } from '../../models/building';
import { Periods, PeriodLabels } from '../../models/periods.enum';
import { Usage, UsageLabels } from '../../models/usage.enum';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';



@Component({
  selector: 'app-building-information',
  standalone: true,
  imports: [ MatIconModule, MatButtonModule, MatDividerModule],
  templateUrl: './building-information.component.html',
  styleUrl: './building-information.component.scss'
})
export class BuildingInformationComponent {
  @Input() building!: Building | null;
  @Output() closePanel = new EventEmitter<void>();

  periodOptions = Object.values(Periods).filter(value => typeof value === 'number') as number[];
  periodLabels = PeriodLabels;

  get periodLabel(): string {
    if (this.building && this.building.bp) {
      // Split the string by comma, trim whitespace, and map each to a number
      const bpValues = this.building.bp.split(',').map(val => val.trim());
      const labels = bpValues.map(bpStr => {
        const bpValue = Number(bpStr);
        return (!isNaN(bpValue) && this.periodLabels[bpValue]) ? this.periodLabels[bpValue] : 'Bauperiode unbekannt';
      });
      return labels.join(', ');
    }
    return 'Bauperiode unbekannt';
  }
  
  
  usageOptions = Object.values(Usage).filter(value => typeof value === 'number') as number[];
  usageLabels = UsageLabels;

  get usageLabel(): string {
    if (this.building && this.building.dom_nutzung != null) {
      return this.usageLabels[this.building.dom_nutzung] || 'Keine Nutzung';
    }
    return 'Keine Nutzung';
  }

  onClose() {
    this.closePanel.emit();
  }
}
