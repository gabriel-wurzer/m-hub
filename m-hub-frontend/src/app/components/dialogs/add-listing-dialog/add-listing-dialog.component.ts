import { CommonModule } from '@angular/common';
import { Component, Inject, Optional } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MarketListingStatus } from '../../../enums/market-listing-status';
import { MarketPotential } from '../../../enums/market-potential.enum';
import { Bauteil, Objekt } from '../../../models/building-component';

export type AddListingDialogData = {
  component: Bauteil | Objekt;
};

export type AddListingDialogResult = {
  name: string;
  description: string | null;
  price: number;
  status: MarketListingStatus;
  potential: MarketPotential;
  contact: string;
};

@Component({
  selector: 'app-add-listing-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './add-listing-dialog.component.html',
  styleUrl: './add-listing-dialog.component.scss'
})
export class AddListingDialogComponent {
  readonly statusOptions: MarketListingStatus[] = Object.values(MarketListingStatus);
  readonly potentialOptions: MarketPotential[] = Object.values(MarketPotential);

  name = '';
  description = '';
  price: number | null = null;
  status: MarketListingStatus | null = null;
  potential: MarketPotential | null = null;
  contact = '';

  constructor(
    @Optional() public dialogRef: MatDialogRef<AddListingDialogComponent> | null,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: AddListingDialogData | null
  ) {
    this.name = data?.component?.name?.trim() ?? '';
    this.description = data?.component?.description?.trim() ?? '';
  }

  getNameError(): string | null {
    if (this.name.trim().length === 0) {
      return 'Name erforderlich';
    }
    return null;
  }

  getPriceError(): string | null {
    if (this.price === null || this.price === undefined || Number.isNaN(Number(this.price))) {
      return 'Preis erforderlich';
    }

    if (Number(this.price) < 0) {
      return 'Preis darf nicht negativ sein';
    }

    return null;
  }

  getStatusError(): string | null {
    if (!this.status) {
      return 'Status erforderlich';
    }
    return null;
  }

  getPotentialError(): string | null {
    if (!this.potential) {
      return 'Potential erforderlich';
    }
    return null;
  }

  getContactError(): string | null {
    if (this.contact.trim().length === 0) {
      return 'Kontakt erforderlich';
    }
    return null;
  }

  isFormValid(): boolean {
    const isNameValid = this.name.trim().length > 0;
    const isPriceValid = this.price !== null && this.price !== undefined && !Number.isNaN(Number(this.price)) && Number(this.price) >= 0;
    const isStatusValid = !!this.status;
    const isPotentialValid = !!this.potential;
    const isContactValid = this.contact.trim().length > 0;

    return isNameValid && isPriceValid && isStatusValid && isPotentialValid && isContactValid;
  }

  confirmAddListing(): void {
    if (!this.isFormValid()) return;
    if (!this.status || !this.potential || this.price === null || this.price === undefined) return;

    const result: AddListingDialogResult = {
      name: this.name.trim(),
      description: this.normalizeOptionalInput(this.description),
      price: Number(this.price),
      status: this.status,
      potential: this.potential,
      contact: this.contact.trim()
    };

    this.dialogRef?.close(result);
  }

  close(): void {
    this.dialogRef?.close();
  }

  formatPotentialLabel(value: MarketPotential): string {
    if (value === MarketPotential.reuse) {
      return 'Wiederverwendung';
    }

    if (value === MarketPotential.recycle) {
      return 'Recycling';
    }

    return value;
  }

  private normalizeOptionalInput(input: string): string | null {
    const trimmed = input.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
}
