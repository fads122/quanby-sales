import { Component, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import Chart from 'chart.js/auto';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { SidebarComponent } from '../../nav/sidebar/sidebar.component';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatPaginatorModule } from '@angular/material/paginator';
import { NgModule } from '@angular/core';
import { ChartModule } from 'primeng/chart';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { CalendarModule } from 'primeng/calendar';
import { AccordionModule } from 'primeng/accordion';
import { PaginatorModule } from 'primeng/paginator';
import { ToastModule } from 'primeng/toast';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { BreadcrumbComponent } from '../../breadcrumb/breadcrumb.component';


interface TimeframeOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    NgFor,
    SidebarComponent,
    BreadcrumbComponent, // Add this line
    MatCardModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatPaginatorModule,
    FormsModule,
    ChartModule,
    CardModule,
    DropdownModule,
    ButtonModule,
    InputTextModule,
    CalendarModule,
    AccordionModule,
    PaginatorModule,
    ToastModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, AfterViewInit {
  isCollapsed = false;

  userEmail: string | null = null;
  selectedEquipmentId: string | null = null;
  costHistory: any[] = [];
  equipmentList: any[] = [];
  costChart: Chart | null = null;
  totalEquipment: number = 0;
  recentActivities: any[] = [];
  paginatedActivities: any[] = [];
  currentPage: number = 0;
  pageSize: number = 3;
  totalPages: number = 0;
  borrowedEquipment: number = 0;
  totalSuppliers: number = 0;
  usedInProjects: number = 0;
  updatedEquipmentList: any[] = [];
  lowStockEquipment: any[] = [];
  lowStockCount: number = 0; // ✅ Declare the property
  totalPagesArray: (number | string)[] = [];
  filter = {
    startDate: '',
    endDate: '',
    message: ''
  };
  filteredActivities: any[] = [];
  selectedEquipmentSuppliers: {id: string, name: string}[] = [];
  selectedSuppliers: string[] = [];
  supplierColors: string[] = [];
  filteredCostHistory: any[] = [];

  selectedTimeframe = 'all';
  priceChangePercentage: number | null = null;
  currentAveragePrice: number | null = null;
  lowestPrice: number | null = null;
  highestPrice: number | null = null;
  currentPrice: number | null = null;
  lowestPriceDate: string | null = null;
  highestPriceDate: string | null = null;

  isLoading: boolean = true;

  // Add new properties for sparkline data
  supplierSparkline: Chart | null = null;
  equipmentSparkline: Chart | null = null;
  borrowedSparkline: Chart | null = null;
  projectsSparkline: Chart | null = null;

  // Historical data arrays
  supplierHistory: number[] = [];
  equipmentHistory: number[] = [];
  borrowedHistory: number[] = [];
  projectsHistory: number[] = [];

  // Add property to track if showing aggregate data
  isShowingAggregateData: boolean = false;

  rankedSuppliers: any[] = [];
  topSupplierName: string = '';
  rankingFilter: string = 'overall';
  lastUpdated: Date = new Date();

  paginatedSuppliers: any[] = []; // Suppliers to display on current page
  itemsPerPage: number = 5;

  isLoaded = false;


  constructor(private supabaseService: SupabaseService, private cdr: ChangeDetectorRef, private router: Router) {}

  async ngOnInit() {
    try {
      this.isLoading = true;
      await this.loadUserEmail();
      const rawEquipmentList = await this.supabaseService.getEquipmentList() || [];

      // Group equipment by model while preserving all individual records
      const equipmentGroups = new Map<string, any[]>();
      rawEquipmentList.forEach(item => {
          const groupKey = item.model?.trim() || item.name?.trim() || 'uncategorized';

          if (!equipmentGroups.has(groupKey)) {
              equipmentGroups.set(groupKey, []);
          }
          equipmentGroups.get(groupKey)?.push(item);
      });

      this.equipmentList = Array.from(equipmentGroups.entries()).map(([model, items]) => ({
          id: items[0].id,
          model: model,
          name: items[0].name,
          allItems: items
      }));

      this.equipmentList.sort((a, b) => a.model.localeCompare(b.model));

      this.totalEquipment = rawEquipmentList.length;
      this.borrowedEquipment = await this.supabaseService.getBorrowedEquipmentCount();
      this.cdr.detectChanges();

      const suppliers = await this.supabaseService.getSuppliers();
      this.totalSuppliers = suppliers.length;
      this.usedInProjects = await this.supabaseService.getUsedInProjectsCount();

      this.recentActivities = await this.supabaseService.getRecentActivities();
      this.recentActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      this.computeLowStock();
      this.updatePagination();

      this.loadSupplierRanking();

      // Load historical data
      await this.loadHistoricalData();

      // Initialize sparkline charts
      this.initializeSparklines();

      // Load aggregate cost data initially
      await this.loadAggregateCostData();

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setTimeout(() => {
        this.isLoading = false;
      }, 1000); // Minimum 1 second loading time for better UX
    }
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
  }

  getActivityTypeClass(type: string): string {
    switch (type) {
      case 'info': return 'info';
      case 'success': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'error';
      default: return 'info';
    }
  }

  exportChartData() {
    // Implement export functionality (CSV, PNG, etc.)
    console.log('Exporting chart data...');
    // You can implement actual export logic here
    // For example, export as CSV:
    this.exportAsCSV();
  }

  private exportAsCSV() {
    if (!this.costHistory.length) return;

    const headers = ['Date', 'Supplier', 'Supplier Cost', 'SRP'];
    const csvRows = [];

    // Add headers
    csvRows.push(headers.join(','));

    // Add data rows
    this.costHistory.forEach(entry => {
      const row = [
        entry.date_updated,
        entry.supplier || 'N/A',
        entry.supplier_cost,
        entry.srp
      ];
      csvRows.push(row.join(','));
    });

    // Create CSV file
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);

    // Create download link
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'cost_history.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  getLatestSupplierPrice(supplierId: string): number | null {
    if (!this.costHistory.length) return null;
    
    if (this.isShowingAggregateData) {
      // For aggregate data, get the latest supplier cost
      const sorted = [...this.costHistory].sort((a, b) =>
        new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime());
      return sorted[0]?.supplier_cost || null;
    }
    
    const supplierName = this.selectedEquipmentSuppliers.find(s => s.id === supplierId)?.name;
    if (!supplierName) return null;

    const supplierEntries = this.costHistory
      .filter(entry => entry.supplier === supplierName)
      .sort((a, b) => new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime());

    return supplierEntries[0]?.supplier_cost || null;
  }

  getLatestSrpPrice(): number | null {
    if (!this.costHistory.length) return null;

    const sorted = [...this.costHistory].sort((a, b) =>
      new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime());

    return sorted[0]?.srp || null;
  }

  changeTimeframe(timeframe: string) {
    this.selectedTimeframe = timeframe;
    // this.updateChartWithTimeframe();
  }


  calculateChartStats(data: any[]) {
    if (data.length === 0) {
      this.priceChangePercentage = null;
      this.currentAveragePrice = null;
      this.lowestPrice = null;
      this.highestPrice = null;
      this.currentPrice = null;
      this.lowestPriceDate = null;
      this.highestPriceDate = null;
      return;
    }

    // Sort chronologically
    const sortedData = [...data].sort((a, b) =>
      new Date(a.date_updated).getTime() - new Date(b.date_updated).getTime());

    // Get first and last prices (using supplier cost)
    const firstPrice = sortedData[0].supplier_cost;
    const lastPrice = sortedData[sortedData.length - 1].supplier_cost;

    // Calculate percentage change
    this.priceChangePercentage = ((lastPrice - firstPrice) / firstPrice) * 100;

    // Calculate current average (average of last 3 entries)
    const lastThree = sortedData.slice(-3).map(entry => entry.supplier_cost);
    this.currentAveragePrice = lastThree.reduce((sum, price) => sum + price, 0) / lastThree.length;

    // Find lowest and highest prices
    const prices = sortedData.map(entry => entry.supplier_cost);
    this.lowestPrice = Math.min(...prices);
    this.highestPrice = Math.max(...prices);

    // Find dates for lowest and highest prices
    this.lowestPriceDate = sortedData.find(entry => entry.supplier_cost === this.lowestPrice)?.date_updated;
    this.highestPriceDate = sortedData.find(entry => entry.supplier_cost === this.highestPrice)?.date_updated;

    // Current price
    this.currentPrice = lastPrice;
  }

  getActivityIcon(type: string): string {
    switch (type) {
      case 'info': return 'fas fa-info-circle';
      case 'success': return 'fas fa-check-circle';
      case 'warning': return 'fas fa-exclamation-triangle';
      case 'error': return 'fas fa-times-circle';
      default: return 'fas fa-info-circle';
    }
  }

  onPageChange(event: any) {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updatePagination();
  }

  applyActivityFilter() {
    const { startDate, endDate, message } = this.filter;
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    this.filteredActivities = this.recentActivities.filter(activity => {
      const activityDate = new Date(activity.timestamp);
      const messageMatch = message ? activity.message.toLowerCase().includes(message.toLowerCase()) : true;
      const startMatch = start ? activityDate >= start : true;
      const endMatch = end ? activityDate <= end : true;

      return messageMatch && startMatch && endMatch;
    });

    // Reset to first page after filtering
    this.currentPage = 0;

    this.updatePagination();
  }




  computeLowStock() {
    const groupedStock: { [key: string]: { model: string; stock: number } } = {};
    const lowStockThreshold = 3;

    // Group by model and sum quantities
    this.equipmentList.forEach(equipmentGroup => {
      equipmentGroup.allItems.forEach((item: any) => {
        const modelKey = item.model?.trim().toLowerCase() || 'uncategorized';

        if (!groupedStock[modelKey]) {
          groupedStock[modelKey] = {
            model: item.model || 'Unspecified Model',
            stock: 0
          };
        }

        groupedStock[modelKey].stock += Number(item.quantity) || 0;
      });
    });

    this.updatedEquipmentList = Object.values(groupedStock);
    this.lowStockEquipment = this.updatedEquipmentList.filter(item => item.stock < lowStockThreshold);
    this.lowStockCount = this.lowStockEquipment.length;
  }

