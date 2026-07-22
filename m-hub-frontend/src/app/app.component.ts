import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MenuBarComponent } from './components/menu-bar/menu-bar.component';
import { DisclaimerDialogComponent, DISCLAIMER_ACK_KEY } from './components/dialogs/disclaimer-dialog/disclaimer-dialog.component';
import { versionedImageSvgUrl } from './utils/asset-url';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MenuBarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'm-hub-frontend';
  houseIconUrl = versionedImageSvgUrl('/assets/images/house_icon.svg');

  constructor(private dialog: MatDialog) {}

  ngOnInit(): void {
    // Show the trial-phase notice once per browser until acknowledged.
    if (localStorage.getItem(DISCLAIMER_ACK_KEY) !== '1') {
      this.dialog.open(DisclaimerDialogComponent, {
        width: '90%',
        maxWidth: '520px',
        disableClose: true,
        autoFocus: false
      });
    }
  }
}
