import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { SidebarComponent } from '../../nav/sidebar/sidebar.component';
import { BreadcrumbComponent } from '../../breadcrumb/breadcrumb.component';
import { PaginatorModule } from 'primeng/paginator';
import { SliderModule } from 'primeng/slider';
import { SupabaseService } from '../../services/supabase.service';
import { MatTabsModule } from '@angular/material/tabs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CheckboxModule } from 'primeng/checkbox'; // Add this import
import { InputNumberModule } from 'primeng/inputnumber'; // Add this import
import { DialogModule } from 'primeng/dialog';
import { HttpClient } from '@angular/common/http';

interface ApiError {
  message: string;
  stack?: string;
}

interface SemanticSearchConfig {
  threshold: number;
  maxResults: number;
  sortByRelevance: boolean;
}

interface SemanticSearchResult {
  id: string;
  name: string;
  model: string;
  brand: string;
  supplier: string;
  supplier_cost: number;
  price: number;
  image: string;
  quantity: number;
  similarity: number;
  description: string;
}

@Component({
  selector: 'app-parts-picker',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    SidebarComponent,
    BreadcrumbComponent,
    PaginatorModule,
    MatTabsModule,
    SliderModule,
    CheckboxModule, // Add this
    InputNumberModule,
    DialogModule
  ],
  templateUrl: './parts-picker.component.html',
  styleUrls: ['./parts-picker.component.css']
})

export class PartsPickerComponent implements OnInit {
  searchQuery: string = '';
  selectedProducts: any[] = [];
  showDropdown: boolean = false;
  showModal: boolean = false;
  products: any[] = [];
  categories: { name: string, count: number }[] = [];
  selectedCategory: string = 'All';
  equipmentTitle: string = ''; // Store title input
  showTitleModal: boolean = false;
  compatibilityIssues: string[] = [];
  isCheckingCompatibility: boolean = false;
  suggestedParts: any[] = [];
  showSuggestionsPanel: boolean = false;
  searchMode: 'text' | 'semantic' = 'text';
  semanticSearchResults: any[] = [];
  isSemanticSearching = false;
  isTesting = false; // Change this to false to use real semantic search
  isLoading: boolean = true;
  isSidebarCollapsed: boolean = false; // Add this property

  first: number = 0;
rows: number = 5; // Items per page
currentPage: number = 1;
totalRecords: number = 0;

  // Add to parts-picker.component.ts
mockProducts = [
  {
    id: 1,
    name: 'Industrial Bearing',
    model: 'IB-5000-XL',
    brand: 'BearingTech',
    supplier: 'Global Parts Inc.',
    supplier_cost: 45.99,
    price: 89.99,
    image: '/assets/bearing.jpg',
    description: 'Heavy-duty industrial bearing for high-load applications'
  },
  {
    id: 2,
    name: 'Hydraulic Pump',
    model: 'HP-3000-MAX',
    brand: 'FluidSystems',
    supplier: 'HydraParts Co.',
    supplier_cost: 320.50,
    price: 599.99,
    image: '/assets/pump.jpg',
    description: 'High-pressure hydraulic pump for industrial machinery'
  },
  {
    id: 3,
    name: 'Conveyor Belt Roller',
    model: 'CBR-2000-STD',
    brand: 'MotionTech',
    supplier: 'BeltWorld Ltd.',
    supplier_cost: 28.75,
    price: 49.99,
    image: '/assets/roller.jpg',
    description: 'Standard conveyor roller for material handling systems'
  },
  {
    id: 4,
    name: 'Electric Motor',
    model: 'EM-7500-HP',
    brand: 'PowerDrive',
    supplier: 'ElectroParts Inc.',
    supplier_cost: 425.00,
    price: 799.99,
    image: '/assets/motor.jpg',
    description: 'High-performance electric motor for industrial equipment'
  },
  {
    id: 5,
    name: 'Linear Actuator',
    model: 'LA-4000-PRO',
    brand: 'MotionSystems',
    supplier: 'AutoParts Global',
    supplier_cost: 185.25,
    price: 349.99,
    image: '/assets/actuator.jpg',
    description: 'Precision linear actuator for automation systems'
  }
];

constructor(
  private supabaseService: SupabaseService,
  private route: ActivatedRoute,
  private router: Router,
  private cdr: ChangeDetectorRef
) {}

async ngOnInit() {
  try {
    this.isLoading = true; // Start loading

    // Initialize theme state
    this.initializeTheme();

    // Load the TensorFlow model when component initializes
    await this.supabaseService.loadModel();
    await this.fetchEquipmentData();
    // Read category from query params if navigating from the sidebar dropdown
    this.route.queryParams.subscribe(params => {
      if (params['category']) {
        this.selectedCategory = params['category'];
      }
    });
  } catch (error) {
    console.error('Error initializing parts picker:', error);
  } finally {
    // Add a slight delay to ensure smooth animation
    setTimeout(() => {
      this.isLoading = false; // End loading
    }, 1000);
  }
}