// Modify your loading completion handler
completeLoading() {
  this.isLoading = false;
  setTimeout(() => {
    this.isLoaded = true;
    this.cdr.detectChanges(); // Trigger change detection
    this.recalculateLayout(); // Call this if you have chart resizing logic
  }, 100);
}

// Add this method
recalculateLayout() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('resize'));
  }
}

// Update ngAfterViewInit
ngAfterViewInit() {
  this.initializeChart();
  // Add a fallback resize handler
  setTimeout(() => this.recalculateLayout(), 500);
}

  async loadUserEmail() {
    const user = await this.supabaseService.getUser();
    this.userEmail = user?.email || 'Guest';
  }

  async onEquipmentChange(event: any) {
    const selectedModel = event.target.value;
    this.costHistory = [];
    this.selectedEquipmentSuppliers = [];
    this.selectedSuppliers = [];
    this.isShowingAggregateData = false; // Reset aggregate flag

    if (selectedModel) {
      console.log(`🔄 Fetching cost history for Model: ${selectedModel}`);

      // Get all equipment with this model
      const { data: equipmentData, error: equipmentError } = await this.supabaseService
        .from('equipments')
        .select('*')
        .eq('model', selectedModel);

      if (equipmentError) {
        console.error('Error fetching equipment:', equipmentError);
        return;
      }

      if (!equipmentData || equipmentData.length === 0) {
        console.warn('No equipment found for model:', selectedModel);
        return;
      }

      // Get cost history for all equipment with this model
      let costData: any[] = [];
      for (const equipment of equipmentData) {
        const history = await this.supabaseService.getCostHistory(equipment.id);
        costData = [...costData, ...history];
      }

      console.log('📊 Raw Cost History from DB:', JSON.stringify(costData, null, 2));

      // Extract unique supplier names from cost history
      const supplierNames = [...new Set(costData.map(item => item.supplier).filter(Boolean))] as string[];

      // Map to supplier objects
      this.selectedEquipmentSuppliers = supplierNames.map(name => ({
        id: name,  // Using name as ID
        name: name
      }));

      // Generate color palette for suppliers
      this.generateColorPalette(this.selectedEquipmentSuppliers.length);

      // Normalize date format
      costData = costData.map(entry => ({
        ...entry,
        date_updated: new Date(entry.date_updated).toISOString().split('T')[0]
      }));

      console.log('📊 Normalized Cost History:', JSON.stringify(costData, null, 2));

      // For initial entry, use the first equipment in the group
      const firstEquipment = equipmentData[0];
      const { data: firstCostEntry, error: fetchError } = await this.supabaseService.getFirstCostEntry(firstEquipment.id);

      if (fetchError) {
        console.error("❌ Error fetching first cost entry:", fetchError);
      } else {
        console.log("🔍 First Recorded Cost Entry:", JSON.stringify(firstCostEntry, null, 2));
      }

      // Create initial entry if missing
      if (!firstCostEntry) {
        console.log("🆕 No initial cost entry found, inserting...");

        const initialEntry = {
          equipment_id: firstEquipment.id,
          supplier_cost: firstEquipment.supplier_cost,
          srp: firstEquipment.srp,
          date_updated: new Date(firstEquipment.date_acquired).toISOString().split('T')[0],
          entry_type: 'initial',
          supplier: firstEquipment.supplier || 'Unknown'
        };

        await this.supabaseService.addCostHistory(firstEquipment.id, initialEntry);
        costData.unshift(initialEntry);
        console.log('✅ Initial cost entry added.');
      }

      // Sort chronologically
      costData.sort((a, b) => new Date(a.date_updated).getTime() - new Date(b.date_updated).getTime());

      console.log('📊 Final Sorted Cost History:', JSON.stringify(costData, null, 2));

      // Update chart
      this.costHistory = costData;
      this.updateChart();
    } else {
      // If no model selected, show aggregate data
      await this.loadAggregateCostData();
    }
  }

