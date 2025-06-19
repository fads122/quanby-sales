import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { SidebarComponent } from "../../nav/sidebar/sidebar.component";
import { FormsModule } from '@angular/forms';

interface BorrowedItem {
  id: string;
  name: string;
  quantity: number;
  image: string;
  brand: string;
  model: string;
  serial_number: string;
  status: string; // Add status field
  statusReason?: string; // Optional field for inactive reason
  statusLocation?: string; // Optional field for location when inactive
  movement_id?: number; // Add movement ID for tracking
}

enum EquipmentStatus {
  AVAILABLE = 'Available',
  BORROWED = 'Borrowed',
  MAINTENANCE = 'Maintenance',
  WORKING = 'Working',
  INACTIVE = 'Inactive',
  OUT_OF_STOCK = 'Out of Stock'
}

@Component({
  selector: 'app-equipment-borrow',
  standalone: true,
  imports: [SidebarComponent, CommonModule, FormsModule],
  templateUrl: './equipment-borrow.component.html',
  styleUrl: './equipment-borrow.component.css'
})
export class EquipmentBorrowComponent implements OnInit {
  equipmentList: any[] = [];
  borrowedItems: BorrowedItem[] = [];
  displayedItems: any[] = [];
  selectedEquipment: any = null; // To store the specific equipment details
  showDetailsModal: boolean = false; // To control the modal visibility
  isCollapsed = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    // Initialize theme state
    this.initializeTheme();

