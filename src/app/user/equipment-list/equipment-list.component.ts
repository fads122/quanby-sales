import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SidebarComponent } from '../../nav/sidebar/sidebar.component';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { RouterLink } from '@angular/router';
import Chart from 'chart.js/auto';
import { BarcodeFormat } from '@zxing/library'; // ✅ Import BarcodeFormat enum
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatInputModule } from '@angular/material/input';
import { MatDialogModule } from '@angular/material/dialog';
import { ChangeDetectorRef } from '@angular/core';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { MatDialog } from '@angular/material/dialog';
import { AddEquipmentComponent } from '../add-equipment/add-equipment.component';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ReactiveFormsModule } from '@angular/forms'; // Add this


interface RepairLog {
  repair_details?: string;
  repair_status?: string;
  repair_date?: string | Date;
}

interface GroupedEquipment {
  name: string;
  quantity: number;
  product_images?: string[]; // Now optional
  items: any[];
  expanded: boolean;
  status: string;
  lastUpdated?: string; // Added property to fix the error
}

@Component({
  selector: 'app-equipment-list',
  standalone: true,
  imports: [CommonModule, SidebarComponent, FormsModule, TableModule, MatTableModule,
    MatSelectModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatExpansionModule,
    MatInputModule,
    MatDialogModule,
    MatSnackBarModule], // ✅ No need to import ZXingScannerModule
  templateUrl: './equipment-list.component.html',
  styleUrls: ['./equipment-list.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  animations: [ // <-- Place it here inside @Component
    trigger('expandCollapse', [
      state('collapsed', style({
        height: '0',
        opacity: 0,
        overflow: 'hidden',
        padding: '0',
        margin: '0',
        border: 'none'
      })),
      state('expanded', style({
        height: '*',
        opacity: 1,
        overflow: 'visible'
      })),
      transition('expanded => collapsed', [
        animate('250ms cubic-bezier(0.4, 0.0, 0.2, 1)',
          style({ height: '0', opacity: 0 }))
      ]),
      transition('collapsed => expanded', [
        animate('300ms cubic-bezier(0.0, 0.0, 0.2, 1)',
          style({ height: '*', opacity: 1 }))
      ]),
    ]),
    trigger('rotateChevron', [
      state('collapsed', style({
        transform: 'rotate(0deg)',
        color: '#666'
      })),
      state('expanded', style({
        transform: 'rotate(90deg)',
        color: '#2B30C3'
      })),
      transition('collapsed <=> expanded', [
        animate('200ms ease-out')
      ]),
    ]),
    trigger('tableSwitch', [
      transition(':increment, :decrement', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),

    // Fade animation for content
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms ease-out', style({ opacity: 0 }))
      ])
    ])
  ]
})

export class EquipmentListComponent implements OnInit {
  equipmentList: any[] = [];
  groupedEquipment: { [key: string]: GroupedEquipment } = {};
  filteredEquipmentList: any[] = [];
  isQRCodeModalOpen = false;
  selectedQRCode: string | null = null;
  searchQuery: string = '';
  currentPage = 1;
  pageSize = 5;
  totalPages = 1;
  paginatedEquipmentList = [];
  selectedEquipment: any = null;
  showDetails: boolean = false;
  showQRCode: boolean = false;
  isBarcodeModalOpen = false;
  selectedBarcode: string | null = null;
  scannedData: any;
  isScanning = false;
  barcodeFormats: BarcodeFormat[] = [BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128];
  expandedEquipment: any = null;
  equipment: any;
  showTrash = false;
  isTrashModalOpen = false;
  trashedEquipmentList: any[] = [];
  trashReason: string = '';
  equipmentToTrashId: string | null = null;
  isMoveToTrashModalOpen = false;
  private scannerBuffer: string = "";
  private scannerTimeout: any = null;
  isScannedEquipmentModalOpen = false; // ✅ Controls modal visibility
  isAddEquipmentModalOpen = false;
  selectedEquipmentType: string = 'inhouse';
  isLoading: boolean = false; // Added property to track loading state
  allEquipment: any[] = [];
  selectedTable: 'inhouse' | 'equipments' = 'equipments';
  tableSwitchState = 0;
  // Removed duplicate declaration to resolve type conflict

