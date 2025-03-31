import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';

import { BuildingPart } from '../../models/building-part';
import { Building } from '../../models/building';
import { FileType } from '../../enums/file-type.enum';
import { Period, PeriodLabels } from '../../enums/period.enum';
import { Usage, UsageLabels } from '../../enums/usage.enum';
import { StructureTreeComponent } from "../structure-tree/structure-tree.component";


@Component({
  selector: 'app-structure-details',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDividerModule, MatExpansionModule, StructureTreeComponent],
  templateUrl: './structure-details.component.html',
  styleUrl: './structure-details.component.scss'
})
export class StructureDetailsComponent implements OnInit {

  @Input() entity!: Building | BuildingPart | null;
  @Output() closeDetails = new EventEmitter<void>();

  // check on init if entity is building or building part
  isBuilding = false;
  building?: Building;
  buildingPart?: BuildingPart;

  periodOptions = Object.values(Period).filter(value => typeof value === 'number') as number[];
  periodLabels = PeriodLabels;

  usageOptions = Object.values(Usage).filter(value => typeof value === 'number') as number[];
  usageLabels = UsageLabels;


  dummyBuildingParts: BuildingPart[] = [        //TODO: replace with actual fetched buildingParts
    {
        id: "101",
        name: "Dach",
        description: "Primary roofing structure",
        type: "building_part",
        ownerId: "owner-001",
        isPublic: true,
        children: [
            {
                id: "102",
                name: "Dachziegel",
                description: "Ziegel des Daches",
                type: "building_part",
                ownerId: "owner-001",
                isPublic: true
            },
            {
                id: "103",
                name: "Dachbalken",
                description: "Trägt die Dachkonstruktion. Besteht aus Fichtenholz.",
                type: "building_part",
                ownerId: "owner-001",
                isPublic: true
            }
        ]
    },
    {
        id: "104",
        name: "Fundament",
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


  ngOnInit() {
    if(this.entity) {
      if ('bw_geb_id' in this.entity) {
        this.isBuilding = true;
        this.building = this.entity as Building;

        this.building.buildingParts = this.dummyBuildingParts; //TODO: replace with actual fetched buildingParts
      } else {
        this.isBuilding = false;
        this.buildingPart = this.entity as BuildingPart;
      }
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

  onClose() {
    this.closeDetails.emit();
  }

}