    this.route.queryParams.subscribe(async params => {
      const selectedId = params['id'];
      const selectedName = params['name'];

      try {
        if (params['submitted'] === 'true') {
          localStorage.removeItem('borrowedItems');
        }

        const savedItems = localStorage.getItem('borrowedItems');
        this.borrowedItems = savedItems ? JSON.parse(savedItems) : [];

        const [allEquipment, borrowedEquipment] = await Promise.all([
          this.supabaseService.getInHouseEquipment(),
          this.supabaseService.getBorrowedEquipment()
        ]);

        const borrowedItemIds = new Set(
          borrowedEquipment.map((item: any) => item.inhouse_equipment_id)
        );

        this.equipmentList = allEquipment.map(equipment => {
          const isBorrowedInDB = borrowedItemIds.has(equipment.id);
          const isBorrowedLocally = this.borrowedItems.some(item => item.id === equipment.id);
          const isOutOfStock = equipment.quantity <= 0;

          // Priority 1: Check borrowed status or out of stock
          if (isBorrowedInDB || isBorrowedLocally || isOutOfStock) {
            return {
              ...equipment,
              quantity: equipment.quantity || 0,
              borrowed: true,
              status: EquipmentStatus.BORROWED
            };
          }

          // Priority 2: Check condition (Working or Inactive)
          if (equipment.condition === 'Working') {
            return {
              ...equipment,
              quantity: equipment.quantity || 0,
              borrowed: false,
              status: EquipmentStatus.WORKING
            };
          }

          if (equipment.condition === 'Inactive') {
            return {
              ...equipment,
              quantity: equipment.quantity || 0,
              borrowed: false,
              status: EquipmentStatus.INACTIVE
            };
          }

          // Priority 3: Check status from DB
          if (equipment.status && Object.values(EquipmentStatus).includes(equipment.status)) {
            return {
              ...equipment,
              quantity: equipment.quantity || 0,
              borrowed: false,
              status: equipment.status
            };
          }

          // Default status
          return {
            ...equipment,
            quantity: equipment.quantity || 0,
            borrowed: false,
            status: EquipmentStatus.AVAILABLE
          };
        });

        if (selectedId || selectedName) {
          this.equipmentList = this.equipmentList.filter(equipment =>
            (selectedId && equipment.id === selectedId) ||
            (selectedName && equipment.name === selectedName)
          );
        }

        this.cdr.markForCheck();
      } catch (error) {
        console.error('Error loading equipment:', error);
      }
    });
  }

  // Add method to handle sidebar collapse
  onSidebarCollapsed(collapsed: boolean) {
    this.isCollapsed = collapsed;
    this.cdr.detectChanges();
  }

  // Add method to handle theme changes from sidebar
  onSidebarThemeChange(theme: string) {
    // Update the document attribute to trigger CSS variable changes
    document.documentElement.setAttribute('data-theme', theme);
    this.cdr.detectChanges();
  }

  // Add method to initialize theme
  private initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    const currentTheme = savedTheme || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
  }

  async addToBorrowedList(equipmentId: string) {
    const equipment = this.equipmentList.find(e => e.id === equipmentId);

    if (!equipment) {
      alert('⚠ Equipment not found.');
      return;
    }

    if (equipment.status === EquipmentStatus.BORROWED) {
      alert('⚠ This item is already borrowed.');
      return;
    }

    if (equipment.status === EquipmentStatus.MAINTENANCE) {
      alert('⚠ This item is under maintenance and cannot be borrowed.');
      return;
    }

    if (equipment.status === EquipmentStatus.WORKING) {
      alert('⚠ This item is currently in use and cannot be borrowed.');
      return;
    }

    if (equipment.status === EquipmentStatus.INACTIVE) {
      alert('⚠ This item is inactive and cannot be borrowed.');
      return;
    }

    try {
      const borrowedItem = {
        id: equipment.id,
        name: equipment.name,
        quantity: 1,
        image: this.getValidImage(equipment),
        brand: equipment.brand || 'N/A',
        model: equipment.model || 'N/A',
        serial_number: equipment.serial_number || 'N/A',
        status: EquipmentStatus.BORROWED,
        movement_id: Date.now()
      };

      // Update local state
      equipment.status = EquipmentStatus.BORROWED;
      equipment.borrowed = true;

      // Update borrowed items list
      this.borrowedItems = this.borrowedItems || [];
      const existingItem = this.borrowedItems.find(item => item.id === equipment.id);

      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        this.borrowedItems.push(borrowedItem);
      }

      localStorage.setItem('borrowedItems', JSON.stringify(this.borrowedItems));

      // Update server state
      await this.supabaseService.updateEquipmentStatus(equipment.id, EquipmentStatus.BORROWED);

      // Only decrement quantity if it's positive
      if (equipment.quantity > 0) {
        await this.supabaseService.decrementEquipmentQuantity(equipment.id);
        equipment.quantity -= 1;
      }

      this.cdr.markForCheck();

      this.router.navigate(['/borrow-form'], {
        queryParams: {
          borrowedItems: JSON.stringify(this.borrowedItems),
          source: 'borrow'
        }
      });
    } catch (error) {
      console.error('❌ Error borrowing equipment:', error);


      if (equipment) {
        equipment.status = EquipmentStatus.AVAILABLE;
        equipment.borrowed = false;
        this.cdr.markForCheck();
      }

      this.borrowedItems = this.borrowedItems.filter(item => item.id !== equipment.id);
      localStorage.setItem('borrowedItems', JSON.stringify(this.borrowedItems));

      alert(`Failed to borrow equipment: ${error instanceof Error ? error.message : 'Please try again.'}`);
    }
  }


   async refreshEquipmentList() {
      try {
        // ✅ Fetch the latest equipment list from Supabase
        const allEquipment = await this.supabaseService.getAvailableEquipment();

        // ✅ Get all borrowed items to filter them out
        const borrowedItemIds = this.borrowedItems.map(item => item.id);

        // ✅ Only show available items
        this.equipmentList = allEquipment.filter(equipment => !this.borrowedItems.some(item => item.id === equipment.id));


        console.log("🔄 Equipment list refreshed:", this.equipmentList);

        // ✅ Force UI update
        this.cdr.detectChanges();
      } catch (error) {
        console.error("❌ Error refreshing equipment list:", error);
      }
    }

  async proceedToBorrowForm() {
      const selectedEquipments = this.equipmentList.filter(e => e.selected && !this.borrowedItems.some(item => item.id === e.id));

      if (selectedEquipments.some(e => e.quantity <= 0)) {
          alert('Some items are out of stock');
          return;
      }

      try {
          await Promise.all(selectedEquipments.map(async equipment => {
              await this.supabaseService.decrementEquipmentQuantity(equipment.id);
          }));

          selectedEquipments.forEach(equipment => {
              this.borrowedItems.push({
                  id: equipment.id,
                  name: equipment.name,
                  quantity: 1,
                  image: this.getValidImage(equipment),
                  brand: equipment.brand || 'N/A',
                  model: equipment.model || 'N/A',
                  serial_number: equipment.serial_number || 'N/A',
                  status: 'Borrowed' // Add status field
              });
          });

          localStorage.setItem('borrowedItems', JSON.stringify(this.borrowedItems));
          this.router.navigate(['/borrow-form'], {
              queryParams: { borrowedItems: JSON.stringify(this.borrowedItems) }
          });
      } catch (error) {
          console.error('Error updating quantity:', error);
          alert('Failed to update quantity. Please try again.');
      }
  }


    getValidImage(equipment: any): string {
      if (equipment.images) {
          return equipment.images; // ✅ Use image if already set
      }

      if (equipment.product_images?.length > 0) {
          return equipment.product_images[0]; // ✅ Use first image from product_images array
      }

      return 'assets/no-image.png'; // �� Fallback image
  }

}