  async fetchEquipmentData() {
    try {
      this.isLoading = true; // Show loader while fetching data
      console.log('⏳ Fetching equipment data...');
      const result = await this.supabaseService.getEquipmentList();
      console.log('🔍 Result from getEquipmentList():', result);

      if (result && result.length > 0) {
        this.products = result.map(equipment => {
          // Ensure model is never empty
          const displayModel = equipment.model || 'No Model';

          const product = {
            id: equipment.id,
            name: equipment.name || displayModel, // Use model if name is empty
            model: displayModel, // Always show model
            brand: equipment.brand || 'No Brand',
            supplier: equipment.supplier || 'No Supplier',
            supplier_cost: equipment.supplier_cost || 0,
            price: equipment.srp || 0,
            image: equipment.product_images?.[0] || '/assets/no-image.png',
            quantity: 1
          };
          return product;
        });

        this.updateCategories();
      } else {
        console.warn('⚠️ No equipment data received or empty array');
        this.products = [];
      }
    } catch (error) {
      console.error('Error fetching equipment data:', error);
    } finally {
      // Add a slight delay for smooth animation
      setTimeout(() => {
        this.isLoading = false; // Hide loader
      }, 1000);
    }
  }

// Add to your PartsPickerComponent class

async checkCompatibility() {
  this.isCheckingCompatibility = true;
  this.compatibilityIssues = [];

  try {
    // Get compatibility data for selected parts
    const compatibilityResults = await this.supabaseService.checkPartCompatibility(
      this.selectedProducts.map(p => p.id)
    );

    if (compatibilityResults?.issues?.length) {
      this.compatibilityIssues = compatibilityResults.issues;
      alert('⚠️ Compatibility issues found!');
    } else {
      alert('✅ All selected parts are compatible!');
    }

    return compatibilityResults;
  } catch (error) {
    console.error('Compatibility check failed:', error);
    return null;
  } finally {
    this.isCheckingCompatibility = false;
  }
}

async onSearch() {
  if (this.searchMode === 'semantic') {
    await this.runSemanticSearch();
  }
  // Regular text search happens automatically through filteredProducts()
}

// In your PartsPickerComponent
// Update in parts-picker.component.ts
async runSemanticSearch() {
  console.log('🔍 Starting semantic search...');
  console.log('📝 Search query:', this.searchQuery);

  if (!this.searchQuery.trim()) {
    console.log('❌ Empty search query - returning empty results');
    this.semanticSearchResults = [];
    return;
  }

  this.isSemanticSearching = true;
  console.log('🔄 Search in progress...');

  try {
    console.log('🔎 Using semantic search with query:', this.searchQuery);
    const results = await this.supabaseService.semanticSearch(
      this.searchQuery,
      0.2
    );

    // Map the results to match product card format
    this.semanticSearchResults = results.map(item => ({
      id: item.id,
      name: item.name || item.model || 'No Name',
      model: item.model || 'No Model',
      brand: item.brand || 'No Brand',
      supplier: item.supplier || 'No Supplier',
      supplier_cost: item.supplier_cost || 0,
      price: item.srp || 0,
      image: item.product_images?.[0] || '/assets/no-image.png',
      quantity: 1,
      similarity: item.similarity || 0,
      description: item.description || ''
    }));

    console.log('📊 Formatted search results:', this.semanticSearchResults);

    if (this.semanticSearchResults.length === 0) {
      console.log('⚠️ No matches found for query:', this.searchQuery);
    } else {
      console.log('✅ Found matches:', this.semanticSearchResults.length);
    }

    if (this.selectedProducts.length > 0) {
      console.log('👉 Checking compatibility for matches...');
      const compatibleParts = await this.supabaseService.getCompatibleParts(
        this.selectedProducts[0].id,
        this.selectedProducts[0].name
      );

      this.semanticSearchResults.forEach(result => {
        result.compatible = compatibleParts.some(p => p.id === result.id);
      });
    }

  } catch (error: unknown) {
    console.error('❌ Semantic search failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
    }
    this.semanticSearchResults = [];
  } finally {
    this.isSemanticSearching = false;
    console.log('🏁 Semantic search completed');
    console.log('Final results:', this.semanticSearchResults);
  }
}

async getCompatibleParts(selectedPartId: string, category: string) {
  try {
    return await this.supabaseService.getCompatibleParts(selectedPartId, category);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Failed to fetch compatible parts:', error.message);
    } else {
      console.error('Unknown error fetching compatible parts:', error);
    }
    return [];
  }
}

