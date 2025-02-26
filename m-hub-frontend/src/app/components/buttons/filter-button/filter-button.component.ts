import { Component, EventEmitter, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-filter-button',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './filter-button.component.html',
  styleUrl: './filter-button.component.scss'
})
export class FilterButtonComponent {
  @Output() togglePanel = new EventEmitter<void>();

  onButtonClick() {
    this.togglePanel.emit();
  }
}
