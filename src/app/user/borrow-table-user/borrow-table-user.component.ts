import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { NgIf, NgFor, NgClass } from '@angular/common';
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
import { ViewChild, AfterViewInit } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { NgTemplateOutlet } from '@angular/common';



import { DialogModule } from 'primeng/dialog';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

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
  imports: [NgIf, NgFor,NgClass, SidebarComponent, NgTemplateOutlet, MatPaginatorModule, MatCardModule, MatTooltipModule, MatDialogModule, FormsModule, MatIconModule ,MatTableModule, MatTableModule, DialogModule, ],
  templateUrl: './borrow-table-user.component.html',
  styleUrl: './borrow-table-user.component.css'
})
export class BorrowTableUserComponent implements OnInit, AfterViewInit {

displayedColumns: string[] = ['borrower_name', 'borrower_department', 'borrow_date', 'return_date', 'action'];
  dataSource = new MatTableDataSource<BorrowRequest>([]);

@ViewChild(MatPaginator) paginator!: MatPaginator;
@ViewChild(MatSort) sort!: MatSort;


  // borrowRequests: any[] = [];
  userEmail: string | null = null;
  filteredBorrowRequests: any[] = [];
  searchTerm: string = "";
  selectedBorrower: any | null = null;
  showDetailsModal: boolean = false;
  equipmentList: any[] = [];
  borrowedItems: any[] = [];
      borrowRequests: BorrowRequest[] = [];


  constructor(
    private router: Router,
    private supabaseService: SupabaseService,
    private authService: SupabaseAuthService,
    private sanitizer: DomSanitizer
  ) {}


  async ngOnInit() {
    await this.loadUserEmail();
    this.fetchBorrowRequests();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  async loadUserEmail() {
    const isLoggedIn = await this.authService.isLoggedIn();
    if (!isLoggedIn) {
      console.warn("⚠ No logged-in user detected.");
      return;
    }

    const user = await this.authService.getUser();

    if (user?.id) {
      this.userEmail = user.id;
      console.log("✅ Logged-in user ID:", this.userEmail);
    } else {
      console.warn("⚠ No user ID found.");
    }
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
    if (!this.userEmail) {
      console.warn("⚠ No user ID found. Skipping data fetch.");
      return;
    }

    console.log(`🔍 Fetching borrow requests for user ID: ${this.userEmail}`);

    // 1. Fetch basic request data (same as before)
    const { data: requests, error: requestsError } = await this.supabaseService
      .from('borrow_requests')
      .select(`id, user_id, borrow_date, return_date, borrower_name, 
              borrower_department, borrower_contact, borrower_email, purpose, status`)
      .eq('user_id', this.userEmail);

    if (requestsError) throw requestsError;
    if (!requests || requests.length === 0) {
      console.warn("⚠ No borrow requests found for user");
      return;
    }

    // 2. Process requests using the WORKING equipment query from your old code
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

        console.log(`🛠 Equipment data for request ${request.id}:`, equipmentData);

        // Process equipment data using the WORKING logic from old code
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

        const equipmentList = Array.from(equipmentMap.values());
        console.log(`📊 Final equipment list for request ${request.id}:`, equipmentList);
        
        return {
          ...request,
          equipmentList: equipmentList
        };
      })
    );

    // 3. Update both data sources
    this.borrowRequests = processedRequests;
    this.dataSource.data = this.borrowRequests;
    this.filteredBorrowRequests = [...this.borrowRequests]; // Maintain this for compatibility

    console.log('✅ Updated data with:', {
      borrowRequests: this.borrowRequests,
      dataSource: this.dataSource.data,
      sampleWithEquipment: this.borrowRequests.find(r => r.equipmentList?.length > 0)
    });

  } catch (error) {
    console.error('❌ Failed to load borrow requests:', error);
    alert('Error loading borrow requests. Please try again.');
  }
}
// async fetchBorrowRequests(): Promise<void> {
//   try {
//     if (!this.userEmail) {
//       console.warn("⚠ No user ID found. Skipping data fetch.");
//       return;
//     }

//     console.log(`🔍 Fetching borrow requests for user ID: ${this.userEmail}`);

//     // Fetch basic request data
//     const { data: requests, error: requestsError } = await this.supabaseService
//       .from('borrow_requests')
//       .select(`id, user_id, borrow_date, return_date, borrower_name, borrower_department, 
//               borrower_contact, borrower_email, purpose, status`)
//       .eq('user_id', this.userEmail);

//     if (requestsError) throw requestsError;

//     // Process each request with equipment data
//     const processedRequests = await Promise.all(
//       requests.map(async (request) => {
//         const { data: equipmentData, error: equipmentError } = await this.supabaseService
//           .from('borrow_request_equipment')
//           .select(`
//             inhouse_equipment_id,
//             quantity,
//             inhouse!borrow_request_equipment_inhouse_equipment_id_fkey (name, images)
//           `)
//           .eq('borrow_request_id', request.id);

//         if (equipmentError) {
//           console.error('❌ Error fetching equipment:', equipmentError);
//           return { ...request, equipmentList: [] };
//         }

//         // Process equipment data
//         const equipmentMap = new Map<string, any>();
//         equipmentData.forEach((bre: any) => {
//           const equipmentName = bre.inhouse?.name || "Unknown Equipment";
//           const equipmentImage = bre.inhouse?.images?.[0] || "assets/no-image.png";

//           if (equipmentMap.has(equipmentName)) {
//             equipmentMap.get(equipmentName).quantity += bre.quantity;
//           } else {
//             equipmentMap.set(equipmentName, {
//               name: equipmentName,
//               quantity: bre.quantity || 0,
//               image: equipmentImage
//             });
//           }
//         });

//         return {
//           ...request,
//           equipmentList: Array.from(equipmentMap.values())
//         };
//       })
//     );

//     // Update both the data source and borrowRequests
//     this.borrowRequests = processedRequests;
//     this.dataSource.data = this.borrowRequests; // This is the critical line for Material Table
//     console.log('✅ Updated dataSource with:', this.dataSource.data);

//   } catch (error) {
//     console.error('❌ Failed to load borrow requests:', error);
//     alert('Error loading borrow requests. Please try again.');
//   }
// }

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


  // ✅ Fetch latest equipment data after returning
  async refreshEquipmentList() {
    this.equipmentList = await this.supabaseService.getAvailableEquipment();
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

    // ✅ Ensure `split()` is not called on undefined values
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
  closeDetailsModal() {
    this.showDetailsModal = false;
    this.selectedBorrower = null;
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
}
