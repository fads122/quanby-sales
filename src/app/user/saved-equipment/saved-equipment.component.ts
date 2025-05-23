
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../../nav/sidebar/sidebar.component';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-saved-equipment',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: './saved-equipment.component.html',
  styleUrls: ['./saved-equipment.component.css']
})

export class SavedEquipmentComponent implements OnInit {
  savedEquipment: any[] = [];
  showDeleteModal: boolean = false;
  entryToDelete: any | null = null;
  selectedEntry: any | null = null;
  showDetailsModal: boolean = false;

ngOnInit() {
  this.loadSavedEquipment();
}

loadSavedEquipment() {
  const storedData: any[] = JSON.parse(localStorage.getItem('savedEquipment') || '[]');
  // ✅ Group equipment by name before displaying
    this.savedEquipment = storedData.map(entry => ({
      ...entry,
      groupedItems: this.groupEquipment(entry.items)
    }));
  }

// ✅ Group equipment by name and sum their quantities
groupEquipment(items: any[]) {
  const grouped = new Map<string, any>();
  items.forEach((item: { name: string; quantity: number; actual_cost: number; image: string; brand: string; supplier: string; supplier_cost: number }) => {
    if (grouped.has(item.name)) {
      grouped.get(item.name).quantity += item.quantity;
    } else {
      grouped.set(item.name, { ...item, brand: item.brand, supplier: item.supplier, supplier_cost: item.supplier_cost });
    }
  });
  return Array.from(grouped.values());
}


openDetailsModal(entry: any) {
  this.selectedEntry = entry;
  this.showDetailsModal = true;
}

closeDetailsModal() {
  this.showDetailsModal = false;
  this.selectedEntry = null;
}

getTotalPrice(): number {
  if (!this.selectedEntry || !this.selectedEntry.groupedItems) {
  return 0;
}

return this.selectedEntry.groupedItems.reduce(
  (sum: number, item: { actual_cost: number; quantity: number }) => sum + item.actual_cost * item.quantity,
    0
  );
}

clearSpecificSavedEquipment(entryToRemove: any) {
  const confirmDelete = window.confirm("❗ Are you sure you want to delete this saved equipment?");
    if (confirmDelete) {
      this.savedEquipment = this.savedEquipment.filter(entry => entry !== entryToRemove);
      localStorage.setItem('savedEquipment', JSON.stringify(this.savedEquipment));
      alert("✅ Equipment entry deleted successfully.");
    }
  }

closeDeleteModal() {
  console.log("❌ Closing delete modal");
  this.showDeleteModal = false;
  this.entryToDelete = null;
}

openDeleteModal(entry: any, event: Event) {
  event.stopPropagation(); // ✅ Prevents modal click from triggering details modal
  if (this.entryToDelete === entry) {
  console.warn("⚠️ Already selected this entry for deletion.");
  return;
}

console.log("🗑 Open delete modal for:", entry);
  this.entryToDelete = entry;
  this.showDeleteModal = true;
}

confirmDelete() {
  if (!this.entryToDelete) {
    console.error("❌ No entry selected for deletion!");
  return;
}

    console.log("🔍 Deleting entry with timestamp:", this.entryToDelete.timestamp);

    // ✅ Ensure we are filtering by timestamp, avoiding object reference issues
    this.savedEquipment = this.savedEquipment.filter(entry => entry.timestamp !== this.entryToDelete.timestamp);

    // ✅ Save the updated list back to localStorage
    localStorage.setItem('savedEquipment', JSON.stringify(this.savedEquipment));

    // ✅ Close modal after deletion
    this.closeDeleteModal();

    console.log("✅ Deleted successfully! Remaining items:", this.savedEquipment);
    alert("✅ Equipment entry deleted successfully.");
  }

exportToPDF(entry: any) {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Saved Equipment", 14, 15);

  // Add timestamp for when the equipment was saved
  doc.setFontSize(12);
  doc.text(`Saved on: ${new Date(entry.timestamp).toLocaleString()}`, 14, 25);

  // Table headers
  const headers = [["Name", "Quantity", "Actual Cost (PHP)", "Total (PHP)"]];

  // Table data for this specific entry
  const data = entry.items.map((item: any) => [
    item.name,
    item.brand,  // Add brand to the table
    item.supplier,
    item.quantity,
    item.actual_cost.toFixed(2),
    (item.actual_cost * item.quantity).toFixed(2)
  ]);

  // Add table using autoTable
  autoTable(doc, {
    head: headers,
    body: data,
    startY: 35,
    theme: "striped",
    styles: { fontSize: 10 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 14, right: 14 },
  });

  // Get the Y position after the table
  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 50;

  // Calculate total price
  const totalPrice = entry.items.reduce((sum: number, item: any) => sum + item.actual_cost * item.quantity, 0).toFixed(2);

  // Add total price at the bottom
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Total Price: PHP ${totalPrice}`, 14, finalY + 10);

  // Save the PDF
  doc.save(`saved-equipment-${entry.timestamp}.pdf`);
}
}