// Helper methods
private findSupplierId(supplierName: string, suppliers: any[]): string | null {
  if (!supplierName) return null;
  const found = suppliers.find(s => s.name === supplierName);
  return found ? found.id : null;
}

private getUniqueSuppliers(costData: any[], allSuppliers: any[]): {id: string, name: string}[] {
  const supplierIds = [...new Set(costData.map(item => item.supplier_id).filter(Boolean))];
  return allSuppliers.filter(s => supplierIds.includes(s.id));
}

private generateColorPalette(count: number): void {
  // Generate a dynamic color palette based on number of suppliers
  const baseColors = [
    '#66BBDE', // Light blue
    '#4FA8D1', // Medium blue
    '#3B95C4', // Darker blue
    '#2982B7', // Deep blue
    '#1E6FA0', // Navy blue
  ];

  this.supplierColors = Array.from({ length: count }, (_, i) => {
    // If we have more suppliers than base colors, cycle through the base colors
    return baseColors[i % baseColors.length];
  });
}
// Add these methods to your DashboardComponent
toggleSupplierSelection(supplierId: string): void {
  if (this.selectedSuppliers.includes(supplierId)) {
    this.selectedSuppliers = this.selectedSuppliers.filter(id => id !== supplierId);
  } else {
    this.selectedSuppliers = [...this.selectedSuppliers, supplierId];
  }
  this.updateChart();
}

