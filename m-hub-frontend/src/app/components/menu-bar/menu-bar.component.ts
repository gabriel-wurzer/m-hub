import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthenticationService } from '../../services/authentication/authentication.service';
import { LoginDialogComponent } from '../dialogs/login-dialog/login-dialog.component';
import { Observable } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LogoutDialogComponent } from '../dialogs/logout-dialog/logout-dialog.component';
import { ProfileDialogComponent } from '../dialogs/profile-dialog/profile-dialog.component';

@Component({
  selector: 'app-menu-bar',
  standalone: true,
  imports: [ 
    RouterOutlet, 
    CommonModule, 
    MatToolbarModule, 
    MatMenuModule, 
    MatSidenavModule, 
    MatListModule, 
    MatIconModule, 
    MatButtonModule, 
    MatDividerModule,
    MatTooltipModule
  ],
  templateUrl: './menu-bar.component.html',
  styleUrl: './menu-bar.component.scss'
})
export class MenuBarComponent implements OnInit {

  currentRoute: string = '/map';

  isMobile = false;

  user$: Observable<any>;

  constructor(
    private authService: AuthenticationService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private breakpointObserver: BreakpointObserver
  ) {
    this.user$ = this.authService.getUser$();

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.currentRoute = event.urlAfterRedirects;
      }
    });
  }

  ngOnInit() {
    this.breakpointObserver.observe(['(max-width: 1199px)']).subscribe(result => {
      this.isMobile = result.matches;
    });
  }


  onMenuClick(route: string): void {
    this.router.navigate([`/${route}`]);
  }

  onLoginClick() {
    this.dialog.open(LoginDialogComponent, {
      width: '90%',
      maxWidth: '400px',
      disableClose: true // User must click cancel or login
    });
  }

  onLogoutClick() {
    const dialogRef = this.dialog.open(LogoutDialogComponent, 
      { 
        width: '90%',
        maxWidth: '360px',
        autoFocus: false 

      });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        this.authService.logout();
        this.router.navigate(['/map']);
      }
    });
  }

  onProfileClick(user: any) {
    this.dialog.open(ProfileDialogComponent, {
      width: '90%',
      maxWidth: '400px',
      data: user, // Pass the user object to the dialog
      autoFocus: false
    });
  }

  onDisabledDataClick() {
  this.snackBar.open('Gebäudeliste: \nAnmeldung erforderlich', 'OK', {
    duration: 30000,
    verticalPosition: 'bottom',
    panelClass: 'multiline-snackbar'
  });
}
}
