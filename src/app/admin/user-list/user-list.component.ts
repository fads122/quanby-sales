import { Component, OnInit, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { SidebarComponent } from '../../nav/sidebar/sidebar.component';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface User {
  uid: string;
  name: string;
  email: string;
}

@Component({
  selector: 'user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css'],
  standalone: true,
  imports: [
    TableModule,
    CommonModule,
    SidebarComponent,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
  ],
})
export class UserListComponent implements OnInit {
goToPage(_t48: any) {
throw new Error('Method not implemented.');
}
  private supabase: SupabaseClient;
  user: User[] = [];
  searchQuery: string = '';
  userForm: FormGroup;
  editMode = false;
  editUserId: string | null = null;
  currentPage: number = 1;
  pageSize: number = 5; // Number of users per page
  supplierForm!: FormGroup;

  @ViewChild('addUserDialog') addUserDialog!: TemplateRef<any>;
  @ViewChild('addSupplierDialog') addSupplierDialog!: TemplateRef<any>;
totalPages: any;

  constructor(
    private fb: FormBuilder,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    this.supabase = createClient(
      'https://xvcgubrtandfivlqcmww.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2Y2d1YnJ0YW5kZml2bHFjbXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkxNDk4NjYsImV4cCI6MjA1NDcyNTg2Nn0.yjd-SXfzJe6XmuNpI2HsZcI9EsS9AxBXI-qukzgcZig'
    );

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
      password: ['', [Validators.required, Validators.minLength(8)]],
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
  }


  openAddUserDialog() {
    this.editMode = false;
    this.userForm.reset();
    this.dialog.open(this.addUserDialog);
  }

  openAddSupplierDialog() {
    this.editMode = false;
    this.userForm.reset();
    this.dialog.open(this.addSupplierDialog);
  }

  closeDialog() {
    this.dialog.closeAll();
  }
  async onAddUser() {
    if (this.userForm.valid) {
      const { firstName, lastName, email, password } = this.userForm.value;

      if (this.editMode && this.editUserId) {
        // Update existing user
        const { error } = await this.supabase
          .from('users')
          .update({ first_name: firstName, last_name: lastName, email })
          .eq('id', this.editUserId);

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
          this.loadUsers();
        }
      } else {
        // Create a new user in auth and profile tables
        const { data, error } = await this.supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          this.snackBar.open(`Error: ${error.message}`, 'Close', {
            duration: 3000,
            panelClass: ['snackbar-error'],
          });
        } else if (data.user) {
          const { error: profileError } = await this.supabase
            .from('users')
            .insert([
              { id: data.user.id, first_name: firstName, last_name: lastName, email },
            ]);

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
            this.loadUsers();
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
    const { data, error } = await this.supabase
      .from('users')
      .select('id, first_name, last_name, email, usertype') // Include the user_type column
      .eq('usertype', 'user'); // Filter only users with user_type = 'user'

    if (error) {
      this.snackBar.open(`Error loading users: ${error.message}`, 'Close', {
        duration: 3000,
        panelClass: ['snackbar-error'],
      });
    } else {
      this.user = data.map(user => ({
        uid: user.id,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
      }));
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
    const { error } = await this.supabase
      .from('users')
      .delete()
      .eq('id', user.uid);

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
      this.loadUsers();
    }
  }
  get paginatedUsers(): User[] {
  const startIndex = (this.currentPage - 1) * this.pageSize;
  return this.user.slice(startIndex, startIndex + this.pageSize);
}

prevPage() {
  if (this.currentPage > 1) {
    this.currentPage--;
  }
}

nextPage() {
  if (this.currentPage < Math.ceil(this.user.length / this.pageSize)) {
    this.currentPage++;
  }
}

async onAddSupplier() {
  if (this.supplierForm.valid) {
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

    // 1. Create the supplier in Supabase Auth (if needed)
    const { data, error } = await this.supabase.auth.signUp({ email, password });

    if (error || !data.user) {
      this.snackBar.open(`Error: ${error?.message || 'User creation failed'}`, 'Close', { duration: 3000 });
      return;
    }

    const user_id = data.user.id;

    // 2. Insert the supplier into the `suppliers` table
    const { data: supplierData, error: insertError } = await this.supabase
      .from('suppliers')
      .insert([{
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
        user_id
      }])
      .select('id') // Get the inserted supplier's ID
      .single();

    if (insertError || !supplierData) {
      this.snackBar.open(`Insert error: ${insertError?.message || 'Failed to insert supplier'}`, 'Close', { duration: 3000 });
      return;
    }

    const supplier_id = supplierData.id;

    // 3. Insert the supplier into the `users` table with `usertype = 'supplier'`
    const { error: userInsertError } = await this.supabase
      .from('users')
      .insert([{
        id: user_id,
        first_name: supplier_name,  // Assuming supplier_name is the full name or you can split it
        last_name: contact_person,  // You can adjust this if you have specific fields
        email,
        usertype: 'supplier'  // Set usertype to 'supplier'
      }]);

    if (userInsertError) {
      this.snackBar.open(`Error adding supplier to users table: ${userInsertError.message}`, 'Close', { duration: 3000 });
      return;
    }

    // 4. Generate and insert the supplier token
    const token = await this.generateSupplierToken(user_id);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Token expires in 7 days

    const { error: tokenError } = await this.supabase
      .from('supplier_access_tokens')
      .insert([{
        supplier_id,
        token,
        expires_at: expiresAt.toISOString(),
        is_used: false
      }]);

    if (tokenError) {
      this.snackBar.open(`Token error: ${tokenError.message}`, 'Close', { duration: 3000 });
    } else {
      this.snackBar.open('Supplier added successfully!', 'Close', { duration: 3000 });
      this.dialog.closeAll();
      this.supplierForm.reset();
    }

  } else {
    this.snackBar.open('Please fill out the form correctly', 'Close', { duration: 3000 });
  }
}


// Example token generation (custom logic)
async generateSupplierToken(userId: string) {
  // You can use Supabase's JWT token generation or create a custom token here
  const token = `supplier-token-${userId}-${new Date().getTime()}`;
  return token;
}
}
