import { CommonModule } from '@angular/common';
import { animate, style, transition, trigger } from '@angular/animations';
import { Component, Inject, Optional } from '@angular/core';
import { FormControl, FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ErrorStateMatcher } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PartStructureListComponent } from '../../part-structure-list/part-structure-list.component';
import { FloorType } from '../../../enums/floor-type.enum';
import { PartType } from '../../../enums/part-type.enum';
import { RoofType } from '../../../enums/roof-type.enum';
import { Bauteil } from '../../../models/building-component';
import { Floor } from '../../../models/floor';
import { PartStructure } from '../../../models/part-structure';

export type EditPartDialogData = {
  structure?: Floor[];
  part?: Bauteil;
};

export type EditPartDialogResult = {
  name: string;
  partType: PartType;
  partStructure: PartStructure;
  isPublic: boolean;
  isHazardous: boolean;
  description: string | null;
  location: string;
};

type FloorOption = {
  label: string;
  description?: string;
};

type LocationOptionVm = {
  value: string;
  main: string;
  note?: string;
};

class PartTypeSelectMatcher implements ErrorStateMatcher {
  constructor(private readonly hasNoAvailablePartTypes: () => boolean) {}

  isErrorState(control: FormControl | null): boolean {
    if (this.hasNoAvailablePartTypes()) {
      return true;
    }

    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}

@Component({
  selector: 'app-edit-part-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatDividerModule,
    MatIconModule,
    PartStructureListComponent
  ],
  templateUrl: './edit-part-dialog.component.html',
  styleUrl: './edit-part-dialog.component.scss',
  animations: [
    trigger('partStructureBlend', [
      transition(':enter', [
        style({
          opacity: 0,
          transform: 'translateY(-6px)',
          height: '0px',
          overflow: 'hidden'
        }),
        animate(
          '260ms cubic-bezier(0.2, 0, 0, 1)',
          style({
            opacity: 1,
            transform: 'translateY(0)',
            height: '*'
          })
        )
      ]),
      transition(':leave', [
        style({
          opacity: 1,
          transform: 'translateY(0)',
          height: '*',
          overflow: 'hidden'
        }),
        animate(
          '200ms cubic-bezier(0.4, 0, 1, 1)',
          style({
            opacity: 0,
            transform: 'translateY(-4px)',
            height: '0px'
          })
        )
      ])
    ])
  ]
})
export class EditPartDialogComponent {
  readonly specialLocationOptions: string[] = ['Individuell (Verortung in Beschreibung angeben)'];
  private readonly specialLocationOptionValue = 'Individuell';
  private readonly floorDescriptionByLocationLabel = new Map<string, string>();
  private readonly roofTypeInBuilding: RoofType | null;
  private previousSelectedLocations: string[] = [];

  name: string = '';
  description: string = '';
  selectedLocations: string[] = [];
  partType: PartType | null = null;
  partStructure: PartStructure | null = null;
  isPartStructureValid = false;
  isPublic: boolean = true;
  isHazardous: boolean = false;

  floorOptions: FloorOption[] = [];
  locationOptions: string[] = [];
  locationOptionVms: LocationOptionVm[] = [];
  readonly allPartTypes: PartType[] = Object.values(PartType);
  availablePartTypes: PartType[] = [];
  readonly partTypeMatcher = new PartTypeSelectMatcher(
    () => this.selectedLocations.length > 0 && this.availablePartTypes.length === 0
  );

  constructor(
    @Optional() public dialogRef: MatDialogRef<EditPartDialogComponent> | null,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: EditPartDialogData | null,
    private snackBar: MatSnackBar
  ) {
    this.roofTypeInBuilding = this.resolveRoofTypeInBuilding(this.data?.structure ?? []);
    this.floorOptions = this.buildFloorOptions(this.data?.structure ?? []);
    this.rebuildFloorDescriptionByLocationLabel();
    this.locationOptions = [...this.floorOptions.map((option) => option.label), ...this.specialLocationOptions];
    this.locationOptionVms = this.locationOptions.map((value) => this.toLocationOptionVm(value));
    this.syncAvailablePartTypes();
    this.prefillFromPart(this.data?.part);
  }

