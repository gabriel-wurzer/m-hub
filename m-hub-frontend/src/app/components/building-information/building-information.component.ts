import { Component, EventEmitter, Input, Output } from '@angular/core';
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
import { BuildingPart } from '../../models/building-part';
import { FileType } from '../../enums/file-type.enum';



@Component({
  selector: 'app-building-information',
  standalone: true,
  imports: [ CommonModule, MatIconModule, MatButtonModule, MatDividerModule, MatListModule, NgxEchartsModule],
  templateUrl: './building-information.component.html',
  styleUrl: './building-information.component.scss'
})
export class BuildingInformationComponent {
  @Input() building!: Building | null;
  @Output() closePanel = new EventEmitter<void>();

  periodOptions = Object.values(Period).filter(value => typeof value === 'number') as number[];
  periodLabels = PeriodLabels;

  usageOptions = Object.values(Usage).filter(value => typeof value === 'number') as number[];
  usageLabels = UsageLabels;

  usagePieChartOptions: EChartsOption = {};
  materialsPieChartOptions: EChartsOption = {};

  buildingParts: BuildingPart[] = [
    {
        id: "101",
        name: "Main Roof",
        description: "Primary roofing structure",
        type: "building_part",
        ownerId: "owner-001",
        isPublic: true,
        children: [
            {
                id: "102",
                name: "Sub Roof Section A",
                description: "Left side of the roof",
                type: "building_part",
                ownerId: "owner-001",
                isPublic: true
            },
            {
                id: "103",
                name: "Sub Roof Section B",
                description: "Right side of the roof",
                type: "building_part",
                ownerId: "owner-001",
                isPublic: true
            }
        ]
    },
    {
        id: "104",
        name: "Foundation",
        description: "Base structure of the building",
        type: "building_part",
        ownerId: "owner-002",
        isPublic: false
    },
    {
        id: "201",
        name: "Bauplan.pdf",
        description: "Architectural blueprint",
        type: "document",
        ownerId: "owner-003",
        isPublic: true,
        fileUrl: "https://example.com/blueprint.pdf",
        fileType: FileType.PDF
    },
    {
        id: "202",
        name: "Sicherheitsbericht.docx",
        description: "Building safety inspection report",
        type: "document",
        ownerId: "owner-004",
        isPublic: false,
        fileUrl: "https://example.com/inspection.docx",
        fileType: FileType.DOCX
    }
  ];

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

  ngOnChanges() {
    this.updateUsagePieChart();
    this.updateMaterialsPieChart();
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
      { value: this.building.bmg1, name: MaterialGroup.mg_mineral },
      { value: this.building.bmg2, name: MaterialGroup.mg_wood },
      { value: this.building.bmg3, name: MaterialGroup.mg_metals },
      { value: this.building.bmg4, name: MaterialGroup.mg_plastics },
      { value: this.building.bmg5, name: MaterialGroup.mg_insulation },
      { value: this.building.bmg6, name: MaterialGroup.mg_building_technology }
      // TODO: add bmg 7 to 9
    ].filter(entry => entry.value > 0);

    this.materialsPieChartOptions = {
      title: {
        left: 'center',
        text: 'Baumaterialien',
      },
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (params: any) => {
          const roundedValue = Number(params.value).toFixed(2);
          return `${params.marker} ${params.name}: <b>${roundedValue} m&sup3;</b>`;
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


  onClose() {
    this.closePanel.emit();
  }
}
