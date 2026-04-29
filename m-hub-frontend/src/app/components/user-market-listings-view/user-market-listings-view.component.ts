import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-user-market-listings-view',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatDividerModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './user-market-listings-view.component.html',
  styleUrl: './user-market-listings-view.component.scss'
})
export class UserMarketListingsViewComponent {
  @Output() closeUserListingsView = new EventEmitter<void>();

  constructor() { }

  close(): void {
    this.closeUserListingsView.emit();
  }
}