  private prefillFromPart(part: Bauteil | undefined): void {
    if (!part) return;

    this.name = part.name ?? '';
    this.description = part.description ?? '';
    this.isPublic = this.coerceBoolean(part.is_public, true);
    this.isHazardous = this.coerceBoolean(part.is_hazardous, false);

    const parsedLocations = this.parseLocations(part.location);
    parsedLocations.forEach((value) => this.ensureLocationValueAvailable(value));
    this.selectedLocations = parsedLocations;
    this.previousSelectedLocations = [...this.selectedLocations];
    this.syncAvailablePartTypes();

    const parsedPartType = part.part_type as PartType;
    this.partType = this.availablePartTypes.includes(parsedPartType) ? parsedPartType : null;

    this.partStructure = part.part_structure ?? null;
    this.isPartStructureValid = !!this.partType && !!this.partStructure;
  }

  private parseLocations(location: string | undefined): string[] {
    if (!location || location.trim().length === 0) return [];

    return location
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map((part) => this.normalizeLocationValue(part));
  }

  private normalizeLocationValue(location: string): string {
    if (location === this.specialLocationOptions[0]) {
      return this.specialLocationOptionValue;
    }
    return location;
  }

  private ensureLocationValueAvailable(value: string): void {
    if (this.locationOptionVms.some((option) => option.value === value)) return;

    this.locationOptions.push(value);
    this.locationOptionVms.push(this.toLocationOptionVm(value));
  }

  private coerceBoolean(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    if (typeof value === 'number') return value === 1;
    return fallback;
  }

  private toLocationOptionVm(value: string): LocationOptionVm {
    const floorDesc = this.floorDescriptionByLocationLabel.get(value);
    if (floorDesc) {
      return { value, main: value, note: this.formatLocationNote(floorDesc) };
    }

    if (!this.specialLocationOptions.includes(value)) {
      return { value, main: value };
    }

    const match = value.match(/^(.*?)(\s*\(.*\))$/);
    if (!match) {
      return { value, main: value };
    }

    const main = match[1].trimEnd();
    const note = match[2].trimStart();

    return { value: this.specialLocationOptionValue, main, note };
  }

  private formatLocationNote(description: string): string | undefined {
    const trimmed = description.trim();
    if (trimmed.length === 0) return undefined;

    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      return trimmed;
    }

