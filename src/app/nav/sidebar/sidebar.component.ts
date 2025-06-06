import { Component, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SupabaseAuthService } from '../../services/supabase-auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { ApplicationConfig } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';

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
    MatSnackBarModule
  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
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
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router
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
        this.snackBar.open('Logging out...', '', {
          duration: 2000,
        });
        setTimeout(() => {
          this.logout();
        }, 2000);
      }
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

      this.snackBar.open('Successfully logged out', 'Close', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom'
      });
    } catch (error) {
      console.error('Logout failed:', error);
      this.snackBar.open('Logout failed. Please try again.', 'Close', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
    }
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

