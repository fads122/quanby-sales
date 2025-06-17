import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { NgIf, NgFor, CommonModule } from '@angular/common';
import { SupabaseAuthService } from '../../services/supabase-auth.service';
import { SidebarComponent } from "../../nav/sidebar/sidebar.component";
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator } from '@angular/material/paginator';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { DatePipe } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BreadcrumbComponent } from '../../breadcrumb/breadcrumb.component';

interface InhouseEquipment {
    id: string;
    name: string;
    quantity: number;
    images?: string[];
}

interface BorrowRequestEquipment {
    inhouse_equipment_id: string;
    quantity: number;
    inhouse: InhouseEquipment;
}

interface BorrowRequest {
    id: string;
    user_id: string;
    borrow_date: string;
    return_date: string;
    borrower_name: string;
    borrower_department: string;
    borrower_contact: string;
    borrower_email: string;
    purpose: string;
    status: string;
    equipmentList: {
        name: string;
        quantity: number;
        image: string;
    }[];
}

@Component({
  selector: 'app-borrow-table-user',
  standalone: true,
  imports: [
    CommonModule,
    NgIf,
    NgFor,
    FormsModule,
    MatTableModule,
    MatIconModule,
    MatPaginatorModule,
    MatDialogModule,
    DatePipe,
    MatTooltipModule,
    SidebarComponent,
    BreadcrumbComponent
  ],
  templateUrl: './borrow-table-user.component.html',
  styleUrls: ['./borrow-table-user.component.css']
})
export class BorrowTableUserComponent implements OnInit, AfterViewInit {
  isLoading: boolean = true;
  selectedBorrower: any = null;
  isCollapsed = false;

  displayedColumns: string[] = ['borrower_name', 'borrower_department', 'borrow_date', 'return_date', 'status', 'action'];
  dataSource = new MatTableDataSource<BorrowRequest>([]);
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  userEmail: string | null = null;
  filteredBorrowRequests: any[] = [];
  searchTerm: string = "";
  selectedRequest: any | null = null;
  showDetailsModal: boolean = false;
  borrowedItems: any[] = [];
  borrowRequests: BorrowRequest[] = [];
  equipmentList: any[] = []; // Add this line
  
  // Computed properties for template
  get totalRequests(): number {
    return this.dataSource.data.length;
  }

  get activeRequests(): number {
    return this.dataSource.data.filter(r => r.status !== 'Returned' && r.status !== 'returned').length;
  }

  get isRequestActive(): boolean {
    return this.selectedRequest && this.selectedRequest.status !== 'Returned' && this.selectedRequest.status !== 'returned';
  }

  constructor(
    private router: Router,
    private supabaseService: SupabaseService,
    private authService: SupabaseAuthService,
    private sanitizer: DomSanitizer,
    private dialog: MatDialog
  ) {}

  onSidebarCollapsedChange(isCollapsed: boolean) {
    this.isCollapsed = isCollapsed;
    const container = document.querySelector('.borrow-table-container');
    if (container) {
      if (isCollapsed) {
        container.classList.add('collapsed');
      } else {
        container.classList.remove('collapsed');
      }
    }
  }

