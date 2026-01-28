import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

// Interface für die Daten, die wir erwarten
export interface ConfirmDialogData {
  title: string;
  message: string;
  messagePrefix?: string;
  messageIcon?: string;
  messageSuffix?: string;
  messageIconAriaLabel?: string;
  confirmText?: string; // default: "Bestätigen"
  cancelText?: string;  // default: "Abbrechen"
  requireSlider?: boolean; 
  sliderText?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatSlideToggleModule, FormsModule, MatIconModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss'
})
export class ConfirmDialogComponent {

  // Variable für den Status des Sliders
  sliderChecked = false;

  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {}

  // Helper um zu prüfen, ob der Button disabled sein soll
  isConfirmDisabled(): boolean {
    if (this.data.requireSlider) {
      return !this.sliderChecked;
    }
    return false;
  }
}
