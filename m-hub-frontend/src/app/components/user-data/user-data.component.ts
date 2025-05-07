import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { UserService } from '../../services/user/user.service';


@Component({
  selector: 'app-user-data',
  standalone: true,
  imports: [CommonModule, MatDividerModule, MatListModule, MatProgressSpinnerModule],
  templateUrl: './user-data.component.html',
  styleUrl: './user-data.component.scss'
})
export class UserDataComponent implements OnInit {

  userId = "c3e5b0fc-cc48-4a6f-8e27-135b6d3a1b71";
  buildingIds: number[] = [];

  isLoading = false; 
  errorMessage = '';

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    if(!this.userId) return;

    this.loadBuildings();
  }

  private loadBuildings(): void {
    this.isLoading = true;
    this.userService.getBuildingsByUser(this.userId).subscribe({
      next: (ids) => {
        this.buildingIds = ids;
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = 'Failed to load buildings.';
        this.isLoading = false;
        console.error(error);
      }
    });
  }

}