  ownershipOptions = [
  { label: 'All Ownership Types', value: null },
  { label: 'Government', value: 'government' },
  { label: 'Private', value: 'private' },
  { label: 'Unspecified', value: '' } // For empty/null values
];


dropdownOpen = false;
selectedOwnership: string | null = null;

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private cdRef: ChangeDetectorRef,
    public dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  async ngOnInit() {
    this.selectedTable = 'inhouse'; // Default to operational equipment
    this.isLoading = true; // Set loading state to true

    try {
      // Fetch data
      this.equipmentList = await this.supabaseService.getEquipmentList() || [];
      console.log("📋 Loaded Equipment List:", this.equipmentList);

      this.filteredEquipmentList = [...this.equipmentList];
      console.log("🛠 ngOnInit() is running...");

      await this.loadEquipment();

      // Listen for scanner input
      window.addEventListener('keydown', this.handleScannerInput.bind(this));
    } catch (error) {
      console.error('Error initializing equipment list:', error);
    } finally {
      // Ensure a minimum loading time of 1 second for better UX
      setTimeout(() => {
        this.isLoading = false;
      }, 1000);
    }
  }

  // Add this method to your EquipmentListComponent class
openImagePreview(imageUrl: string) {
  window.open(imageUrl, '_blank');
}

getEquipmentIcon(equipmentGroup: any): string {
  // Example logic: return different icons based on equipment group name or type
  if (!equipmentGroup || !equipmentGroup.name) {
    return 'pi pi-box equipment-icon';
  }
  switch (equipmentGroup.name.toLowerCase()) {
    case 'audio':
      return 'pi pi-volume-up equipment-icon';
    case 'lighting':
      return 'pi pi-lightbulb equipment-icon';
    case 'video':
      return 'pi pi-video equipment-icon';
    default:
      return 'pi pi-box equipment-icon';
  }
}

getStatusSeverity(status: string): string {
  switch ((status || '').toLowerCase()) {
    case 'active':
    case 'available':
      return 'success';
    case 'inactive':
    case 'unavailable':
      return 'danger';
    case 'maintenance':
      return 'warning';
    case 'reserved':
      return 'info';
    default:
      return 'secondary';
  }
}


openEquipmentModal() {
  const dialogRef = this.dialog.open(AddEquipmentComponent, {
    width: '1000px',
    maxWidth: '90vw',  // Add responsive max width
    panelClass: 'equipment-dialog-container',  // Add custom panel class
    data: {
      isEditMode: false,
      equipmentDataArray: [],
      suppliers: []
    }
  });

  dialogRef.afterClosed().subscribe(result => {
    if (result?.success) {
      console.log("✅ Equipment added, refreshing list...");
      this.loadEquipment();
    }
  });
}
  // openEquipmentModal() {
  //   const dialogRef = this.dialog.open(AddEquipmentComponent, {
  //     width: '800px',
  //     data: {
  //       isEditMode: false,
  //       equipmentDataArray: [],
  //       suppliers: []
  //     }
  //   });

  //   dialogRef.afterClosed().subscribe(result => {
  //     if (result?.success) {
  //       console.log("✅ Equipment added, refreshing list...");
  //       this.loadEquipment(); // ✅ Refresh equipment list
  //     }
  //   });
  // }


  ngOnDestroy() {
    window.removeEventListener('keydown', this.handleScannerInput.bind(this));
  }

  openScannedEquipmentModal() {
    this.isScannedEquipmentModalOpen = true;
  }

  closeScannedEquipmentModal() {
    this.isScannedEquipmentModalOpen = false;
  }