toggleSearchMode() {
  this.searchMode = this.searchMode === 'text' ? 'semantic' : 'text';
  this.onSearch(); // Re-run search when mode changes
}

// Call this when a part is selected
async onPartSelected(part: any) {
  this.toggleProductSelection(part);

  // Get compatible parts
  const compatibleParts = await this.getCompatibleParts(part.id, part.name);

  // Update product compatibility flags
  this.products.forEach(p => {
    p.compatible = compatibleParts.some(cp => cp.id === p.id);
  });

  // Generate AI-like suggestions
  this.generateSuggestions(part, compatibleParts);
  this.showSuggestionsPanel = true;
}

generateSuggestions(selectedPart: any, compatibleParts: any[]) {
  this.suggestedParts = [];

  // Group by category
  const categories = new Set(compatibleParts.map(p => p.name));

  categories.forEach(category => {
    const partsInCategory = compatibleParts
      .filter(p => p.name === category)
      .slice(0, 3); // Limit to 3 suggestions per category

    if (partsInCategory.length > 0) {
      this.suggestedParts.push({
        category: `Recommended ${category}s`,
        parts: partsInCategory
      });
    }
  });
}

addSuggestion(part: any) {
  if (!this.isSelected(part)) {
    // Create a new object with quantity
    const newPart = {
      ...part,
      quantity: 1
    };
    this.selectedProducts.push(newPart);

    // Update the compatible status
    this.products.forEach(p => {
      p.compatible = false; // Reset all
    });

    // Close the panel
    this.showSuggestionsPanel = false;
  }
}

updateCategories() {
  const categoryMap = new Map<string, number>();

  this.products.forEach(product => {
    // Use model as primary category, fallback to name
    const categoryName = product.model || product.name || 'Uncategorized';

    // Clean up category names
    const cleanCategory = categoryName.trim() || 'Uncategorized';
    categoryMap.set(cleanCategory, (categoryMap.get(cleanCategory) || 0) + 1);
  });

  // Sort categories alphabetically
  this.categories = [
    { name: 'All', count: this.products.length },
    ...Array.from(categoryMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }))
  ];
}

getCategories() {
  return this.categories;
}

filteredProducts() {
  // First handle empty search and category
  if (this.searchQuery === '' && this.selectedCategory === 'All') {
    return this.products;
  }

  return this.products.filter(product => {
    // Normalize the model (handle empty/undefined cases)
    const productModel = (product.model || '').toLowerCase().trim();

    // Category filtering
    const categoryMatch = this.selectedCategory === 'All' ||
                        (productModel === this.selectedCategory.toLowerCase()) ||
                        (product.name === this.selectedCategory);

    // Search filtering
    const searchMatch = this.searchQuery === '' ||
                       productModel.includes(this.searchQuery.toLowerCase());

    return categoryMatch && searchMatch;
  });
}

  toggleProductSelection(product: any) {
    const index = this.selectedProducts.findIndex(p => p.id === product.id);
    if (index !== -1) {
      this.selectedProducts.splice(index, 1);
    } else {
      this.selectedProducts.push({...product});
    }
  }

