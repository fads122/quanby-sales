import { Component, OnInit, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { SidebarComponent } from '../../nav/sidebar/sidebar.component';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { SupabaseSupplierService } from '../../services/supabase_supplier.service';
import { SupabaseAuthService } from '../../services/supabase-auth.service';
import { Router, RouterLink } from '@angular/router';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  selector: 'app-supplier-list',
  templateUrl: './supplier-list.component.html',
  styleUrls: ['./supplier-list.component.css'],
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
    MatDividerModule,
    RouterLink
  ],
})
export class SupplierListComponent implements OnInit {
  suppliers: any[] = [];
  filteredSuppliers: any[] = [];
  searchQuery: string = '';
  supplierForm: FormGroup;
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;
  editingSupplier: any = null;

  @ViewChild('addSupplierDialog') addSupplierDialog!: TemplateRef<any>;
  @ViewChild('deleteDialog') deleteDialog!: TemplateRef<any>;
  private supplierToDelete: number | null = null;

  constructor(
    private fb: FormBuilder,
    // private dialog: MatDialog,
    private supabaseService: SupabaseSupplierService,
    private authService: SupabaseAuthService,
    private router: Router
  ) {
    this.supplierForm = this.fb.group({
      supplier_name: ['', Validators.required],
      contact_person: ['', Validators.required],
      phone: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      address: ['', Validators.required],
      status: ['active'],
      facebook: [''],
      viber: [''],
      telegram: [''],
      instagram: ['']
    });
  }

  async ngOnInit(): Promise<void> {
    await this.authService.restoreSession();
    const user = await this.authService.getUser();
    if (!user) {
      alert('Session expired. Please log in again.');
      return;
    }
    await this.fetchSuppliers();
  }

  async fetchSuppliers(): Promise<void> {
    try {
      this.suppliers = await this.supabaseService.getSuppliers();
      this.filterSuppliers();
    } catch (error) {
      alert('Failed to load supplier list. Please try again.');
    }
  }

  filterSuppliers(): void {
    this.filteredSuppliers = this.suppliers.filter(supplier =>
      supplier.supplier_name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
      supplier.contact_person.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
      supplier.phone.includes(this.searchQuery) ||
      supplier.email.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
    this.totalPages = Math.ceil(this.filteredSuppliers.length / this.itemsPerPage);
    this.currentPage = 1;
  }

  editSupplier(supplier: any): void {
    this.editingSupplier = supplier;
    this.supplierForm.patchValue(supplier);
    // this.dialog.open(this.addSupplierDialog);
  }

  confirmDelete(id: number): void {
    this.supplierToDelete = id;
    // this.dialog.open(this.deleteDialog);
  }

  closeDeleteDialog(): void {
    // this.dialog.closeAll();
    this.supplierToDelete = null;
  }

  async deleteSupplier(): Promise<void> {
    if (this.supplierToDelete === null) return;

    try {
      await this.supabaseService.deleteSupplier(this.supplierToDelete);
      // this.dialog.closeAll();
      await this.fetchSuppliers();
    } catch (error) {
      alert('Failed to delete supplier. Please try again.');
    } finally {
      this.supplierToDelete = null;
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  openAddSupplierDialog(): void {
    this.editingSupplier = null;
    this.supplierForm.reset({
      status: 'active'
    });
    // this.dialog.open(this.addSupplierDialog);
  }

  closeDialog(): void {
    // this.dialog.closeAll();
  }

  async onSubmit(): Promise<void> {
    if (this.supplierForm.invalid) {
      alert('Please fill in all required fields.');
      return;
    }

    try {
      if (this.editingSupplier) {
        await this.supabaseService.updateSupplier(this.editingSupplier.id, this.supplierForm.value);
      } else {
        await this.supabaseService.addSupplier(this.supplierForm.value);
      }
      // this.dialog.closeAll();
      await this.fetchSuppliers();
    } catch (error) {
      alert(`Failed to ${this.editingSupplier ? 'update' : 'add'} supplier. Please try again.`);
    }
  }

  get paginatedSuppliers(): any[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredSuppliers.slice(startIndex, startIndex + this.itemsPerPage);
  }
}