selectAllSuppliers(): void {
  this.selectedSuppliers = this.selectedEquipmentSuppliers.map(s => s.id);
  this.updateChart();
}

clearSupplierSelection(): void {
  this.selectedSuppliers = [];
  this.updateChart();
}

printRecentActivities() {
  const printWindow = window.open('', '', 'height=500,width=800');

  // Use recentActivities if no filter is applied
  const activitiesToPrint = this.filteredActivities.length ? this.filteredActivities : this.recentActivities;

  console.log(activitiesToPrint); // Debugging

  if (printWindow) {
    // Write initial HTML for the print window
    printWindow.document.write('<html><head><title>Recent Activities</title></head><body>');
    printWindow.document.write('<h2>Recent Activities</h2>');

    // Add activities to the print window
    activitiesToPrint.forEach(activity => {
      const formattedTimestamp = activity.timestamp ?
        new Date(activity.timestamp).toLocaleString('en-US', {
          weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true
        }) : 'Unknown Time';

      printWindow.document.write(`
        <p><strong>Activity:</strong> ${activity.message}</p>
        <p><strong>Date:</strong> ${formattedTimestamp}</p>
        <hr>
      `);
    });

    // Close the document, allowing it to fully load
    printWindow.document.write('</body></html>');
    printWindow.document.close();

    // Delay the print action to ensure everything is rendered
    setTimeout(() => {
      printWindow.print();
    }, 500);
  } else {
    console.error('Failed to open print window');
  }
}

initializeChart() {
  const canvas = document.getElementById('costChart') as HTMLCanvasElement;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Create gradient effects for better visualization
  const gradientSupplier = ctx.createLinearGradient(0, 0, 0, 400);
  gradientSupplier.addColorStop(0, 'rgba(102, 187, 222, 0.2)');  // Light blue
  gradientSupplier.addColorStop(1, 'rgba(102, 187, 222, 0.0)');

  const gradientSRP = ctx.createLinearGradient(0, 0, 0, 400);
  gradientSRP.addColorStop(0, 'rgba(183, 26, 74, 0.2)');  // Light red
  gradientSRP.addColorStop(1, 'rgba(183, 26, 74, 0.0)');

  this.costChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Supplier Cost',
          data: [],
          borderColor: '#66BBDE',
          backgroundColor: gradientSupplier,
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#66BBDE',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointHoverBorderWidth: 3,
          pointHoverBackgroundColor: '#66BBDE',
          pointHoverBorderColor: '#FFFFFF'
        },
        {
          label: 'Your Retail Price (SRP)',
          data: [],
          borderColor: '#B71A4A',
          backgroundColor: gradientSRP,
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#B71A4A',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointHoverBorderWidth: 3,
          pointHoverBackgroundColor: '#B71A4A',
          pointHoverBorderColor: '#FFFFFF'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          titleColor: '#1a1a1a',
          titleFont: {
            size: 13,
            weight: 600,
            family: "'Inter', sans-serif"
          },
          bodyColor: '#666666',
          bodyFont: {
            size: 12,
            family: "'Inter', sans-serif"
          },
          padding: 12,
          boxPadding: 6,
          usePointStyle: true,
          borderColor: 'rgba(0, 0, 0, 0.1)',
          borderWidth: 1,
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += new Intl.NumberFormat('en-PH', {
                  style: 'currency',
                  currency: 'PHP',
                  minimumFractionDigits: 2
                }).format(context.parsed.y);
              }
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          border: {
            display: false
          },
          ticks: {
            font: {
              size: 11,
              family: "'Inter', sans-serif",
              weight: 500
            },
            color: '#666666',
            maxRotation: 45,
            minRotation: 45,
            padding: 8
          }
        },
        y: {
          border: {
            display: false
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.06)',
            display: false,
            lineWidth: 1
          },
          ticks: {
            font: {
              size: 11,
              family: "'Inter', sans-serif",
              weight: 500
            },
            color: '#666666',
            padding: 8,
            callback: function(value) {
              return new Intl.NumberFormat('en-PH', {
                style: 'currency',
                currency: 'PHP',
                notation: 'compact',
                minimumFractionDigits: 0,
                maximumFractionDigits: 1
              }).format(value as number);
            }
          }
        }
      },
      animations: {
        tension: {
          duration: 1000,
          easing: 'easeInOutQuart',
          from: 0.8,
          to: 0.4,
          loop: false
        }
      }
    }
  });
}

