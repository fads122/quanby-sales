import { Component, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';  // Add Router here
import { SupabaseAuthService } from '../../services/supabase-auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { ConfirmationService } from 'primeng/api';
import { MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ConfirmDialogModule,
    ToastModule
  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'],
  providers: [ConfirmationService, MessageService],
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
     private confirmationService: ConfirmationService,
    private messageService: MessageService,
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
    this.confirmationService.confirm({
      header: 'Confirm Logout',
      icon: 'pi pi-info-circle',
      message: 'Are you sure you want to logout?',
      acceptLabel: 'Yes',
      acceptButtonStyleClass: 'p-button-danger', // Make the Yes button red
      rejectVisible: false, // Hide No button
      accept: () => {
        // Store logout message BEFORE delay
        localStorage.setItem('logoutMessage', 'Successfully logged out.');

        this.messageService.add({
          severity: 'info',
          summary: 'Logging Out',
          detail: 'You are being logged out...',
        });

        // Delay logout by 2 seconds to show the toast
        setTimeout(() => {
          this.logout();
        }, 2000);
      },
    });
  }

  async logout(): Promise<void> {
    try {
      console.log('Starting logout process...');
      const signOutResult = await this.authService.signOut();
      console.log('SignOut result:', signOutResult);

      localStorage.clear();
      console.log('LocalStorage cleared');

      await this.router.navigate(['/login']);
      console.log('Navigation completed');
    } catch (error) {
      console.error('Logout failed:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Logout failed. Please try again.',
      });
    }
  }
}

