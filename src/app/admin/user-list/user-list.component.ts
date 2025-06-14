import { Component, OnInit, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTabsModule } from '@angular/material/tabs';
import { SidebarComponent } from '../../nav/sidebar/sidebar.component';
import { SupabaseService } from '../../services/supabase.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';

interface User {
  uid: string;
  name: string;
  email: string;
}

interface Supplier {
  id: number;
  supplier_name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  group_chat_link?: string;
  facebook?: string;
  viber?: string;
  telegram?: string;
  instagram?: string;
}

@Component({
  selector: 'user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatIconModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatCheckboxModule,
    MatTabsModule,
    SidebarComponent
  ],
})
export class UserListComponent implements OnInit {
  private supabase: SupabaseService;
  user: User[] = [];
  suppliers: Supplier[] = [];
  searchQuery: string = '';
  userForm: FormGroup;
  editMode = false;
  editUserId: string | null = null;
  editSupplierMode = false;
  editSupplierId: number | null = null;
  supplierForm!: FormGroup;
  userDisplayedColumns: string[] = ['uid', 'name', 'email', 'actions'];
  supplierDisplayedColumns: string[] = ['id', 'supplier_name', 'contact_person', 'phone', 'email', 'actions'];
  userDataSource!: MatTableDataSource<User>;
  supplierDataSource!: MatTableDataSource<Supplier>;
  
  // Add new properties for user selection
  allUsers: any[] = [];
  selectedUsers: string[] = [];
  showUserSelection: boolean = false;
  activeTab: 'users' | 'suppliers' = 'users';

  @ViewChild('userPaginator') userPaginator!: MatPaginator;
  @ViewChild('supplierPaginator') supplierPaginator!: MatPaginator;
  @ViewChild('userSort') userSort!: MatSort;
  @ViewChild('supplierSort') supplierSort!: MatSort;

  @ViewChild('addUserDialog') addUserDialog!: TemplateRef<any>;
  @ViewChild('addSupplierDialog') addSupplierDialog!: TemplateRef<any>;
  @ViewChild('editSupplierDialog') editSupplierDialog!: TemplateRef<any>;

