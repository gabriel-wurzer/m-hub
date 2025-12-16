import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthenticationService } from '../../../services/authentication/authentication.service';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-login-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule
  ],
  templateUrl: './login-dialog.component.html',
  styleUrl: './login-dialog.component.scss'
})
export class LoginDialogComponent {
loginForm: FormGroup;
  isLoading = false;
  errorMessage = '';

  hide = true;

  constructor(
    private fb: FormBuilder,
    private authService: AuthenticationService,
    private dialogRef: MatDialogRef<LoginDialogComponent>
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  onSubmit() {
    if (this.loginForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';
    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
      next: (resp) => {
        this.isLoading = false;
        this.dialogRef.close(true); // Close dialog on success
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 401 || err.error?.error === 'Invalid credentials') {
            this.errorMessage = 'Ungültige Anmeldedaten';
        } else {
            this.errorMessage = 'Ein Serverfehler ist aufgetreten.';
        }
      }
    });
  }
}
