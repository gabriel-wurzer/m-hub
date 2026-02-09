import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabGroup, MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Bauteil, BuildingComponent, Objekt } from '../../models/building-component';
import { Document } from '../../models/document';
import { Floor } from '../../models/floor';
import { FloorType } from '../../enums/floor-type.enum';
import { RoofType } from '../../enums/roof-type.enum';
import { UserBuilding } from '../../models/building';
import { BuildingStructureListComponent } from '../building-structure-list/building-structure-list.component';
import { DocumentService } from '../../services/document/document.service';
import { UserService } from '../../services/user/user.service';
import { ConfirmDialogComponent } from '../dialogs/confirm-dialog/confirm-dialog.component';
import { BuildingPartService } from '../../services/building-part/building-part.service';
import { BuildingObjectService } from '../../services/building-object/building-object.service';
import { EntityInfoDialogComponent } from '../dialogs/entity-info-dialog/entity-info-dialog.component';
import { finalize } from 'rxjs';

export type EditBuildingPayload = {
  name: string;
  address?: string;
  structure: Floor[];
};

@Component({
  selector: 'app-edit-building-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTooltipModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatTabsModule,
    MatDividerModule,
    MatDialogModule,
    BuildingStructureListComponent
  ],
  templateUrl: './edit-building-view.component.html',
  styleUrl: './edit-building-view.component.scss'
})
export class EditBuildingViewComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() userBuilding: UserBuilding | null = null;
  @Output() closeEditView = new EventEmitter<void>();
  @Output() buildingUpdated = new EventEmitter<UserBuilding>();
  @ViewChild('tabGroup', { read: ElementRef }) tabGroupRef?: ElementRef<HTMLElement>;
  @ViewChild('tabGroup', { read: MatTabGroup }) tabGroup?: MatTabGroup;

  selectedTabIndex: number = 0;
  private lastTabIndex: number = 0;
  private isRevertingTab = false;
  private removeScrollListener?: () => void;

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
  private initializedBuildingId?: number | string;

  isStructureValid: boolean = false;

  buildingParts: Bauteil[] = [];
  buildingObjects: Objekt[] = [];
  documents: Document[] = [];

  floorSvgUrl = 'assets/images/geschoss.svg';
  roofSvgUrl = 'assets/images/dach.svg';

  animationsDisabled = true;
  suppressStructureAnimations = false;

  isLoadingDocuments = false;
  isLoadingObjects = false;
  isLoadingParts = false;

  constructor(
    private documentService: DocumentService,
    private buildingPartService: BuildingPartService,
    private buildingObjectService: BuildingObjectService,
    private userService: UserService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    if (this.userBuilding) {
      this.initializeFromBuilding(this.userBuilding);
    }
  }

  ngAfterViewInit(): void {
    // this.scheduleScrollBinding();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['userBuilding'] && this.userBuilding) {
      this.initializeFromBuilding(this.userBuilding);
    }
  }

  ngOnDestroy(): void {
    this.removeScrollListener?.();
  }

  private suppressStructureAnimationsOnce(): void {
    this.suppressStructureAnimations = true;
    Promise.resolve().then(() => {
      this.suppressStructureAnimations = false;
    });
  }

  private initializeFromBuilding(building: UserBuilding): void {
    this.suppressStructureAnimationsOnce();
    this.name = building.name || '';
    this.address = building.address || '';
    this.structure = building.structure ? JSON.parse(JSON.stringify(building.structure)) : [];

    const shouldResetTab = building.id !== this.initializedBuildingId;

    this.originalName = this.name;
    this.originalAddress = this.address;
    this.originalStructureJson = JSON.stringify(this.structure);

    if (shouldResetTab) {
      this.selectedTabIndex = 0;
      this.lastTabIndex = 0;
    }

    this.initializedBuildingId = building.id;
    this.fetchDocuments(building);
    this.fetchBuildingParts(building);
    this.fetchBuildingObjects(building);
  }

  private fetchDocuments(building: UserBuilding): void {
    if (!building?.id) return;

    this.isLoadingDocuments = true;

    this.documentService.getDocumentsByUserBuilding(building.id).subscribe({
      next: (docs) => {
        this.documents = docs;
        this.isLoadingDocuments = false;
        console.log('Docs loaded for User Building:', this.documents);
        // this.scheduleScrollBinding();
      },
      error: (err) => {
        console.error('Error loading documents', err);
        this.isLoadingDocuments = false;
        // this.scheduleScrollBinding();
      }
    });
  }

  private fetchBuildingParts(building: UserBuilding): void {
    if (!building?.id) return;

    this.isLoadingParts = true;

    this.buildingPartService.getComponentsByUserBuilding(building.id).subscribe({
      next: (parts) => {
        this.buildingParts = parts;
        this.isLoadingParts = false;
        console.log('Building parts loaded for User Building:', this.buildingParts);
      },
      error: (err) => {
        console.error('Error loading building parts', err);
        this.isLoadingParts = false;
      }
    });
  }

  private fetchBuildingObjects(building: UserBuilding): void {
    if (!building?.id) return;

    this.isLoadingObjects = true;

    this.buildingObjectService.getComponentsByUserBuilding(building.id).subscribe({
      next: (objects) => {
        this.buildingObjects = objects;
        this.isLoadingObjects = false;
        console.log('Building objects loaded for User Building:', this.buildingObjects);
      },
      error: (err) => {
        console.error('Error loading building objects', err);
        this.isLoadingObjects = false;
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

  openEntityInfoDialog(entity: Bauteil | Objekt | Document): void {
    this.dialog.open(EntityInfoDialogComponent, {
      width: '90%',
      maxWidth: '620px',
      autoFocus: false,
      data: {
        entity
      }
    });
  }

  openDeleteComponentDialog(component: BuildingComponent): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '450px',
      data: {
        title: component.category === 'Bauteil' ? 'Bauteil löschen' : 'Objekt löschen',
        message: `Möchtest du <strong>${component.name}</strong> (ID: ${component.id}) wirklich unwiderruflich löschen? Alle zugehörigen Daten gehen verloren.`,
        confirmText: 'Löschen',
        cancelText: 'Behalten',
        requireSlider: true, 
        sliderText: 'Löschen bestätigen' 
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        this.executeComponentDelete(component);
      }
    });
  }

  private executeComponentDelete(component: BuildingComponent): void {
    const isPart = component.category === 'Bauteil';
    const isObject = component.category === 'Objekt';

    if (!isPart && !isObject) {
      console.error('Unbekannte Komponente:', component.category, component);
      this.snackBar.open(`Komponente konnte nicht gelöscht werden.`, 'OK', {
        duration: 10000,
        verticalPosition: 'top',
        panelClass: 'snackbar-warn'
      });
      return;
    }

    const setLoadingState = (isLoading: boolean): void => {
      if (isPart) {
        this.isLoadingParts = isLoading;
      } else {
        this.isLoadingObjects = isLoading;
      }
    };

    setLoadingState(true);

    const deleteRequest$ = isPart
      ? this.buildingPartService.deleteComponent(component.id)
      : this.buildingObjectService.deleteComponent(component.id);

    deleteRequest$
      .pipe(finalize(() => setLoadingState(false)))
      .subscribe({
        next: () => {
          if (isPart) {
            this.buildingParts = this.buildingParts.filter(part => part.id !== component.id);
          } else {
            this.buildingObjects = this.buildingObjects.filter(object => object.id !== component.id);
          }
        },
        complete: () => {
          this.snackBar.open(`${component.name} erfolgreich gelöscht.`, 'OK', {
            duration: 3000,
            verticalPosition: 'top'
          });
        },
        error: (error) => {
          console.error('Failed to delete component:', error);
          this.snackBar.open(`${component.name} konnte nicht gelöscht werden.`, 'OK', {
            duration: 10000,
            verticalPosition: 'top',
            panelClass: 'snackbar-warn'
          });
        }
      });
  }

  openDeleteDcoumentDialog(document: Document): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '450px',
      data: {
        title: 'Dokument löschen',
        message: `Möchtest du das Dokument <strong>${document.name}</strong> wirklich unwiderruflich löschen? Alle zugehörigen Daten gehen verloren.`,
        confirmText: 'Löschen',
        cancelText: 'Behalten',
        requireSlider: true, 
        sliderText: 'Löschen bestätigen' 
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        this.executeDocumentDelete(document);
      }
    });
  }

  private executeDocumentDelete(document: Document): void {
    this.isLoadingDocuments = true;

    this.documentService.deleteDocument(document.id)
      .pipe(finalize(() => this.isLoadingDocuments = false))
      .subscribe({
        next: () => {
          this.documents = this.documents.filter(d => d.id !== document.id);
        },
        complete: () => {
          this.snackBar.open('Dokument erfolgreich entfernt.', 'OK', {
            duration: 3000,
            verticalPosition: 'top'
          });
        },
        error: (error) => {
          console.error('Failed to delete document:', error);
          this.snackBar.open(`Dokument konnte nicht gelöscht werden.`, 'OK', {
            duration: 10000,
            verticalPosition: 'top',
            panelClass: 'snackbar-warn'
          });
        }
      });
  }

  getNameError(): string | null {
    if (this.name.trim().length === 0) {
      return 'Bitte Namen für das Gebäude angeben';
    }
    return null;
  }

  private normalizeOptionalInput(input: string): string | undefined {
    const trimmed = input.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }

  isFormValid(): boolean {
    const isNameValid = !!this.name && this.name.trim().length > 0;

    return isNameValid && this.isStructureValid;
  }

  formatBoolean(value: unknown): string {
    if (value === null || value === undefined) return 'unknown';
    if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'ja'].includes(normalized)) return 'Ja';
      if (['false', '0', 'no', 'nein'].includes(normalized)) return 'Nein';
    }
    if (typeof value === 'number') return value === 1 ? 'Ja' : value === 0 ? 'Nein' : String(value);
    return String(value);
  }

  saveUpdatedBuilding(): void {
    if (!this.isFormValid()) return;

    const trimmedAddress = this.normalizeOptionalInput(this.address);

    if (!this.userBuilding?.id) return;

    const payload: EditBuildingPayload = {
      name: this.name.trim(),
      address: trimmedAddress,
      structure: this.structure
    };

    if (!this.hasUnsavedChanges()) return;

    this.userService.updateUserBuilding(this.userBuilding.id, payload).subscribe({
      next: updated => {
        console.log('User building updated:', updated);
        this.applyUpdatedBuilding(updated);
        this.buildingUpdated.emit(updated);
        this.snackBar.open('Gebäudestruktur aktualisiert.', 'OK', {
          duration: 3000,
          verticalPosition: 'top'
        });
      },
      error: err => {
        console.error('Error updating user building:', err);
        this.snackBar.open('Fehler beim Aktualisieren der Gebäudestruktur!', 'OK', {
          duration: 10000,
          verticalPosition: 'top',
          panelClass: 'snackbar-warn'
        });
      }
    });
  }

  private applyUpdatedBuilding(updated: UserBuilding): void {
    this.suppressStructureAnimationsOnce();
    if (this.userBuilding) {
      Object.assign(this.userBuilding, updated);
    }

    if (updated.name !== undefined) {
      this.name = updated.name || '';
    }
    if (updated.address !== undefined) {
      this.address = updated.address || '';
    }
    if (updated.structure !== undefined) {
      this.structure = updated.structure ? JSON.parse(JSON.stringify(updated.structure)) : [];
    }

    this.originalName = this.name;
    this.originalAddress = this.address;
    this.originalStructureJson = JSON.stringify(this.structure);
  }

  private discardUnsavedChanges(): void {
    this.name = this.originalName;
    this.address = this.originalAddress;
    this.structure = this.originalStructureJson ? JSON.parse(this.originalStructureJson) : [];
    this.isStructureValid = this.isStructureValidFor(this.structure);
  }

  private isStructureValidFor(structure: Floor[]): boolean {
    const roof = structure.find(f => f.type === FloorType.D) as any;
    const isRoofValid = !!roof && !!roof.roofType;

    const regularFloors = structure.filter(f => f.type === FloorType.RG) as any[];
    const basementFloors = structure.filter(f => f.type === FloorType.KG) as any[];

    const hasRegularFloors = regularFloors.length > 0;
    const areRegularFloorsValid = regularFloors.every(f =>
      f.count !== null && f.count > 0 && Number.isInteger(f.count) &&
      f.height !== null && f.height > 0 &&
      f.area !== null && f.area > 0
    );

    const areBasementFloorsValid = basementFloors.every(f =>
      f.count !== null && f.count > 0 && Number.isInteger(f.count) &&
      f.height !== null && f.height > 0 &&
      f.area !== null && f.area > 0
    );

    return isRoofValid && hasRegularFloors && areRegularFloorsValid && areBasementFloorsValid;
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

  onTabLabelClick(nextIndex: number, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.onTabIndexChange(nextIndex);
  }

  private applyTabIndex(index: number): void {
    this.selectedTabIndex = index;
    if (this.tabGroup) {
      this.tabGroup.selectedIndex = index;
    }
  }

  private commitTabIndex(index: number): void {
    this.lastTabIndex = index;
    this.applyTabIndex(index);
  }

  onTabIndexChange(nextIndex: number): void {
    if (this.isRevertingTab) return;
    if (nextIndex === this.lastTabIndex) {
      this.applyTabIndex(this.lastTabIndex);
      return;
    }

    if (!this.hasUnsavedChanges()) {
      this.commitTabIndex(nextIndex);
      // this.scheduleScrollBinding();
      return;
    }

    const previousIndex = this.lastTabIndex;

    this.isRevertingTab = true;
    this.applyTabIndex(previousIndex);
    // this.scheduleScrollBinding();
    Promise.resolve().then(() => {
      this.applyTabIndex(previousIndex);
      this.isRevertingTab = false;
    });

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '90%',
      maxWidth: '520px',
      autoFocus: false,
      data: {
        title: 'Änderungen verwerfen?',
        messagePrefix: 'Beim Wechseln des Tabs werden ungespeicherte Änderungen an der Gebäudestruktur verworfen. Zum Speichern ',
        messageIcon: 'save',
        messageSuffix: '-Icon nutzen. Tab trotzdem ohne zu speichern wechseln?',
        confirmText: 'Verwerfen',
        cancelText: 'Abbrechen'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        this.discardUnsavedChanges();
        this.commitTabIndex(nextIndex);
        // this.scheduleScrollBinding();
      } else {
        this.applyTabIndex(previousIndex);
      }
    });
  }

  close(): void {
    if (this.hasUnsavedChanges()) {
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        width: '90%',
        maxWidth: '480px',
        autoFocus: false,
        data: {
          title: 'Änderungen verwerfen?',
          messagePrefix: 'Beim Schließen werden ungespeicherte Änderungen an der Gebäudestruktur verworfen. Zum Speichern ',
          messageIcon: 'save',
          messageSuffix: '-Icon nutzen. Ansicht trotzdem ohne zu speichern schließen?',
          confirmText: 'Verwerfen',
          cancelText: 'Abbrechen'
        }
      });
        
      dialogRef.afterClosed().subscribe(result => {
        if (result === true) {
          this.closeEditView.emit();
        }
      });
    } else {
      this.closeEditView.emit();
    }
  }

  // private scheduleScrollBinding(): void {
  //   setTimeout(() => this.bindScrollListener());
  // }

  // private bindScrollListener(): void {
  //   this.removeScrollListener?.();
  //   const contentEl = this.getActiveTabContent();
  //   if (!contentEl) return;

  //   const onScroll = () => this.updateScrollFade(contentEl);
  //   contentEl.addEventListener('scroll', onScroll, { passive: true });
  //   this.removeScrollListener = () => contentEl.removeEventListener('scroll', onScroll);

  //   this.updateScrollFade(contentEl);
  // }

  // private getActiveTabContent(): HTMLElement | null {
  //   return this.tabGroupRef?.nativeElement.querySelector(
  //     '.mat-mdc-tab-body-active .mat-mdc-tab-body-content'
  //   ) as HTMLElement | null;
  // }

  // private updateScrollFade(contentEl: HTMLElement): void {
  //   contentEl.classList.toggle('is-scrolled', contentEl.scrollTop > 0);
  //   const hasScrollbar = contentEl.scrollHeight > contentEl.clientHeight + 1;
  //   contentEl.classList.toggle('has-scrollbar', hasScrollbar);
  // }
}

