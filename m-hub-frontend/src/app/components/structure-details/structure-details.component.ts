import { Component, Input, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';

import { EChartsOption } from 'echarts';
import { NgxEchartsModule } from 'ngx-echarts';

import { BuildingPart } from '../../models/building-part';
import { Building } from '../../models/building';
import { Period, PeriodLabels } from '../../enums/period.enum';
import { Usage, UsageLabels } from '../../enums/usage.enum';
import { DocumentListComponent } from "../document-list/document-list.component";
import { MaterialGroup } from '../../enums/material-group.enum';


@Component({
  selector: 'app-structure-details',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDividerModule, MatExpansionModule, MatProgressSpinnerModule, MatListModule, DocumentListComponent, NgxEchartsModule],
  templateUrl: './structure-details.component.html',
  styleUrl: './structure-details.component.scss'
})
export class StructureDetailsComponent implements OnInit {

  @Input() entity!: Building | BuildingPart | null;

  errorMessage = '';

  // check on init if entity is building or building part
  isBuilding = false;
  building!: Building | null;
  buildingPart!: BuildingPart | null;

  periodOptions = Object.values(Period).filter(value => typeof value === 'number') as number[];
  periodLabels = PeriodLabels;

  usageOptions = Object.values(Usage).filter(value => typeof value === 'number') as number[];
  usageLabels = UsageLabels;

  usagePieChartOptions: EChartsOption = {};
  materialsPieChartOptions: EChartsOption = {};

  isLoading = false;

  ngOnInit() {
    if (!this.entity) return;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['entity']) {
      this.setupEntity();
    }
  }

  private setupEntity() {
    this.building = null;
    this.buildingPart = null;

    if (!this.entity) return;

    'bw_geb_id' in this.entity
      ? (this.isBuilding = true, this.building = this.entity as Building)
      : (this.isBuilding = false, this.buildingPart = this.entity as BuildingPart);


      console.log("current building: ", this.building);


      if(this.isBuilding) {
        this.#updateUsagePieChart();
        this.#updateMaterialsPieChart();
      }
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

  #updateUsagePieChart() {
    if (!this.building) return;

    const usageData = [
      { value: this.building.m2bgf_use1, name: UsageLabels[Usage.WOHNEN] },
      { value: this.building.m2bgf_use2, name: UsageLabels[Usage.GEMISCHT] },
      { value: this.building.m2bgf_use3, name: UsageLabels[Usage.INDUSTRIE] },
      { value: this.building.m2bgf_use4, name: UsageLabels[Usage.SONSTIGES] }
    ].filter(entry => entry.value > 0);

    this.usagePieChartOptions = {
      title: {
        left: 'center',
        text: 'Bruttogrundfläche',
        subtext: 'nach Nutzungen',
        subtextStyle: {
          fontSize: 14
        }
      },
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (params: any) => {
          return `${params.marker} ${params.name}: <b>${params.value} m&sup2;</b>`;
        },
        textStyle: {
          fontSize: 15
        },
      },
      legend: {
        orient: 'vertical',
        top: 'bottom',
        left: 'right',
        selectedMode: false
      },
      series: [
        {
          name: 'Nutzungen',
          type: 'pie',
          radius: '60%',
          data: usageData,
          label: {
            show: true,
            position: 'outside',
            alignTo: 'edge',
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    };
  }

  #updateMaterialsPieChart() {
    if (!this.building) return;

    const materialsData = [
      { value: this.building.bmg1, name: MaterialGroup.mg_1 },
      { value: this.building.bmg2, name: MaterialGroup.mg_2 },
      { value: this.building.bmg3, name: MaterialGroup.mg_3 },
      { value: this.building.bmg4, name: MaterialGroup.mg_4 },
      { value: this.building.bmg5, name: MaterialGroup.mg_5 },
      { value: this.building.bmg6, name: MaterialGroup.mg_6 },
      { value: this.building.bmg7, name: MaterialGroup.mg_7 },
      { value: this.building.bmg8, name: MaterialGroup.mg_8 },
      { value: this.building.bmg9, name: MaterialGroup.mg_9 }
    ].filter(entry => entry.value > 0);
  
    this.materialsPieChartOptions = {
      title: {
        left: 'center',
        text: 'Baumatrialgruppen',
      },
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (params: any) => {
          const roundedValue = Number(params.value).toFixed(2);
          return `${params.marker} ${params.name}: <b>${roundedValue} t/m&sup2;</b>`;
        },
        textStyle: {
          fontSize: 15
        },
      },
      legend: {
        orient: 'vertical',
        top: 'bottom',
        left: 'right',
        selectedMode: false,
        type: 'scroll',
        height: 110,
        pageButtonPosition: 'start',
        pageIconSize: 11,
      },
      series: [
        {
          name: 'Baumaterialgruppen',
          type: 'pie',
          radius: '60%',
          center: ['50%', '38%'],
          data: materialsData,
          label: {
            show: false
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    };
  }

}