  constructor(
    private fb: FormBuilder,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    this.supabase = new SupabaseService();

    // Initialize data sources
    this.userDataSource = new MatTableDataSource<User>([]);
    this.supplierDataSource = new MatTableDataSource<Supplier>([]);

    this.supplierForm = this.fb.group({
      supplier_name: ['', Validators.required],
      contact_person: ['', Validators.required],
      phone: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      address: ['', Validators.required],
      group_chat_link: [''],
      facebook: [''],
      viber: [''],
      telegram: [''],
      instagram: [''],
      password: ['', [Validators.minLength(8)]],
    });

    this.userForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.pattern(/^[a-zA-Z]+$/)]],
      lastName: ['', [Validators.required, Validators.pattern(/^[a-zA-Z]+$/)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  ngOnInit() {
    this.loadUsers();
    this.loadSuppliers();
    this.loadAllUsers(); // Load all users for supplier assignment
  }

  // Load all suppliers for admin
  async loadSuppliers() {
    await this.loadSuppliersWithPagination(0, 10, '', '');
  }

  // Load suppliers with pagination state preservation
  async loadSuppliersWithPagination(pageIndex: number, pageSize: number, sortActive: string, sortDirection: string) {
    try {
      const { data, error } = await this.supabase.from('suppliers').select('*');
      if (error) {
        this.snackBar.open(`Error loading suppliers: ${error.message}`, 'Close', {
          duration: 3000,
          panelClass: ['snackbar-error'],
        });
      } else {
        this.suppliers = data || [];
        this.supplierDataSource.data = this.suppliers; // Update the data source data
        
        // Reconnect to paginator and sort if they exist
        if (this.supplierPaginator) {
          this.supplierDataSource.paginator = this.supplierPaginator;
          
          // Restore pagination state
          setTimeout(() => {
            if (this.supplierPaginator) {
              this.supplierPaginator.pageIndex = pageIndex;
              this.supplierPaginator.pageSize = pageSize;
            }
          });
        }
        
        if (this.supplierSort) {
          this.supplierDataSource.sort = this.supplierSort;
          
          // Restore sort state
          setTimeout(() => {
            if (this.supplierSort && sortActive) {
              this.supplierSort.active = sortActive;
              this.supplierSort.direction = sortDirection as 'asc' | 'desc';
            }
          });
        }
      }
    } catch (error) {
      console.error('Error loading suppliers:', error);
      this.snackBar.open('Failed to load suppliers', 'Close', {
        duration: 3000,
        panelClass: ['snackbar-error'],
      });
    }
  }

  // Edit supplier
  editSupplier(supplier: Supplier) {
    this.editSupplierMode = true;
    this.editSupplierId = supplier.id;
    
    // Make password optional for editing
    this.makePasswordOptional();
    
    this.supplierForm.patchValue({
      supplier_name: supplier.supplier_name,
      contact_person: supplier.contact_person,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      group_chat_link: supplier.group_chat_link || '',
      facebook: supplier.facebook || '',
      viber: supplier.viber || '',
      telegram: supplier.telegram || '',
      instagram: supplier.instagram || '',
      password: '' // Clear password field for editing
    });
    
    // Clear password validation errors since it's optional for editing
    this.supplierForm.get('password')?.setErrors(null);
    
    // Load current user assignments for this supplier
    this.loadSupplierUserAssignments(supplier.id);
    
    this.dialog.open(this.editSupplierDialog);
  }

  // Load current user assignments for a supplier
  async loadSupplierUserAssignments(supplierId: number) {
    try {
      const relationships = await this.supabase.getUserSupplierRelationships(supplierId);
      
      if (relationships && relationships.length > 0) {
        // Set the currently assigned users
        this.selectedUsers = relationships.map((relationship: any) => relationship.user_id);
        console.log('Current user assignments:', this.selectedUsers);
      } else {
        this.selectedUsers = [];
      }
    } catch (error) {
      console.error('Error loading supplier user assignments:', error);
      this.snackBar.open('Error loading user assignments', 'Close', {
        duration: 3000,
        panelClass: ['snackbar-error'],
      });
    }
  }

  // Update supplier
  async onUpdateSupplier() {
    // Check if the form is valid (excluding password for editing)
    const formData = this.supplierForm.value;
    const requiredFieldsValid = this.supplierForm.get('supplier_name')?.valid &&
                               this.supplierForm.get('contact_person')?.valid &&
                               this.supplierForm.get('phone')?.valid &&
                               this.supplierForm.get('email')?.valid &&
                               this.supplierForm.get('address')?.valid;
    
    if (requiredFieldsValid && this.editSupplierId) {
      delete formData.password; // Remove password from update data

      try {
        // Store current pagination state
        const currentPage = this.supplierDataSource.paginator?.pageIndex || 0;
        const currentPageSize = this.supplierDataSource.paginator?.pageSize || 10;
        const currentSort = this.supplierDataSource.sort?.active || '';
        const currentSortDirection = this.supplierDataSource.sort?.direction || '';

        // 1. Update supplier information
        const { error: updateError } = await this.supabase
          .from('suppliers')
          .update(formData)
          .eq('id', this.editSupplierId);

        if (updateError) {
          this.snackBar.open(`Error updating supplier: ${updateError.message}`, 'Close', {
            duration: 3000,
            panelClass: ['snackbar-error'],
          });
          return;
        }

        // 2. Update user assignments
        try {
          // First, get current assignments to compare
          const currentAssignments = await this.supabase.getUserSupplierRelationships(this.editSupplierId);
          const currentUserIds = currentAssignments?.map((rel: any) => rel.user_id) || [];
          
          // Find users to remove (in current but not in selected)
          const usersToRemove = currentUserIds.filter((userId: string) => !this.selectedUsers.includes(userId));
          
          // Find users to add (in selected but not in current)
          const usersToAdd = this.selectedUsers.filter((userId: string) => !currentUserIds.includes(userId));
          
          // Remove users that are no longer assigned
          if (usersToRemove.length > 0) {
            for (const userId of usersToRemove) {
              // Delete individual relationships
              await this.supabase
                .from('user_supplier_relationships')
                .delete()
                .eq('supplier_id', this.editSupplierId)
                .eq('user_id', userId);
            }
          }
          
          // Add new user assignments
          if (usersToAdd.length > 0) {
            await this.supabase.createUserSupplierRelationships(this.editSupplierId, usersToAdd);
          }
          
          this.snackBar.open('Supplier updated successfully!', 'Close', {
            duration: 3000,
            panelClass: ['snackbar-success'],
          });
          this.dialog.closeAll();
          
          // Reload suppliers and restore pagination state
          await this.loadSuppliersWithPagination(currentPage, currentPageSize, currentSort, currentSortDirection);
          this.resetSupplierForm();
          
        } catch (assignmentError) {
          console.error('Error updating user assignments:', assignmentError);
          this.snackBar.open('Supplier information updated but user assignments failed. Please try again.', 'Close', {
            duration: 3000,
            panelClass: ['snackbar-warning'],
          });
        }
        
      } catch (error) {
        console.error('Error updating supplier:', error);
        this.snackBar.open('Failed to update supplier', 'Close', {
          duration: 3000,
          panelClass: ['snackbar-error'],
        });
      }
    } else {
      this.snackBar.open('Please fill in all required fields correctly', 'Close', {
        duration: 3000,
        panelClass: ['snackbar-warning'],
      });
    }
  }

  // Delete supplier
  async deleteSupplier(supplier: Supplier) {
    if (confirm(`Are you sure you want to delete supplier "${supplier.supplier_name}"?`)) {
      try {
        // Store current pagination state
        const currentPage = this.supplierDataSource.paginator?.pageIndex || 0;
        const currentPageSize = this.supplierDataSource.paginator?.pageSize || 10;
        const currentSort = this.supplierDataSource.sort?.active || '';
        const currentSortDirection = this.supplierDataSource.sort?.direction || '';

        const { error } = await this.supabase
          .from('suppliers')
          .delete()
          .eq('id', supplier.id);

        if (error) {
          this.snackBar.open(`Error deleting supplier: ${error.message}`, 'Close', {
            duration: 3000,
            panelClass: ['snackbar-error'],
          });
        } else {
          this.snackBar.open('Supplier deleted successfully!', 'Close', {
            duration: 3000,
            panelClass: ['snackbar-success'],
          });
          
          // Reload suppliers and restore pagination state
          await this.loadSuppliersWithPagination(currentPage, currentPageSize, currentSort, currentSortDirection);
        }
      } catch (error) {
        console.error('Error deleting supplier:', error);
        this.snackBar.open('Failed to delete supplier', 'Close', {
          duration: 3000,
          panelClass: ['snackbar-error'],
        });
      }
    }
  }

  // Reset supplier form
  resetSupplierForm() {
    this.editSupplierMode = false;
    this.editSupplierId = null;
    this.supplierForm.reset();
    this.selectedUsers = [];
    this.showUserSelection = false;
  }

  // Switch tabs
  switchTab(tab: 'users' | 'suppliers') {
    this.activeTab = tab;
  }

  // Handle tab changes
  onTabChange(index: number) {
    // Add a small delay for smooth animation
    setTimeout(() => {
      this.activeTab = index === 0 ? 'users' : 'suppliers';
      
      // Trigger re-render of data sources to ensure proper animation
      if (this.activeTab === 'users') {
        this.userDataSource.data = [...this.userDataSource.data];
      } else {
        this.supplierDataSource.data = [...this.supplierDataSource.data];
      }
    }, 50);
  }

  // Apply filter for suppliers
  applySupplierFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.supplierDataSource.filter = filterValue.trim().toLowerCase();

    if (this.supplierDataSource.paginator) {
      this.supplierDataSource.paginator.firstPage();
    }
  }

  // Apply filter for users
  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.userDataSource.filter = filterValue.trim().toLowerCase();

    if (this.userDataSource.paginator) {
      this.userDataSource.paginator.firstPage();
    }
  }

  // Add method to load all users for supplier assignment
  async loadAllUsers() {
    const { data, error } = await this.supabase.getAllUsers();

    if (error) {
      this.snackBar.open(`Error loading users: ${error.message}`, 'Close', {
        duration: 3000,
        panelClass: ['snackbar-error'],
      });
    } else if (data) {
      this.allUsers = data.map(user => ({
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        usertype: user.usertype
      }));
    }
  }

  // Toggle user selection modal
  toggleUserSelection() {
    this.showUserSelection = !this.showUserSelection;
    if (this.showUserSelection) {
      this.loadAllUsers();
    }
  }

  // Handle user selection
  onUserSelectionChange(userId: string, isChecked: boolean) {
    if (isChecked) {
      if (!this.selectedUsers.includes(userId)) {
        this.selectedUsers.push(userId);
      }
    } else {
      this.selectedUsers = this.selectedUsers.filter(id => id !== userId);
    }
  }

  // Get selected user names for display
  getSelectedUserNames(): string {
    if (this.selectedUsers.length === 0) return 'No users selected';
    
    const selectedUserObjects = this.allUsers.filter(user => 
      this.selectedUsers.includes(user.id)
    );
    return selectedUserObjects.map(user => user.name).join(', ');
  }

  // Clear user selection
  clearUserSelection() {
    this.selectedUsers = [];
  }

  openAddUserDialog() {
    this.editMode = false;
    this.userForm.reset();
    this.dialog.open(this.addUserDialog);
  }

  openAddSupplierDialog() {
    this.editSupplierMode = false;
    this.editSupplierId = null;
    this.supplierForm.reset();
    this.selectedUsers = [];
    this.showUserSelection = false;
    
    // Make password required for adding new suppliers
    this.supplierForm.get('password')?.setValidators([Validators.required, Validators.minLength(8)]);
    this.supplierForm.get('password')?.updateValueAndValidity();
    
    this.dialog.open(this.addSupplierDialog);
  }

  // Method to make password optional for editing
  makePasswordOptional() {
    this.supplierForm.get('password')?.setValidators([Validators.minLength(8)]);
    this.supplierForm.get('password')?.updateValueAndValidity();
  }

  closeDialog() {
    this.dialog.closeAll();
    this.resetSupplierForm();
  }

  async onAddUser() {
    if (this.userForm.valid) {
      const { firstName, lastName, email, password } = this.userForm.value;

      if (this.editMode && this.editUserId) {
        // Store current pagination state
        const currentPage = this.userDataSource.paginator?.pageIndex || 0;
        const currentPageSize = this.userDataSource.paginator?.pageSize || 10;
        const currentSort = this.userDataSource.sort?.active || '';
        const currentSortDirection = this.userDataSource.sort?.direction || '';

        // Update existing user
        const { error } = await this.supabase.updateUser(this.editUserId, firstName, lastName, email);

        if (error) {
          this.snackBar.open(`Error updating user: ${error.message}`, 'Close', {
            duration: 3000,
            panelClass: ['snackbar-error'],
          });
        } else {
          this.snackBar.open('User updated successfully!', 'Close', {
            duration: 3000,
            panelClass: ['snackbar-success'],
          });
          this.dialog.closeAll();
          
          // Reload users and restore pagination state
          await this.loadUsersWithPagination(currentPage, currentPageSize, currentSort, currentSortDirection);
        }
      } else {
        // Create a new user in auth and profile tables
        const { data, error } = await this.supabase.signUp(email, password);

        if (error) {
          this.snackBar.open(`Error: ${error.message}`, 'Close', {
            duration: 3000,
            panelClass: ['snackbar-error'],
          });
        } else if (data.user) {
          const { error: profileError } = await this.supabase.insertProfile(data.user.id, firstName, lastName, email);

          if (profileError) {
            this.snackBar.open(`Error saving profile: ${profileError.message}`, 'Close', {
              duration: 3000,
              panelClass: ['snackbar-error'],
            });
          } else {
            this.snackBar.open('User added successfully!', 'Close', {
              duration: 3000,
              panelClass: ['snackbar-success'],
            });
            this.dialog.closeAll();
            
            // Reload users and go to first page for new items
            await this.loadUsersWithPagination(0, 10, '', '');
          }
        }
      }
    } else {
      this.snackBar.open('Please correct form errors before submitting', 'Close', {
        duration: 3000,
        panelClass: ['snackbar-warning'],
      });
    }
  }

  async loadUsers() {
    await this.loadUsersWithPagination(0, 10, '', '');
  }

  // Load users with pagination state preservation
  async loadUsersWithPagination(pageIndex: number, pageSize: number, sortActive: string, sortDirection: string) {
    const { data, error } = await this.supabase.getUsers();

    if (error) {
      this.snackBar.open(`Error loading users: ${error.message}`, 'Close', {
        duration: 3000,
        panelClass: ['snackbar-error'],
      });
    } else if (data) {
      const users = data.map(user => ({
        uid: user.id,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
      }));
      
      this.user = users; // Store the users array
      this.userDataSource.data = users; // Update the data source data
      
      // Reconnect to paginator and sort if they exist
      if (this.userPaginator) {
        this.userDataSource.paginator = this.userPaginator;
        
        // Restore pagination state
        setTimeout(() => {
          if (this.userPaginator) {
            this.userPaginator.pageIndex = pageIndex;
            this.userPaginator.pageSize = pageSize;
          }
        });
      }
      
      if (this.userSort) {
        this.userDataSource.sort = this.userSort;
        
        // Restore sort state
        setTimeout(() => {
          if (this.userSort && sortActive) {
            this.userSort.active = sortActive;
            this.userSort.direction = sortDirection as 'asc' | 'desc';
          }
        });
      }
    }
  }

  editUser(user: User) {
    this.editMode = true;
    this.editUserId = user.uid;
    this.userForm.patchValue({
      firstName: user.name.split(' ')[0],
      lastName: user.name.split(' ')[1],
      email: user.email,
    });
    this.dialog.open(this.addUserDialog);
  }

  async deleteUser(user: User) {
    // Store current pagination state
    const currentPage = this.userDataSource.paginator?.pageIndex || 0;
    const currentPageSize = this.userDataSource.paginator?.pageSize || 10;
    const currentSort = this.userDataSource.sort?.active || '';
    const currentSortDirection = this.userDataSource.sort?.direction || '';

    const { error } = await this.supabase.deleteUser(user.uid);

    if (error) {
      this.snackBar.open(`Error deleting user: ${error.message}`, 'Close', {
        duration: 3000,
        panelClass: ['snackbar-error'],
      });
    } else {
      this.snackBar.open('User deleted successfully!', 'Close', {
        duration: 3000,
        panelClass: ['snackbar-success'],
      });
      
      // Reload users and restore pagination state
      await this.loadUsersWithPagination(currentPage, currentPageSize, currentSort, currentSortDirection);
    }
  }

  async onAddSupplier() {
    if (this.supplierForm.valid && this.selectedUsers.length > 0) {
      const {
        supplier_name,
        contact_person,
        phone,
        email,
        address,
        group_chat_link,
        facebook,
        viber,
        telegram,
        instagram,
        password
      } = this.supplierForm.value;

      try {
        // 1. Create the supplier in Supabase Auth
        const { data, error } = await this.supabase.signUp(email, password);

        if (error || !data.user) {
          this.snackBar.open(`Error: ${error?.message || 'User creation failed'}`, 'Close', { duration: 3000 });
          return;
        }

        const user_id = data.user.id;

        // 2. Insert the supplier into the `suppliers` table
        const { data: supplierData, error: insertError } = await this.supabase.insertSupplier(supplier_name, contact_person, phone, email, address, group_chat_link, facebook, viber, telegram, instagram);

        if (insertError || !supplierData) {
          this.snackBar.open(`Insert error: ${insertError?.message || 'Failed to insert supplier'}`, 'Close', { duration: 3000 });
          return;
        }

        const supplier_id = supplierData.id;

        // 4. Create relationships between supplier and selected users
        const userSupplierRelationships = this.selectedUsers.map(userId => ({
          supplier_id: supplier_id,
          user_id: userId,
          created_at: new Date().toISOString()
        }));

        // Create the relationships using the service
        try {
          await this.supabase.createUserSupplierRelationships(supplier_id, this.selectedUsers);
          console.log('✅ User-supplier relationships created successfully');
        } catch (relationshipError) {
          console.error('❌ Error creating user-supplier relationships:', relationshipError);
          this.snackBar.open('Supplier created but failed to assign users. Please try again.', 'Close', { duration: 3000 });
          return;
        }

        // 5. Generate and insert the supplier token
        const token = await this.generateSupplierToken(user_id);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Token expires in 7 days

        const { error: tokenError } = await this.supabase.insertSupplierToken(supplier_id, token, expiresAt.toISOString());

        if (tokenError) {
          this.snackBar.open(`Token error: ${tokenError.message}`, 'Close', { duration: 3000 });
        } else {
          this.snackBar.open(`Supplier added successfully! Assigned to ${this.selectedUsers.length} user(s).`, 'Close', { duration: 3000 });
          this.dialog.closeAll();
          this.supplierForm.reset();
          this.clearUserSelection();
          
          // Reload suppliers and go to first page for new items
          await this.loadSuppliersWithPagination(0, 10, '', '');
        }

      } catch (error) {
        console.error('Error adding supplier:', error);
        this.snackBar.open('An unexpected error occurred. Please try again.', 'Close', { duration: 3000 });
      }

    } else {
      if (this.selectedUsers.length === 0) {
        this.snackBar.open('Please select at least one user to assign the supplier to.', 'Close', { duration: 3000 });
      } else {
        this.snackBar.open('Please fill out the form correctly', 'Close', { duration: 3000 });
      }
    }
  }

  // Example token generation (custom logic)
  async generateSupplierToken(userId: string) {
    // You can use Supabase's JWT token generation or create a custom token here
    const token = `supplier-token-${userId}-${new Date().getTime()}`;
    return token;
  }

  ngAfterViewInit() {
    // Use setTimeout to ensure view children are available
    setTimeout(() => {
      // Set up user data source with paginator and sort
      if (this.userDataSource && this.userPaginator && this.userSort) {
        this.userDataSource.paginator = this.userPaginator;
        this.userDataSource.sort = this.userSort;
      }
      
      // Set up supplier data source with paginator and sort
      if (this.supplierDataSource && this.supplierPaginator && this.supplierSort) {
        this.supplierDataSource.paginator = this.supplierPaginator;
        this.supplierDataSource.sort = this.supplierSort;
      }
    });
  }
}
