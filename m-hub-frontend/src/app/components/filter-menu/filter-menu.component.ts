import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatOptionModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatDividerModule } from '@angular/material/divider';
import { Periods } from '../../models/periods.enum';
import { Usage } from '../../models/usage.enum';



@Component({
  selector: 'app-filter-menu',
  standalone: true,
  imports: [
    MatIconModule, 
    MatButtonModule, 
    MatDividerModule, 
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    ReactiveFormsModule,
    CommonModule,
    MatOptionModule
  ],
  templateUrl: './filter-menu.component.html',
  styleUrl: './filter-menu.component.scss'
})
export class FilterMenuComponent {

  @Output() closePanel = new EventEmitter<void>();

  periodOptions = Object.values(Periods);
  usageOptions = Object.values(Usage);

  periodControl = new FormControl<string[]>([], { nonNullable: true });
  usageControl = new FormControl<string[]>([], { nonNullable: true });

  removeBauperiode(value: string) {
    this.periodControl.setValue(this.periodControl.value.filter(item => item !== value));
  }

  removeNutzung(value: string) {
    this.usageControl.setValue(this.usageControl.value.filter(item => item !== value));
  }

  closeFilterMenu() {
    this.closePanel.emit();
  }
}