  toggleGroupExpansion(equipmentGroup: GroupedEquipment) {
  // Close all other groups if this one is being opened
  if (!equipmentGroup.expanded) {
    this.filteredEquipmentList.forEach(group => {
      if (group !== equipmentGroup) {
        group.expanded = false;
      }
    });
  }

  equipmentGroup.expanded = !equipmentGroup.expanded;

  // Force change detection to ensure animation triggers
  this.cdRef.detectChanges();

  // Optional: Scroll to keep the expanded section in view
  if (equipmentGroup.expanded) {
    setTimeout(() => {
      const element = document.querySelector(`tr.expanded-row`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 300);
  }
}

handleScannerInput(event: KeyboardEvent) {
  // Ignore special keys and modifiers
  if (event.key === 'Shift' || event.key === 'Control' || event.key === 'Alt' ||
      event.key === 'Meta' || event.key === 'CapsLock' || event.key.length > 1) {
    return;
  }

  // Ignore manual typing in input fields
  if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    console.log("⚠ Ignoring input field typing...");
    return;
  }

  // If "Enter" key is pressed, process immediately
  if (event.key === 'Enter') {
    console.log("🚀 Enter key pressed! Processing buffer:", this.scannerBuffer);
    this.processScannedCode(this.scannerBuffer);
    this.scannerBuffer = "";
    return;
  }

  // Append regular characters to buffer
  this.scannerBuffer += event.key;
  console.log("📌 Scanner Buffer:", this.scannerBuffer);

  // Reset buffer if no input received within 500ms
  clearTimeout(this.scannerTimeout);
  this.scannerTimeout = setTimeout(() => {
    if (this.scannerBuffer.trim()) {
      console.log("🔄 Processing scanned code...");
      this.processScannedCode(this.scannerBuffer);
    }
    this.scannerBuffer = "";
  }, 500);
}


async processScannedCode(scannedCode: string) {
  console.log("🔎 processScannedCode() called with:", scannedCode);

  if (!scannedCode.trim()) {
    console.warn("⚠ Scanned code is empty");
    return;
  }

  let equipmentData = await this.supabaseService.getInHouseEquipment();
  console.log("📋 Fetched Equipment Data:", equipmentData);

  let matchedEquipment = equipmentData?.find(equipment =>
    equipment.qr_code === scannedCode ||
    equipment.barcode === scannedCode
  );

  if (!matchedEquipment && scannedCode.includes('-')) {
    const parts = scannedCode.split('-');
    const name = parts[parts.length - 1].trim();

    console.log("🔍 Looking for equipment with name:", name);

    matchedEquipment = equipmentData?.find(equipment => {
      const nameMatch = equipment.name?.toLowerCase() === name.toLowerCase();
      console.log(`Comparing: "${equipment.name}" with "${name}" = ${nameMatch}`);
      return nameMatch;
    });
  }

  if (matchedEquipment) {
    console.log("✅ Equipment Found:", matchedEquipment);

    this.scannedData = {
      ...matchedEquipment,
      serial_no: matchedEquipment.serial_number,
      model: matchedEquipment.product_type,
      barcode: matchedEquipment.barcode,
      repair_logs: []
    };

    if (matchedEquipment.id) {
      const repairLogs = await this.supabaseService.getEquipmentRepairLogs(matchedEquipment.id);
      this.scannedData.repair_logs = Array.isArray(repairLogs) ? repairLogs : [];
    }

    console.log("📊 Barcode data:", this.scannedData.barcode);

    this.expandedEquipment = matchedEquipment;
    this.isScannedEquipmentModalOpen = true;
    this.cdRef.detectChanges();
  } else {
    console.warn("⚠ No matching equipment found");
    this.snackBar.open('No matching equipment found for the scanned code.', 'Close', {
      duration: 3000,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: ['warning-snackbar']
    });
  }
}

  // ✅ Open Move to Trash Modal
openMoveToTrashModal(id: string) {
  this.equipmentToTrashId = id;
  this.trashReason = '';
  this.isMoveToTrashModalOpen = true;
}

// ✅ Close Move to Trash Modal
closeMoveToTrashModal() {
  this.isMoveToTrashModalOpen = false;
  this.trashReason = '';
  this.equipmentToTrashId = null;
}

 // ✅ Handle scan errors (for debugging)
 onScanError(error: any) {
  console.error("❌ Scan Error:", error);
}

// ✅ Confirm Move to Trash with Reason
async confirmMoveToTrash() {
  if (!this.equipmentToTrashId || !this.trashReason.trim()) {
    this.snackBar.open('Please provide a reason before moving to trash.', 'Close', {
      duration: 3000,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: ['warning-snackbar']
    });
    return;
  }

  const success = await this.supabaseService.softDeleteEquipment(this.equipmentToTrashId, this.trashReason);
  if (success) {
    this.snackBar.open('Equipment successfully moved to trash.', 'Close', {
      duration: 3000,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: ['success-snackbar']
    });

    console.log(`✅ Equipment moved to trash with reason: ${this.trashReason}`);

    await this.loadEquipment();
    this.closeMoveToTrashModal();
  } else {
    this.snackBar.open('Failed to move equipment to trash.', 'Close', {
      duration: 3000,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: ['error-snackbar']
    });
  }
}


async openTrashModal() {
  this.isTrashModalOpen = true;
  this.trashedEquipmentList = await this.supabaseService.getTrashedEquipment(); // ✅ Ensure correct function is used
  console.log("🗑 Trashed Equipment Loaded:", this.trashedEquipmentList);
}

    // ✅ Close Trash Bin Modal
    closeTrashModal() {
      this.isTrashModalOpen = false;
    }

    toggleTrashView() {
      this.showTrash = !this.showTrash;
      this.loadEquipment(); // 🔄 Reload equipment list
    }

    openBarcodeModal(barcodeUrl: string | null) {
      console.log("🔍 Opening barcode modal with URL:", barcodeUrl); // Add debug log

      if (!barcodeUrl) {
        console.warn("⚠ No Barcode available.");
        return;
      }

      this.selectedBarcode = barcodeUrl;
      this.isBarcodeModalOpen = true;
      this.cdRef.detectChanges(); // Force update
    }

  closeBarcodeModal() {
    this.isBarcodeModalOpen = false;
    this.selectedBarcode = null;
  }

toggleScanner() {
  this.isScanning = !this.isScanning;
}

toggleDetails(equipment: any) {
  console.log("🔹 Toggling Details for:", equipment);

  if (equipment && equipment.items && equipment.items.length > 0) {
    console.log("✅ Expanding dropdown with items:", equipment.items);

    // Check if QR Code and Barcode exist
    equipment.items.forEach((item: any) => {
      console.log(`📌 ${item.name} - QR Code: ${item.qr_code} | Barcode: ${item.barcode}`);
    });

    // Toggle the expanded state for equipment details
    if (this.expandedEquipment === equipment) {
      this.expandedEquipment = null;
      this.showDetails = false; // Collapse the details
    } else {
      this.expandedEquipment = equipment;
      this.showDetails = true; // Expand the details
    }
  } else {
    console.warn("⚠ No items found for this equipment:", equipment);
    this.expandedEquipment = null;
    this.showDetails = false; // Collapse if no items
  }
}


onScanSuccess(event: any) {
  console.log("🚀 Raw Scan Data:", event);

  if (!event || !event.text) {
    console.warn("⚠ No scanned text detected.");
    return;
  }

  let scannedCode = event.text.trim();
  console.log("✅ Scanned Code:", scannedCode);

  // ✅ Extract only the Equipment ID (before "-")
  const extractedID = scannedCode.split("-")[0].trim();
  console.log("🔍 Extracted Equipment ID:", extractedID);

  // 🔎 Find the equipment in the list
  this.scannedData = this.equipmentList.find(e =>
    String(e.id) === extractedID ||
    String(e.barcode) === scannedCode ||
    String(e.qr_code) === scannedCode
  );

  if (this.scannedData) {
    console.log("✅ Matched Equipment Found:", this.scannedData);
  } else {
    console.warn("⚠ No matching equipment found for:", extractedID);
  }

  this.isScanning = false; // ✅ Hide scanner after success

  this.cdRef.detectChanges(); // 🚀 Force Angular to update UI
}

onEquipmentTypeChange(selectedType: string) {
  this.selectedEquipmentType = selectedType;
  this.loadEquipment();  // Reload equipment list based on new type
}

async loadEquipment() {
  console.log("⚡ Executing loadEquipment() for table:", this.selectedTable);
  console.log("Loaded equipment with ownership types:", 
  this.equipmentList.map(e => ({name: e.name, ownership: e.ownership_type})));

  try {
    let equipmentData;
    let isInHouseTable = this.selectedTable === 'inhouse';

    // Step 1: Fetch Equipment List based on selected table
    if (isInHouseTable) {
      equipmentData = await this.supabaseService.getInHouseEquipment();
      // Transform inhouse data to match common structure with null checks
      equipmentData = (equipmentData || []).map(item => ({
        ...item,
        id: item?.id?.toString() || '', // Safe conversion
        serial_no: item?.serial_number || '',
        model: item?.product_type || '',
        supplier_cost: 0,
        srp: 0,
        status: 'Available'
      }));
    } else {
      equipmentData = await this.supabaseService.getEquipmentList();
    }

    if (!equipmentData) {
      console.warn("No equipment data received");
      this.equipmentList = [];
      this.groupEquipment();
      return;
    }

    // Step 2: Deduplicate equipment entries by ID with null checks
    const uniqueEquipmentMap = new Map<string, any>();
    equipmentData.forEach((equipment) => {
      if (!equipment?.id) {
        console.warn("Skipping equipment with missing ID:", equipment);
        return;
      }

      const equipmentId = equipment.id.toString(); // Safe toString() call
      if (!uniqueEquipmentMap.has(equipmentId)) {
        uniqueEquipmentMap.set(equipmentId, {
          ...equipment,
          status: 'Available' // Default status
        });
      } else {
        const existingEquipment = uniqueEquipmentMap.get(equipmentId);
        if (existingEquipment) {
          existingEquipment.quantity = (existingEquipment.quantity || 0) + (equipment.quantity || 0);
        }
      }
    });

    this.equipmentList = Array.from(uniqueEquipmentMap.values());
    console.log("📌 Unique Equipment List:", this.equipmentList);

    // Only fetch assignments and movements for in-house equipment
    if (isInHouseTable) {
      // Step 3: Fetch Assigned Equipment with error handling
      const assignedMaterials = await this.supabaseService.getAssignedEquipment().catch(error => {
        console.error("Error fetching assigned equipment:", error);
        return [];
      });
      console.log("📌 Assigned Equipment Data:", assignedMaterials);

      const assignedEquipmentMap = new Map<string, number>();
      (assignedMaterials || []).forEach((item) => {
        // Handle both equipment_id and inhouse_id cases
        const equipmentRef = item?.equipment_id || item?.inhouse_id;
        if (!equipmentRef) {
          console.warn("⚠ Skipping entry with missing equipment reference:", item);
          return;
        }

        const equipmentId = equipmentRef.toString(); // Safe conversion
        assignedEquipmentMap.set(
          equipmentId,
          (assignedEquipmentMap.get(equipmentId) || 0) + (item.quantity || 0)
        );
      });

      console.log("📌 Assigned Equipment Map:", assignedEquipmentMap);

      // Step 4: Fetch Equipment Movements with error handling
      const movementData = await this.supabaseService.getEquipmentMovements().catch(error => {
        console.error("Error fetching equipment movements:", error);
        return [];
      });
      console.log("📌 Equipment Movement Data:", movementData);

      // Step 5: Process Equipment Data & Assign Status with null checks
      for (const equipment of this.equipmentList) {
        if (!equipment?.id) {
          console.warn(`⚠ Equipment ${equipment?.name || 'unnamed'} has no valid ID!`);
          continue;
        }

        const equipmentId = equipment.id.toString(); // Safe conversion
        const assignedQty = assignedEquipmentMap.get(equipmentId) || 0;
        const originalQuantity = equipment.quantity || 0;
        const finalQuantity = Math.max(originalQuantity - assignedQty, 0);

        console.log(
          `🔹 Equipment: ${equipment.name} | ID: ${equipmentId} | Assigned: ${assignedQty} | Original: ${originalQuantity} | Final: ${finalQuantity}`
        );

        equipment.quantity = finalQuantity;

        // Determine Equipment Status (Latest Movement) with null checks
        const latestMovement = (movementData || []).find(m => {
          const movementEquipmentId = m?.equipment_id?.toString() || '';
          return movementEquipmentId === equipmentId;
        });

        if (latestMovement) {
          switch (latestMovement.movement_type) {
            case "borrowed": equipment.status = "Borrowed"; break;
            case "in use": equipment.status = "In Use"; break;
            case "returned": equipment.status = "Returned"; break;
            default: equipment.status = "Available";
          }
        } else {
          equipment.status = "Available";
        }
      }
    }

    console.log("✅ Final Updated Equipment Status:", this.equipmentList);
    this.groupEquipment();

  } catch (error) {
    console.error("❌ Error loading equipment:", error);
    this.equipmentList = [];
    this.groupEquipment();
  }
}

groupEquipment(list: any[] = this.equipmentList) {
  // Clear previous grouping
  this.groupedEquipment = {};

  list.forEach(item => {
    // Use model as the primary grouping key, fallback to name if model doesn't exist
    const groupKey = item.model?.trim().toLowerCase() ||
                    `unnamed_${item.name?.trim().toLowerCase()}` ||
                    'uncategorized';

    if (!this.groupedEquipment[groupKey]) {
      this.groupedEquipment[groupKey] = {
        name: item.model || item.name || 'Unnamed Equipment',
        quantity: 0,
        product_images: item.product_images || [],
        status: 'Available',
        items: [],
        expanded: false,
        lastUpdated: item.updated_at || item.created_at || new Date().toISOString()
      };
    }

    // Add item to group
    this.groupedEquipment[groupKey].items.push(item);

    // Calculate total quantity
    this.groupedEquipment[groupKey].quantity += item.quantity || 0;

    // Determine group status (show most "active" status)
    if (item.status === 'Borrowed') {
      this.groupedEquipment[groupKey].status = 'Borrowed';
    } else if (item.status === 'In Use' && this.groupedEquipment[groupKey].status !== 'Borrowed') {
      this.groupedEquipment[groupKey].status = 'In Use';
    } else if (item.status === 'Returned' &&
               this.groupedEquipment[groupKey].status !== 'Borrowed' &&
               this.groupedEquipment[groupKey].status !== 'In Use') {
      this.groupedEquipment[groupKey].status = 'Returned';
    }

    // Update lastUpdated to the most recent item
    const itemDate = new Date(item.updated_at || item.created_at);
    const groupDate = new Date(this.groupedEquipment[groupKey].lastUpdated || new Date().toISOString());
    if (itemDate > groupDate) {
      this.groupedEquipment[groupKey].lastUpdated = item.updated_at || item.created_at;
    }
  });

  // Convert to array and sort by model name
  this.filteredEquipmentList = Object.values(this.groupedEquipment)
    .sort((a, b) => a.name.localeCompare(b.name));
}

  getTotalQuantity(group: any[]): number {
    return group.reduce((sum, item) => sum + item.quantity, 0);
  }

  getGroupValue(group: any[]): number {
    return group.reduce((sum, item) => sum + (item.quantity * item.srp), 0);
  }

  getStatusClass(timeRemaining: number, status?: string): string {
  if (status) {
    switch (status.toLowerCase()) {
      case 'borrowed': return 'status-borrowed';  // Red
      case 'in use': return 'status-in-use';      // Orange
      case 'returned': return 'status-returned';  // Blue
      case 'available': return 'status-available';// Green
      default: return 'status-unknown';           // Gray (for unexpected values)
    }
  }

  // If no status is provided, fallback to time-based logic
  if (timeRemaining <= 0) {
    return 'expired';  // Red
  } else if (timeRemaining <= 60) {
    return 'warning';  // Orange
  } else {
    return 'safe';     // Green
  }
}

// Add table change handler
// Update your onTableChange method to trigger animations
async onTableChange(newTable: 'inhouse' | 'equipments') {
  this.tableSwitchState++;
  this.isLoading = true;
  this.cdRef.detectChanges();

  await new Promise(resolve => setTimeout(resolve, 50));

  this.selectedTable = newTable;
  this.searchQuery = ''; // Reset search filter
  await this.loadEquipment();

  this.isLoading = false;
}


editEquipment(equipment: any) {
  const dialogRef = this.dialog.open(AddEquipmentComponent, {
    width: '800px',
    data: {
      isEditMode: true,
      equipmentData: equipment, // Pass the specific equipment item
      suppliers: []
    }
  });

  dialogRef.afterClosed().subscribe(result => {
    if (result) {
      this.loadEquipment();
    }
  });
}

  async deleteEquipment(id: string) {
    const dialogRef = this.dialog.open(DeleteConfirmationDialog, {
      width: '300px',
      data: { message: 'Are you sure you want to delete this equipment?' }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        const success = await this.supabaseService.deleteEquipment(id);

        if (success) {
          console.log('✅ Equipment deleted:', id);
          this.snackBar.open('Equipment successfully deleted.', 'Close', {
            duration: 3000,
            horizontalPosition: 'right',
            verticalPosition: 'top',
            panelClass: ['success-snackbar']
          });

          this.equipmentList = this.equipmentList.filter(equipment => equipment.id !== id);
          this.filteredEquipmentList = this.filteredEquipmentList.filter(equipment => equipment.id !== id);
          this.groupEquipment();

          this.cdRef.detectChanges();
        } else {
          this.snackBar.open('Failed to delete equipment.', 'Close', {
            duration: 3000,
            horizontalPosition: 'right',
            verticalPosition: 'top',
            panelClass: ['error-snackbar']
          });
        }
      }
    });
  }

