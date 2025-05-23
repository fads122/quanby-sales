import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SupplierService } from '../../services/supplier.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../nav/sidebar/sidebar.component';

@Component({
  selector: 'app-supplier-portal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, SidebarComponent],
  templateUrl: './supplier-portal.component.html',
  styleUrls: ['./supplier-portal.component.css']
})
export class SupplierPortalComponent implements OnInit {
  isValidUser = false;
  supplier: { id: string; name: string } | null = null;
  equipments: any[] = [];
  filteredEquipments: any[] = [];
  isLoading = false;
  lastLogin = new Date();
  isSupplierPortal = false;
  showProfileViewModal = false;


  // Profile related properties
  showProfileModal = false;
  profileForm: FormGroup;
  profileData: any = null;
  isProfileLoading = false;

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;

  // Search
  searchTerm = '';

  // Modals
  showModal = false;
  editingEquipmentId: string | null = null;

  // Forms
  equipmentForm: FormGroup;
  newEquipmentForm: FormGroup;
  editForms: { [key: string]: FormGroup } = {};

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabaseService: SupabaseService,
    private fb: FormBuilder,
    private supplierService: SupplierService,
  ) {
    this.equipmentForm = this.fb.group({
      name: ['', Validators.required],
      model: [''],
      brand: [''],
      serial_no: [''],
      supplier_cost: [0, [Validators.required, Validators.min(0)]],
      quantity: [1, [Validators.required, Validators.min(1)]]
    });

    this.newEquipmentForm = this.fb.group({
      name: ['', Validators.required],
      model: [''],
      brand: [''],
      serial_no: [''],
      supplier_cost: [0, [Validators.required, Validators.min(0)]],
      quantity: [1, [Validators.required, Validators.min(1)]]
    });

this.profileForm = this.fb.group({
  supplier_name: ['', Validators.required],
  contact_person: ['', Validators.required],
  phone: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
  email: ['', [Validators.required, Validators.email]],
  address: ['', Validators.required],
  group_chat_link: [''],
  facebook: [''],
  viber: [''],
  telegram: [''],
  instagram: ['']
});
  }

  // Safe accessor for supplier name
  get supplierName(): string {
    return this.supplier?.name || 'Supplier';
  }

  async ngOnInit() {
    const user = await this.supabaseService.getCurrentUser();
    console.log('🔍 Current user:', user);

    if (!user || user.usertype !== 'supplier') {
      console.warn('❌ Access denied: Not a supplier');
      this.router.navigate(['/page-not-found']);
      return;
    }

    this.isValidUser = true;
    this.supplier = { id: user.id, name: `${user.first_name} ${user.last_name}` };

    await this.loadEquipments();
    await this.loadProfileData(); // Load profile data on init
    this.filterEquipments();
  }

  private async loadEquipments() {
    if (!this.supplier) return;
    this.isLoading = true;
    try {
      this.equipments = await this.supplierService.getSupplierEquipments(this.supplier.id);
      this.initializeEditForms();
      this.calculatePagination();
      this.filterEquipments();
    } finally {
      this.isLoading = false;
    }
  }

  private async loadProfileData() {
    if (!this.supplier) return;
    this.isProfileLoading = true;
    try {
      this.profileData = await this.supplierService.getSupplierProfile(this.supplier.id);
      if (this.profileData) {
        this.profileForm.patchValue(this.profileData);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      this.isProfileLoading = false;
    }
  }
  openProfileViewModal() {
    this.showProfileViewModal = true;
  }

  closeProfileViewModal() {
    this.showProfileViewModal = false;
  }
  private initializeEditForms() {
    this.equipments.forEach(equipment => {
      this.editForms[equipment.id] = this.fb.group({
        supplier_cost: [equipment.supplier_cost, [Validators.required, Validators.min(0)]],
        quantity: [equipment.quantity, [Validators.required, Validators.min(0)]]
      });
    });
  }

  // Profile methods
  openProfileModal(): void {
    this.showProfileModal = true;
    // Refresh profile data when opening modal
    this.loadProfileData();
  }

  closeProfileModal(): void {
    this.showProfileModal = false;
  }

  async saveProfile(): Promise<void> {
    if (this.profileForm.invalid || !this.supplier) return;

    this.isProfileLoading = true;
    try {
      await this.supplierService.upsertSupplierProfile(
        this.supplier.id,
        this.profileForm.value
      );

      // Update the displayed name if company name changed
      if (this.profileForm.value.supplier_name) {
        this.supplier.name = this.profileForm.value.supplier_name;
      }

      this.closeProfileModal();
    } catch (error) {
      console.error('Error saving profile:', error);
      // Consider adding user notification here
    } finally {
      this.isProfileLoading = false;
    }
  }

  // Navigation methods
  goBack(): void {
    this.router.navigate(['/']);
  }

  // Search and filtering
  filterEquipments(): void {
    if (!this.searchTerm) {
      this.filteredEquipments = [...this.equipments];
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredEquipments = this.equipments.filter(eq =>
        eq.name.toLowerCase().includes(term) ||
        eq.model?.toLowerCase().includes(term) ||
        eq.brand?.toLowerCase().includes(term)
      );
    }
    this.calculatePagination();
  }

  resetSearch(): void {
    this.searchTerm = '';
    this.filterEquipments();
  }

  // Pagination methods
  calculatePagination(): void {
    this.totalPages = Math.ceil(this.filteredEquipments.length / this.pageSize);
    this.currentPage = Math.min(this.currentPage, this.totalPages || 1);
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  get paginatedEquipments(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.filteredEquipments.slice(start, end);
  }

  // Modal methods
  openAddModal(): void {
    this.editingEquipmentId = null;
    this.equipmentForm.reset();
    this.showModal = true;
  }

  openEditModal(equipmentId: string): void {
    const equipment = this.equipments.find(eq => eq.id === equipmentId);
    if (equipment) {
      this.editingEquipmentId = equipmentId;
      this.equipmentForm.patchValue(equipment);
      this.showModal = true;
    }
  }

  closeModal(): void {
    this.showModal = false;
  }

  // Equipment CRUD methods
  async saveEquipment(): Promise<void> {
    if (this.equipmentForm.invalid || !this.supplier) return;

    if (this.editingEquipmentId) {
      await this.supplierService.updateEquipment(
        this.editingEquipmentId,
        this.equipmentForm.value
      );
    } else {
      const supplierName = await this.supplierService.getSupplierName(this.supplier.id);
      if (!supplierName) return;

      const newEquipment = {
        ...this.equipmentForm.value,
        supplier: supplierName,
        status: 'active',
        created_at: new Date().toISOString()
      };

      await this.supplierService.addEquipment(newEquipment);
    }

    await this.loadEquipments();
    this.closeModal();
  }

  viewDetails(equipmentId: string): void {
    this.router.navigate(['/equipment', equipmentId]);
  }

  // Computed properties
  get availableCount(): number {
    return this.equipments.reduce((sum, eq) => sum + eq.quantity, 0);
  }

  editEquipment(equipmentId: string): void {
    this.openEditModal(equipmentId);
  }
}
