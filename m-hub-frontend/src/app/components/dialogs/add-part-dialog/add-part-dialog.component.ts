import { CommonModule } from '@angular/common';
import { Component, Inject, Optional } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FloorType } from '../../../enums/floor-type.enum';
import { PartType } from '../../../enums/part-type.enum';
import { Floor } from '../../../models/floor';

type AddPartDialogData = {
  structure?: Floor[];
};

export type AddPartDialogResult = {
  name: string;
  partType: PartType;
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

@Component({
  selector: 'app-add-part-dialog',
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
    MatTooltipModule,
    MatDividerModule,
    MatIconModule
  ],
  templateUrl: './add-part-dialog.component.html',
  styleUrl: './add-part-dialog.component.scss'
})
export class AddPartDialogComponent {
  readonly specialLocationOptions: string[] = ['Individuell (Verortung in Beschreibung angeben)'];
  private readonly specialLocationOptionValue = 'Individuell';
  private readonly floorDescriptionByLocationLabel = new Map<string, string>();

  name: string = '';
  description: string = '';
  selectedLocations: string[] = [];
  partType: PartType | null = null;
  isPublic: boolean = true;
  isHazardous: boolean = false;

  floorOptions: FloorOption[] = [];
  locationOptions: string[] = [];
  locationOptionVms: LocationOptionVm[] = [];
  partTypes: PartType[] = Object.values(PartType);

  constructor(
    @Optional() public dialogRef: MatDialogRef<AddPartDialogComponent> | null,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: AddPartDialogData | null
  ) {
    this.floorOptions = this.buildFloorOptions(this.data?.structure ?? []);
    this.rebuildFloorDescriptionByLocationLabel();
    this.locationOptions = [...this.floorOptions.map((option) => option.label), ...this.specialLocationOptions];
    this.locationOptionVms = this.locationOptions.map((value) => this.toLocationOptionVm(value));
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
    const isPartTypeValid = !!this.partType;
    const isLocationValid = this.selectedLocations.length > 0;
    return isNameValid && isPartTypeValid && isLocationValid;
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

  private formatLocationForPayload(): string {
    return this.selectedLocations.join(', ');
  }

  confirmAddPart(): void {
    if (!this.isFormValid()) return;
    if (!this.partType) return;

    const result: AddPartDialogResult = {
      name: this.name.trim(),
      partType: this.partType,
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