isSelected(product: any) {
  return this.selectedProducts.some(p => p.id === product.id);
}

getTotalPrice() {
  return this.selectedProducts.reduce((sum, product) => sum + product.supplier_cost * product.quantity, 0);
}

toggleDropdown() {
  this.showDropdown = !this.showDropdown;
}

openModal() {
  this.showModal = true;
}

closeModal() {
  this.showModal = false;
}

openTitleModal() {
  if (this.selectedProducts.length === 0) {
    alert('⚠️ No items selected to save.');
    return;
  }
    this.showTitleModal = true;
  }

closeTitleModal() {
  this.showTitleModal = false;
}

navigateToPartsPicker(category: string) {
  this.router.navigate(['/parts-picker'], { queryParams: { category } });
}

exportToPDF() {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Selected Equipment", 14, 15);

  // Table headers
  const headers = [["Name", "Model", "Quantity", "Supplier Cost (PHP)", "Total (PHP)"]];

  // Table data
  const data = this.selectedProducts.map(product => [
    product.name,
    product.model,
    product.quantity,
    product.supplier_cost.toFixed(2),
    (product.supplier_cost * product.quantity).toFixed(2)
  ]);

  // Add table using autoTable
  autoTable(doc, {
    head: headers,
    body: data,
    startY: 25,
    theme: "striped",
    styles: { fontSize: 10 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 14, right: 14 },
  });

  // Get the Y position after the table
  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 40; // Fallback if undefined

  // Calculate total price
  const totalPrice = this.getTotalPrice().toFixed(2);

  // Add total price at the bottom
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Total Price: PHP ${totalPrice}`, 14, finalY + 10);

  // Save the PDF
  doc.save("selected-equipment.pdf");
  }

  adjustQuantity(product: any, change: number) {
    // Find the product in selectedProducts
    const selectedProduct = this.selectedProducts.find(p => p.id === product.id);

    if (selectedProduct) {
      // Update quantity, ensuring it doesn't go below 1
      selectedProduct.quantity = Math.max(1, selectedProduct.quantity + change);
    }

    // Also update the quantity in the main products array for consistency
    const mainProduct = this.products.find(p => p.id === product.id);
    if (mainProduct) {
      mainProduct.quantity = Math.max(1, mainProduct.quantity + change);
    }
  }

  async saveSelectedEquipment() {
    if (!this.equipmentTitle.trim()) {
      alert('⚠️ Please enter a title before saving.');
      return;
    }

    try {
      // Prepare the entry object
      const entry = {
        title: this.equipmentTitle,
        timestamp: new Date().toISOString(),
        items: [...this.selectedProducts]
        // Optionally add user_id if you want to associate with a user
      };

      // Save to Supabase
      await this.supabaseService.saveEquipmentEntry(entry);

      alert('✅ Equipment saved to Supabase!');
      this.equipmentTitle = '';
      this.showTitleModal = false;
      this.closeModal();
    } catch (error) {
      alert('❌ Failed to save equipment to Supabase.');
      console.error(error);
    }
  }

  navigateToSavedEquipment() {
    this.router.navigate(['/saved-equipment']);
  }

  // Add to parts-picker.component.ts
async mockSemanticSearch(query: string): Promise<any[]> {
  // Simple mock search - in a real app this would use vector embeddings
  const results = this.mockProducts.filter(product => {
    const searchText = `${product.name} ${product.model} ${product.brand} ${product.description}`.toLowerCase();
    return searchText.includes(query.toLowerCase());
  }).map(product => ({
    ...product,
    similarity: Math.random() * 0.5 + 0.5 // Random similarity score between 0.5-1.0
  })).sort((a, b) => b.similarity - a.similarity);

  return results;
}


// Add this method to your PartsPickerComponent class
onPageChange(event: any) {
  this.first = event.first;
  this.rows = event.rows;
  this.currentPage = event.page + 1;

  // Update total records based on search mode
  this.totalRecords = this.searchMode === 'semantic'
    ? this.semanticSearchResults.length
    : this.filteredProducts().length;
}

// Add method to handle sidebar collapsed state
onSidebarCollapsed(collapsed: boolean) {
  this.isSidebarCollapsed = collapsed;
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

}
