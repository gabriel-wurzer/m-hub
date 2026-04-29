import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize, map, Observable, Subscription } from 'rxjs';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

import { UserService } from '../../services/user/user.service';
import { UserBuilding } from '../../models/building';
import { Floor } from '../../models/floor';
import { EditBuildingViewComponent } from '../edit-building-view/edit-building-view.component';
import { AuthenticationService } from '../../services/authentication/authentication.service';
import { EntityContext } from '../../models/entity-context';
import { StructureViewComponent } from '../structure-view/structure-view.component';
import { ConfirmDialogComponent } from '../dialogs/confirm-dialog/confirm-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';


@Component({
  selector: 'app-user-data',
  standalone: true,
  imports: [
    CommonModule, 
    MatDividerModule, 
    MatListModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatDialogModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    StructureViewComponent,
    EditBuildingViewComponent
  ],
  templateUrl: './user-data.component.html',
  styleUrl: './user-data.component.scss'
})
export class UserDataComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly compactActionWidthPx = 128;

  @ViewChildren('cardHeader') private cardHeaders!: QueryList<ElementRef<HTMLElement>>;

  readonly emptyValue = '—';

  userBuildings: UserBuilding[] = [];
  selectedBuilding: UserBuilding | null = null;
  compactMenuBuildingIds = new Set<string>();

  isStructureViewVisible = false;
  structureContext: EntityContext | null = null;
  isEditViewVisible = false;
  editingBuilding: UserBuilding | null = null;

  isLoading = false;
  isLoadingBuilding = false;
  errorMessage = '';

  isLoggedIn$: Observable<boolean>;
  private resizeObserver?: ResizeObserver;
  private cardHeadersChangeSub?: Subscription;
  private responsiveHeaderUpdateFrame: number | null = null;

  constructor(
    private authService: AuthenticationService,
    private userService: UserService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {    
    this.isLoggedIn$ = this.authService.getUser$().pipe(
      map(user => !!user)
    );
  }

  ngOnInit(): void {
    if(!this.isLoggedIn$) return;

    this.loadBuildings();
  }

  ngAfterViewInit(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.scheduleResponsiveHeaderUpdate());
      this.observeCardHeaders();
    }

    this.cardHeadersChangeSub = this.cardHeaders.changes.subscribe(() => {
      this.observeCardHeaders();
      this.scheduleResponsiveHeaderUpdate();
    });

    this.scheduleResponsiveHeaderUpdate();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.cardHeadersChangeSub?.unsubscribe();

    if (this.responsiveHeaderUpdateFrame !== null) {
      cancelAnimationFrame(this.responsiveHeaderUpdateFrame);
    }
  }

  private loadBuildings(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.userService.getUserBuildingsList().subscribe({
      next: (data) => {
        this.userBuildings = data || []; 
        this.isLoading = false;
        this.scheduleResponsiveHeaderUpdate();
      },
      error: (error) => {
        console.error('Failed to load user buildings:', error);
        this.errorMessage = 'Gebäudeliste konnten nicht geladen werden.';
        this.isLoading = false;
      }
    });
  }

  
  isSelected(building: UserBuilding): boolean {
    if (!building || !this.selectedBuilding) return false;
    return this.selectedBuilding.id === building.id;
  }

  deselectBuilding(): void {
    if (this.selectBuilding !== null) {
      console.log(`Building with ID ${this.selectedBuilding?.id} deselected`);
    }
    this.selectedBuilding = null;
    this.scheduleResponsiveHeaderUpdate();
  }

  selectBuilding(building: UserBuilding): void {
    if (!building) return;
    this.selectedBuilding = building;
    this.scheduleResponsiveHeaderUpdate();
  }

  deleteBuilding(building: UserBuilding): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '450px',
      data: {
        title: 'Gebäude löschen',
        message: `Möchtest du das Gebäude <strong>${building.name}</strong> (ID: ${building.building_id}) wirklich unwiderruflich löschen? Alle zugehörigen Daten gehen verloren.`,
        confirmText: 'Löschen',
        cancelText: 'Behalten',
        requireSlider: true, 
        sliderText: 'Löschen bestätigen' 
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        this.executeDelete(building);
      }
    });
  }

  private executeDelete(building: UserBuilding): void {
    this.isLoading = true;

    this.userService.deleteUserBuilding(building.id)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: () => {
          this.userBuildings = this.userBuildings.filter(b => b.id !== building.id);
          if (this.selectedBuilding?.id === building.id) {
            this.selectedBuilding = null;
          }
          this.scheduleResponsiveHeaderUpdate();
        },
        complete: () => {
          this.snackBar.open('Gebäude erfolgreich entfernt.', 'OK', {
            duration: 3000,
            verticalPosition: 'top'
          });
        },
        error: (error) => {
          console.error('Failed to delete building:', error);
          this.errorMessage = 'Gebäude konnte nicht entfernt werden.';
                  this.snackBar.open(this.errorMessage, 'OK', {
            duration: 10000,
            verticalPosition: 'top'
          });
        }
      });
  }

  editBuilding(building: UserBuilding): void {
    if (!building) return;
    this.editingBuilding = building;
    this.isEditViewVisible = true;
    this.isStructureViewVisible = false;
    this.structureContext = null;
  }

  showBuildingInfo(building: UserBuilding): void {

    const context: EntityContext = {
      id: building.building_id, // Use the external Building ID
      type: 'building'
    };
    
    this.showStructureView(context);
  }

  showStructureView(context: EntityContext): void {
    this.structureContext = context;
    this.isStructureViewVisible = true;
    this.isEditViewVisible = false;
    this.editingBuilding = null;
  }
  
  hideStructureView(): void {
    this.isStructureViewVisible = false;
    this.structureContext = null;
  }

  hideEditBuildingView(): void {
    this.isEditViewVisible = false;
    this.editingBuilding = null;
  }

  onBuildingUpdated(updated: UserBuilding): void {
    if (!updated) return;

    const merged = this.mergeUpdatedBuilding(updated);

    if (this.selectedBuilding?.id === updated.id) {
      this.selectedBuilding = merged ?? { ...this.selectedBuilding, ...updated };
    }

    if (this.editingBuilding?.id === updated.id) {
      this.editingBuilding = merged ?? { ...this.editingBuilding, ...updated };
    }

    this.scheduleResponsiveHeaderUpdate();
  }

  private mergeUpdatedBuilding(updated: UserBuilding): UserBuilding | null {
    const index = this.userBuildings.findIndex(building => building.id === updated.id);
    if (index === -1) return null;

    const merged = { ...this.userBuildings[index], ...updated };
    this.userBuildings[index] = merged;
    return merged;
  }

  getBuildingDisplayName(building: UserBuilding): string {
    return building.name.trim() || `Gebäude ${building.building_id}`;
  }

  shouldUseCompactMenu(building: UserBuilding): boolean {
    return this.compactMenuBuildingIds.has(building.id);
  }

  getStructureSegments(building: UserBuilding): Array<{ main: string; note?: string }> {
    if (!building?.structure?.length) return [];

    return building.structure.map(level => this.formatStructureSegment(level));
  }

  private formatStructureSegment(level: Floor): { main: string; note?: string } {
    if ('count' in level) {
      const details: string[] = [];

      if (level.count) details.push(`${level.count}x`);
      if (level.height) details.push(`${level.height} cm`);
      if (level.area) details.push(`${level.area} m²`);

      return {
        main: level.type,
        note: details.length > 0 ? `(${details.join(', ')})` : undefined
      };
    }

    const details = [level.roofType, level.description].filter(Boolean) as string[];

    return {
      main: level.type,
      note: details.length > 0 ? `(${details.join(', ')})` : undefined
    };
  }

  private observeCardHeaders(): void {
    if (!this.resizeObserver) return;

    this.resizeObserver.disconnect();
    this.cardHeaders.forEach(header => this.resizeObserver?.observe(header.nativeElement));
  }

  private scheduleResponsiveHeaderUpdate(): void {
    if (typeof window === 'undefined') return;

    if (this.responsiveHeaderUpdateFrame !== null) {
      cancelAnimationFrame(this.responsiveHeaderUpdateFrame);
    }

    this.responsiveHeaderUpdateFrame = window.requestAnimationFrame(() => {
      this.responsiveHeaderUpdateFrame = null;
      this.updateResponsiveHeaderActions();
    });
  }

  private updateResponsiveHeaderActions(): void {
    if (!this.cardHeaders) return;

    const compactIds = new Set<string>();

    this.cardHeaders.forEach(headerRef => {
      const header = headerRef.nativeElement;
      const buildingId = header.dataset['buildingId'];

      if (!buildingId || this.selectedBuilding?.id !== buildingId) return;

      const titleMeasure = header.querySelector('.card-title-measure') as HTMLElement | null;
      const iconShell = header.querySelector('.icon-shell') as HTMLElement | null;

      if (!titleMeasure) return;

      const columnGap = parseFloat(getComputedStyle(header).columnGap || '0');
      const iconWidth = iconShell ? Math.ceil(iconShell.getBoundingClientRect().width) : 0;
      const headerWidth = header.clientWidth;
      const titleWidth = Math.ceil(titleMeasure.getBoundingClientRect().width);
      const availableTitleWidth = headerWidth - iconWidth - this.compactActionWidthPx - (columnGap * 2);

      if (titleWidth > availableTitleWidth) {
        compactIds.add(buildingId);
      }
    });

    this.compactMenuBuildingIds = compactIds;
  }

}