  viewDetails(equipmentGroup: any) {
    if (equipmentGroup.items && equipmentGroup.items.length > 0) {
      this.viewEquipmentDetails(equipmentGroup.items[0].id);
    }
  }


 // equipment-list.component.ts
 viewEquipmentDetails(equipmentId: string) {
  console.log('Attempting to navigate to equipment details with ID:', equipmentId);

  if (!equipmentId) {
    console.error('Invalid equipment ID:', equipmentId);
    return;
  }

  const equipment = this.equipmentList.find(item => item.id === equipmentId);

  // Determine the route based on the selected table
  const routePath = this.selectedTable === 'inhouse'
    ? '/operational-equipment-details'
    : '/equipment-details';

  this.router.navigate([routePath, equipmentId], {
    state: {
      equipmentData: equipment,
      fromTable: this.selectedTable // Use the current table selection
    }
  }).then(navigationSuccess => {
    if (!navigationSuccess) {
      console.error('Navigation failed');
    }
  }).catch(err => {
    console.error('Navigation error:', err);
  });
}


openQRCodeModal(qrCodeUrl: string | null) {
  if (!qrCodeUrl) {
    console.warn("⚠ No QR Code available.");
    return;
  }

  console.log("✅ Opening QR Code Modal with URL:", qrCodeUrl);
  this.selectedQRCode = qrCodeUrl;
  this.isQRCodeModalOpen = true;
}

closeQRCodeModal() {
  this.isQRCodeModalOpen = false;
  this.selectedQRCode = null;
}