  async ngOnInit() {
    try {
      this.isLoading = true; // Show loader
      await this.fetchBorrowRequests();
    } finally {
      // Add a slight delay to ensure smooth animation
      setTimeout(() => {
        this.isLoading = false; // Hide loader
      }, 1000);
    }
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  getFullRequest(id: string): any {
  return this.borrowRequests.find(request => request.id === id);
}

  goToBorrowForm() {
      console.log('Button clicked'); // Check if this appears in console
    this.router.navigate(['/borrow-form']);
  }

  async fetchBorrowRequests(): Promise<void> {
  try {
    this.isLoading = true; // Show loader while fetching
    console.log(`🔍 Fetching ALL borrow requests`);

    // 1. Fetch basic request data (REMOVED the user_id filter)
    const { data: requests, error: requestsError } = await this.supabaseService
      .from('borrow_requests')
      .select(`id, user_id, borrow_date, return_date, borrower_name,
              borrower_department, borrower_contact, borrower_email, purpose, status`)
      .order('borrow_date', { ascending: false }); // Optional: sort by most recent

    if (requestsError) throw requestsError;
    if (!requests || requests.length === 0) {
      console.warn("⚠ No borrow requests found");
      return;
    }

    // 2. Process requests with equipment (same as before)
    const processedRequests = await Promise.all(
      requests.map(async (request) => {
        const { data: equipmentData, error: equipmentError } = await this.supabaseService
          .from('borrow_request_equipment')
          .select(`
            inhouse_equipment_id,
            quantity,
            inhouse!borrow_request_equipment_inhouse_equipment_id_fkey (name, images)
          `)
          .eq('borrow_request_id', request.id);

        if (equipmentError) {
          console.error(`❌ Error fetching equipment for request ${request.id}:`, equipmentError);
          return { ...request, equipmentList: [] };
        }

        const equipmentMap = new Map<string, any>();
        equipmentData.forEach((bre: any) => {
          const equipmentName = bre.inhouse?.name || "Unknown Equipment";
          const equipmentImage = bre.inhouse?.images?.[0] || "assets/no-image.png";

          if (equipmentMap.has(equipmentName)) {
            equipmentMap.get(equipmentName).quantity += bre.quantity;
          } else {
            equipmentMap.set(equipmentName, {
              name: equipmentName,
              quantity: bre.quantity || 0,
              image: equipmentImage
            });
          }
        });

        return {
          ...request,
          equipmentList: Array.from(equipmentMap.values())
        };
      })
    );

    // 3. Update data sources
    this.borrowRequests = processedRequests;
    this.dataSource.data = this.borrowRequests;
    this.filteredBorrowRequests = [...this.borrowRequests];

    console.log('✅ Loaded all borrow requests:', this.borrowRequests);

  } catch (error) {
    console.error('❌ Failed to load borrow requests:', error);
    alert('Error loading borrow requests. Please try again.');
  } finally {
    // Add a slight delay for smooth animation
    setTimeout(() => {
      this.isLoading = false; // Hide loader
    }, 1000);
  }
}

  filterBorrowRequests(): void {
  const term = this.searchTerm.toLowerCase().trim();

  if (!term) {
    this.dataSource.data = this.borrowRequests; // Reset to all data
  } else {
    this.dataSource.data = this.borrowRequests.filter(request =>
      request.borrower_name.toLowerCase().includes(term) ||
      request.borrower_department.toLowerCase().includes(term) ||
      (request.borrower_contact && request.borrower_contact.toLowerCase().includes(term)) ||
      (request.borrower_email && request.borrower_email.toLowerCase().includes(term))
    );
  }
}

  sortRequests() {
    this.filteredBorrowRequests.sort((a, b) => new Date(b.borrow_date).getTime() - new Date(a.borrow_date).getTime());
  }

  addNewBorrowRequest(newRequest: any) {
    this.filteredBorrowRequests = [newRequest, ...this.filteredBorrowRequests];
    this.sortRequests(); // Sort after adding
  }

  openDetails(request: any) {
    this.selectedRequest = request;
    this.showDetailsModal = true;
  }

  openEditDialog(request: any) {
    // Implement edit dialog logic
    console.log('Edit dialog opened for:', request);
  }

  openDeleteDialog(request: any) {
    // Implement delete dialog logic
    console.log('Delete dialog opened for:', request);
  }

  closeDetailsModal() {
    this.showDetailsModal = false;
    this.selectedRequest = null;
  }

  getImagePath(image: string | null | undefined): string {
    console.log("🖼 Image Path Received:", image);

    if (image) {
      // ✅ Ensure the image path is correctly formatted
      return image.startsWith("http") ? image : `assets/${image}`;
    }

    console.warn("⚠️ No Image Found, Using Default");
    return 'assets/no-image.png'; // ✅ Fallback image
  }

  sanitizeUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  isPdf(fileUrl: string): boolean {
    return fileUrl?.toLowerCase().endsWith('.pdf');
  }

  openDetailsModal(request: any) {
    console.log("🟢 Opening details for:", request);
     console.log("Equipment List:", request.equipmentList);

    if (!request) {
      console.error("❌ No request data provided.");
      return;
    }

    // ✅ Ensure equipmentList exists and has data
    if (!request.equipmentList || request.equipmentList.length === 0) {
      console.warn("⚠ No equipment data found for this borrower.");
      request.equipmentList = []; // Set an empty array to avoid errors
    }

    // ✅ Ensure split() is not called on undefined values
    const safeEquipmentNames = request.equipment_names ? request.equipment_names.split(', ') : [];
    const safeQuantities = request.quantities ? request.quantities.split(', ') : [];

    // ✅ Assign selected borrower details
    this.selectedBorrower = {
      ...request,
      equipmentList: request.equipmentList, // ✅ Use preprocessed equipment list
      equipmentNamesArray: safeEquipmentNames,
      quantitiesArray: safeQuantities
    };

    this.showDetailsModal = true; // ✅ Show the modal
  }

  async markAsReturned(requestId: string): Promise<void> {
  try {
    console.log(`🔍 Processing return for request ID: ${requestId}`);

    // 1. Get borrowed items and request details
    const { data: requestData, error: requestError } = await this.supabaseService
      .from('borrow_requests')
      .select('borrower_name')
      .eq('id', requestId)
      .single();

    if (requestError) throw requestError;

    const { data: borrowedItems, error: itemsError } = await this.supabaseService
      .from('borrow_request_equipment')
      .select('inhouse_equipment_id, quantity')
      .eq('borrow_request_id', requestId);

    if (itemsError || !borrowedItems?.length) {
      console.error('❌ Error fetching items:', itemsError);
      throw new Error(itemsError?.message || 'No equipment found');
    }

    // 2. Process returns
    const returnDate = new Date();
    const returnedEquipmentNames: string[] = [];
    const borrowerName = requestData.borrower_name;

    // Get equipment details
    const equipmentIds = borrowedItems.map(item => item.inhouse_equipment_id);
    const { data: currentEquipment, error: fetchError } = await this.supabaseService
      .from('inhouse')
      .select('id, name, quantity')
      .in('id', equipmentIds);

    if (fetchError) throw fetchError;

    // Update equipment status and quantities
    for (const item of borrowedItems) {
      const equipment = currentEquipment?.find(e => e.id === item.inhouse_equipment_id);
      if (!equipment) {
        console.warn(`Equipment ${item.inhouse_equipment_id} not found`);
        continue;
      }

      const newQuantity = (equipment.quantity || 0) + item.quantity;

      const { error: updateError } = await this.supabaseService
        .from('inhouse')
        .update({
          status: 'Available',
          quantity: newQuantity
        })
        .eq('id', item.inhouse_equipment_id);

      if (updateError) throw updateError;

      returnedEquipmentNames.push(equipment.name);
    }

    // 3. Update borrow request status
    const { error: statusError } = await this.supabaseService
      .from('borrow_requests')
      .update({
        status: 'Returned',
        actual_return_date: returnDate.toISOString()
      })
      .eq('id', requestId);

    if (statusError) throw statusError;

    // 4. Create movement records
    const movementPromises = borrowedItems.map(async item => {
      const payload = {
        inhouse_equipment_id: item.inhouse_equipment_id,
        movement_type: 'returned',
        status: 'completed',
        borrow_request_id: requestId,
        movement_date: returnDate.toISOString(),
        employee_id: this.userEmail,
      };

      const { data, error } = await this.supabaseService
        .from('equipment_movements')
        .insert(payload)
        .select();

      if (error) throw error;
      return data;
    });

    await Promise.all(movementPromises);

    // 5. Log activities (only one return activity now)
    if (returnedEquipmentNames.length > 0) {
      const formattedDate = returnDate.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });

      await this.supabaseService.logActivity(
        'return_completed',
        '',
        `${borrowerName} returned ${returnedEquipmentNames.length} equipment(s) (${returnedEquipmentNames.join(', ')}) on ${formattedDate}`
      );
    }

    // 6. Refresh data and notify user
    this.fetchBorrowRequests();
    alert(`Successfully returned: ${returnedEquipmentNames.join(', ')}`);

  } catch (error) {
    console.error('❌ Return failed:', error);
    alert(`Return failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

  async refreshEquipmentList() {
    this.equipmentList = await this.supabaseService.getAvailableEquipment();
  }
}