updateChart() {
  if (this.costChart) {
    this.costChart.destroy();
  }

  setTimeout(() => {
    const canvas = document.getElementById('costChart') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('⚠ No valid chart context found');
      return;
    }

    // Handle empty data case
    if (!this.costHistory.length) {
      this.createEmptyChart(ctx, canvas);
      return;
    }

    // Get all unique dates for consistent x-axis
    const allDates = [...new Set(this.costHistory.map(entry => entry.date_updated))].sort();

    // Create a map of all SRP values by date
    const srpByDate = new Map();
    this.costHistory.forEach(entry => {
      if (!srpByDate.has(entry.date_updated) || entry.srp > srpByDate.get(entry.date_updated)) {
        srpByDate.set(entry.date_updated, entry.srp);
      }
    });

    // Prepare datasets for each selected supplier
    const supplierDatasets = this.selectedSuppliers.length > 0 && !this.isShowingAggregateData
      ? this.selectedSuppliers.map((supplierId, index) => {
          const supplier = this.selectedEquipmentSuppliers.find(s => s.id === supplierId);
          const supplierData = this.costHistory.filter(entry =>
            supplier && entry.supplier === supplier.name
          );

          // Create data points for this supplier
          const dataPoints = allDates.map(date => {
            const entry = supplierData.find(d => d.date_updated === date);
            return entry ? entry.supplier_cost : null;
          });

          // Create gradient for this supplier
          const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
          const color = this.supplierColors[index];
          gradient.addColorStop(0, `${color}33`); // 20% opacity
          gradient.addColorStop(1, `${color}00`); // 0% opacity

          return {
            label: supplier ? supplier.name : 'Unknown Supplier',
            data: dataPoints,
            borderColor: color,
            backgroundColor: gradient,
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointBackgroundColor: color,
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointHoverBorderWidth: 3,
            pointHoverBackgroundColor: color,
            pointHoverBorderColor: '#FFFFFF',
            spanGaps: true
          };
        })
      : this.isShowingAggregateData 
        ? [{
            // For aggregate data, create a supplier cost dataset
            label: 'Monthly Total Cost',
            data: allDates.map(date => {
              const entry = this.costHistory.find(d => d.date_updated === date);
              return entry ? entry.supplier_cost : null;
            }),
            borderColor: '#66BBDE',
            backgroundColor: (() => {
              const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
              gradient.addColorStop(0, 'rgba(102, 187, 222, 0.2)');
              gradient.addColorStop(1, 'rgba(102, 187, 222, 0.0)');
              return gradient;
            })(),
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointBackgroundColor: '#66BBDE',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointHoverBorderWidth: 3,
            pointHoverBackgroundColor: '#66BBDE',
            pointHoverBorderColor: '#FFFFFF',
            spanGaps: true
          }]
        : [{
            label: 'Average Supplier Cost',
            data: allDates.map(date => {
              const entriesForDate = this.costHistory.filter(entry => entry.date_updated === date);
              if (entriesForDate.length === 0) return null;
              const totalCost = entriesForDate.reduce((sum, entry) => sum + entry.supplier_cost, 0);
              return totalCost / entriesForDate.length;
            }),
            borderColor: '#66BBDE',
            backgroundColor: (() => {
              const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
              gradient.addColorStop(0, 'rgba(102, 187, 222, 0.2)');
              gradient.addColorStop(1, 'rgba(102, 187, 222, 0.0)');
              return gradient;
            })(),
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointBackgroundColor: '#66BBDE',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointHoverBorderWidth: 3,
            pointHoverBackgroundColor: '#66BBDE',
            pointHoverBorderColor: '#FFFFFF',
            spanGaps: true
          }];

    // Prepare SRP dataset
    const srpDataset = {
      label: this.isShowingAggregateData ? 'Monthly Total SRP' : 'Your Retail Price (SRP)',
      data: allDates.map(date => {
        if (this.isShowingAggregateData) {
          // For aggregate data, get SRP directly from the cost history
          const entry = this.costHistory.find(d => d.date_updated === date);
          return entry ? entry.srp : null;
        } else {
          // For specific equipment, use the existing logic
          return srpByDate.get(date) || null;
        }
      }),
      borderColor: '#B71A4A',
      backgroundColor: (() => {
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(183, 26, 74, 0.2)');
        gradient.addColorStop(1, 'rgba(183, 26, 74, 0.0)');
        return gradient;
      })(),
      borderWidth: 2,
      tension: 0.4,
      fill: true,
      pointBackgroundColor: '#B71A4A',
      pointBorderColor: '#FFFFFF',
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointHoverBorderWidth: 3,
      pointHoverBackgroundColor: '#B71A4A',
      pointHoverBorderColor: '#FFFFFF',
      spanGaps: true
    };

    // Format dates
    const labels = allDates.map(date => {
      return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    });

    // Create the chart with all datasets
    this.costChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [...supplierDatasets, srpDataset]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            titleColor: '#1a1a1a',
            titleFont: {
              size: 13,
              weight: 600,
              family: "'Inter', sans-serif"
            },
            bodyColor: '#666666',
            bodyFont: {
              size: 12,
              family: "'Inter', sans-serif"
            },
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            borderColor: 'rgba(0, 0, 0, 0.1)',
            borderWidth: 1,
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += new Intl.NumberFormat('en-PH', {
                    style: 'currency',
                    currency: 'PHP',
                    minimumFractionDigits: 2
                  }).format(context.parsed.y);
                }
                return label;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            border: {
              display: false
            },
            ticks: {
              font: {
                size: 11,
                family: "'Inter', sans-serif",
                weight: 500
              },
              color: '#666666',
              maxRotation: 45,
              minRotation: 45,
              padding: 8
            }
          },
          y: {
            border: {
              display: false
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.06)',
              display: false,
              lineWidth: 1
            },
            ticks: {
              font: {
                size: 11,
                family: "'Inter', sans-serif",
                weight: 500
              },
              color: '#666666',
              padding: 8,
              callback: function(value) {
                return new Intl.NumberFormat('en-PH', {
                  style: 'currency',
                  currency: 'PHP',
                  notation: 'compact',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 1
                }).format(value as number);
              }
            }
          }
        },
        animations: {
          tension: {
            duration: 1000,
            easing: 'easeInOutQuart',
            from: 0.8,
            to: 0.4,
            loop: false
          }
        }
      }
    });

    // Update the filtered cost history for display
    this.filteredCostHistory = this.costHistory.filter(entry =>
      this.selectedSuppliers.length === 0 ||
      this.selectedSuppliers.includes(
        this.selectedEquipmentSuppliers.find(s => s.name === entry.supplier)?.id || ''
      )
    );

    // Calculate chart statistics
    this.calculateChartStats(this.costHistory);
  }, 100);
}