  showQRCodeModal(equipment: any) {
    this.selectedEquipment = equipment;
    this.showQRCode = true;
  }


  getConditionClass(condition: string): string {
    return condition.toLowerCase() === 'new' ? 'condition-new' : 'condition-used';
  }

  getDamagedClass(damaged: boolean): string {
    return damaged ? 'damaged' : 'not-damaged';
  }

  printQRCode() {
    if (!this.selectedQRCode) {
      console.warn("⚠ No QR Code available for printing.");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print QR Code</title>
            <style>
              @media print {
                @page {
                  size: 127mm 50.8mm; /* ✅ 5 inches x 2 inches */
                  margin: 0; /* ✅ No extra margin */
                }
                body {
                  width: 127mm;
                  height: 50.8mm;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  text-align: center;
                  font-family: Arial, sans-serif;
                  margin: 0;
                  padding: 5mm;
                  box-sizing: border-box;
                }
                img {
                  width: 40mm; /* ✅ Centered & well-sized */
                  height: auto;
                  margin-bottom: 3mm;
                }
                h2 {
                  font-size: 14px;
                  margin: 0;
                }
              }
            </style>
          </head>
          <body>
            <h2>QR Code</h2>
            <img src="${this.selectedQRCode}" alt="QR Code">
            <script>
              window.onload = function() {
                window.print();
                window.close();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      console.error("❌ Failed to open print window.");
    }
  }

  printBarcode() {
    if (!this.selectedBarcode) {
      console.warn("⚠ No Barcode available for printing.");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Barcode</title>
            <style>
              @media print {
                @page {
                  size: 80mm 40mm; /* ✅ Fixed size for one-page printing */
                  margin: 0;
                }
                body {
                  width: 80mm;
                  height: 40mm;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  text-align: center;
                  font-family: Arial, sans-serif;
                  margin: 0;
                  padding: 5mm;
                  box-sizing: border-box;
                }
                img {
                  width: 70mm; /* ✅ Fit the barcode properly */
                  height: auto;
                  margin-bottom: 3mm;
                }
                h2 {
                  font-size: 14px;
                  margin: 0;
                }
              }
            </style>
          </head>
          <body>
            <h2>Barcode</h2>
            <img src="${this.selectedBarcode}" alt="Barcode">
            <script>
              window.onload = function() {
                window.print();
                window.close();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      console.error("❌ Failed to open print window.");
    }
  }


  async moveToTrash(id: string) {
    if (!this.trashReason.trim()) {
      this.snackBar.open('Please provide a reason before moving to trash.', 'Close', {
        duration: 3000,
        horizontalPosition: 'right',
        verticalPosition: 'top',
        panelClass: ['warning-snackbar']
      });
      return;
    }

    const dialogRef = this.dialog.open(DeleteConfirmationDialog, {
      width: '300px',
      data: { message: 'Are you sure you want to move this equipment to trash?' }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        const success = await this.supabaseService.softDeleteEquipment(id, this.trashReason);
        if (success) {
          console.log(`✅ Equipment ID ${id} moved to trash.`);
          this.snackBar.open('Equipment moved to trash successfully.', 'Close', {
            duration: 3000,
            horizontalPosition: 'right',
            verticalPosition: 'top',
            panelClass: ['success-snackbar']
          });
          await this.loadEquipment();
          this.closeMoveToTrashModal();
        } else {
          console.error(`❌ Failed to move equipment ID ${id} to trash.`);
          this.snackBar.open('Failed to move equipment to trash.', 'Close', {
            duration: 3000,
            horizontalPosition: 'right',
            verticalPosition: 'top',
            panelClass: ['error-snackbar']
          });
        }
      }
    });
  }


  async restoreEquipment(id: string) {
    const dialogRef = this.dialog.open(DeleteConfirmationDialog, {
      width: '300px',
      data: { message: 'Restore this equipment?' }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        const success = await this.supabaseService.restoreEquipment(id);
        if (success) {
          this.snackBar.open('Equipment restored successfully.', 'Close', {
            duration: 3000,
            horizontalPosition: 'right',
            verticalPosition: 'top',
            panelClass: ['success-snackbar']
          });
          await this.loadEquipment();
          this.groupEquipment();
        } else {
          this.snackBar.open('Failed to restore equipment.', 'Close', {
            duration: 3000,
            horizontalPosition: 'right',
            verticalPosition: 'top',
            panelClass: ['error-snackbar']
          });
        }
      }
    });
  }


