import { Component } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

// Storage key used to remember that the visitor acknowledged the trial notice.
export const DISCLAIMER_ACK_KEY = 'mhub-disclaimer-ack';

@Component({
  selector: 'app-disclaimer-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './disclaimer-dialog.component.html',
  styleUrl: './disclaimer-dialog.component.scss'
})
export class DisclaimerDialogComponent {
  constructor(private dialogRef: MatDialogRef<DisclaimerDialogComponent>) {}

  acknowledge(): void {
    localStorage.setItem(DISCLAIMER_ACK_KEY, '1');
    this.dialogRef.close();
  }
}
