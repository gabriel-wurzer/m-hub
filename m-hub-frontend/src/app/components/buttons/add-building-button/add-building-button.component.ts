import { Component, Input, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Building } from '../../../models/building';
import { UserService } from '../../../services/user/user.service';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';


@Component({
  selector: 'app-add-building-button',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatProgressSpinnerModule],
    templateUrl: './add-building-button.component.html',
    styleUrl: './add-building-button.component.scss'
})
export class AddBuildingButtonComponent implements OnInit {
  @Input() building!: Building;
  @Input() userId!: string;

  isAdded = false;
  isLoading = false;

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    if (this.userId && this.building) {
      this.checkIfBuildingAdded();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['building'] && this.building && this.userId) {
      this.checkIfBuildingAdded();
    }
  }

  checkIfBuildingAdded(): void {

    this.isLoading = true;

    this.userService.isBuildingInUser(this.userId, this.building.bw_geb_id).subscribe({
      next: (exists) => {
        this.isAdded = exists;
        this.isLoading = false;
      },
      error: () => {
        this.isAdded = false;
        this.isLoading = false;
      }
    });
  }

  addBuilding(): void {
    if (!this.building || this.isAdded || this.isLoading) return;

    this.isLoading = true;
    this.userService.addBuildingToUser(this.userId, this.building.bw_geb_id).subscribe({
      next: () => {
        this.isAdded = true;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        // optionally show error UI
      }
    });
  }
}
