import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { SupabaseAuthService } from '../../services/supabase-auth.service';
import { SidebarComponent } from "../../nav/sidebar/sidebar.component";
import { ChangeDetectorRef } from '@angular/core';



import { Router, ActivatedRoute } from '@angular/router';
import { firstValueFrom as rxFirstValueFrom } from 'rxjs';


interface BorrowedItem {
  id: string;
  name: string;
  stock: number;
  image: string;
  brand: string;
  model: string;
}


enum EquipmentStatus {
  AVAILABLE = 'Available',
  BORROWED = 'Borrowed',
  OUT_OF_STOCK = 'Out of Stock'
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './borrow-request-form.component.html',
  styleUrls: ['./borrow-request-form.component.css']
})
export class BorrowRequestComponent {
  equipmentList: any[] = []; // Array to store available equipment
  borrowDate: string = '';
  returnDate: string = '';
  purpose: string = '';
  selectedEquipmentIds: string[] = []; // Array to store selected equipment IDs
  userEmail: string | null = null;
  displayedItems: any[] = [];
  borrowedItems: any[] = [];

  // New properties for borrower details
  borrowerName: string = '';
  borrowerDepartment: string = '';
  borrowerContact: string = '';
  borrowerEmail: string = '';

  showAllItems = false;
  dateError: boolean = false;
  recentActivities: any[] = [];
  inHouseEquipment: any[] = [];
  loading: boolean = false;

  // Add sidebar integration properties
  isCollapsed = false;

