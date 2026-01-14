import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTabsModule } from '@angular/material/tabs';

import { Bauteil, BuildingComponent, Objekt } from '../../../models/building-component';
import { Document } from '../../../models/document';
import { Floor } from '../../../models/floor';
import { MatDividerModule } from '@angular/material/divider';
import { UserBuilding } from '../../../models/building';
import { FloorType } from '../../../enums/floor-type.enum';
import { RoofType } from '../../../enums/roof-type.enum';
import { BuildingStructureListComponent } from "../../building-structure-list/building-structure-list.component";
import { DocumentService } from '../../../services/document/document.service';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';



@Component({
  selector: 'app-edit-building-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTooltipModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatExpansionModule,
    MatTabsModule,
    MatDividerModule,
    BuildingStructureListComponent
],
  templateUrl: './edit-building-dialog.component.html',
  styleUrl: './edit-building-dialog.component.scss'
})
export class EditBuildingDialogComponent implements OnInit {

  selectedTabIndex: number = 0;

  FloorType = FloorType;
  RoofType = RoofType;

  roofTypes = Object.values(RoofType);
  floorTypes = Object.values(FloorType).filter(ft => ft !== FloorType.D);

  name: string = '';
  address: string = '';
  structure: Floor[] = [];

  private originalStructureJson: string = '';
  private originalName: string = '';
  private originalAddress: string = '';

  isStructureValid: boolean = false;

  buildingParts: Bauteil[] = [];
  buildingObjects: Objekt[] = [];
  documents: Document[] = [];

  floorSvgUrl = 'assets/images/geschoss.svg';
  roofSvgUrl = 'assets/images/dach.svg';

  animationsDisabled = true;

  isLoadingDocuments = false;
  isLoadingObjects = false;
  isLoadingParts = false;



  buildingPartsMock: any[] = [
    { id: "3", name: 'RG1', category: 'WAND' },
    { id: "64", name: 'UG2', category: 'BODEN' },
    { id: "64", name: 'UG2', category: 'BODEN' },
    { id: "64", name: 'UG2', category: 'BODEN' },
    { id: "64", name: 'UG2', category: 'BODEN' },
    { id: "64", name: 'UG2', category: 'BODEN' },
    { id: "64", name: 'UG2', category: 'BODEN' },
    { id: "64", name: 'UG2', category: 'BODEN' },
    { id: "64", name: 'UG2', category: 'BODEN' },
    { id: "64", name: 'UG2', category: 'BODEN' },
    { id: "64", name: 'UG2', category: 'BODEN' },
    { id: "64", name: 'UG2', category: 'BODEN' },
    { id: "64", name: 'UG2', category: 'BODEN' },
    { id: "64", name: 'UG2', category: 'BODEN' }
  ];

  constructor(
      public dialogRef: MatDialogRef<EditBuildingDialogComponent>,
      @Inject(MAT_DIALOG_DATA) public data: { userBuilding: UserBuilding },
      private documentService: DocumentService,
      private dialog: MatDialog
  ) {
    if (this.data && this.data.userBuilding) {
      
      // create copy of user building to prevent change of original befor completing dialog--> Immutability principle
      const b = this.data.userBuilding;
      this.name = b.name || '';
      this.address = b.address || '';
      this.structure = b.structure ? JSON.parse(JSON.stringify(b.structure)) : [];

      // SNAPSHOT DER ORIGINALDATEN MACHEN
      this.originalName = this.name;
      this.originalAddress = this.address;
      // JSON Stringify ist ein einfacher Weg, um Objekte/Arrays auf Gleichheit zu prüfen
      this.originalStructureJson = JSON.stringify(this.structure);
    }
  }

  ngOnInit(): void {
    this.fetchDocuments();

    // TODO: Fetch usrbuilding related parts and objects
  }

  private fetchDocuments(): void {
    if (!this.data.userBuilding?.id) return;

    this.isLoadingDocuments = true;

    this.documentService.getDocumentsByUserBuilding(this.data.userBuilding.id).subscribe({
      next: (docs) => {
        this.documents = docs;
        this.isLoadingDocuments = false;
        console.log('Docs loaded for User Building:', this.documents);
      },
      error: (err) => {
        console.error('Error loading documents', err);
        this.isLoadingDocuments = false;
      }
    });
  }


  openAddBuildingPartDialog(): void {
    console.log('Open Add Building Part Dialog - Not yet implemented');
  }

  openAddBuildingObjectDialog(): void {
    console.log('Open Add Building Object Dialog - Not yet implemented');
  }

  openAddDocumentDialog(): void {
    console.log('Open Add Document Dialog - Not yet implemented');
  }

  getNameError(): string | null {
    if (this.name.trim().length === 0) {
      return 'Bitte Namen für das Gebäude angeben';
    }
    return null;
  }

  private normalizeOptionalInput(input: string): string | null {
    const trimmed = input.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  isFormValid(): boolean {
    const isNameValid = !!this.name && this.name.trim().length > 0;
    
    return isNameValid && this.isStructureValid;
  }
  
  confirmEditBuilding(): void {
    if (!this.isFormValid()) return;

    const trimmedAddress = this.normalizeOptionalInput(this.address);

    this.dialogRef.close({
      name: this.name.trim(),
      address: trimmedAddress, 
      structure: this.structure,
      // buildingComponents: this.components,
      // documents: this.documents
    });
  }

  hasUnsavedChanges(): boolean {
    if (this.name !== this.originalName) return true;
    
    const currentAddress = this.address ? this.address.trim() : '';
    const oldAddress = this.originalAddress ? this.originalAddress.trim() : '';
    if (currentAddress !== oldAddress) return true;
    
    const currentStructureJson = JSON.stringify(this.structure);
    if (currentStructureJson !== this.originalStructureJson) return true;

    return false;
  }

  close(): void {
    if (this.hasUnsavedChanges()) {
        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
            width: '90%',
            maxWidth: '420px',
            autoFocus: false,
            data: {
                title: 'Änderungen verwerfen?',
                message: 'Du hast ungespeicherte Änderungen an der Gebäudestruktur. Möchtest du den Dialog wirklich schließen? Deine Änderungen gehen verloren.',
                confirmText: 'Verwerfen',
                cancelText: 'Abbrechen'
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result === true) {
              this.dialogRef.close(); // Wirklich schließen
            }
        });
    } else {
        this.dialogRef.close();
    }
  }

}
