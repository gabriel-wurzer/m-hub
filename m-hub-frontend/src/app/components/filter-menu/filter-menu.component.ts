import { Component, EventEmitter, HostBinding, HostListener, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
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
import { MdabMaterialGroup } from '../../enums/mdab-material-group.enum';
import { Building } from '../../models/building';
import { materialGroupColor } from '../../utils/material-group-colors';
import {
  FilterService,
  MaterialGroupRange,
  MaterialReference,
  getRelevantMaterialGroups
} from '../../services/filter/filter.service';
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
export class FilterMenuComponent implements OnInit, OnChanges {
  
  @HostBinding('@slideInOut') animate = true;
  
  @HostListener('dblclick', ['$event'])
  @HostListener('click', ['$event'])
  @HostListener('mousedown', ['$event'])
  stopEventPropagation(event: MouseEvent) {
    event.stopPropagation();
  }
  
  /** Currently selected building on the map, used as reference for the material composition filter. */
  @Input() selectedBuilding: Building | null = null;

  @Output() closePanel = new EventEmitter<void>();

  periodOptions = Object.values(Period).filter(value => typeof value === 'number') as number[];
  periodLabels = PeriodLabels;

  usageOptions = Object.values(Usage).filter(value => typeof value === 'number') as number[];
  usageLabels = UsageLabels;

  periodControl = new FormControl<number[]>([], { nonNullable: true });
  usageControl = new FormControl<number[]>([], { nonNullable: true });

  /** Relevant material groups of the selected building, recalculated only when the selection changes. */
  selectedBuildingGroups: MaterialGroupRange[] = [];

  constructor(private filterService: FilterService) {}

  ngOnInit() {
    // load previously selected values
    this.periodControl.setValue(this.filterService.getPeriodFilter());
    this.usageControl.setValue(this.filterService.getUsageFilter());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedBuilding']) {
      this.selectedBuildingGroups = this.selectedBuilding ? getRelevantMaterialGroups(this.selectedBuilding) : [];
    }
  }

  updateFilterSelection(): void {
    this.filterService.setFilters(this.usageControl.value, this.periodControl.value);
  }
  
  get materialReference(): MaterialReference | null {
    return this.filterService.getMaterialReference();
  }

  /** The selected building can only serve as reference if it has material share data. */
  get canUseSelectedBuildingAsReference(): boolean {
    return this.selectedBuildingGroups.length > 0;
  }

  /** The switch can neither be turned on (no usable building) nor is it on. */
  get isMaterialFilterUnavailable(): boolean {
    return !this.materialReference && !this.canUseSelectedBuildingAsReference;
  }

  /** Why the switch cannot be turned on. */
  get materialFilterUnavailableHint(): string {
    return this.selectedBuilding
      ? 'Für dieses Gebäude liegen keine Materialanteile vor.'
      : 'Bitte zuerst ein Gebäude auf der Karte auswählen.';
  }

  toggleMaterialFilter(): void {
    this.filterService.setMaterialReference(this.materialReference ? null : this.selectedBuilding);
  }

  materialGroupLabel(group: number): string {
    return MdabMaterialGroup[`mg_${group}` as keyof typeof MdabMaterialGroup];
  }

  materialGroupColor(group: number): string {
    return materialGroupColor(group);
  }

  /** Share of all material groups below the relevance threshold together. */
  otherShare(groups: MaterialGroupRange[]): number {
    return Math.max(0, 100 - groups.reduce((sum, { share }) => sum + share, 0));
  }

  formatShare(share: number): string {
    return share.toLocaleString('de-AT', { maximumFractionDigits: 0 });
  }

  resetForm() {
    this.periodControl.reset();
    this.usageControl.reset();
    this.filterService.setFilters([], []);
    this.filterService.setMaterialReference(null);
  }

  isResetDisabled(): boolean {
    return !this.periodControl.value?.length && !this.usageControl.value?.length && !this.materialReference;
  }

  closeFilterMenu() {
    this.closePanel.emit();
  }
}
