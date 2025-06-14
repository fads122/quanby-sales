import { Component, OnInit, ViewChild, TemplateRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SidebarComponent } from '../../nav/sidebar/sidebar.component';
import { SupabaseSupplierService } from '../../services/supabase_supplier.service';
import { SupabaseAuthService } from '../../services/supabase-auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { Router, RouterLink } from '@angular/router';
import { MatDividerModule } from '@angular/material/divider';
import { BreadcrumbComponent } from '../../breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-supplier-list',
  templateUrl: './supplier-list.component.html',
  styleUrls: ['./supplier-list.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    SidebarComponent,
    BreadcrumbComponent,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    RouterLink
  ],
})
export class SupplierListComponent implements OnInit {
  suppliers: any[] = [];
  currentUserSuppliers: any[] = [];
  allSuppliers: any[] = [];
  filteredSuppliers: any[] = [];
  searchQuery: string = '';
  supplierForm: FormGroup;
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;
  editingSupplier: any = null;
  isLoading: boolean = true;
  isCollapsed = false;
  currentUser: any = null;
  activeTab: 'current' | 'all' = 'current'; // Track which tab is active

  displayedColumns: string[] = ['number', 'supplier_name', 'contact_person', 'phone', 'email', 'actions'];
  dataSource!: MatTableDataSource<any>;

  @ViewChild('addSupplierDialog') addSupplierDialog!: TemplateRef<any>;
  @ViewChild('deleteDialog') deleteDialog!: TemplateRef<any>;
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  private supplierToDelete: number | null = null;

  constructor(
    private fb: FormBuilder,
    private supabaseService: SupabaseSupplierService,
    private authService: SupabaseAuthService,
    private mainSupabaseService: SupabaseService,
    private router: Router,
    private cdRef: ChangeDetectorRef
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
  try {
    this.isLoading = true;
    await this.authService.restoreSession();
    this.currentUser = await this.authService.getUser();
    if (!this.currentUser) {
      alert('Session expired. Please log in again.');
      return;
    }
    await this.fetchAllSuppliers();
    await this.fetchCurrentUserSuppliers();
    this.updateDataSource();
  } finally {
    // Add a minimum loading time of 1 second for better UX
    setTimeout(() => {
      this.isLoading = false;
    }, 1000);
  }
}

  // Fetch suppliers assigned to the current user
  async fetchCurrentUserSuppliers(): Promise<void> {
    try {
      const relationships = await this.mainSupabaseService.getUserSupplierRelationships(undefined, this.currentUser.id);
      
      // Extract supplier IDs from relationships
      const supplierIds = relationships.map(rel => rel.supplier_id);
      
      if (supplierIds.length > 0) {
        // Fetch supplier details for each ID
        const { data, error } = await this.supabaseService.from('suppliers')
          .select('id, supplier_name, contact_person, phone, email, address')
          .in('id', supplierIds);
        
        if (error) {
          console.error('Error fetching current user suppliers:', error);
          this.currentUserSuppliers = [];
        } else {
          this.currentUserSuppliers = data || [];
        }
      } else {
        this.currentUserSuppliers = [];
      }
    } catch (error) {
      console.error('Error fetching current user suppliers:', error);
      this.currentUserSuppliers = [];
    }
  }

  // Fetch all suppliers
  async fetchAllSuppliers(): Promise<void> {
    try {
      this.allSuppliers = await this.supabaseService.getSuppliers();
    } catch (error) {
      console.error('Error fetching all suppliers:', error);
      this.allSuppliers = [];
    }
  }

  // Update data source based on active tab
  updateDataSource(): void {
    if (this.activeTab === 'current') {
      this.suppliers = this.currentUserSuppliers;
    } else {
      this.suppliers = this.allSuppliers;
    }
    
    this.dataSource = new MatTableDataSource(this.suppliers);
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;

    // Custom filter predicate
    this.dataSource.filterPredicate = (data: any, filter: string) => {
      const searchStr = (data.supplier_name + data.contact_person + data.phone + data.email).toLowerCase();
      return searchStr.indexOf(filter.toLowerCase()) !== -1;
    };
  }

  // Switch between current user suppliers and all suppliers
  switchTab(tab: 'current' | 'all'): void {
    // Add a small delay for smooth animation
    setTimeout(() => {
      this.activeTab = tab;
      this.updateDataSource();
      this.filterSuppliers(); // Reapply current filter
      
      // Trigger re-render of data source to ensure proper animation
      this.dataSource.data = [...this.dataSource.data];
    }, 100);
  }

  // Get the current tab label
  getCurrentTabLabel(): string {
    return this.activeTab === 'current' ? 'Current Supplier' : 'All Suppliers';
  }

  // Get the count for each tab
  getCurrentSupplierCount(): number {
    return this.currentUserSuppliers.length;
  }

  getAllSupplierCount(): number {
    return this.allSuppliers.length;
  }

  async fetchSuppliers(): Promise<void> {
    try {
      this.isLoading = true;
      await this.fetchAllSuppliers();
      await this.fetchCurrentUserSuppliers();
      this.updateDataSource();
    } catch (error) {
      alert('Failed to load supplier list. Please try again.');
    } finally {
      setTimeout(() => {
        this.isLoading = false;
      }, 1000);
    }
  }

  // Update ngAfterViewInit
  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  // Update filterSuppliers method
  filterSuppliers(): void {
    this.dataSource.filter = this.searchQuery.trim().toLowerCase();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
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
    if (this.supplierToDelete === null) {  // Fixed missing parenthesis
      return;
    }

    try {
      await this.supabaseService.deleteSupplier(this.supplierToDelete);
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

  // Add this method to handle sidebar collapse
  onSidebarCollapsed(collapsed: boolean): void {
    this.isCollapsed = collapsed;
    this.cdRef.detectChanges();
  }
}