  constructor(
    private supabaseService: SupabaseService,
    private authService: SupabaseAuthService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      // Initialize theme state
      this.initializeTheme();

      // Load form data from localStorage
      const savedFormData = localStorage.getItem('borrowFormData');
      if (savedFormData) {
        const formData = JSON.parse(savedFormData);
        this.borrowerName = formData.borrowerName || '';
        this.borrowerDepartment = formData.borrowerDepartment || '';
        this.borrowerContact = formData.borrowerContact || '';
        this.borrowerEmail = formData.borrowerEmail || '';
        this.borrowDate = formData.borrowDate || '';
        this.returnDate = formData.returnDate || '';
        this.purpose = formData.purpose || '';
      }

      // Load borrowed items from localStorage
      const savedItems = localStorage.getItem('borrowedItems');
      this.borrowedItems = savedItems ? JSON.parse(savedItems) : [];

      // Fetch in-house equipment from Supabase
      const rawEquipmentList = await this.supabaseService.getInHouseEquipment();

      // Process the equipment list
      this.equipmentList = rawEquipmentList.map((item: any) => {
        const borrowedItem = this.borrowedItems.find(b => b.id === item.id);
        return {
          ...item,
          current_quantity: item.quantity, // Use the quantity from in-house table
          quantity: borrowedItem ? borrowedItem.quantity : 0,
          borrowed: borrowedItem ? true : false,
          selected: borrowedItem ? true : false
        };
      });

      this.updateDisplayedItems();
      await this.loadUserDetails();
    } catch (error) {
      console.error('Error during initialization:', error);
      alert('Failed to load data. Please try again.');
    }
  }

  // Add method to handle sidebar collapsed state
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

  async loadInHouseEquipment() {
    try {
      this.inHouseEquipment = await this.supabaseService.getInHouseEquipment();
      console.log('In-house equipment:', this.inHouseEquipment);
    } catch (error) {
      console.error('Error loading in-house equipment:', error);
    }
  }

  validateDates() {
    // ✅ FIX: Added missing validateDates() method
    if (this.borrowDate && this.returnDate) {
      this.dateError = new Date(this.returnDate) <= new Date(this.borrowDate);
    }
  }

  allowOnlyNumbers(event: KeyboardEvent): boolean {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  onFormChange() {
    this.saveFormData();
  }

  saveFormData() {
    const formData = {
      borrowerName: this.borrowerName,
      borrowerDepartment: this.borrowerDepartment,
      borrowerContact: this.borrowerContact,
      borrowerEmail: this.borrowerEmail,
      borrowDate: this.borrowDate,
      returnDate: this.returnDate,
      purpose: this.purpose,
      borrowedItems: this.borrowedItems // Add this line to save borrowed items
    };
    localStorage.setItem('borrowFormData', JSON.stringify(formData));
  }

  async loadUserDetails() {
    try {
      if (await this.authService.isLoggedIn()) {
        const user = await this.authService.getUser();

        if (user && user.id) { // ✅ Ensure we have a valid user ID
          this.userEmail = user.email;

          // ✅ Fetch user profile from Supabase
          const userProfile = await this.supabaseService.getUserProfile(user.id);

          if (userProfile) {
            this.borrowerName = userProfile.first_name; // ✅ Assign first_name correctly
            console.log('✅ Borrower Name:', this.borrowerName);
          } else {
            console.warn('⚠️ User profile not found.');
            this.borrowerName = ''; // Fallback
          }
        } else {
          console.warn('⚠️ User details are missing:', user);
          this.userEmail = null;
          this.borrowerName = '';
          console.log('User ID:', user.id);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching user details:', error);
      this.userEmail = null;
      this.borrowerName = '';
    }
  }

  viewEquipmentDetails(item: any) {
    this.router.navigate(['/equipment-borrow'], {
      queryParams: {
        id: item.id,
        name: item.name
      }
    });
  }

  clearSavedFormData() {
    localStorage.removeItem('borrowFormData');
    localStorage.removeItem('borrowedItems');
  }

  async loadUserEmail() {
    try {
      if (await this.authService.isLoggedIn()) {
        const user = await this.authService.getUser();

        if (user && user.email) { // Directly check for email
          this.userEmail = user.email;
        } else {
          console.warn('User email is missing:', user);
          this.userEmail = null;
        }
      }
    } catch (error) {
      console.error('Error fetching user email:', error);
      this.userEmail = null;
    }
  }

  updateSelectedEquipment(item: any): void {
    if (item.selected) {
      this.selectedEquipmentIds.push(item.id);
    } else {
      this.selectedEquipmentIds = this.selectedEquipmentIds.filter(
        (id) => id !== item.id
      );
    }
    console.log('Selected equipment IDs:', this.selectedEquipmentIds);
  }

  validateQuantity(item: any): void {
    const maxQuantity = item.quantity_available || 0; // Available stock in the database
    if (!item.quantity || isNaN(item.quantity) || item.quantity < 1) {
      alert('⚠ Invalid quantity. Setting to 1.');
      item.quantity = 1;
    } else if (item.quantity > maxQuantity) {
      alert(`⚠ Quantity cannot exceed available stock (${maxQuantity}).`);
      item.quantity = maxQuantity;
    }
  }

  async submitBorrowRequest(): Promise<void> {
    if (this.dateError) {
      alert("❌ Return date must be after the borrow date.");
      return;
    }

    try {
      const userId = (await this.supabaseService.getCurrentUser()).id;

      const requestData = {
        user_id: userId,
        borrower_name: this.borrowerName,
        borrower_department: this.borrowerDepartment,
        borrower_contact: this.borrowerContact,
        borrower_email: this.borrowerEmail,
        borrow_date: this.borrowDate,
        return_date: this.returnDate,
        purpose: this.purpose,
        status: 'borrowed'
      };

      const borrowRequestData = await this.supabaseService.createBorrowRequest(requestData);
      const borrowRequestId = borrowRequestData.id;

      const equipmentInsertData = this.borrowedItems.map((item) => ({
        borrow_request_id: borrowRequestId,
        inhouse_equipment_id: item.id,  // Changed from equipment_id to inhouse_equipment_id
        quantity: 1
      }));

      await this.supabaseService.insertBorrowRequestEquipment(equipmentInsertData);

      for (let item of equipmentInsertData) {
        await this.supabaseService.insertEquipmentMovement({
          inhouse_equipment_id: item.inhouse_equipment_id,  // Updated field
          movement_type: 'borrowed',
          borrow_request_id: borrowRequestId,
          movement_date: new Date().toISOString(),
          employee_id: userId,
          status: 'active',
          project_id: null
        });
      }

      for (const item of this.borrowedItems) {
        await this.supabaseService.decrementEquipmentQuantity(item.id);
        console.log(`✅ Decremented quantity for equipment ID: ${item.id}`);
        const equipmentToUpdate = this.equipmentList.find(eq => eq.id === item.id);
        if (equipmentToUpdate) {
          equipmentToUpdate.current_quantity -= 1;
        }
      }

      // Clear saved data after successful submission
      this.clearSavedFormData();

      this.updateDisplayedItems();
      alert('✅ Borrow request submitted successfully!');

      // ✅ Save to recent activities (Supabase)
      const itemNames = this.borrowedItems.map(item => item.name).join(', ');
      const itemCount = this.borrowedItems.length;

      await this.supabaseService.logActivity(
        'borrow',
        '', // Instead of null
        `${this.borrowerName} borrowed ${itemCount} ${itemCount > 1 ? 'equipments' : 'equipments'} (${itemNames}) on ${new Date(this.borrowDate).toLocaleDateString()}`
      );

      // ✅ Update local recent activities array
      this.recentActivities.unshift({
        message: `${this.borrowerName} borrowed ${itemCount} ${itemCount > 1 ? 'equipments' : ' equipments'} (${itemNames}) on ${new Date(this.borrowDate).toLocaleDateString()}`,
        timestamp: new Date().toISOString()
      });

      this.borrowDate = '';
      this.returnDate = '';
      this.purpose = '';
      this.borrowerDepartment = '';
      this.borrowedItems = [];
      this.selectedEquipmentIds = [];
      localStorage.removeItem('borrowedItems');
      localStorage.removeItem('borrowFormData');

      this.cdr.detectChanges();
      this.router.navigate(['/borrow-table-user']);

    } catch (error) {
      console.error('❌ Error submitting borrow request:', error);
      alert('Failed to submit borrow request. Please try again.');
    }
  }

  updateCurrentQuantity(item: any): void {
    // Prevent negative values
    if (item.quantity < 0) {
      item.quantity = 0;
    }

    // Ensure quantity does not exceed available stock
    if (item.quantity > item.current_quantity) {
      item.quantity = item.current_quantity;
      alert(`⚠ Quantity cannot exceed available stock (${item.current_quantity}).`);
    }
  }

  updateDisplayedItems(): void {
    const groupedEquipment = new Map<string, any>();

    // ✅ Group available equipment by name (case insensitive)
    this.equipmentList.forEach(item => {
        const normalizedName = item.name.trim().toLowerCase(); // Normalize name

        if (groupedEquipment.has(normalizedName)) {
            let existingItem = groupedEquipment.get(normalizedName);
            existingItem.current_quantity += item.current_quantity; // ✅ Sum quantity
        } else {
            groupedEquipment.set(normalizedName, { ...item, name: item.name.trim() }); // Preserve original name case
        }
    });

    // ✅ Merge borrowed items
    this.borrowedItems.forEach(borrowedItem => {
        const normalizedName = borrowedItem.name.trim().toLowerCase(); // Normalize name

        if (groupedEquipment.has(normalizedName)) {
            let existingItem = groupedEquipment.get(normalizedName);
            existingItem.quantity = borrowedItem.quantity; // ✅ Update quantity
            existingItem.borrowed = true; // ✅ Mark as borrowed
        } else {
            groupedEquipment.set(normalizedName, { ...borrowedItem, selected: true });
        }
    });

    // ✅ Assign a new reference to trigger Angular's change detection
    this.displayedItems = Array.from(groupedEquipment.values());

    console.log("✅ Updated Displayed Items:", this.displayedItems);
    this.cdr.detectChanges(); // Force UI refresh
  }

  increaseQuantity(item: any): void {
    if (item.quantity < item.current_quantity) {
      item.quantity++;
      this.updateCurrentQuantity(item);
    }
  }

  decreaseQuantity(item: any): void {
    if (item.quantity > 0) {
      item.quantity--;
      this.updateCurrentQuantity(item);
    }
  }

  viewDetails(item: any) {
    console.log('Viewing details for:', item);
    // Implement the logic to view the details of the selected item
  }

  autoSelectItem(item: any): void {
    if (item.current_quantity <= 5) {
      alert(`⚠ "${item.name}" is low on stock and cannot be selected.`);
      item.quantity = 0; // Reset quantity
      return;
    }

    if (item.quantity > 0) {
      item.selected = true; // ✅ Auto-check the checkbox
      if (!this.selectedEquipmentIds.includes(item.id)) {
        this.selectedEquipmentIds.push(item.id);
      }
    } else {
      item.selected = false;
      this.selectedEquipmentIds = this.selectedEquipmentIds.filter(id => id !== item.id);
    }
  }

  async returnBorrowedEquipment(borrowRequestId: string, equipmentId: string, quantityReturned: number): Promise<void> {
    try {
      const userId = (await this.supabaseService.getCurrentUser()).id;

      // Insert return movement
      await this.supabaseService.insertEquipmentMovement({
        inhouse_equipment_id: equipmentId,
        movement_type: 'returned',
        borrow_request_id: borrowRequestId,
        movement_date: new Date().toISOString(),
        employee_id: userId,
        status: 'returned',
        project_id: null // Not linked to any project
      });

      // Update stock
      await this.supabaseService.incrementEquipmentQuantity(equipmentId, quantityReturned);

      alert('Equipment returned successfully!');
    } catch (error) {
      console.error('Error returning equipment:', error);
      alert('Failed to return equipment.');
    }
  }

  async borrowItem(equipmentId: string) {
    console.log(`Borrowing equipment ID: ${equipmentId}`);

    const borrowedEquipment = this.equipmentList.find(e => e.id === equipmentId);
    if (!borrowedEquipment) return;

    const userId = (await this.supabaseService.getCurrentUser()).id;
    const quantity = 1; // Set the desired quantity
    const response = await this.supabaseService.borrowEquipment(equipmentId, userId, quantity);
    if (response.error) {
        console.error("Error borrowing equipment:", response.error);
        return;
    }

    console.log("Equipment borrowed successfully:", response);
    alert("Equipment borrowed successfully!");

    // Add the borrowed item to the form list
    this.borrowedItems.push(borrowedEquipment);

    // Remove the borrowed item from the main list
    this.equipmentList = this.equipmentList.filter(e => e.id !== equipmentId);
  }

  async addToBorrowedList(equipmentId: string) {
    const equipment = this.equipmentList.find(e => e.id === equipmentId);
    if (!equipment || equipment.current_quantity <= 0) {
      alert('⚠ Item is out of stock.');
      return;
    }

    try {
      // ✅ Decrease stock in Supabase
      await this.supabaseService.decrementEquipmentQuantity(equipmentId);

      // ✅ Clone the borrowed equipment to avoid modifying original reference
      const borrowedEquipment = { ...equipment };

      // ✅ Ensure `borrowedItems` is an array before updating
      if (!Array.isArray(this.borrowedItems)) {
        this.borrowedItems = [];
      }

      // ✅ Check if the item already exists in `borrowedItems`
      const existingItem = this.borrowedItems.find(item => item.id === equipment.id);

      if (existingItem) {
        existingItem.quantity += 1; // 🔥 Increase quantity instead of replacing
      } else {
        borrowedEquipment.quantity = 1;
        this.borrowedItems = [...this.borrowedItems, borrowedEquipment]; // 🔥 Maintain previous selections
      }

      // ✅ Update stock in UI without removing from `equipmentList`
      equipment.current_quantity -= 1;
      equipment.borrowed = equipment.current_quantity === 0; // Mark as borrowed if out of stock

      // ✅ Save updated borrowed items to localStorage
      localStorage.setItem('borrowedItems', JSON.stringify(this.borrowedItems));

      console.log("📌 Updated Borrowed Items:", this.borrowedItems);

      this.updateDisplayedItems();
      this.cdr.detectChanges();
    } catch (error) {
      console.error('❌ Error updating stock:', error);
      alert('Failed to update stock. Please try again.');
    }
  }

  async removeFromBorrowList(equipment: any) {
    console.log("❌ Removing Equipment ID:", equipment.id);

    try {
      // Get the quantity to restore (default to 1 if not specified)
      const quantityToRestore = equipment.quantity || 1;

      // 1. Update database - increment quantity AND set status to Available
      await this.supabaseService.incrementEquipmentQuantity(equipment.id, quantityToRestore);
      await this.supabaseService.updateEquipmentStatus(equipment.id, EquipmentStatus.AVAILABLE);

      // 2. Update local state
      const equipmentInList = this.equipmentList.find(item => item.id === equipment.id);
      if (equipmentInList) {
        equipmentInList.quantity += quantityToRestore;
        equipmentInList.borrowed = false;
        equipmentInList.status = EquipmentStatus.AVAILABLE; // Explicit status update
      } else {
        // If it's not in the list, add it back
        this.equipmentList.push({
          ...equipment,
          quantity: quantityToRestore,
          borrowed: false,
          status: EquipmentStatus.AVAILABLE
        });
      }

      // 3. Remove from borrowed items list
      this.borrowedItems = this.borrowedItems.filter(item => item.id !== equipment.id);
      localStorage.setItem('borrowedItems', JSON.stringify(this.borrowedItems));

      // 4. Force refresh of the equipment list
      await this.refreshEquipmentList();

      console.log("✅ Equipment restored successfully. Status:", EquipmentStatus.AVAILABLE);
      this.cdr.markForCheck();

    } catch (error) {
      console.error("❌ Error restoring equipment:", error);

      // Revert UI changes if the server update failed
      if (equipment) {
        const equipmentInList = this.equipmentList.find(item => item.id === equipment.id);
        if (equipmentInList) {
          equipmentInList.quantity -= (equipment.quantity || 1);
          equipmentInList.borrowed = true;
          equipmentInList.status = EquipmentStatus.BORROWED;
        }
        this.cdr.markForCheck();
      }

      alert(`Failed to restore equipment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async refreshEquipmentList(): Promise<void> {
    try {
      const [allEquipment, borrowedEquipment] = await Promise.all([
        this.supabaseService.getInHouseEquipment(),
        this.supabaseService.getBorrowedEquipment()
      ]);

      const borrowedItemIds = new Set(
        borrowedEquipment.map((item: any) => item.inhouse_equipment_id)
      );

      this.equipmentList = allEquipment.map(equipment => {
        const isBorrowed = borrowedItemIds.has(equipment.id);
        return {
          ...equipment,
          quantity: equipment.quantity || equipment.current_quantity || 0,
          borrowed: isBorrowed,
          status: isBorrowed ? EquipmentStatus.BORROWED :
                  (equipment.quantity <= 0 ? EquipmentStatus.OUT_OF_STOCK :
                   equipment.status || EquipmentStatus.AVAILABLE)
        };
      });

      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error refreshing equipment list:', error);
      throw error;
    }
  }
}

function firstValueFrom(queryParams: any) {
  return rxFirstValueFrom(queryParams);
}

