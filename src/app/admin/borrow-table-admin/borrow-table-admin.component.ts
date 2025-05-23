import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { NgIf, NgForOf, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseAuthService } from '../../services/supabase-auth.service';
import { SidebarComponent } from "../../nav/sidebar/sidebar.component";
import { Router } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-borrow-table-admin',
  standalone: true,
  imports: [NgIf, NgForOf, NgClass, SidebarComponent, FormsModule, TableModule, DialogModule, DropdownModule, InputTextModule
  ],
  templateUrl: './borrow-table-admin.component.html',
  styleUrls: ['./borrow-table-admin.component.css'] // ✅ Fixed `styleUrls`
})
export class BorrowTableAdminComponent implements OnInit {
  borrowRequests: any[] = [];
  userEmail: string | null = null;
  filteredRequests: any[] = [];
  uniqueDepartments: string[] = [];
  selectedBorrower: any | null = null;
  showDetailsModal: boolean = false;

  // Filters
  searchTerm: string = '';
  selectedDepartment: string = '';
  selectedStatus: string = '';
  selectedBorrowDate: string = '';
  selectedReturnDate: string = '';

  statusOptions = [
    { label: 'All Statuses', value: '' },
    { label: 'Borrowed', value: 'borrowed' },
    { label: 'Returned', value: 'Returned' }
  ];

  constructor(
    private router: Router,
    private supabaseService: SupabaseService,
    private authService: SupabaseAuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.fetchBorrowRequests();
    this.loadUserEmail();
    console.log('Filtered requests:', this.filteredRequests);
  }

  async loadUserEmail() {
    if (await this.authService.isLoggedIn()) {
      const { data } = await this.authService.getUser();
      this.userEmail = data?.user?.email || null;
    }
  }

  goToBorrowForm() {
    this.router.navigate(['/borrow-form']);
  }

  applyFilters(): void {
    this.filteredRequests = this.borrowRequests.filter(request => {
      return (
        (!this.searchTerm || request.borrower_name.toLowerCase().includes(this.searchTerm.toLowerCase())) &&
        (!this.selectedDepartment || request.borrower_department === this.selectedDepartment) &&
        (!this.selectedStatus || request.status === this.selectedStatus) &&
        (!this.selectedBorrowDate || request.borrow_date === this.selectedBorrowDate) &&
        (!this.selectedReturnDate || request.return_date === this.selectedReturnDate)
      );
    });
  }

  async fetchBorrowRequests(): Promise<void> {
    try {
      const { data: requests, error: requestsError } = await this.supabaseService
        .from('borrow_requests')
        .select(`id, user_id, borrow_date, return_date, borrower_name, borrower_department, purpose, status`);

      if (requestsError) {
        console.error('Error fetching borrow requests:', requestsError);
        return;
      }

      const processedRequests = await Promise.all(
        requests.map(async (request) => {
          const { data: equipmentData, error: equipmentError } = await this.supabaseService
        .from('borrow_request_equipment')
        .select(`equipment_id, quantity, equipments!borrow_request_equipment_equipment_id_fkey (name, product_images)`)
        .eq('borrow_request_id', request.id);


          if (equipmentError) {
            console.error('Error fetching equipment:', equipmentError);
            return { ...request, equipmentList: [] };
          }

          return {
            ...request,
            equipmentList: (equipmentData ?? []).map((e: any) => ({
              name: e.equipments?.name || 'Unknown',
              quantity: e.quantity || 0,
              image: e.equipments?.product_images?.[0] || 'assets/default-equipment.jpg' // Get first image
            }))
          };

        })
      );

      this.borrowRequests = processedRequests;
      this.filteredRequests = [...processedRequests];
      this.uniqueDepartments = [...new Set(processedRequests.map(req => req.borrower_department))].filter(Boolean);
    } catch (error) {
      console.error('Failed to load borrow requests:', error);
    }
  }


  resetFilters(): void {
    this.searchTerm = '';
    this.selectedDepartment = '';
    this.selectedStatus = '';
    this.selectedBorrowDate = '';
    this.selectedReturnDate = '';
    this.filteredRequests = [...this.borrowRequests];
  }

  openDetailsModal(request: any): void {
    console.log("Opening modal for:", request);
    console.log("Equipment List:", request.equipmentList);
    this.selectedBorrower = request;
    this.showDetailsModal = true;
    this.cdr.detectChanges();
  }





  closeDetailsModal() {
    this.showDetailsModal = false;
    this.selectedBorrower = null;
  }
}
