import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Building } from '../../models/building';
import { Period, PeriodLabels } from '../../enums/period.enum';
import { Usage, UsageLabels } from '../../enums/usage.enum';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { EChartsOption } from 'echarts';
import { NgxEchartsModule } from 'ngx-echarts';
import { MaterialGroup } from '../../enums/material-group.enum';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DocumentListComponent } from "../document-list/document-list.component";
import { BreakpointObserver } from '@angular/cdk/layout';
import { AddBuildingButtonComponent } from "../buttons/add-building-button/add-building-button.component";
import { BuildingService } from '../../services/building/building.service';

@Component({
  selector: 'app-building-sidepanel',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDividerModule, MatListModule, MatProgressSpinnerModule, NgxEchartsModule, DocumentListComponent, AddBuildingButtonComponent],
  templateUrl: './building-sidepanel.component.html',
  styleUrl: './building-sidepanel.component.scss'
})
export class BuildingSidepanelComponent implements OnInit {
  @Input() building: Building | null = null;
  @Output() closePanel = new EventEmitter<void>();

  @Output() openStructureView = new EventEmitter<Building>();

  errorMessage = '';
  skipFetchDocuments = false;

  periodOptions = Object.values(Period).filter(value => typeof value === 'number') as number[];
  periodLabels = PeriodLabels;

  usageOptions = Object.values(Usage).filter(value => typeof value === 'number') as number[];
  usageLabels = UsageLabels;

  usagePieChartOptions: EChartsOption = {};
  materialsPieChartOptions: EChartsOption = {};

  isLoading = false; 
  isMobile = false;

  userId = "c3e5b0fc-cc48-4a6f-8e27-135b6d3a1b71";


  constructor(
    private buildingService: BuildingService,
    private breakpointObserver: BreakpointObserver
  ) {}

  ngOnInit(): void {
    if (!this.building) return;

    this.breakpointObserver.observe(['(max-width: 800px)']).subscribe(result => {
      this.isMobile = result.matches;
    });
  }

  ngOnChanges() {
    if (this.building) {
      this.fetchBuildingData(this.building.bw_geb_id);
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

  updateUsagePieChart() {
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

  updateMaterialsPieChart() {
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
        text: 'Baumaterialgruppen',
      },
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (params: any) => {
          const roundedValue = Number(params.value).toFixed(2);
          return `${params.marker} ${params.name}: <b>${roundedValue} t</b>`;
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

  fetchBuildingData(buildingId: number): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.skipFetchDocuments = false;
    
    this.buildingService.getBuildingById(buildingId).subscribe({
      next: (freshBuilding) => {
        this.building = freshBuilding;
        this.updateUsagePieChart();
        this.updateMaterialsPieChart();
        this.skipFetchDocuments = false;
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = 'Fehler beim Laden der Gebäudedaten. Lokale Daten werden angezeigt.';
        console.error(this.errorMessage, err);
        this.updateUsagePieChart();
        this.updateMaterialsPieChart();
        this.skipFetchDocuments = true;
        this.isLoading = false;
      }
    });
  }


  openStructureViewPanel() {
    console.log('Open structure details view for building: ', this.building?.bw_geb_id);
    if (this.building) {
      this.openStructureView.emit(this.building);
    }
  }

  onClose() {
    this.closePanel.emit();
  }
}
