import { Component, HostListener, Inject, PLATFORM_ID, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SupabaseAuthService } from '../../services/supabase-auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { ApplicationConfig } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { Subject } from 'rxjs';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations()
    // ...other providers
  ]
};

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatDialogModule,
  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit {
  @Output() collapsedState = new EventEmitter<boolean>();
  isCollapsed = false;
  isMobile = false;
  isAdmin = false;
  currentUser: any = null;
  userInitials: string = '';

  commonMenuItems = [
    { path: '/dashboard', icon: 'pi pi-home', label: 'Home' },
    { path: '/equipment-list', icon: 'pi pi-list', label: 'Product List' },
    { path: '/project-materials', icon: 'pi pi-file-edit', label: 'Project Proposals' },
    { path: '/client-list', icon: 'pi pi-users', label: 'Client Directory' },
    { path: '/delivery-receipt', icon: 'pi pi-shopping-cart', label: 'Sales Order' },
    { path: '/parts-picker', icon: 'pi pi-box', label: 'Parts Picker' },
    { path: '/borrow-table-user', icon: 'pi pi-tags', label: 'Item' }
  ];

  userOnlyMenuItems = [
    { path: '/supplier-list', icon: 'pi pi-truck', label: 'Suppliers' }
  ];

  adminMenuItems = [
    { path: '/user-list', icon: 'pi pi-users', label: 'User Management' },
    { path: '/borrow', icon: 'pi pi-table', label: 'Borrow Management' }
  ];

  get menuItems() {
    if (this.isAdmin) {
      // Admin: no Suppliers
      return [...this.commonMenuItems, ...this.adminMenuItems];
    } else {
      // User: insert Suppliers after Product List
      const items = [...this.commonMenuItems];
      const productListIndex = items.findIndex(item => item.path === '/equipment-list');
      if (productListIndex !== -1) {
        items.splice(productListIndex + 1, 0, this.userOnlyMenuItems[0]);
      } else {
        items.push(this.userOnlyMenuItems[0]);
      }
      return items;
    }
  }

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private authService: SupabaseAuthService,
    private supabaseService: SupabaseService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.checkScreenSize();
      this.subscribeToAuthChanges();
    }
  }

  async ngOnInit() {
    await this.loadCurrentUser();
    // Subscribe to auth state changes to update user info
    this.authService.isAdmin$.subscribe(async (isAdmin: boolean) => {
      this.isAdmin = isAdmin;
      // Refresh user data when auth state changes
      await this.loadCurrentUser();
    });
  }

  private async loadCurrentUser() {
    try {
      this.currentUser = await this.supabaseService.getCurrentUser();
      if (this.currentUser) {
        this.generateUserInitials();
      } else {
        // If no user, try to get from auth service
        const authUser = await this.authService.getUser();
        if (authUser) {
          this.currentUser = {
            id: authUser.id,
            email: authUser.email,
            first_name: authUser.user_metadata?.first_name || '',
            last_name: authUser.user_metadata?.last_name || ''
          };
          this.generateUserInitials();
        }
      }
    } catch (error) {
      console.error('Error loading current user:', error);
      // Set fallback user data
      this.currentUser = {
        email: 'Unknown User',
        first_name: '',
        last_name: ''
      };
      this.generateUserInitials();
    }
  }

  private generateUserInitials() {
    if (this.currentUser && this.currentUser.first_name && this.currentUser.last_name) {
      const firstName = this.currentUser.first_name.charAt(0).toUpperCase();
      const lastName = this.currentUser.last_name.charAt(0).toUpperCase();
      this.userInitials = firstName + lastName;
    } else if (this.currentUser && this.currentUser.email) {
      // Fallback to email initials if name is not available
      const emailParts = this.currentUser.email.split('@')[0];
      this.userInitials = emailParts.charAt(0).toUpperCase();
    } else {
      this.userInitials = 'U'; // Default fallback
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

  @Output() collapsedChange = new EventEmitter<boolean>();

  toggleSidebar() {
    this.isCollapsed = !this.isCollapsed;
    this.collapsedChange.emit(this.isCollapsed);
  }

   toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    this.collapsedState.emit(this.isCollapsed);
  }
  
  confirmLogout(): void {
    const dialogRef = this.dialog.open(DialogOverview, {
      width: '300px',
      disableClose: true,
      data: {
        title: 'Confirm Logout',
        message: 'Are you sure you want to logout?'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.logout();
      }
    });
  }

async logout(): Promise<void> {
  try {
    // Reset layout state before logout
    this.isCollapsed = false;
    this.collapsedState.emit(false);
    
    // Reset body styles
    document.body.classList.remove('collapsed');
    document.body.style.marginLeft = '';
    document.body.style.width = '';
    
    // Then proceed with logout
    const signOutResult = await this.authService.signOut();
    localStorage.clear();
    localStorage.setItem('logoutMessage', 'You have been logged out successfully');
    
    // Force full page reload to ensure clean state
    window.location.href = '/login';
  } catch (error) {
    console.error('Logout failed:', error);
  }
}

private resetLayoutBeforeLogout(): void {
  // Add transition-disabling class
  document.body.classList.add('logout-transition');
  
  // Reset all possible affecting styles
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.width = '100vw';
  document.body.style.minWidth = '100vw';
  document.body.style.overflowX = 'hidden';
  
  // Reset HTML element
  document.documentElement.style.width = '100vw';
  document.documentElement.style.minWidth = '100vw';
  document.documentElement.style.overflowX = 'hidden';
  
  // Force reset of login container
  const loginContainers = document.querySelectorAll('.login-container, app-login');
  loginContainers.forEach(container => {
    const el = container as HTMLElement;
    el.style.width = '100vw';
    el.style.minWidth = '100vw';
    el.style.maxWidth = '100vw';
    el.style.margin = '0';
    el.style.padding = '0';
    el.style.position = 'relative';
    el.style.left = '0';
  });
  
  // Remove any sidebar-related classes
  document.body.classList.remove('sidebar-collapsed', 'sidebar-expanded');
}
}

@Component({
  selector: 'dialog-overview',
  template: `
    <h1 mat-dialog-title>{{ data.title }}</h1>
    <div mat-dialog-content>
      <p>{{ data.message }}</p>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-button (click)="onNoClick()">Cancel</button>
      <button mat-button color="primary" (click)="dialogRef.close(true)">Yes</button>
    </div>
  `,
  standalone: true,
  imports: [MatDialogModule]
})
class DialogOverview {
  constructor(
    public dialogRef: MatDialogRef<DialogOverview>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  onNoClick(): void {
    this.dialogRef.close(false);
  }
}

