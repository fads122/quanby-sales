import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseAuthService } from '../../services/supabase-auth.service';
import { Router } from '@angular/router';
import { createClient } from '@supabase/supabase-js';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
    imports: [CommonModule, FormsModule, ToastModule],
    standalone: true,
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.css'],
    providers: [MessageService] // Ensure MessageService is provided
})

export class LoginComponent implements OnInit {
  email: string = '';
  password: string = '';
  private supabase = createClient(
    'https://xvcgubrtandfivlqcmww.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2Y2d1YnJ0YW5kZml2bHFjbXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkxNDk4NjYsImV4cCI6MjA1NDcyNTg2Nn0.yjd-SXfzJe6XmuNpI2HsZcI9EsS9AxBXI-qukzgcZig'
  );

  constructor(
    private authService: SupabaseAuthService,
    private router: Router,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.checkLogoutMessage(); // Check for logout message when login page loads
  }

  /**
   * Show toast notification if the user was logged out.
   */
  private checkLogoutMessage(): void {
    const logoutMessage = localStorage.getItem('logoutMessage');
    if (logoutMessage) {
      this.messageService.add({ severity: 'success', summary: 'Logged Out', detail: logoutMessage });
      localStorage.removeItem('logoutMessage'); // Remove message after displaying
    }
  }

  /**
   * Handles user login.
   */
  async login() {
  try {
    // Attempt to sign in the user
    const { data, error } = await this.authService.signIn(this.email, this.password);

    if (error) {
      this.messageService.add({ severity: 'error', summary: 'Login Failed', detail: error.message });
      return;
    }

    // Success notification
    this.messageService.add({ severity: 'success', summary: 'Login Successful', detail: 'Redirecting...' });

    const userId = data.user.id;

    // Fetch user role from 'users' table
    const { data: userData, error: userError } = await this.supabase
      .from('users')
      .select('usertype')
      .eq('id', userId)
      .single();

    if (userError) {
      this.messageService.add({ severity: 'error', summary: 'User Error', detail: userError.message });
      return;
    }

    const userType = userData.usertype;

    // Delay redirection for a smooth user experience
    setTimeout(() => {
      // Check the user type and redirect accordingly
      if (userType === 'admin') {
        this.router.navigate(['/dashboard']);
      } else if (userType === 'user') {
        this.router.navigate(['/dashboard']);
      } else if (userType === 'supplier') {
        // Redirect to the supplier portal
        this.router.navigate(['/supplier-portal']);
      } else {
        this.messageService.add({ severity: 'warn', summary: 'Unknown User Type', detail: 'Access Restricted' });
      }
    }, 1000); // 1 second delay
  } catch (error) {
    console.error('Error:', error);
    this.messageService.add({ severity: 'error', summary: 'Login Failed', detail: 'Wrong Email or Password.' });
  }
}

}