// Add method to create empty chart placeholder
createEmptyChart(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  // Create a simple placeholder chart
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, 'rgba(102, 187, 222, 0.1)');
  gradient.addColorStop(1, 'rgba(102, 187, 222, 0.0)');

  this.costChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['No Data'],
      datasets: [{
        label: 'No Cost Data Available',
        data: [0],
        borderColor: '#e2e8f0',
        backgroundColor: gradient,
        borderWidth: 1,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#e2e8f0',
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 1,
        pointRadius: 2,
        pointHoverRadius: 4,
        pointHoverBorderWidth: 2,
        pointHoverBackgroundColor: '#e2e8f0',
        pointHoverBorderColor: '#FFFFFF'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: false
        }
      },
      scales: {
        x: {
          display: false
        },
        y: {
          display: false
        }
      },
      elements: {
        point: {
          radius: 0
        }
      }
    }
  });

  // Add a text overlay to indicate no data
  ctx.save();
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Select equipment to view cost history', canvas.width / 2, canvas.height / 2);
  ctx.restore();
}

  // updatePagination() {
  //   this.totalPages = Math.ceil(this.recentActivities.length / this.pageSize);
  //   this.paginatedActivities = this.recentActivities.slice(this.currentPage * this.pageSize, (this.currentPage + 1) * this.pageSize);
  // }
  updatePagination() {
    const source = this.filteredActivities.length ? this.filteredActivities : this.recentActivities;

    // ✅ Sort by descending timestamp
    source.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    this.totalPages = Math.ceil(source.length / this.pageSize);

    // ✅ Ensure the current page never exceeds total pages
    if (this.currentPage >= this.totalPages) {
      this.currentPage = Math.max(0, this.totalPages - 1);
    }

    this.paginatedActivities = source.slice(
      this.currentPage * this.pageSize,
      (this.currentPage + 1) * this.pageSize
    );
  }


  // ✅ Go to Next Page
  nextPage() {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  // ✅ Go to Previous Page
  prevPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  // ✅ Jump to a Specific Page
  goToPage(page: number | "...") {
    if (typeof page === "number" && page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  async loadHistoricalData() {
    // Get last 7 days of data
    const today = new Date();
    const dates = Array.from({length: 7}, (_, i) => {
      const date = new Date();
      date.setDate(today.getDate() - (6 - i));
      return date.toISOString().split('T')[0];
    });

    // Mock data for demonstration - replace with actual API calls
    this.supplierHistory = dates.map(() => Math.floor(Math.random() * 20) + 10);
    this.equipmentHistory = dates.map(() => Math.floor(Math.random() * 50) + 30);
    this.borrowedHistory = dates.map(() => Math.floor(Math.random() * 15) + 5);
    this.projectsHistory = dates.map(() => Math.floor(Math.random() * 25) + 15);
  }

  initializeSparklines() {
    this.createSparkline('supplierSparkline', this.supplierHistory, '#66BBDE');
    this.createSparkline('equipmentSparkline', this.equipmentHistory, '#A0143F');
    this.createSparkline('borrowedSparkline', this.borrowedHistory, '#B71A4A');
    this.createSparkline('projectsSparkline', this.projectsHistory, '#03045E');
  }

  createSparkline(canvasId: string, data: number[], color: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Array(data.length).fill(''),
        datasets: [{
          data: data,
          backgroundColor: color,
          borderColor: color,
          borderWidth: 1,
          borderRadius: 2,
          barThickness: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: false
          }
        },
        scales: {
          x: {
            display: false,
            grid: {
              display: false
            }
          },
          y: {
            display: false,
            grid: {
              display: false
            },
            min: 0
          }
        },
        animation: {
          duration: 1000,
          easing: 'easeInOutQuart'
        }
      }
    });
  }


  async loadSupplierRanking() {
  try {
    // Fetch all suppliers and their products
    const { data: suppliers, error: supError } = await this.supabaseService
      .from('suppliers')
      .select('*');

    if (supError) throw supError;

    const { data: equipments, error: eqError } = await this.supabaseService
      .from('equipments')
      .select('id, supplier, supplier_cost, quantity, status');

    if (eqError) throw eqError;

    // Calculate scores for each supplier
    const ranked = suppliers.map(supplier => {
      const supplierProducts = equipments.filter(e => e.supplier === supplier.supplier_name);

      // Price score (lower average is better)
      const avgPrice = supplierProducts.reduce((sum, p) => sum + (p.supplier_cost || 0), 0) /
                      (supplierProducts.length || 1);
      const priceScore = 10 - (avgPrice / 1000); // Adjust divisor based on your price range

      // Inventory score
      const totalStock = supplierProducts.reduce((sum, p) => sum + (p.quantity || 0), 0);
      const inventoryScore = Math.min(10, totalStock / 50); // Adjust divisor based on your stock levels

      // Reliability score (placeholder - you might need to track this separately)
      const reliabilityScore = 7 + Math.random() * 3; // Random for now

      // Overall score
      const overallScore = (priceScore * 0.4) + (inventoryScore * 0.3) + (reliabilityScore * 0.3);

      return {
        ...supplier,
        price_score: Math.min(10, Math.max(0, priceScore)),
        inventory_score: Math.min(10, Math.max(0, inventoryScore)),
        reliability_score: Math.min(10, Math.max(0, reliabilityScore)),
        overall_score: Math.min(10, Math.max(0, overallScore))
      };
    });

    // Sort by overall score
    this.rankedSuppliers = ranked.sort((a, b) => b.overall_score - a.overall_score);
    this.topSupplierName = this.rankedSuppliers[0]?.supplier_name || 'N/A';
    this.lastUpdated = new Date();
  } catch (error) {
    console.error('Error loading supplier ranking:', error);
  }
}

