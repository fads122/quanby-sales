import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseAuthService } from '../../services/supabase-auth.service';
import { Router } from '@angular/router';
import { createClient } from '@supabase/supabase-js';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { environment } from '../../../environments/environment';

@Component({
  imports: [
    CommonModule,
    FormsModule,
    MatSnackBarModule // Add this import
  ],
  standalone: true,
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  email: string = '';
  password: string = '';
  private supabase = createClient(
    environment.SUPABASE_URL,
    environment.SUPABASE_KEY
  );

  constructor(
    private authService: SupabaseAuthService,
    private router: Router,
    private snackBar: MatSnackBar // Replace MessageService with MatSnackBar
  ) {}

  ngOnInit(): void {
    this.checkLogoutMessage();
  }

  private checkLogoutMessage(): void {
    const logoutMessage = localStorage.getItem('logoutMessage');
    if (logoutMessage) {
      this.snackBar.open(logoutMessage, 'Close', {
        duration: 3000,
        horizontalPosition: 'end',
        verticalPosition: 'top',
        panelClass: ['success-snackbar']
      });
      localStorage.removeItem('logoutMessage');
    }
  }

  async login() {
    try {
      const { data, error } = await this.authService.signIn(this.email, this.password);

      if (error) {
        this.showErrorToast(error.message || 'Login failed');
        return;
      }

      this.showSuccessToast('Login successful. Redirecting...');

      const userId = data.user.id;

      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('usertype')
        .eq('id', userId)
        .single();

      if (userError) {
        this.showErrorToast(userError.message || 'User data error');
        return;
      }

      const userType = userData.usertype;

      setTimeout(() => {
        if (userType === 'admin') {
          this.router.navigate(['/dashboard']);
        } else if (userType === 'user') {
          this.router.navigate(['/dashboard']);
        } else if (userType === 'supplier') {
          this.router.navigate(['/supplier-portal']);
        } else {
          this.showWarningToast('Unknown user type. Access restricted');
        }
      }, 1000);
    } catch (error) {
      console.error('Error:', error);
      this.showErrorToast('Wrong email or password');
    }
  }

  private showSuccessToast(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['success-snackbar']
    });
  }

  private showErrorToast(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['error-snackbar']
    });
  }

  private showWarningToast(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['warning-snackbar']
    });
  }
}
