import { Component, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SupabaseAuthService } from '../../services/supabase-auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { ConfirmationService } from 'primeng/api';
import { MessageService } from 'primeng/api';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';


@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
     MatButtonModule,

  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'],
  providers: [ConfirmationService, MessageService, MatSnackBar],
})
export class SidebarComponent {
  isCollapsed = false;
  isMobile = false;
  isAdmin = false;

  commonMenuItems = [
    { path: '/dashboard', icon: 'pi pi-home', label: 'Home' },
    { path: '/equipment-list', icon: 'pi pi-list', label: 'Product List' },
    { path: '/supplier-list', icon: 'pi pi-truck', label: 'Suppliers' },
    { path: '/project-materials', icon: 'pi pi-file-edit', label: 'Project Proposals' },
    { path: '/client-list', icon: 'pi pi-users', label: 'Client Directory' },
    { path: '/delivery-receipt', icon: 'pi pi-shopping-cart', label: 'Sales Order' },
    { path: '/parts-picker', icon: 'pi pi-box', label: 'Parts Picker' },
    { path: '/borrow-table-user', icon: 'pi pi-tags', label: 'Item' }
  ];

  adminMenuItems = [
    { path: '/user-list', icon: 'pi pi-users', label: 'User Management' },
    { path: '/borrow', icon: 'pi pi-table', label: 'Borrow Management' }
  ];

  get menuItems() {
    return this.isAdmin
      ? [...this.commonMenuItems, ...this.adminMenuItems]
      : this.commonMenuItems;
  }

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
     private authService: SupabaseAuthService,
     private supabaseService: SupabaseService,
    private snackBar: MatSnackBar,
    private router: Router  // Add this line
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.checkScreenSize();
      this.subscribeToAuthChanges();
    }
  }

  private subscribeToAuthChanges(): void {
    this.authService.isAdmin$.subscribe(
      (isAdmin: boolean) => this.isAdmin = isAdmin
    );
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    if (isPlatformBrowser(this.platformId)) {
      this.checkScreenSize();
    }
  }

  private checkScreenSize() {
    if (isPlatformBrowser(this.platformId)) {
      this.isMobile = window.innerWidth < 768;
      if (this.isMobile) {
        this.isCollapsed = true;
      }
    }
  }

  toggleSidebar() {
    this.isCollapsed = !this.isCollapsed;
  }

  confirmLogout(): void {
    // Show Material snackbar with action
    const snackBarRef = this.snackBar.open('Are you sure you want to logout?', 'LOGOUT', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: ['logout-snackbar']
    });

    snackBarRef.onAction().subscribe(() => {
      // User clicked "LOGOUT" - proceed with logout
      this.performLogout();
    });
  }

   private performLogout(): void {
    // Store logout message
    localStorage.setItem('logoutMessage', 'Successfully logged out.');

    // Show loading message
    const loadingSnackbar = this.snackBar.open('Logging out...', undefined, {
      duration: 2000
    });

    // Delay logout by 2 seconds to show the message
    setTimeout(() => {
      loadingSnackbar.dismiss();
      this.logout();
    }, 2000);
  }

  async logout(): Promise<void> {
    try {
      console.log('Starting logout process...');
      const signOutResult = await this.authService.signOut();
      console.log('SignOut result:', signOutResult);

      localStorage.clear();
      console.log('LocalStorage cleared');

      // Show success message before navigating
      this.snackBar.open('Logged out successfully', 'Close', {
        duration: 3000,
        panelClass: ['success-snackbar']
      });

      // Small delay to let user see the message
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 500);

    } catch (error) {
      console.error('Logout failed:', error);
      this.snackBar.open('Logout failed. Please try again.', 'Close', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
    }
  }
}