updateSupplierRanking() {
  switch(this.rankingFilter) {
    case 'price':
      this.rankedSuppliers.sort((a, b) => b.price_score - a.price_score);
      break;
    case 'inventory':
      this.rankedSuppliers.sort((a, b) => b.inventory_score - a.inventory_score);
      break;
    case 'reliability':
      this.rankedSuppliers.sort((a, b) => b.reliability_score - a.reliability_score);
      break;
    default:
      this.rankedSuppliers.sort((a, b) => b.overall_score - a.overall_score);
  }
}

viewSupplierDetails(supplierId: number) {
  this.router.navigate(['/supplier-profile', supplierId]);
}

scrollToRanking() {
  const element = document.getElementById('supplier-ranking');
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
}


async exportRankingPDF() {
  try {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size (595 x 842 points)

    // Set up fonts
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    // Add title
    page.drawText('Supplier Ranking Report', {
      x: 50,
      y: 780,
      size: 20,
      font: helveticaBold,
      color: rgb(0, 0.2, 0.4),
    });

    // Add date
    page.drawText(`Generated on ${new Date().toLocaleDateString()}`, {
      x: 50,
      y: 750,
      size: 12,
      font: helvetica,
      color: rgb(0.3, 0.3, 0.3),
    });

    // Add company logo (if available)
    // const logoBytes = await fetch('/assets/logo.png').then(res => res.arrayBuffer());
    // const logoImage = await pdfDoc.embedPng(logoBytes);
    // page.drawImage(logoImage, {
    //   x: 450,
    //   y: 770,
    //   width: 100,
    //   height: 40,
    // });

    // Create table
    await this.createPDFTable(pdfDoc, page);

    // Add footer
    page.drawText('Confidential - For Internal Use Only', {
      x: 200,
      y: 30,
      size: 10,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Save the PDF
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    // Create download link
    const link = document.createElement('a');
    link.href = url;
    link.download = `supplier_ranking_${new Date().toISOString().slice(0,10)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Show success notification
    alert('Supplier ranking exported successfully as PDF');
  } catch (error) {
    console.error('Error exporting PDF:', error);
    alert('Failed to export supplier ranking as PDF');
  }
}

private async createPDFTable(pdfDoc: PDFDocument, page: any) {
  const { width, height } = page.getSize();
  const margin = 20;
  const rowHeight = 30;
  const headerHeight = 25;
  const columnWidths = [30, 80, 50, 50, 50, 50, 70, 80, 100]; // Adjust as needed
  const tableTop = 700;
  
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Draw table headers
  const headers = [
    "Rank", "Supplier", "Avg Price", "Inventory", 
    "Reliability", "Overall", "Contact", "Phone", "Email"
  ];
  
  let x = margin;
  headers.forEach((header, i) => {
    // Draw header background
    page.drawRectangle({
      x,
      y: tableTop - headerHeight,
      width: columnWidths[i],
      height: headerHeight,
      color: rgb(0.2, 0.4, 0.6),
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 0.5,
    });
    
    // Draw header text
    page.drawText(header, {
      x: x + 5,
      y: tableTop - headerHeight + 5,
      size: 10,
      font: helveticaBold,
      color: rgb(1, 1, 1),
      maxWidth: columnWidths[i] - 10,
    });
    
    x += columnWidths[i];
  });

  // Draw table rows
  let currentY = tableTop - headerHeight - rowHeight;
  
  this.rankedSuppliers.forEach((supplier, index) => {
    x = margin;
    const rowData = [
      (index + 1).toString(),
      supplier.supplier_name,
      supplier.price_score.toFixed(2),
      supplier.inventory_score.toFixed(2),
      supplier.reliability_score.toFixed(2),
      supplier.overall_score.toFixed(2),
      supplier.contact_person || 'N/A',
      supplier.phone || 'N/A',
      supplier.email || 'N/A'
    ];
    
    // Alternate row colors
    const rowColor = index % 2 === 0 ? rgb(0.95, 0.95, 0.95) : rgb(1, 1, 1);
    
    // Draw row background
    page.drawRectangle({
      x,
      y: currentY,
      width: columnWidths.reduce((a, b) => a + b, 0),
      height: rowHeight,
      color: rowColor,
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 0.5,
    });
    
    // Draw cell content
    rowData.forEach((cell, i) => {
      // Highlight overall score
      const isOverall = i === 5;
      const cellColor = isOverall ? rgb(0.8, 0, 0) : rgb(0, 0, 0);
      
      page.drawText(cell, {
        x: x + 5,
        y: currentY + 5,
        size: 10,
        font: isOverall ? helveticaBold : helvetica,
        color: cellColor,
        maxWidth: columnWidths[i] - 10,
      });
      
      x += columnWidths[i];
    });
    
    currentY -= rowHeight;
    
    // Add new page if we run out of space
    if (currentY < margin) {
      page = pdfDoc.addPage([595, 842]);
      currentY = height - margin - headerHeight;
      
      // Redraw headers on new page
      x = margin;
      headers.forEach((header, i) => {
        page.drawRectangle({
          x,
          y: currentY,
          width: columnWidths[i],
          height: headerHeight,
          color: rgb(0.2, 0.4, 0.6),
          borderColor: rgb(0.8, 0.8, 0.8),
          borderWidth: 0.5,
        });
        
        page.drawText(header, {
          x: x + 5,
          y: currentY + 5,
          size: 10,
          font: helveticaBold,
          color: rgb(1, 1, 1),
          maxWidth: columnWidths[i] - 10,
        });
        
        x += columnWidths[i];
      });
      
      currentY -= rowHeight;
    }
  });
}

onSidebarCollapsed(collapsed: boolean) {
    this.isCollapsed = collapsed;
    this.cdr.detectChanges();
  }

  // Add method to load aggregate cost data
  async loadAggregateCostData() {
    try {
      console.log('🔄 Loading aggregate cost data...');
      
      // Get all equipment with cost data
      const { data: equipmentData, error: equipmentError } = await this.supabaseService
        .from('equipments')
        .select('id, model, name, supplier_cost, srp, date_acquired, supplier')
        .not('supplier_cost', 'is', null)
        .gt('supplier_cost', 0)
        .order('date_acquired', { ascending: true });

      if (equipmentError) {
        console.error('Error fetching equipment data:', equipmentError);
        return;
      }

      if (!equipmentData || equipmentData.length === 0) {
        console.warn('No equipment with cost data found');
        return;
      }

      // Create aggregate data points by month
      const monthlyData = new Map<string, { totalCost: number, totalSrp: number, count: number }>();
      
      equipmentData.forEach(equipment => {
        const date = new Date(equipment.date_acquired);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData.has(monthKey)) {
          monthlyData.set(monthKey, { totalCost: 0, totalSrp: 0, count: 0 });
        }
        
        const monthData = monthlyData.get(monthKey)!;
        monthData.totalCost += equipment.supplier_cost || 0;
        monthData.totalSrp += equipment.srp || 0;
        monthData.count += 1;
      });

      // Convert to chart data format
      const sortedMonths = Array.from(monthlyData.keys()).sort();
      const aggregateCostData = sortedMonths.map(monthKey => {
        const monthData = monthlyData.get(monthKey)!;
        return {
          date_updated: `${monthKey}-01`, // Use first day of month
          supplier_cost: monthData.totalCost,
          srp: monthData.totalSrp,
          supplier: 'Aggregate',
          entry_type: 'aggregate'
        };
      });

      // Add some recent cost history data for more granular view
      const recentCostHistory = await this.getRecentCostHistory();
      aggregateCostData.push(...recentCostHistory);

      // Sort by date
      aggregateCostData.sort((a, b) => new Date(a.date_updated).getTime() - new Date(b.date_updated).getTime());

      console.log('📊 Aggregate Cost Data:', aggregateCostData);

      // Set up for aggregate display
      this.costHistory = aggregateCostData;
      this.selectedEquipmentSuppliers = [{ id: 'aggregate', name: 'Overall Cost Trend' }];
      this.selectedSuppliers = ['aggregate'];
      this.supplierColors = ['#66BBDE'];
      this.isShowingAggregateData = true;

      // Update chart
      this.updateChart();

    } catch (error) {
      console.error('Error loading aggregate cost data:', error);
    }
  }

  // Helper method to get recent cost history for more granular data
  async getRecentCostHistory() {
    try {
      const { data: recentHistory, error } = await this.supabaseService
        .from('equipment_cost_history')
        .select('supplier_cost, srp, date_updated, supplier')
        .order('date_updated', { ascending: false })
        .limit(20); // Get last 20 entries

      if (error) {
        console.error('Error fetching recent cost history:', error);
        return [];
      }

      return recentHistory.map(entry => ({
        ...entry,
        supplier: entry.supplier || 'Recent Update',
        entry_type: 'recent'
      }));
    } catch (error) {
      console.error('Error in getRecentCostHistory:', error);
      return [];
    }
  }

}