  async permanentlyDeleteEquipment(id: string) {
    const dialogRef = this.dialog.open(DeleteConfirmationDialog, {
      width: '300px',
      data: { message: 'This action is irreversible. Permanently delete?' }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        const success = await this.supabaseService.permanentlyDeleteEquipment(id);
        if (success) {
          this.snackBar.open('Equipment permanently deleted.', 'Close', {
            duration: 3000,
            horizontalPosition: 'right',
            verticalPosition: 'top',
            panelClass: ['success-snackbar']
          });
          this.trashedEquipmentList = this.trashedEquipmentList.filter(item => item.id !== id);
        } else {
          this.snackBar.open('Failed to delete the equipment.', 'Close', {
            duration: 3000,
            horizontalPosition: 'right',
            verticalPosition: 'top',
            panelClass: ['error-snackbar']
          });
        }
      }
    });
  }
 

//   applyFilter() {
//   const query = this.searchQuery.toLowerCase().trim();

//   // Get all equipment items based on selected table (inhouse/equipments)
//   let items = this.equipmentList.filter(equipment => 
//     this.selectedTable === 'inhouse' 
//       ? equipment.product_type // Operational items
//       : !equipment.product_type // For-sale items
//   );


//   // Apply search query if present
//   if (query) {
//     items = items.filter(equipment => 
//       (equipment.model?.toLowerCase().includes(query)) ||
//       (equipment.name?.toLowerCase().includes(query)) ||
//       (equipment.brand?.toLowerCase().includes(query)) ||
//       (equipment.serial_no?.toLowerCase().includes(query))
//     );
//   }