    return `(${trimmed})`;
  }

  private rebuildFloorDescriptionByLocationLabel(): void {
    this.floorDescriptionByLocationLabel.clear();

    for (const option of this.floorOptions) {
      if (!option.description) continue;
      this.floorDescriptionByLocationLabel.set(option.label, option.description);
    }
  }

  getNameError(): string | null {
    if (this.name.trim().length === 0) {
      return 'Bauteilname erforderlich';
    }
    return null;
  }

  getPartTypeError(): string | null {
    if (this.selectedLocations.length === 0) {
      return null;
    }

    if (this.availablePartTypes.length === 0) {
      return 'Für die gewählte Verortung gibt es keine gemeinsame Bauteil-Kategorie.';
    }

    if (!this.partType) {
      return 'Bauteiltyp erforderlich';
    }

    return null;
  }

  getLocationError(): string | null {
    if (this.selectedLocations.length === 0) {
      return 'Verortung erforderlich';
    }
    return null;
  }

  isFormValid(): boolean {
    const isNameValid = this.name.trim().length > 0;
    const isPartTypeValid = !!this.partType && this.availablePartTypes.includes(this.partType);
    const isLocationValid = this.selectedLocations.length > 0;
    const isPartStructureValid = this.partType ? this.isPartStructureValid : true;
    return isNameValid && isPartTypeValid && isLocationValid && isPartStructureValid;
  }

  onLocationsChange(selectedLocations: string[]): void {
    const hadIndividualSelected = this.previousSelectedLocations.includes(this.specialLocationOptionValue);
    const hasIndividualSelected = selectedLocations.includes(this.specialLocationOptionValue);

    if (hasIndividualSelected && selectedLocations.length > 1) {
      if (hadIndividualSelected) {
        this.selectedLocations = selectedLocations.filter((location) => location !== this.specialLocationOptionValue);
        this.openLocationSelectionHint('"Individuell" wurde abgewählt, da eine andere Verortung ausgewählt wurde.');
      } else {
        this.selectedLocations = [this.specialLocationOptionValue];
        this.openLocationSelectionHint('"Individuell" wurde ausgewählt. Andere Verortungen wurden abgewählt.');
      }
    } else if (hasIndividualSelected) {
      this.selectedLocations = [this.specialLocationOptionValue];
    } else {
      this.selectedLocations = selectedLocations;
    }

    this.syncAvailablePartTypes();
    this.previousSelectedLocations = [...this.selectedLocations];
  }

  onPartTypeChange(): void {
    this.partStructure = null;
    this.isPartStructureValid = false;
  }

  onPartStructureChange(structure: PartStructure | null): void {
    this.partStructure = structure;
  }

  onPartStructureValidityChange(isValid: boolean): void {
    this.isPartStructureValid = isValid;
  }

  isPartTypeSelectionDisabled(): boolean {
    return this.selectedLocations.length === 0 || this.availablePartTypes.length === 0;
  }

  getPartTypeHint(): string | null {
    if (this.selectedLocations.length === 0) {
      return 'Bitte zuerst Verortung auswählen';
    }

    if (this.availablePartTypes.length === 0) {
      return 'Für die gewählte Verortung gibt es keine gemeinsame Bauteil-Kategorie!';
    }

    return null;
  }

  private normalizeOptionalInput(input: string): string | null {
    const trimmed = input.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  private buildFloorOptions(structure: Floor[]): FloorOption[] {
    const floorTypeIndex = {
      [FloorType.KG]: 0,
      [FloorType.RG]: 0
    };

    return structure.map((floor) => {
      const description =
        typeof floor.description === 'string' && floor.description.trim().length > 0
          ? floor.description.trim()
          : undefined;

      if (floor.type === FloorType.KG || floor.type === FloorType.RG) {
        floorTypeIndex[floor.type] += 1;
        return { label: `${floor.type} ${floorTypeIndex[floor.type]}`, description };
      }

      return { label: floor.type, description };
    });
  }

  private syncAvailablePartTypes(): void {
    this.availablePartTypes = this.getAllowedPartTypesForSelectedLocations();

    if (this.partType && !this.availablePartTypes.includes(this.partType)) {
      this.partType = null;
      this.partStructure = null;
      this.isPartStructureValid = false;
    }
  }

  private getAllowedPartTypesForSelectedLocations(): PartType[] {
    if (this.selectedLocations.length === 0) {
      return [];
    }

    return this.allPartTypes.filter((partType) =>
      this.selectedLocations.every((location) => this.getAllowedPartTypesForLocation(location).has(partType))
    );
  }

  private getAllowedPartTypesForLocation(location: string): Set<PartType> {
    if (location === this.specialLocationOptionValue) {
      return new Set(this.allPartTypes);
    }

    if (this.isRoofLocation(location)) {
      return this.getAllowedRoofPartTypes();
    }

    if (this.isRegularFloorLocation(location)) {
      const allowed = new Set<PartType>([
        PartType.IW,
        PartType.AW,
        PartType.BW,
        PartType.BA
      ]);

      if (this.roofTypeInBuilding) {
        allowed.add(PartType.DA);
        allowed.add(PartType.A);
        allowed.add(PartType.KS);
      }

      return allowed;
    }

    if (this.isBasementLocation(location)) {
      return new Set<PartType>([
        PartType.IW,
        PartType.AW,
        PartType.BW,
        PartType.BA
      ]);
    }

    return new Set(this.allPartTypes);
  }

  private getAllowedRoofPartTypes(): Set<PartType> {
    if (this.roofTypeInBuilding === RoofType.S) {
      return new Set<PartType>([PartType.KS, PartType.BA, PartType.DA]);
    }

    if (this.roofTypeInBuilding === RoofType.F) {
      return new Set<PartType>([PartType.A, PartType.DA]);
    }

    return new Set<PartType>([PartType.DA]);
  }

  private isBasementLocation(location: string): boolean {
    return location.startsWith(FloorType.KG);
  }

  private isRegularFloorLocation(location: string): boolean {
    return location.startsWith(FloorType.RG);
  }

  private isRoofLocation(location: string): boolean {
    return location === FloorType.D;
  }

  private resolveRoofTypeInBuilding(structure: Floor[]): RoofType | null {
    const roof = structure.find((floor) => floor.type === FloorType.D);
    if (!roof || !('roofType' in roof)) {
      return null;
    }

    return roof.roofType ?? null;
  }

  private formatLocationForPayload(): string {
    return this.selectedLocations.join(', ');
  }

  private openLocationSelectionHint(message: string): void {
    this.snackBar.open(message, 'OK', {
      duration: 3000,
      verticalPosition: 'top'
    });
  }

  confirmEditPart(): void {
    if (!this.isFormValid()) return;
    if (!this.partType) return;
    if (!this.partStructure) return;

    const result: EditPartDialogResult = {
      name: this.name.trim(),
      partType: this.partType,
      partStructure: this.partStructure,
      isPublic: this.isPublic,
      isHazardous: this.isHazardous,
      description: this.normalizeOptionalInput(this.description),
      location: this.formatLocationForPayload()
    };

    this.dialogRef?.close(result);
  }

  close(): void {
    this.dialogRef?.close();
  }

}
