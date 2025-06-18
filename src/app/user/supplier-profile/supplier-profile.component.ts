import { TableModule } from 'primeng/table';
import { NgFor, NgIf, CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseAuthService } from '../../services/supabase-auth.service';
import { SupabaseSupplierService } from '../../services/supabase_supplier.service';
import { SidebarComponent } from "../../nav/sidebar/sidebar.component";
import { FormsModule } from '@angular/forms'; // Add this import

interface Supplier {
  id: number;
  supplier_name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  group_chat_link: string;
  user_id: string;
  facebook?: string;    // <-- New
  viber?: string;      // <-- New
  telegram?: string;   // <-- New
  instagram?: string;  // <-- New
  rating?: number;   // <-- New
}

interface EquipmentItem {
  brand: string;
  model: string;
  supplier_cost: number;
  product_images: string[];
  category?: string; // Optional property for category
  stock?: number; // Optional property for stock
  description?: string; // Optional property for description
}

@Component({
  standalone: true,
  imports: [NgFor, NgIf, CommonModule, SidebarComponent, TableModule, FormsModule],
  selector: 'app-supplier-profile',
  templateUrl: './supplier-profile.component.html',
  styleUrls: ['./supplier-profile.component.css'],
})
export class SupplierProfileComponent implements OnInit {
  supplier: Supplier | null = null;
  supplierItems: EquipmentItem[] = [];
  filteredItems: EquipmentItem[] = [];
  uniqueBrands: string[] = [];
  selectedBrand: string | null = null;
  productSearchQuery: string = '';
  isCollapsed = false;
  loading: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private supabaseService: SupabaseSupplierService,
    private authService: SupabaseAuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const supplierId = this.route.snapshot.paramMap.get('id')?.trim();

    if (!supplierId || isNaN(Number(supplierId))) {
      alert('Invalid supplier ID. Please check the URL.');
      this.router.navigate(['/suppliers']);
      return;
    }

    this.fetchSupplierData();
  }

  async fetchSupplierData(): Promise<void> {
    this.loading = true;
    try {
      let supplierId = this.route.snapshot.paramMap.get('id')?.trim();
      if (!supplierId || isNaN(Number(supplierId))) {
        throw new Error('Invalid supplier ID');
      }

      const numericSupplierId = Number(supplierId);

      // Fetch supplier details
      const { data: supplierData, error: supplierError } = await this.supabaseService
        .from('suppliers')
        .select('*')
        .eq('id', numericSupplierId)
        .maybeSingle();

      if (supplierError || !supplierData) {
        alert(`Supplier not found.`);
        this.router.navigate(['/suppliers']);
        return;
      }

      this.supplier = supplierData;

      // Fetch equipment items
      const { data: itemsData, error: itemsError } = await this.supabaseService
        .from('equipments')
        .select('brand, model, supplier_cost, product_images')
        .eq('supplier', supplierData.supplier_name);

      if (itemsError) throw itemsError;

      this.supplierItems = itemsData;
      this.uniqueBrands = [...new Set(itemsData.map((item) => item.brand))].filter(Boolean);
      this.filteredItems = itemsData;

    } catch (error) {
      alert('Failed to load supplier profile.');
    } finally {
      this.loading = false;
    }
  }

  selectBrand(brand: string): void {
    this.selectedBrand = brand;
    this.filteredItems = brand
      ? this.supplierItems.filter((item) => item.brand === brand)
      : this.supplierItems;
  }

  hasSocialMedia(): boolean {
    return !!(
      this.supplier?.facebook ||
      this.supplier?.viber ||
      this.supplier?.telegram ||
      this.supplier?.instagram
    );
  }

  clearBrandFilter(): void {
    this.selectedBrand = null;
    this.filteredItems = [...this.supplierItems];
  }

  filterProducts(): void {
    if (!this.productSearchQuery) {
      this.filteredItems = [...this.supplierItems];
      return;
    }

    const query = this.productSearchQuery.toLowerCase();
    this.filteredItems = this.supplierItems.filter(item =>
      (item.brand?.toLowerCase().includes(query)) ||
      (item.model?.toLowerCase().includes(query))
    );
  }

  getBrandCount(brand: string): number {
    return this.supplierItems.filter(item => item.brand === brand).length;
  }

  openImageDialog(imageUrl: unknown): void {
    if (typeof imageUrl === 'string') {
      window.open(imageUrl, '_blank');
    }
  }

  // Add method to handle sidebar collapse
  onSidebarCollapsed(collapsed: boolean) {
    this.isCollapsed = collapsed;
  }
}
