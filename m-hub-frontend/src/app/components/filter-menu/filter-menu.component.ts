import { Component, EventEmitter, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-filter-menu',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  templateUrl: './filter-menu.component.html',
  styleUrl: './filter-menu.component.scss'
})
export class FilterMenuComponent {

  @Output() closePanel = new EventEmitter<void>();

  closeFilterMenu() {
    this.closePanel.emit();
  }
}