//   // Apply ownership filter if selected
//   if (this.selectedOwnership) {
//     items = items.filter(equipment => 
//       equipment.ownership_type === this.selectedOwnership
//     );
//   }

//   // Group the filtered items
//   this.groupEquipment(items);
// }

applyFilter() {
  console.log("Current ownership types in data:", 
        this.equipmentList.map(e => e.ownership_type));
  const query = this.searchQuery.toLowerCase().trim();
  
  // Start with all equipment
  let items = [...this.equipmentList];

  // Apply search filter if query exists
  if (query) {
    items = items.filter(equipment => 
      (equipment.model?.toLowerCase().includes(query)) ||
      (equipment.name?.toLowerCase().includes(query)) ||
      (equipment.brand?.toLowerCase().includes(query)) ||
      (equipment.serial_no?.toLowerCase().includes(query))
    );
  }

  // Apply ownership filter
  if (this.selectedOwnership !== null) {
    if (this.selectedOwnership === '') {
      // Show items with empty/null ownership
      items = items.filter(equipment => 
        !equipment.ownership_type || equipment.ownership_type.trim() === ''
      );
    } else {
      // Show items with matching ownership (case insensitive)
      items = items.filter(equipment => 
        equipment.ownership_type?.toLowerCase() === this.selectedOwnership?.toLowerCase()
      );
    }
  }

  // Group the filtered items
  this.groupEquipment(items);
}


toggleDropdown() {
  this.dropdownOpen = !this.dropdownOpen;
}

selectOption(value: string | null) {
  this.selectedOwnership = value;
  this.dropdownOpen = false;
  this.applyFilter();
}

getOwnershipLabel(value: string | null): string {
  if (value === 'government') return 'Government';
  if (value === 'private') return 'Private';
  return 'Ownership';
}

}

@Component({
  selector: 'delete-confirmation-dialog',
  template: `
    <h2 mat-dialog-title>Confirm Action</h2>
    <mat-dialog-content>{{ data.message }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">Cancel</button>
      <button mat-button [mat-dialog-close]="true" color="warn">Confirm</button>
    </mat-dialog-actions>
  `,
  standalone: true,
  imports: [MatDialogModule, MatButtonModule]
})
export class DeleteConfirmationDialog {
  constructor(
    public dialogRef: MatDialogRef<DeleteConfirmationDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { message: string }
  ) {}
}
