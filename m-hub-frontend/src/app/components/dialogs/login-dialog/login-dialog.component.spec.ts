import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { LoginDialogComponent } from './login-dialog.component';
import { AuthenticationService } from '../../../services/authentication/authentication.service';

describe('LoginDialogComponent', () => {
  let component: LoginDialogComponent;
  let fixture: ComponentFixture<LoginDialogComponent>;
  let authServiceSpy: jasmine.SpyObj<AuthenticationService>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<LoginDialogComponent>>;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj<AuthenticationService>('AuthenticationService', ['login']);
    authServiceSpy.login.and.returnValue(of({
      token: 'token',
      user: { id: '1', username: 'alice', email: 'alice@example.com' }
    }) as any);
    dialogRefSpy = jasmine.createSpyObj<MatDialogRef<LoginDialogComponent>>('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, LoginDialogComponent],
      providers: [
        { provide: AuthenticationService, useValue: authServiceSpy },
        { provide: MatDialogRef, useValue: dialogRefSpy }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoginDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show registration info with mailto link after clicking register', () => {
    const registerButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find((button) => button.nativeElement.textContent.trim() === 'Registrieren');

    registerButton?.nativeElement.click();
    fixture.detectChanges();

    const registrationLink = fixture.nativeElement.querySelector('.registration-info a') as HTMLAnchorElement;

    expect(component.showRegistrationInfo).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Für Registrierung bitte E-Mail an');
    expect(registrationLink.getAttribute('href')).toBe('mailto:simlab@tuwien.ac.at');
    expect(registrationLink.textContent?.trim()).toBe('simlab@tuwien.ac.at');
  });
});
