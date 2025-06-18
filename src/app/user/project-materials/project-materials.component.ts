import { Component, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { SupabaseAuthService } from '../../services/supabase-auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../nav/sidebar/sidebar.component';
import { DeliveryReceiptComponent } from '../delivery-receipt/delivery-receipt.component';
import { animate, style, transition, trigger, state, keyframes } from '@angular/animations';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { BreadcrumbComponent } from '../../breadcrumb/breadcrumb.component';

interface ProjectMaterial {
  equipment_id: string;
  quantity: number;
  name: string;
  model: string;
  brand: string;
  srp: number;
  supplier?: string;
  profitMargin?: number;
  cost?: number;
  actual_cost?: number;
  previousQuantity?: number;
  decremented?: boolean;
  status?: 'approved' | 'rejected';
  brochure_url?: string | null; // Add this line
}

interface CreateProjectMaterial {
  equipmentId: string;
  quantity: number;
}

interface Equipment {
  id: string;
  name: string;
  description: string;
  quantity: number;
  status: string;
  condition?: string;
  items?: Equipment[];
  model?: string;
  brand?: string;
  supplier?: string;
  deleted_at?: string | null;
  srp: number;
  product_images: string[];
  brochure_url?: string | null; // Add this line
}

interface Project {
    id: string;
  name: string;
  description: string;
  materials: ProjectMaterial[];
  client_name: string; // ✅ Added this line
  client_phone?: string;
  client_address?: string;
  client_email?: string;
  fileUrl?: string;
  file: File | null;
  delivered?: boolean;
  subtotal?: number;  // Add this
  vat?: number;      // Add this
  total?: number;    // Add this
  delivery_status?: string; // <-- Added to fix compile error
}

const SUPABASE_URL = 'https://xvcgubrtandfivlqcmww.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2Y2d1YnJ0YW5kZml2bHFjbXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkxNDk4NjYsImV4cCI6MjA1NDcyNTg2Nn0.yjd-SXfzJe6XmuNpI2HsZcI9EsS9AxBXI-qukzgcZig';

interface PostgrestError {
  message: string;
  details: string;
  hint: string;
  code: string;
}

@Component({
  selector: 'app-project-materials',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SidebarComponent,
    ToastModule,
    BreadcrumbComponent
  ],
  templateUrl: './project-materials.component.html',
  styleUrls: ['./project-materials.component.css'],
  providers: [MessageService],
  animations: [
    trigger('flyToSidebar', [
      state('normal', style({
        transform: 'scale(1)',
        opacity: 1
      })),
      state('flying', style({
        transform: 'scale(0.1) translateX(-500px) translateY(-200px)',
        opacity: 0
      })),
      transition('normal => flying', [
        animate('500ms ease-in', keyframes([
          style({ transform: 'scale(0.9) translateX(-50px)', offset: 0.3 }),
          style({ transform: 'scale(0.5) translateX(-200px) translateY(-50px)', offset: 0.6 }),
          style({ transform: 'scale(0.1) translateX(-500px) translateY(-200px)', opacity: 0, offset: 1.0 })
        ]))
      ])
    ])
  ]
})

export class ProjectMaterialsComponent implements OnInit {
    @ViewChild(DeliveryReceiptComponent) deliveryReceiptComponent!: DeliveryReceiptComponent;
  private supabase: SupabaseClient;
  userEmail: string | null = null;
  userId: string | null = null;
  isLoading: boolean = true; // Add loading state
  showModal: boolean = false;
  showEditModal: boolean = false;
  showDeleteModal: boolean = false;
  showEquipmentDetailsModal: boolean = false;
  projects: any[] = [];
  equipmentList: Equipment[] = [];
  filteredEquipmentList: Equipment[] = [];
  rawEquipmentList: Equipment[] = [];
  selectedEquipmentDetails: Equipment | null = null;
  selectedMaterials: any[] = [];
  editProject: { id: string; name: string; description: string; client_name?: string; client_address?: string; client_email?: string; client_phone?: string; materials: ProjectMaterial[] } | null = null;
  showProjectDetailsModal: boolean = false;
  selectedProject: any = null;
  selectedEquipments: ProjectMaterial[] = [];
  viewedEquipments: string[] = [];
  selectedItems: string[] = [];
  currentDateTime: string = '';
  totalSrp: number = 0; // Added totalSrp property
  myProjects: any[] = [];
  otherProjects: any[] = [];
  isDeleting = false;
  showToast = false;
toastMessage = '';
  allChecked: boolean = false;
  searchTerm: string = '';
  showImageModal: boolean = false;
  selectedImageUrl: string = '';
  project: Project = {
    id:'',
    name: '',
    description: '',
    client_name: '', // ✅ Added this line
    fileUrl: '', // initial file URL is empty
    file: null,  // file is initially null
    materials: []
  };
  showTemplatesModal = false;
  savedTemplates: { id: string; title: string; items: any[] }[] = [];
  rejectedItems: Set<string> = new Set();
  animationState = 'normal';
  isAnimating = false;
  isSidebarCollapsed: boolean = false
  isCollapsed = false;

  constructor(
    private authService: SupabaseAuthService,
    private supabaseService: SupabaseService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef // Add this
  ) {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }



  // Add this method
  onSidebarCollapsed(collapsed: boolean) {
    this.isCollapsed = collapsed;
    this.cdr.detectChanges();
  }

  async ngOnInit() {
    this.isLoading = true; // Set loading to true at start
    try {
      await this.loadUser();
      await this.fetchEquipment();
      await this.fetchProjects();
      this.updateDateTime();
    } finally {
      setTimeout(() => {
        this.isLoading = false; // Set loading to false after a minimum delay
      }, 1000); // Minimum 1 second loading time for better UX
    }
  }

  updateDateTime() {
    const now = new Date();
    this.currentDateTime = now.toLocaleString(); // Formats as "MM/DD/YYYY, HH:MM:SS AM/PM"
  }
  showSuccessToast(message: string) {
    this.toastMessage = message;
    this.showToast = true;

    setTimeout(() => {
      this.showToast = false;
    }, 3000); // Toast disappears after 3 seconds
  }
  async loadUser() {
    try {
      const user = await this.authService.getUser();
      if (user) {
        this.userEmail = user.email || null;
        this.userId = user.id?.toString() || null;  // Convert to string
      }
    } catch (error) {
      console.error('❌ Error loading user:', error);
    }
  }

  async openTemplatesModal() {
  this.showTemplatesModal = true;
  // Provide default values for title and items, or fetch them as needed
  await this.fetchSavedTemplates('', []);
}

  closeTemplatesModal() {
    this.showTemplatesModal = false;
  }

  async fetchSavedTemplates(title: string, items: any[]) {
  try {
     const entry = { title, items, timestamp: new Date().toISOString() };
    // Fetch all saved equipment templates from Supabase
    const templates = await this.supabaseService.getSavedEquipment();
    this.savedTemplates = (templates || []).map((template: any) => ({
      id: template.id,
      title: template.title,
      items: template.items
    }));
  } catch (error) {
    console.error('❌ Failed to fetch saved templates from Supabase:', error);
    this.savedTemplates = [];
  }
}


  applyTemplateToProject(template: { id: string; title: string; items: any[] }) {
  this.selectedEquipments = template.items.map(item => {
    // Find the equipment in your equipmentList for up-to-date info
    const eq = this.equipmentList.find(e => e.id === item.id) || {
      srp: 0,
      supplier: '',
      brochure_url: null,
      brand: '',
      model: ''
    };

    return {
      equipment_id: item.id,
      name: item.name,
      model: item.model || eq.model || '',
      brand: item.brand || eq.brand || '',
      supplier: item.supplier || eq.supplier || '',
      srp: eq.srp,
      quantity: item.quantity,
      profitMargin: item.profitMargin ?? 20,
      brochure_url: eq.brochure_url || null
    };
  });

  this.selectedItems = this.selectedEquipments.map(e => e.equipment_id);
  this.project.materials = [...this.selectedEquipments];
  this.closeTemplatesModal();
}

  async fetchEquipment() {
    try {
        console.log('🔄 Fetching available equipment...');

        // 1️⃣ Fetch ALL equipment including deleted ones (for debugging)
        const { data: allEquipment, error: allError } = await this.supabase
            .from('equipments')
            .select('*'); // Get everything including deleted

        if (allError) throw allError;
        console.log('📌 ALL equipment (including deleted):', allEquipment);

        // 2️⃣ Fetch only non-deleted equipment
        const { data: rawEquipmentList, error } = await this.supabase
        .from('equipments')
        .select('id, name, quantity, description, srp, brand, model, supplier, product_images, brochure_url, deleted_at')
        .is('deleted_at', null);

        if (error) throw error;
        console.log('📌 Non-deleted equipment:', rawEquipmentList);

        // 3️⃣ Check for any discrepancies
        if (rawEquipmentList.length === 0) {
            console.warn('⚠️ No equipment found in database!');
            this.equipmentList = [];
            this.rawEquipmentList = [];
            return;
        }

        // 4️⃣ Fetch used equipment with more details
        const { data: usedEquipment, error: usedError } = await this.supabase
            .from('project_materials')
            .select(`
                equipment_id,
                quantity,
                equipments!inner(name, model, brand)
            `);

        if (usedError) throw usedError;
        console.log('📌 Used equipment with details:', usedEquipment);

        // 5️⃣ Create used quantities map with better logging
        const usedEquipmentMap = new Map<string, number>();
        usedEquipment.forEach(e => {
            const current = usedEquipmentMap.get(e.equipment_id) || 0;
            usedEquipmentMap.set(e.equipment_id, current + e.quantity);
            console.log(`📊 Used ${e.quantity} of ${e.equipment_id} (${e.equipments?.[0]?.name || 'Unknown'})`);
        });

        // 6️⃣ Calculate available quantities with detailed logging
        const availableEquipment = rawEquipmentList
            .map(equipment => {
                const usedQty = usedEquipmentMap.get(equipment.id) || 0;
                const finalQuantity = equipment.quantity - usedQty;

                console.log(
                    `📦 ${equipment.name} (${equipment.model}): ` +
                    `Total=${equipment.quantity}, Used=${usedQty}, ` +
                    `Available=${finalQuantity} ${finalQuantity <= 0 ? '❌' : '✅'}`
                );

                return {
                    ...equipment,
                    quantity: finalQuantity,
                    srp: equipment.srp ?? 0,
                    status: finalQuantity > 0 ? 'available' : 'out-of-stock',
                    originalQuantity: equipment.quantity // Keep original for reference
                };
            })
            .filter(equipment => {
                const keep = equipment.quantity > 0;
                if (!keep) {
                    console.warn(
                        `🚫 Filtered out: ${equipment.name} (${equipment.id}) - ` +
                        `Available: ${equipment.quantity} (Original: ${equipment.originalQuantity})`
                    );
                }
                return keep;
            });

        console.log('✅ Available equipment after filtering:', availableEquipment);

        // 7️⃣ Group equipment with strict uniqueness check
        const groupedEquipmentMap = new Map<string, Equipment>();
        const duplicateCheck = new Map<string, number>();

        for (const equipment of availableEquipment) {
            // Strict unique key - include ID to prevent any merging
            const strictKey = `${equipment.id}-${equipment.name}-${equipment.model}-${equipment.brand}`.toLowerCase();

            // Count occurrences of similar items (for debugging)
            const similarKey = `${equipment.name}-${equipment.model}-${equipment.brand}`.toLowerCase();
            duplicateCheck.set(similarKey, (duplicateCheck.get(similarKey) || 0) + 1);

            if (groupedEquipmentMap.has(strictKey)) {
                console.warn(`🤔 Duplicate equipment detected: ${strictKey}`);
                continue;
            }

            groupedEquipmentMap.set(strictKey, {
                ...equipment,
                items: [equipment] // Store individual items
            });
        }

        // Log duplicate counts
        duplicateCheck.forEach((count, key) => {
            if (count > 1) {
                console.log(`🔍 Found ${count} similar items for: ${key}`);
            }
        });

        // 8️⃣ Convert to array and update component state
        this.equipmentList = Array.from(groupedEquipmentMap.values());
        this.rawEquipmentList = availableEquipment;

        console.log('✅ Final grouped equipment list:', this.equipmentList);
        console.log('🔢 Total available items:', this.equipmentList.length);

        // 9️⃣ Verify UI will show all items
        if (this.equipmentList.length <= 2) {
            console.error(
                '❌ Unexpected low item count! ' +
                'DB has:', rawEquipmentList.length,
                'Available:', availableEquipment.length,
                'Grouped:', this.equipmentList.length
            );

            // TEMPORARY: Show all items regardless of quantity
            console.warn('🔄 TEMPORARY: Showing all items regardless of quantity');
            this.equipmentList = rawEquipmentList.map(e => ({
                ...e,
                status: 'available'
            }));
        }

    } catch (error) {
        console.error('❌ Error fetching equipment:', error);
        this.showToast = true;
        this.toastMessage = 'Failed to load equipment. See console for details.';
        setTimeout(() => this.showToast = false, 5000);
    }
}

//   async fetchProjects() {
//     try {
//         console.log("🔄 Fetching projects...");

//         // ✅ Fetch projects by the logged-in user
//         const { data: myProjects, error: myProjectsError } = await this.supabase
//             .from('projects')
//             .select('*')
//             .eq('user_id', this.userId);

//         if (myProjectsError) throw myProjectsError;

//         // ✅ Fetch projects created by other users
//         const { data: otherProjects, error: otherProjectsError } = await this.supabase
//             .from('projects')
//             .select('*')
//             .neq('user_id', this.userId);

//         if (otherProjectsError) throw otherProjectsError;

//         // ✅ Fetch all project materials
//         const { data: materials, error: materialsError } = await this.supabase
//             .from('project_materials')
//             .select('*');

//         if (materialsError) throw materialsError;

//         // ✅ Fetch all equipment details (including SRP)
//         const { data: equipmentsData, error: equipmentsError } = await this.supabase
//             .from('equipments')
//             .select('id, name, srp, model, brand, quantity')
//             .is('deleted_at', null);

//         if (equipmentsError) throw equipmentsError;

//         const equipments = equipmentsData ?? [];

//         function attachMaterialsToProjects(projects: any[]) {
//             return projects.map(project => {
//                 const projectMaterials = (materials || [])
//                     .filter(m => m.project_id === project.id)
//                     .map(material => {
//                         const equipment = equipments.find(e => e.id === material.equipment_id);
//                         return equipment ? {
//                             ...material,
//                             name: equipment.name,
//                             srp: equipment.srp || 0,  // ✅ Ensure SRP is included
//                             model: equipment.model,
//                             brand: equipment.brand,
//                             quantity: material.quantity || 0
//                         } : null;
//                     })
//                     .filter(m => m !== null);

//                 return {
//                     ...project,
//                     materials: projectMaterials
//                 };
//             });
//         }

//         this.myProjects = attachMaterialsToProjects(myProjects || []);
//         this.otherProjects = attachMaterialsToProjects(otherProjects || []);

//         console.log("✅ My Projects:", this.myProjects);
//         console.log("✅ Other Users' Projects:", this.otherProjects);

//     } catch (error) {
//         console.error('❌ Error fetching projects:', error);
//     }
// }

async fetchProjects() {
    try {
        console.log("🔄 Fetching projects...");

        // Fetch projects
        const { data: myProjects, error: myProjectsError } = await this.supabase
            .from('projects')
            .select('*')
            .eq('user_id', this.userId);

        const { data: otherProjects, error: otherProjectsError } = await this.supabase
            .from('projects')
            .select('*')
            .neq('user_id', this.userId);

        if (myProjectsError || otherProjectsError) throw myProjectsError || otherProjectsError;

        // Fetch ALL project materials (including status field if it exists)
        const { data: materials, error: materialsError } = await this.supabase
            .from('project_materials')
            .select('*');

        if (materialsError) throw materialsError;

        // Fetch equipment details
        const { data: equipmentsData, error: equipmentsError } = await this.supabase
            .from('equipments')
            .select('id, name, srp, model, brand, quantity')
            .is('deleted_at', null);

        if (equipmentsError) throw equipmentsError;

        const equipments = equipmentsData ?? [];

        const attachMaterialsToProjects = (projects: any[]) => {
    return projects.map(project => {
        const projectMaterials = (materials || [])
            .filter(m => m.project_id === project.id)
            .map(material => {
                const equipment = equipments.find(e => e.id === material.equipment_id);
                if (!equipment) {
                    console.warn('No equipment found for material:', material);
                    return null;
                }

                const status = material.status?.toLowerCase() === 'rejected' ? 'rejected' : 'approved';
                const actualCost = material.actual_cost ||
                                 (equipment.srp * material.quantity * (1 + (material.profit_margin || 20)/100));

                console.log('Processing material:', {
                    id: material.id,
                    name: equipment.name,
                    status: status,
                    actualCost: actualCost
                });

                return {
                    ...material,
                    name: equipment.name,
                    srp: equipment.srp || 0,
                    model: equipment.model,
                    brand: equipment.brand,
                    quantity: material.quantity || 0,
                    status: status,
                    actual_cost: actualCost
                };
            })
            .filter(m => m !== null);

        console.log(`Materials for project ${project.id}:`, projectMaterials);
        return {
            ...project,
            materials: projectMaterials
        };
    });
};

        this.myProjects = attachMaterialsToProjects(myProjects || []);
        this.otherProjects = attachMaterialsToProjects(otherProjects || []);

        console.log("✅ My Projects:", this.myProjects);
        console.log("✅ Other Users' Projects:", this.otherProjects);

    } catch (error) {
        console.error('❌ Error fetching projects:', error);
    }
}

getTotalSrp(project: { materials: ProjectMaterial[] }): number {
  return project.materials.reduce((sum: number, material: ProjectMaterial) =>
    sum + ((material.srp || 0) * material.quantity),
    0
  );
}


getTotalSelectedSrp(): number {
    const total = this.selectedEquipments.reduce((sum, item) => {
        // Skip calculation for rejected items
        if (item.status === 'rejected') {
            return sum;
        }

        const srp = item.srp ?? 0;
        const quantity = item.quantity ?? 0;
        const margin = item.profitMargin ?? 20; // Default to 20% if not set

        const baseCost = srp * quantity;
        const profit = baseCost * (margin / 100);
        const actualCost = baseCost + profit;

        return sum + actualCost;
    }, 0);

    return total;
}




openModal() {
    this.showModal = true;

    // Initialize filtered list for the search bar
    this.filteredEquipmentList = [...this.equipmentList];

    console.log('✅ Selected Equipments BEFORE opening modal:', this.selectedEquipments);

    if (this.selectedEquipments.length === 0) {
      console.log('⚠️ No previously selected equipment. Initializing an empty list.');
      this.selectedEquipments = [];
    } else {
      console.log('✅ Restoring selected equipments:', this.selectedEquipments);
    }

    // 🔄 Sync selected equipment to project materials
    this.project.materials = [...this.selectedEquipments];

    console.log("🛠️ Project Materials after openModal:", this.project.materials);
  }

//   openModal() {
//     this.showModal = true;

//     console.log('✅ Selected Equipments BEFORE opening modal:', this.selectedEquipments);

//     if (this.selectedEquipments.length === 0) {
//         console.log('⚠️ No previously selected equipment. Initializing an empty list.');
//         this.selectedEquipments = [];
//     } else {
//         console.log('✅ Restoring selected equipments:', this.selectedEquipments);
//     }

//     // 🔄 Sync selected equipment to project materials
//     this.project.materials = [...this.selectedEquipments];

//     console.log("🛠️ Project Materials after openModal:", this.project.materials);
// }

  closeModal() {
    this.showModal = false;
    this.resetForm(); // Reset the form and clear selected equipments
  }

  async editProjectModal(project: any) {
    await this.fetchEquipment(); // Ensure available equipment is loaded before opening modal

    try {
        console.log(`🔄 Fetching materials for project: ${project.id}`);

        // 1️⃣ Fetch the materials assigned to this project
        const { data: materials, error: fetchMaterialsError } = await this.supabase
            .from('project_materials')
            .select('*')
            .eq('project_id', project.id);

        if (fetchMaterialsError) throw fetchMaterialsError;

        // 2️⃣ Fetch actual equipment details for assigned equipment
        const enrichedMaterials = await Promise.all(
            materials.map(async (material) => {
                const { data: equipment, error: equipError } = await this.supabase
                    .from('equipments')
                    .select('name, model, brand, supplier, srp')
                    .eq('id', material.equipment_id)
                    .single();

                if (equipError || !equipment) {
                    console.error(`❌ Error fetching equipment ${material.equipment_id}:`, equipError);
                    return {
                        ...material,
                        name: 'Unknown Equipment',
                        model: 'N/A',
                        brand: 'N/A',
                        quantity: material.quantity,
                    };
                }

                return {
                  ...material,
                  name: equipment.name,
                  model: equipment.model,
                  brand: equipment.brand,
                  supplier: equipment.supplier,
                  cost: equipment.srp,
                  quantity: material.quantity,
                  profitMargin: material.profitMargin ?? 20,
                  actual_cost: (equipment.srp * material.quantity) * (1 + ((material.profitMargin ?? 20) / 100))
                };


            })
        );

        console.log('🛠️ Materials in Edit Modal BEFORE merging:', enrichedMaterials);

        // 3️⃣ Merge any newly selected equipment with existing ones
        const updatedMaterials = [...enrichedMaterials];

        for (const newMaterial of this.selectedEquipments) {
          const existingIndex = updatedMaterials.findIndex(m => m.equipment_id === newMaterial.equipment_id);

          if (existingIndex !== -1) {
              updatedMaterials[existingIndex].quantity += newMaterial.quantity;
          } else {
            updatedMaterials.push({
              equipment_id: newMaterial.equipment_id,
              name: newMaterial.name || 'Unknown Equipment',
              model: newMaterial.model || 'N/A',
              brand: newMaterial.brand || 'N/A',
              supplier: newMaterial.supplier || 'N/A',
              cost: newMaterial.srp || 0,
              profitMargin: newMaterial.profitMargin || 0,
              actual_cost: newMaterial.actual_cost || 0,
              quantity: newMaterial.quantity,
          });

          }
      }

        console.log('🛠️ Materials in Edit Modal AFTER merging:', updatedMaterials);

        // 4️⃣ Set the updated project details
        this.editProject = {
            id: project.id,
            name: project.name,
            description: project.description,
            client_name: project.client_name,
            client_address: project.client_address,
            client_email: project.client_email,
            client_phone: project.client_phone,
            materials: updatedMaterials
        };

        this.showEditModal = true;

    } catch (error) {
        console.error('❌ Error fetching project materials:', error);
    }
}

  closeEditModal() {
    this.showEditModal = false;
  }



  confirmDeleteProject(project: any) {
    if (!project?.id) {
        console.error('❌ Error: Project ID is missing.');
        alert('❌ Unable to delete project. Invalid project.');
        return;
    }
    this.selectedProject = project;
    this.showDeleteModal = true;

    console.log(`⚠ Confirming deletion for project: ${project.name || 'Unnamed Project'}`);
}


  openDeleteModal(project: any) {
    this.selectedProject = project;
    this.showDeleteModal = true;
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.selectedProject = null;
  }

  updateTotalSrp() {
    console.log("📌 Calculating Total SRP for selected items...");
    this.selectedEquipments.forEach(item => {
        console.log(`➡️ ${item.name}: SRP = ${item.srp}, Quantity = ${item.quantity}`);
    });

    this.totalSrp = this.selectedEquipments.reduce((sum, item) =>
        sum + ((item.srp ?? 0) * item.quantity), 0
    );

    console.log("✅ Total SRP Calculated:", this.totalSrp);
}

toggleFullEquipmentSelection(equipment: Equipment) {
  console.log("🛠️ Toggling full selection for:", equipment);

  const existingIndex = this.selectedEquipments.findIndex(eq => eq.equipment_id === equipment.id);

  if (existingIndex === -1) {
      this.selectedEquipments.push({
          equipment_id: equipment.id,
          name: equipment.name,
          model: equipment.model || 'N/A',
          brand: equipment.brand || 'N/A',
          quantity: 0,
          srp: equipment.srp ?? 0,
          supplier: equipment.supplier || 'N/A',
          brochure_url: equipment.brochure_url || null
      });
  } else {
      this.selectedEquipments.splice(existingIndex, 1);
  }

  this.updateTotalSrp();
}

//   toggleEquipment(equipment: Equipment) {
//     console.log("🛠️ Toggling equipment:", equipment); // ✅ Log the full object

//     if (this.showEditModal && this.editProject) {
//         const index = this.editProject.materials.findIndex(eq => eq.equipment_id === equipment.id);
//         if (index === -1) {
//             this.editProject.materials.push({
//                 equipment_id: equipment.id,
//                 name: equipment.name,
//                 model: equipment.model || 'N/A',
//                 brand: equipment.brand || 'N/A',
//                 quantity: 1,
//                 srp: equipment.srp ?? 0, // ✅ Ensure SRP is stored
//             });
//             console.log("✅ Added equipment with SRP:", equipment.srp);
//         } else {
//             this.editProject.materials.splice(index, 1);
//             console.log("🗑️ Removed equipment:", equipment.id);
//         }
//         console.log("📌 Updated edit project materials:", this.editProject.materials);
//     } else {
//         const index = this.selectedEquipments.findIndex(eq => eq.equipment_id === equipment.id);
//         if (index === -1) {
//             this.selectedEquipments.push({
//                 equipment_id: equipment.id,
//                 name: equipment.name,
//                 model: equipment.model || 'N/A',
//                 brand: equipment.brand || 'N/A',
//                 quantity: 1,
//                 srp: equipment.srp ?? 0, // ✅ Ensure SRP is stored
//             });
//             console.log("✅ Added selected equipment with SRP:", equipment.srp);
//         } else {
//             this.selectedEquipments.splice(index, 1);
//             console.log("🗑️ Removed selected equipment:", equipment.id);
//         }
//         console.log("📌 Updated selectedEquipments:", this.selectedEquipments);
//     }
// }
toggleEquipment(equipment: Equipment) {
    console.log("🛠️ Toggling equipment:", equipment);

    if (this.showEditModal && this.editProject) {
        const index = this.editProject.materials.findIndex(eq => eq.equipment_id === equipment.id);
        if (index === -1) {
            this.editProject.materials.push({
                equipment_id: equipment.id,
                name: equipment.name,
                model: equipment.model || 'N/A',
                brand: equipment.brand || 'N/A',
                supplier: equipment.supplier || 'N/A', // Add supplier
                cost: equipment.srp || 0, // Use srp as cost
                quantity: 1,
                srp: equipment.srp ?? 0,
                profitMargin: 20, // Default profit margin
                actual_cost: this.calculateActualCost(equipment.srp ?? 0, 20) // Calculate initial actual cost
            });
            console.log("✅ Added equipment with full details:", equipment);
        } else {
            this.editProject.materials.splice(index, 1);
            console.log("🗑️ Removed equipment:", equipment.id);
        }
    } else {
        const index = this.selectedEquipments.findIndex(eq => eq.equipment_id === equipment.id);
        if (index === -1) {
            this.selectedEquipments.push({
                equipment_id: equipment.id,
                name: equipment.name,
                model: equipment.model || 'N/A',
                brand: equipment.brand || 'N/A',
                supplier: equipment.supplier || 'N/A', // Add supplier
                cost: equipment.srp || 0, // Use srp as cost
                quantity: 1,
                srp: equipment.srp ?? 0,
                profitMargin: 20, // Default profit margin
                actual_cost: this.calculateActualCost(equipment.srp ?? 0, 20) // Calculate initial actual cost
            });
            console.log("✅ Added selected equipment with full details:", equipment);
        } else {
            this.selectedEquipments.splice(index, 1);
            console.log("🗑️ Removed selected equipment:", equipment.id);
        }
    }
}

// Add this helper method
private calculateActualCost(srp: number, profitMargin: number): number {
    return srp * (1 + (profitMargin / 100));
}


removeSelectedEquipment(equipmentId: string) {
  if (this.showEditModal && this.editProject) {
      // Remove from editProject.materials
      const index = this.editProject.materials.findIndex(item => item.equipment_id === equipmentId);
      if (index !== -1) {
          const removedItem = this.editProject.materials[index];

          this.editProject.materials.splice(index, 1);
          console.log("✅ Equipment removed from editProject.materials:", equipmentId);
          console.log("✅ Updated editProject.materials:", this.editProject.materials);

          // ✅ Restore the quantity in equipmentList
          const equipment = this.equipmentList.find(e => e.id === equipmentId);
          if (equipment) {
              equipment.quantity += removedItem.quantity;
              console.log(`♻️ Restored stock for ${removedItem.name}: +${removedItem.quantity}`);
          }

          // ✅ Force Angular to detect changes
          this.editProject = { ...this.editProject };
      }
  } else {
      // Remove from selectedEquipments (for the Add Project Modal)
      const index = this.selectedEquipments.findIndex(item => item.equipment_id === equipmentId);
      if (index !== -1) {
          const removedItem = this.selectedEquipments[index];

          this.selectedEquipments.splice(index, 1);
          console.log("✅ Equipment removed from selectedEquipments:", equipmentId);
          console.log("✅ Updated selectedEquipments:", this.selectedEquipments);

          // ✅ Restore quantity in availableEquipmentList
          const equipment = this.equipmentList.find(e => e.id === equipmentId);
          if (equipment) {
              equipment.quantity += removedItem.quantity;
              console.log(`♻️ Restored stock for ${removedItem.name}: +${removedItem.quantity}`);
          }
      }
  }

  // 🔄 Ensure UI updates properly by refetching equipment
  this.fetchEquipment();
}


// removeSelectedEquipment(equipmentId: string) {
//   if (this.showEditModal && this.editProject) {
//       // Remove from editProject.materials
//       const index = this.editProject.materials.findIndex(item => item.equipment_id === equipmentId);
//       if (index !== -1) {
//           const removedItem = this.editProject.materials[index];

//           this.editProject.materials.splice(index, 1);
//           console.log("✅ Equipment removed from editProject.materials:", equipmentId);

//           // Restore the quantity in equipmentList
//           const equipment = this.equipmentList.find(e => e.id === equipmentId);
//           if (equipment) {
//               equipment.quantity += removedItem.quantity;
//           }

//           this.editProject = { ...this.editProject };
//       }
//   } else {
//       // Remove from selectedEquipments (for the Add Project Modal)
//       const index = this.selectedEquipments.findIndex(item => item.equipment_id === equipmentId);
//       if (index !== -1) {
//           const removedItem = this.selectedEquipments[index];

//           this.selectedEquipments.splice(index, 1);
//           console.log("✅ Equipment removed from selectedEquipments:", equipmentId);

//           // Restore quantity in availableEquipmentList
//           const equipment = this.equipmentList.find(e => e.id === equipmentId);
//           if (equipment) {
//               equipment.quantity += removedItem.quantity;
//           }
//       }
//   }
//   this.fetchEquipment();
// }



async validateQuantity(material: ProjectMaterial) {
  const equipment = this.getEquipmentById(material.equipment_id);
  if (!equipment) return;

  // Store old quantity if not already stored (on first load)
  const previousQuantity = material.previousQuantity ?? material.quantity;

  // Ensure entered quantity is at least 1
  if (material.quantity < 1) {
    material.quantity = 1;
  }

  // Ensure quantity does not exceed available equipment quantity
  if (material.quantity > equipment.quantity + previousQuantity) {
    alert(`❌ Not enough stock! Available: ${equipment.quantity + previousQuantity}`);
    material.quantity = equipment.quantity + previousQuantity; // Adjust to available stock
  }

  // Calculate the quantity difference (only decrementing stock)
  const quantityDifference = previousQuantity - material.quantity;

  console.log('Previous quantity:', previousQuantity);
  console.log('New quantity:', material.quantity);
  console.log('Quantity difference:', quantityDifference);

  // Proceed with the decrement only if the quantity is being reduced
  if (quantityDifference > 0) {
    try {
      // Decrement the equipment quantity by the difference
      await this.supabaseService.decrementEquipmentQuantityProject(
        material.equipment_id,
        quantityDifference
      );
      console.log(`✅ Decremented stock by ${quantityDifference}`);
    } catch (error) {
      console.error('Error decrementing stock:', error);
    }
  }

  // After decrement, update the previousQuantity to the current quantity
  material.previousQuantity = material.quantity;
}

storePreviousQuantity(material: ProjectMaterial) {
  // Store the original quantity BEFORE any changes are made (only if not already set)
  if (material.previousQuantity == null) {
    material.previousQuantity = material.quantity;
  }
}

async submitProject() {
  try {
      // Filter out rejected items before processing
      const approvedEquipments = this.selectedEquipments.filter(item => item.status !== 'rejected');

      if (this.selectedEquipments.length === 0) {
          alert('⚠️ Please select at least one equipment item.');
          console.log('❌ No equipment selected. Cannot proceed.');
          return;
      }

      if (!this.project.name || !this.project.description || !this.project.client_name) {
          alert('⚠ Please fill in all required fields.');
          console.log('❌ Missing project details:', this.project);
          return;
      }

      // Ensure that the project has a valid file object and not just the URL
      if (this.project.file && this.project.file instanceof File) {
          await this.handleFileUpload({ target: { files: [this.project.file] } });
      } else if (this.project.fileUrl) {
          console.log('File URL exists, no need to upload again');
      }

      const fileUrl = this.project.fileUrl || '';
      this.project.materials = [...approvedEquipments];
      console.log('✅ Preparing to submit project with approved items:', this.project);

      const subtotal = this.getTotalSelectedSrp();
      const vat = subtotal * 0.2;
      const total = subtotal * 1.2;

      console.log('💰 Financial Details:', { subtotal, vat, total });

      // Insert project into database
      const { data: projectData, error: projectError } = await this.supabase
          .from('projects')
          .insert([{
              name: this.project.name,
              description: this.project.description,
              client_name: this.project.client_name,
              client_address: this.project.client_address,
              client_email: this.project.client_email,
              client_phone: this.project.client_phone,
              user_id: this.userId,
              file_url: fileUrl,
              subtotal: subtotal,
              vat: vat,
              total: total
          }])
          .select()
          .single();

      if (projectError) throw projectError;
      console.log('✅ Project created successfully:', projectData);

      const projectUserId = projectData.user_id || this.userId;

      // Insert materials
      const materialsToInsert = approvedEquipments.map(material => ({
          project_id: projectData.id,
          equipment_id: material.equipment_id,
          quantity: material.quantity,
          profit_margin: material.profitMargin || 20,
          actual_cost: this.getActualCost(material)
      }));

      const { error: materialInsertError } = await this.supabase
          .from('project_materials')
          .insert(materialsToInsert);

      if (materialInsertError) throw materialInsertError;

      // Handle equipment decrement
      for (const material of this.project.materials) {
          if (material.decremented) continue;

          try {
              const previous = material.previousQuantity ?? 0;
              const quantityToDecrement = material.quantity - previous;

              if (quantityToDecrement > 0) {
                  await this.supabaseService.decrementEquipmentQuantityProject(
                      material.equipment_id,
                      quantityToDecrement
                  );
                  material.decremented = true;
              }
          } catch (error) {
              console.error(`❌ Failed to decrement quantity for equipment ID: ${material.equipment_id}`, error);
              throw error;
          }
      }

      // Log equipment movement
      for (const material of this.project.materials) {
          const movementData = {
              equipment_id: material.equipment_id,
              project_id: projectData.id,
              movement_type: 'in use',
              movement_date: new Date().toISOString(),
              employee_id: projectUserId,
              status: 'active',
              borrow_request_id: null,
          };

          const { error: movementError } = await this.supabase
              .from('equipment_movements')
              .insert([movementData]);

          if (movementError) throw movementError;
      }

      // Get user name for activity log
      const { data: userData, error: userError } = await this.supabase
          .from('users')
          .select('first_name')
          .eq('id', projectUserId)
          .single();

      if (userError) console.error('❌ Error fetching user name:', userError);

      const userName = userData?.first_name || 'Unknown User';

      // Log activity
      const { data: projectMaterials, error: projectMaterialsError } = await this.supabase
          .from('project_materials')
          .select('equipment_id, quantity')
          .eq('project_id', projectData.id);

      if (!projectMaterialsError && projectMaterials) {
          const equipmentIds = projectMaterials.map(m => m.equipment_id).filter(id => id);
          if (equipmentIds.length > 0) {
              const { data: equipmentData } = await this.supabase
                  .from('equipments')
                  .select('id, name')
                  .in('id', equipmentIds);

              const equipmentMap = equipmentData ? Object.fromEntries(equipmentData.map(eq => [eq.id, eq.name])) : {};
              const equipmentList = projectMaterials.map(m => `${m.quantity}x ${equipmentMap[m.equipment_id] || 'Unknown Equipment'}`).join(', ');
              const totalEquipmentCount = projectMaterials.reduce((sum, m) => sum + m.quantity, 0);

              await this.supabase
                  .from('recent_activities')
                  .insert([{
                      activity_type: 'project_created',
                      user_id: projectUserId,
                      project_id: projectData.id,
                      message: `${userName} used ${totalEquipmentCount} equipment${totalEquipmentCount > 1 ? 's' : ''} (${equipmentList}) for project "${this.project.name}"`,
                      timestamp: new Date().toISOString()
                  }]);
          }
      }

      // ==================== ANIMATION LOGIC ====================
      // 1. Get the modal element position
      const modal = document.querySelector('.modal-content') as HTMLElement;
      if (modal) {
          // 2. Get the client directory element in sidebar
          const clientDirElement = document.querySelector('.nav-item[routerLink="/client-list"]') as HTMLElement;

          if (clientDirElement) {
              // 3. Calculate positions
              const modalRect = modal.getBoundingClientRect();
              const targetRect = clientDirElement.getBoundingClientRect();

              // 4. Create flying element
              const flyElement = document.createElement('div');
              flyElement.className = 'fly-animation-element';
              flyElement.innerHTML = '<i class="fas fa-folder"></i>';
              flyElement.style.position = 'fixed';
              flyElement.style.left = `${modalRect.left + modalRect.width/2 - 15}px`;
              flyElement.style.top = `${modalRect.top + modalRect.height/2 - 15}px`;
              flyElement.style.width = '30px';
              flyElement.style.height = '30px';
              flyElement.style.backgroundColor = '#4CAF50';
              flyElement.style.borderRadius = '50%';
              flyElement.style.display = 'flex';
              flyElement.style.alignItems = 'center';
              flyElement.style.justifyContent = 'center';
              flyElement.style.color = 'white';
              flyElement.style.zIndex = '10000';
              flyElement.style.transition = 'all 0.5s ease-in';
              document.body.appendChild(flyElement);

              // 5. Trigger animation
              setTimeout(() => {
                  flyElement.style.left = `${targetRect.left + targetRect.width/2 - 15}px`;
                  flyElement.style.top = `${targetRect.top + targetRect.height/2 - 15}px`;
                  flyElement.style.transform = 'scale(0.5)';
                  flyElement.style.opacity = '0.7';
              }, 10);

              // 6. Clean up after animation
              setTimeout(() => {
                  flyElement.remove();
                  this.closeModal();
                  this.showSuccessToast('Project created successfully!');
                  this.fetchProjects();
                  this.fetchEquipment();
              }, 600);

              return; // Exit early to prevent default close behavior
          }
      }

      // Fallback if animation elements not found
      this.closeModal();
      this.showSuccessToast('Project created successfully!');
      await this.fetchProjects();
      await this.fetchEquipment();

  } catch (error) {
      console.error('❌ Error creating project:', error);
      alert(`❌ Failed to create project: ${(error as Error).message}`);
  }
}


async saveEditedProject() {
    if (!this.editProject) return;

    const projectId = this.editProject.id;

    // Separate approved and rejected materials
    const approvedMaterials = this.editProject.materials.filter(m => m.status !== 'rejected');
    const rejectedMaterials = this.editProject.materials.filter(m => m.status === 'rejected');

    try {
        console.log(`✏️ Saving changes for project: ${projectId}`);

        // 1️⃣ Calculate totals using only approved materials
        const subtotal = approvedMaterials.reduce((sum, item) => sum + (this.getActualCost(item) * item.quantity), 0);
        const vat = subtotal * 0.2;
        const total = subtotal + vat;

        // Update project details including financials
        const { error: updateProjectError } = await this.supabase
            .from('projects')
            .update({
                name: this.editProject.name,
                description: this.editProject.description,
                client_address: this.editProject.client_address,
                client_email: this.editProject.client_email,
                client_phone: this.editProject.client_phone,
                subtotal,
                vat,
                total
            })
            .eq('id', projectId);

        if (updateProjectError) throw updateProjectError;

        // 2️⃣ Fetch previous materials
        const { data: previousMaterials, error: fetchMaterialsError } = await this.supabase
            .from('project_materials')
            .select('*')
            .eq('project_id', projectId);

        if (fetchMaterialsError) throw fetchMaterialsError;

        // 3️⃣ Restore stock for rejected items (if they were previously approved)
        for (const rejectedItem of rejectedMaterials) {
            const previousMaterial = previousMaterials?.find(m => m.equipment_id === rejectedItem.equipment_id);
            if (previousMaterial && previousMaterial.status !== 'rejected') {
                const equipment = this.equipmentList.find(e => e.id === rejectedItem.equipment_id);
                if (equipment) {
                    equipment.quantity += rejectedItem.quantity;
                    console.log(`♻️ Restoring stock for rejected equipment ${equipment.id}: +${rejectedItem.quantity}`);

                    const { error: stockError } = await this.supabase
                        .from('equipments')
                        .update({ quantity: equipment.quantity })
                        .eq('id', equipment.id);

                    if (stockError) console.error(`❌ Error restoring stock for ${equipment.id}:`, stockError);
                }
            }
        }

        // 4️⃣ Restore stock for removed or reduced equipment
        for (const oldMaterial of previousMaterials || []) {
            const newMaterial = this.editProject.materials.find(m => m.equipment_id === oldMaterial.equipment_id);
            const equipment = this.equipmentList.find(e => e.id === oldMaterial.equipment_id);

            if (equipment) {
                let quantityToRestore = 0;

                if (!newMaterial) {
                    // Equipment removed -> Restore full quantity
                    quantityToRestore = oldMaterial.quantity;
                } else if (oldMaterial.quantity > newMaterial.quantity) {
                    // Equipment quantity reduced -> Restore the difference
                    quantityToRestore = oldMaterial.quantity - newMaterial.quantity;
                }

                if (quantityToRestore > 0) {
                    equipment.quantity += quantityToRestore;
                    console.log(`♻️ Restoring stock for equipment ${equipment.id}: +${quantityToRestore}`);

                    const { error: stockError } = await this.supabase
                        .from('equipments')
                        .update({ quantity: equipment.quantity })
                        .eq('id', equipment.id);

                    if (stockError) console.error(`❌ Error restoring stock for ${equipment.id}:`, stockError);
                }
            }
        }

        // 5️⃣ Delete old project materials
        const { error: deleteMaterialsError } = await this.supabase
            .from('project_materials')
            .delete()
            .eq('project_id', projectId);

        if (deleteMaterialsError) throw deleteMaterialsError;

        // 6️⃣ Insert ALL materials (both approved and rejected) into database
        const materialsToInsert = this.editProject.materials.map(material => ({
            project_id: projectId,
            equipment_id: material.equipment_id,
            quantity: material.quantity,
            profit_margin: material.profitMargin || 20,
            actual_cost: this.getActualCost(material),
            status: material.status || 'approved' // Save the status
        }));

        const { error: insertMaterialsError } = await this.supabase
            .from('project_materials')
            .insert(materialsToInsert);

        if (insertMaterialsError) throw insertMaterialsError;

        // 7️⃣ Deduct stock only for approved materials
        for (let material of approvedMaterials) {
            const oldMaterial = previousMaterials?.find(m => m.equipment_id === material.equipment_id);
            const equipment = this.equipmentList.find(e => e.id === material.equipment_id);

            if (equipment) {
                let quantityToDeduct = 0;

                if (!oldMaterial) {
                    // New equipment -> Deduct full quantity
                    quantityToDeduct = material.quantity;
                } else if (material.quantity > oldMaterial.quantity) {
                    // Increased quantity -> Deduct the difference
                    quantityToDeduct = material.quantity - oldMaterial.quantity;
                }

                if (quantityToDeduct > 0) {
                    equipment.quantity -= quantityToDeduct;
                    console.log(`🔻 Deducting stock for equipment ${equipment.id}: -${quantityToDeduct}`);

                    const { error: updateStockError } = await this.supabase
                        .from('equipments')
                        .update({ quantity: equipment.quantity })
                        .eq('id', equipment.id);

                    if (updateStockError) console.error(`❌ Error updating stock for ${equipment.id}:`, updateStockError);
                }
            }
        }

        alert('✅ Project successfully updated!');
        this.closeEditModal();
        await this.fetchProjects();
        await this.fetchEquipment();

    } catch (error) {
        console.error('❌ Error updating project:', error);
        alert(`❌ Failed to update project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
  // async saveEditedProject() {
  //   if (!this.editProject) return;

  //   const projectId = this.editProject.id;
  //   let projectMaterials = this.editProject.materials;

  //   try {
  //       console.log(`✏️ Saving changes for project: ${projectId}`);

  //       // 1️⃣ Update project details
  //       const { error: updateProjectError } = await this.supabase
  //           .from('projects')
  //           .update({
  //               name: this.editProject.name,
  //               description: this.editProject.description,
  //               client_address: this.editProject.client_address,
  //               client_email: this.editProject.client_email,
  //               client_phone: this.editProject.client_phone
  //           })
  //           .eq('id', projectId);

  //       if (updateProjectError) throw updateProjectError;
  //       console.log('✅ Project details updated');

  //       // 2️⃣ Fetch previous materials
  //       const { data: previousMaterials, error: fetchMaterialsError } = await this.supabase
  //           .from('project_materials')
  //           .select('*')
  //           .eq('project_id', projectId);

  //       if (fetchMaterialsError) throw fetchMaterialsError;
  //       console.log('📌 Previous materials:', previousMaterials);

  //       // 3️⃣ Restore stock for removed or reduced equipment
  //       for (const oldMaterial of previousMaterials || []) {
  //           const newMaterial = projectMaterials.find(m => m.equipment_id === oldMaterial.equipment_id);
  //           const equipment = this.equipmentList.find(e => e.id === oldMaterial.equipment_id);

  //           if (equipment) {
  //               let quantityToRestore = 0;

  //               if (!newMaterial) {
  //                   // Equipment removed -> Restore full quantity
  //                   quantityToRestore = oldMaterial.quantity;
  //               } else if (oldMaterial.quantity > newMaterial.quantity) {
  //                   // Equipment quantity reduced -> Restore the difference
  //                   quantityToRestore = oldMaterial.quantity - newMaterial.quantity;
  //               }

  //               if (quantityToRestore > 0) {
  //                   equipment.quantity += quantityToRestore;
  //                   console.log(`♻️ Restoring stock for equipment ${equipment.id}: +${quantityToRestore}`);

  //                   const { error: stockError } = await this.supabase
  //                       .from('equipments')
  //                       .update({ quantity: equipment.quantity })
  //                       .eq('id', equipment.id);

  //                   if (stockError) console.error(`❌ Error restoring stock for ${equipment.id}:`, stockError);
  //               }
  //           }
  //       }

  //       // 4️⃣ Delete old project materials before inserting updated ones
  //       const { error: deleteMaterialsError } = await this.supabase
  //           .from('project_materials')
  //           .delete()
  //           .eq('project_id', projectId);

  //       if (deleteMaterialsError) throw deleteMaterialsError;
  //       console.log('🗑️ Deleted old project materials');

  //       // 5️⃣ Insert updated materials list into `project_materials`
  //       const materialsToInsert = projectMaterials.map((m: ProjectMaterial) => ({
  //         project_id: projectId,
  //         equipment_id: m.equipment_id,
  //         quantity: m.quantity,
  //     }));


  //       const { error: insertMaterialsError } = await this.supabase
  //           .from('project_materials')
  //           .insert(materialsToInsert);

  //       if (insertMaterialsError) throw insertMaterialsError;
  //       console.log('✅ Inserted new project materials:', materialsToInsert);

  //       // 6️⃣ Deduct stock **only for newly added or increased quantities**
  //       for (let material of projectMaterials) {
  //           const oldMaterial = previousMaterials?.find(m => m.equipment_id === material.equipment_id);
  //           const equipment = this.equipmentList.find(e => e.id === material.equipment_id);

  //           if (equipment) {
  //               let quantityToDeduct = 0;

  //               if (!oldMaterial) {
  //                   // New equipment -> Deduct full quantity
  //                   quantityToDeduct = material.quantity;
  //               } else if (material.quantity > oldMaterial.quantity) {
  //                   // Increased quantity -> Deduct the difference
  //                   quantityToDeduct = material.quantity - oldMaterial.quantity;
  //               }

  //               if (quantityToDeduct > 0) {
  //                   equipment.quantity -= quantityToDeduct;
  //                   console.log(`🔻 Deducting stock for equipment ${equipment.id}: -${quantityToDeduct}`);

  //                   const { error: updateStockError } = await this.supabase
  //                       .from('equipments')
  //                       .update({ quantity: equipment.quantity })
  //                       .eq('id', equipment.id);

  //                   if (updateStockError) console.error(`❌ Error updating stock for ${equipment.id}:`, updateStockError);
  //               }

  //               // ✅ Validate and insert equipment movement
  //               const allowedMovementTypes = ['in use', 'returned', 'transferred']; // ✅ Allowed values
  //               const movementType = quantityToDeduct > 0 ? 'in use' : 'returned';

  //               // 🔥 Ensure movement type is valid
  //               if (!allowedMovementTypes.includes(movementType)) {
  //                   console.error(`❌ Invalid movement type: ${movementType}`);
  //                   continue; // Skip invalid entry
  //               }

  //               const { error: movementError } = await this.supabase.from('equipment_movements').insert([{
  //                   equipment_id: material.equipment_id,
  //                   project_id: projectId,
  //                   movement_type: movementType,
  //                   movement_date: new Date().toISOString(),
  //                   employee_id: this.userId,
  //                   status: 'active',
  //                   borrow_request_id: null,
  //               }]);

  //               if (movementError) {
  //                   console.error('❌ Error inserting equipment movement:', movementError);
  //               } else {
  //                   console.log(`✅ Equipment movement recorded successfully for: ${material.equipment_id}`);
  //               }
  //           }
  //       }

  //       alert('✅ Project successfully updated!');
  //       this.closeEditModal();
  //       await this.fetchProjects(); // Refresh project list
  //       await this.fetchEquipment(); // Refresh equipment list

  //       const updatedProject = this.projects.find(p => p.id === projectId);
  //       if (updatedProject) {
  //           await this.viewProject(updatedProject); // ✅ Refresh modal data
  //       }


  //   } catch (error) {
  //       console.error('❌ Error updating project:', error);
  //       alert(`❌ Failed to update project: ${error instanceof Error ? error.message : 'Unknown error'}`);
  //   }
  // }



  rejectMaterialInEdit(material: any) {
  const previousStatus = material.status;
  material.status = 'rejected';

  // Restore quantity to inventory
  const equipment = this.equipmentList.find(e => e.id === material.equipment_id);
  if (equipment) {
    equipment.quantity += material.quantity;
    console.log(`♻️ Restored ${material.quantity} units of ${material.name} to inventory`);
  }

  console.log(`❌ Rejected material: ${material.name}`);
  this.showStatusChangeAlert(material, previousStatus, 'rejected');
}

approveMaterialInEdit(material: any) {
  const previousStatus = material.status;
  material.status = 'approved';

  // Deduct quantity from inventory if available
  const equipment = this.equipmentList.find(e => e.id === material.equipment_id);
  if (equipment) {
    if (equipment.quantity >= material.quantity) {
      equipment.quantity -= material.quantity;
      console.log(`🔻 Deducted ${material.quantity} units of ${material.name} from inventory`);
    } else {
      alert(`⚠️ Not enough stock for ${material.name}! Only ${equipment.quantity} available.`);
      material.status = 'rejected'; // Revert status if not enough stock
      return;
    }
  }

  console.log(`✅ Approved material: ${material.name}`);
  this.showStatusChangeAlert(material, previousStatus, 'approved');
}

private showStatusChangeAlert(material: any, previousStatus: string, newStatus: string) {
  if (previousStatus !== newStatus) {
    const action = newStatus === 'approved' ? 'approved' : 'rejected';
    alert(`Material "${material.name}" has been ${action}`);
  }
}

  async deleteProject(projectId: string | null) {
    try {
      if (!projectId) {
        console.error('❌ Error: Project ID is missing.');
        alert('❌ Unable to delete project. Invalid project ID.');
        return;
      }

      console.log(`🗑️ Attempting to delete project with ID: ${projectId}`);

      // ✅ Fetch project details (name & user_id) BEFORE deleting
      const { data: project, error: fetchError } = await this.supabase
        .from('projects')
        .select('name, user_id') // ✅ Fetch user_id too
        .eq('id', projectId)
        .single();

      if (fetchError) {
        console.error("❌ Error fetching project name:", fetchError);
        throw new Error(`Error fetching project details: ${fetchError.message}`);
      }

      const projectName = project?.name || "Unknown Project";
      const projectOwnerId = project?.user_id || null; // ✅ Ensure it's null-safe

      let projectOwnerName = "Unknown User";

      if (projectOwnerId) {
        // ✅ Fetch only first_name from the users table
        const { data: user, error: userError } = await this.supabase
          .from('users')
          .select('first_name')
          .eq('id', projectOwnerId)
          .single();

        if (userError) {
          console.error("❌ Error fetching user name:", userError);
        } else {
          projectOwnerName = user?.first_name || "Unknown User";
        }
      }

      // ✅ Fetch project materials before deletion
      const { data: materials, error: materialsError } = await this.supabase
        .from('project_materials')
        .select('equipment_id, quantity, equipments(name), project_id')
        .eq('project_id', projectId);

      if (materialsError) throw new Error(`Error fetching project materials: ${materialsError.message}`);
      console.log('📌 Project materials to be restored:', materials);

      // ✅ Update "in use" equipment movements to "returned"
      const { error: updateMovementsError } = await this.supabase
        .from('equipment_movements')
        .update({
          movement_type: 'returned',
          project_id: null
        })
        .eq('project_id', projectId)
        .eq('movement_type', 'in use');

      if (updateMovementsError) {
        console.error('❌ Error updating equipment movements:', updateMovementsError);
        throw new Error(`Error updating equipment movements: ${updateMovementsError.message}`);
      }
      console.log('✅ ALL "in use" movements updated to "returned" before deletion.');

      // ✅ Track processed equipment to avoid duplicate updates
      const processedEquipments = new Map();

      // ✅ Restore equipment quantities before deleting the project
for (const material of materials || []) {
  // Check if the equipment has already been processed by checking the Map
  if (processedEquipments.has(material.equipment_id)) {
    console.log(`❌ Equipment ${material.equipment_id} has already been processed.`);
    continue;
  }

  const { data: currentEquipment, error: equipmentError } = await this.supabase
    .from('equipments')
    .select('quantity')
    .eq('id', material.equipment_id)
    .single();

  if (equipmentError) {
    console.error(`❌ Error fetching equipment ${material.equipment_id}:`, equipmentError);
    continue;
  }


  // Mark this equipment as processed to avoid duplication
  processedEquipments.set(material.equipment_id, true);

  // ✅ Re-fetch equipment list to reflect updated quantities in the UI
  await this.fetchEquipment();




        // ✅ Insert a "returned" movement
        const returnMovementData = {
          equipment_id: material.equipment_id,
          project_id: null,
          movement_type: 'returned',
          movement_date: new Date().toISOString(),
          employee_id: this.userId || '00000000-0000-0000-0000-000000000000',
          status: 'returned',
          borrow_request_id: null
        };

        console.log(`📌 Inserting return movement:`, returnMovementData);

        const { error: insertReturnMovementError } = await this.supabase
          .from('equipment_movements')
          .insert([returnMovementData]);

        if (insertReturnMovementError) {
          console.error(`❌ Error inserting return movement for ${material.equipment_id}:`, insertReturnMovementError);
        } else {
          console.log(`✅ Added "returned" movement for equipment ID: ${material.equipment_id}`);
        }
      }

      // ✅ Delete project materials (safe to remove)
      const { error: deleteMaterialsError } = await this.supabase
        .from('project_materials')
        .delete()
        .eq('project_id', projectId);

      if (deleteMaterialsError) throw new Error(`Error deleting project materials: ${deleteMaterialsError.message}`);
      console.log('🗑️ Deleted old project materials.');

      // ✅ Delete all equipment movements referencing the project
      const { error: deleteMovementsError } = await this.supabase
        .from('equipment_movements')
        .delete()
        .eq('project_id', projectId);

      if (deleteMovementsError) {
        console.error('❌ Error deleting equipment movements:', deleteMovementsError);
        throw new Error(`Error deleting equipment movements: ${deleteMovementsError.message}`);
      }
      console.log('✅ Deleted all equipment movements related to project.');

      // ✅ Delete the project
      const { error: deleteProjectError } = await this.supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (deleteProjectError) {
        console.error('❌ Error deleting project:', deleteProjectError);
        throw new Error(`Error deleting project: ${deleteProjectError.message}`);
      }

      console.log('✅ Project deleted successfully.');

      // ✅ Log "Deleted a project" in `recent_activities`
      const { error: activityError } = await this.supabase
        .from('recent_activities')
        .insert([{
          activity_type: 'project_deleted',
          user_id: this.userId, // ✅ Log the user who deleted the project
          project_id: projectId, // ✅ Log the project ID for reference
          message: `${projectOwnerName} deleted the project "${projectName}"`, // ✅ Show only first_name
          timestamp: new Date().toISOString()
        }]);

      if (activityError) {
        console.error('❌ Error logging project deletion:', activityError);
      } else {
        console.log('✅ Project deletion logged in recent activities');
      }

      // 🔥 Remove project from local state immediately (fixes UI issue)
      this.projects = this.projects.filter(project => project.id !== projectId);

      alert('✅ Project deleted, and history log is saved!');

      // ✅ Close the delete modal
      this.closeDeleteModal()

      // ✅ Fetch projects again from the database to ensure UI updates
      await this.fetchProjects();
      await this.fetchEquipment();

    } catch (error: any) {
      console.error('❌ Full Error Deleting Project:', error);
      alert(`❌ Failed to delete project. ${error.message || 'Unknown error'}`);
    }
  }







// toggleCheckAll() {
//   if (!this.selectedEquipmentDetails?.items?.length) return; // ✅ Prevent errors

//   // Toggle selection state
//   this.allChecked = !this.allChecked;

//   if (this.showEditModal && this.editProject) {
//       // ✅ Editing an existing project
//       if (this.allChecked) {
//           this.editProject.materials = this.selectedEquipmentDetails.items.map(item => ({
//               equipment_id: item.id,
//               name: item.name,
//               model: item.model || 'N/A',
//               brand: item.brand || 'N/A',
//               quantity: 1, // Default quantity
//               srp: item.srp || 0
//           }));
//           console.log(`✅ All items added to editProject.materials`);
//       } else {
//           this.editProject.materials = []; // Clear all
//           console.log(`🗑️ All items removed from editProject.materials`);
//       }
//   } else {
//       // ✅ Creating a new project
//       if (this.allChecked) {
//           this.selectedEquipments = this.selectedEquipmentDetails.items.map(item => ({
//               equipment_id: item.id,
//               name: item.name,
//               model: item.model || 'N/A',
//               brand: item.brand || 'N/A',
//               quantity: 1, // Default quantity
//               srp: item.srp || 0
//           }));
//           console.log(`✅ All items added to selectedEquipments`);
//       } else {
//           this.selectedEquipments = []; // Clear all
//           console.log(`🗑️ All items removed from selectedEquipments`);
//       }
//   }

//   // ✅ Update the total SRP calculation
//   this.updateTotalSrp();
// }
toggleCheckAll() {
    if (!this.selectedEquipmentDetails?.items?.length) return;

    this.allChecked = !this.allChecked;

    if (this.showEditModal && this.editProject) {
        if (this.allChecked) {
            this.editProject.materials = this.selectedEquipmentDetails.items.map(item => ({
                equipment_id: item.id,
                name: item.name,
                model: item.model || 'N/A',
                brand: item.brand || 'N/A',
                supplier: item.supplier || 'N/A', // Add supplier
                cost: item.srp || 0, // Use srp as cost
                quantity: 1,
                srp: item.srp ?? 0,
                profitMargin: 20, // Default profit margin
                actual_cost: this.calculateActualCost(item.srp ?? 0, 20) // Calculate initial actual cost
            }));
        } else {
            this.editProject.materials = [];
        }
    } else {
        if (this.allChecked) {
            this.selectedEquipments = this.selectedEquipmentDetails.items.map(item => ({
                equipment_id: item.id,
                name: item.name,
                model: item.model || 'N/A',
                brand: item.brand || 'N/A',
                supplier: item.supplier || 'N/A', // Add supplier
                cost: item.srp || 0, // Add cost
                quantity: 1,
                srp: item.srp ?? 0,
                profitMargin: 20, // Default profit margin
                actual_cost: this.calculateActualCost(item.srp ?? 0, 20) // Calculate initial actual cost
            }));
        } else {
            this.selectedEquipments = [];
        }
    }
    this.updateTotalSrp();
}

  resetForm() {
    this.project = {
      id: '',
      name: '',
      description: '',
      client_name: '', // ✅ Added this line
      client_address: '',
      client_email: '',
      client_phone: '',
      fileUrl: '', // initial file URL is empty
      file: null,  // file is initially null
      materials: []
    };
    this.selectedEquipments = [];
  }

   async viewProject(project: any) {
    try {
      console.log(`🔎 Fetching project and materials for: ${project.id}`);

      // 1. Fetch complete project data including financial fields
      const { data: fullProject, error: projectError } = await this.supabase
        .from('projects')
        .select('*')
        .eq('id', project.id)
        .single();

      if (projectError) throw projectError;

      // 2. Fetch project materials
      const { data: materials, error: materialsError } = await this.supabase
        .from('project_materials')
        .select('*')
        .eq('project_id', project.id);

      if (materialsError) throw materialsError;

      // 3. Enrich materials with equipment details
      const enrichedMaterials = await Promise.all(
        materials.map(async (material) => {
          const { data: equipment, error: equipError } = await this.supabase
            .from('equipments')
            .select('*')
            .eq('id', material.equipment_id)
            .single();

          if (equipError || !equipment) {
            console.error(`❌ Error fetching equipment ${material.equipment_id}:`, equipError);
            return {
              ...material,
              name: 'Unknown Equipment',
              model: 'N/A',
              brand: 'N/A',
              srp: 0,
            };
          }

          return {
          ...material,
          name: equipment.name,
          model: equipment.model,
          brand: equipment.brand,
          srp: equipment.srp || 0,
          supplier: equipment.supplier || 'Unknown Supplier',
          cost: material.cost || equipment.srp || 0,
          profit_margin: material.profit_margin || 20,
          // Use the stored actual_cost if available, otherwise calculate consistently
          actual_cost: material.actual_cost !== undefined ?
              material.actual_cost :
              (material.cost || equipment.srp || 0) * material.quantity * (1 + (material.profit_margin || 20) / 100)
      };
        })
      );

      // 4. Set the complete project data
      this.selectedProject = {
        ...fullProject,
        materials: enrichedMaterials,
        // Keep these for any other calculations you might need
        subtotal: fullProject.subtotal,
        vat: fullProject.vat,
        total: fullProject.total
      };

      console.log('✅ Project loaded with financials:', {
        subtotal: this.selectedProject.subtotal,
        vat: this.selectedProject.vat,
        total: this.selectedProject.total
      });

      this.showProjectDetailsModal = true;
    } catch (error) {
      console.error('❌ Error viewing project:', error);
      // Add user-friendly error handling here
    }
  }

expandDescription(project: any) {
  project.expanded = !project.expanded;
}

  closeProjectDetailsModal() {
    this.showProjectDetailsModal = false;
  }

  getEquipmentById(equipmentId: string): Equipment | null {
    return this.equipmentList.find(e => e.id === equipmentId)
        || this.rawEquipmentList.find(e => e.id === equipmentId)
        || null;
}


viewEquipmentDetails(equipment: Equipment) {
  console.log("🔍 Viewing equipment details:", equipment);

  // Show equipment details modal
  this.selectedEquipmentDetails = equipment;
  this.showEquipmentDetailsModal = true;

  // Ensure it's tracked for selection
  if (!this.viewedEquipments.includes(equipment.id)) {
    this.viewedEquipments.push(equipment.id);
  }
}


closeEquipmentDetailsModal() {
  this.showEquipmentDetailsModal = false;

  if (!this.selectedEquipmentDetails) return; // Ensure modal was open

  console.log("🛠️ Closing Equipment Details Modal. Selected equipment:", this.selectedEquipmentDetails);

  // ✅ Ensure selected equipment is added when closing the modal
  if (!this.isEquipmentSelected(this.selectedEquipmentDetails.id)) {
      this.selectedEquipments.push({
          equipment_id: this.selectedEquipmentDetails.id,
          name: this.selectedEquipmentDetails.name,
          model: this.selectedEquipmentDetails.model || 'N/A',
          brand: this.selectedEquipmentDetails.brand || 'N/A',
          quantity: 1,
          srp: this.selectedEquipmentDetails.srp ?? 0 // ✅ Ensure SRP is stored
      });

      console.log(`✅ Equipment added from modal: ${this.selectedEquipmentDetails.name}`);
  }

  // ✅ Update total SRP calculation
  this.updateTotalSrp();

  console.log("✅ Updated selectedEquipments:", this.selectedEquipments);
  console.log("✅ Updated project materials:", this.project.materials);

  this.selectedEquipmentDetails = null; // Reset after processing
}

  findMaterialIndex(equipmentId: string): number {
    return this.project.materials.findIndex((m: ProjectMaterial) => m.equipment_id === equipmentId);
  }

  findEditMaterialIndex(equipmentId: string): number {
    if (!this.editProject) return -1;
    return this.editProject.materials.findIndex((m: ProjectMaterial) => m.equipment_id === equipmentId);
  }

  selectIndividualEquipment(equipmentId: string, materialIndex: number) {
    if (materialIndex === -1) return;

    if (this.showEditModal && this.editProject) {
      const material = this.editProject.materials[materialIndex];
      material.equipment_id = equipmentId;
      if (!material.quantity || material.quantity <= 0) {
        material.quantity = 1;
      }
    } else {
      const material = this.project.materials[materialIndex];
      material.equipment_id = equipmentId;
      if (!material.quantity || material.quantity <= 0) {
        material.quantity = 1;
      }
    }

    this.closeEquipmentDetailsModal();
  }

//   toggleEquipmentItem(item: Equipment) {
//     console.log("🛠️ Toggling equipment item:", item);

//     if (this.showEditModal && this.editProject) {
//         // ✅ Ensure editProject is not null
//         if (!this.editProject) return;

//         const existingIndex = this.editProject.materials.findIndex(m => m.equipment_id === item.id);

//         if (existingIndex !== -1) {
//             this.editProject.materials.splice(existingIndex, 1);
//             console.log(`🗑️ Removed item from editProject.materials: ${item.name}`);
//         } else {
//             this.editProject.materials.push({
//                 equipment_id: item.id,
//                 name: item.name,
//                 model: item.model || 'N/A',
//                 brand: item.brand || 'N/A',
//                 quantity: 1, // Default quantity
//                 srp: item.srp || 0
//             });
//             console.log(`✅ Added item to editProject.materials: ${item.name} (SRP: ${item.srp})`);
//         }

//         console.log("📌 Updated assigned materials:", this.editProject.materials);
//     } else {
//         // ✅ Creating a new project
//         const existingIndex = this.selectedEquipments.findIndex(eq => eq.equipment_id === item.id);

//         if (existingIndex !== -1) {
//             this.selectedEquipments.splice(existingIndex, 1);
//             console.log(`🗑️ Removed item from selectedEquipments: ${item.name}`);
//         } else {
//             this.selectedEquipments.push({
//                 equipment_id: item.id,
//                 name: item.name,
//                 model: item.model || 'N/A',
//                 brand: item.brand || 'N/A',
//                 quantity: 1, // Default quantity
//                 srp: item.srp || 0
//             });
//             console.log(`✅ Added item to selectedEquipments: ${item.name} (SRP: ${item.srp})`);
//         }

//         console.log("📌 Updated selectedEquipments:", this.selectedEquipments);
//     }

//     // ✅ Fix: Update the "Check All" button state correctly
//     const totalItems = this.selectedEquipmentDetails?.items?.length ?? 0;
//     const selectedItemsCount = this.showEditModal && this.editProject
//         ? this.editProject.materials.length
//         : this.selectedEquipments.length;

//     this.allChecked = totalItems > 0 && selectedItemsCount === totalItems;

//     // ✅ Update the total SRP calculation
//     this.updateTotalSrp();
// }
toggleEquipmentItem(item: Equipment) {
    console.log("🛠️ Toggling equipment item:", item);

    if (this.showEditModal && this.editProject) {
        if (!this.editProject) return;

        const existingIndex = this.editProject.materials.findIndex(m => m.equipment_id === item.id);

        if (existingIndex !== -1) {
            this.editProject.materials.splice(existingIndex, 1);
        } else {
            this.editProject.materials.push({
                equipment_id: item.id,
                name: item.name,
                model: item.model || 'N/A',
                brand: item.brand || 'N/A',
                supplier: item.supplier || 'N/A', // Add supplier
                cost: item.srp || 0, // Add cost
                quantity: 1,
                srp: item.srp ?? 0,
                profitMargin: 20, // Default profit margin
                actual_cost: this.calculateActualCost(item.srp ?? 0, 20) // Calculate initial actual cost
            });
        }
    } else {
        const existingIndex = this.selectedEquipments.findIndex(eq => eq.equipment_id === item.id);

        if (existingIndex !== -1) {
            this.selectedEquipments.splice(existingIndex, 1);
        } else {
            this.selectedEquipments.push({
                equipment_id: item.id,
                name: item.name,
                model: item.model || 'N/A',
                brand: item.brand || 'N/A',
                supplier: item.supplier || 'N/A', // Add supplier
                cost: item.srp || 0, // Add cost
                quantity: 1,
                srp: item.srp ?? 0,
                profitMargin: 20, // Default profit margin
                actual_cost: this.calculateActualCost(item.srp ?? 0, 20) // Calculate initial actual cost
            });
        }
    }

    const totalItems = this.selectedEquipmentDetails?.items?.length ?? 0;
    const selectedItemsCount = this.showEditModal && this.editProject
        ? this.editProject.materials.length
        : this.selectedEquipments.length;

    this.allChecked = totalItems > 0 && selectedItemsCount === totalItems;
    this.updateTotalSrp();
}


isEquipmentSelected(equipmentId: string): boolean {
  return this.selectedEquipments.some(eq => eq.equipment_id === equipmentId);
}

// addToSelectedEquipments(item: Equipment) {
//   const exists = this.selectedEquipments.some(eq => eq.equipment_id === item.id);
//   if (!exists) {
//       this.selectedEquipments.push({
//           equipment_id: item.id,
//           quantity: 1, // ✅ Should start at 1, not 0
//           name: item.name || 'Unknown',
//           model: item.model || 'N/A',
//           brand: item.brand || 'N/A',
//           srp: item.srp || 0,
//           supplier: item.supplier || 'N/A'
//       });

//       console.log('✅ Added to selectedEquipments:', this.selectedEquipments);
//   } else {
//       console.warn(`⚠️ Equipment (${item.id}) is already in selectedEquipments.`);
//   }
// }
addToSelectedEquipments(item: Equipment) {
    const exists = this.selectedEquipments.some(eq => eq.equipment_id === item.id);
    if (!exists) {
        this.selectedEquipments.push({
            equipment_id: item.id,
            name: item.name || 'Unknown',
            model: item.model || 'N/A',
            brand: item.brand || 'N/A',
            supplier: item.supplier || 'N/A', // Add supplier
            cost: item.srp || 0, // Add cost
            quantity: 1,
            srp: item.srp || 0,
            profitMargin: 20, // Default profit margin
            actual_cost: this.calculateActualCost(item.srp || 0, 20) // Calculate initial actual cost
        });
    }
}

// addToSelectedEquipments(item: Equipment) {
//     const exists = this.selectedEquipments.some(eq => eq.equipment_id === item.id);
//     if (!exists) {
//         this.selectedEquipments.push({
//             equipment_id: item.id,
//             quantity: 0, // Default to 1 when adding new equipment
//             name: item.name || 'Unknown',
//             model: item.model || 'N/A',
//             brand: item.brand || 'N/A',
//             srp: item.srp || 0, // Provide a default value for srp (e.g., 0)
//             supplier: item.supplier || 'N/A' // ✅ Add this line
//         });

//         console.log('✅ Added to selectedEquipments:', this.selectedEquipments);
//     } else {
//         console.warn(`⚠️ Equipment (${item.id}) is already in selectedEquipments.`);
//     }
// }


  removeFromSelectedEquipments(itemId: string) {
    const index = this.selectedEquipments.findIndex(eq => eq.equipment_id === itemId);
    if (index !== -1) {
      this.selectedEquipments.splice(index, 1);
    }
  }

  getGroupedSelectedEquipments() {
    const groupedEquipments = new Map<string, {
        name: string;
        model: string;
        brand: string;
        totalQuantity: number;
        srp: number;
    }>();

    for (const equipment of this.selectedEquipments) {
        // Create a unique key using name, model and brand
        const key = `${equipment.name}-${equipment.model}-${equipment.brand}`.toLowerCase();

        if (!groupedEquipments.has(key)) {
            groupedEquipments.set(key, {
                name: equipment.name || 'Unknown Equipment',
                model: equipment.model || 'N/A',
                brand: equipment.brand || 'N/A',
                totalQuantity: equipment.quantity,
                srp: equipment.srp || 0
            });
        } else {
            const current = groupedEquipments.get(key)!;
            current.totalQuantity += equipment.quantity;
            // Keep the highest SRP if there are variations
            current.srp = Math.max(current.srp, equipment.srp || 0);
        }
    }

    return Array.from(groupedEquipments.values());
}

  filterEquipmentList() {
    const term = this.searchTerm.toLowerCase();

    this.filteredEquipmentList = this.equipmentList.filter(equipment => {
      console.log('Checking:', equipment);
      return (
        equipment.name?.toLowerCase().includes(term) ||
        equipment.model?.toLowerCase().includes(term) ||
        equipment.brand?.toLowerCase().includes(term) ||
        equipment.supplier?.toLowerCase().includes(term)
      );
    });
  }


getTotalProjectCost(): number {
    if (!this.selectedProject?.materials) return 0;

    // Use stored actual_cost if available, otherwise calculate
    const subtotal = this.selectedProject.materials.reduce((total: number, material: ProjectMaterial) => {
        return total + (material.actual_cost || this.getActualCost(material));
    }, 0);

    // Add 12% VAT (same as during creation)
    return subtotal * 1.12;
}



  getActualCost(selected: ProjectMaterial): number {
    const quantity = selected.quantity || 0;
    const cost = selected.cost || selected.srp || 0; // Fallback to srp if cost doesn't exist

    // Default to 20% if profitMargin is undefined/null
    const margin = selected.profitMargin ?? 20;

    const baseCost = cost * quantity;
    const profit = baseCost * (margin / 100);
    return baseCost + profit;
  }


  updateActualCostInEdit(material: any): void {
    const quantity = material.quantity || 0;
    const cost = material.cost || 0;
    const margin = material.profitMargin ?? 20;
    const baseCost = cost * quantity;
    const profit = baseCost * (margin / 100);
    material.actual_cost = baseCost + profit;
  }


    // ✅ Correct VAT Calculation (20%)
calculateVAT(): number {
  const subtotal = this.getTotalSelectedSrp();
  return subtotal * 0.2; // 20% of subtotal
}

// ✅ Correct Total with VAT (Subtotal + 20%)
calculateTotalWithVAT(): number {
  const subtotal = this.getTotalSelectedSrp();
  return subtotal * 1.2; // Subtotal + 20% VAT
}

//   markAsDelivered(project: Project) {
//   console.log(`🚚 Delivering project: ${project.name}`);

//   const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
//   const clientName = project.client_name;

//   // Pass project.id here to ensure project_id is saved
//   this.addDeliveryReceipt(project.id, project.name, clientName, currentDate);

//   project.delivered = true;

//   this.showSuccessToast('Marked as Delivered!');
//   this.closeProjectDetailsModal();
// }
async markAsDelivered(project: Project) {
  console.log(`🚚 Delivering project: ${project.name}`);

  // Update the delivery_status in the database
  const { error } = await this.supabase
    .from('projects')
    .update({ delivery_status: 'delivering' })
    .eq('id', project.id);

  if (error) {
    console.error('❌ Error updating delivery status:', error);
    this.showSuccessToast('Failed to update delivery status!');
    return;
  }

  // Update the local project object
  project.delivery_status = 'delivering';

  // Add a delivery receipt as before
  const currentDate = new Date().toISOString().split('T')[0];
  const clientName = project.client_name;
  this.addDeliveryReceipt(project.id, project.name, clientName, currentDate);

  this.showSuccessToast('Marked as Delivering!');
  this.closeProjectDetailsModal();
  await this.fetchProjects(); // Refresh the list
}

addDeliveryReceipt(projectId: string, projectName: string, clientName: string, deliveryDate: string) {
  const deliveryReceipt = {
    project_id: projectId,     // IMPORTANT: must include this
    project_name: projectName,
    client_name: clientName,
    delivery_date: deliveryDate,
    status: 'Delivering',
    attached_file: null,
  };

  this.supabase
    .from('delivery_receipts')
    .insert([deliveryReceipt])
    .select()
    .then(({ data, error }) => {
      if (error) {
        console.error('Error inserting delivery receipt:', error.message);
        return;
      }
      console.log('✅ Delivery receipt added:', data);
    });
}


  async handleFileUpload(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      // 1️⃣ Ensure the bucket name is correct (update if necessary)
      const bucketName = 'project-files'; // Check Supabase dashboard for correct name
      const fileName = `projects/${Date.now()}_${file.name}`;

      // 2️⃣ Upload file to Supabase Storage
      const { data, error } = await this.supabase.storage.from(bucketName).upload(fileName, file);

      if (error) {
        console.error('❌ Error uploading file:', error);
        alert('❌ Failed to upload file');
        return;
      }

      // 3️⃣ Retrieve the public URL after upload
      const { data: publicData } = this.supabase.storage.from(bucketName).getPublicUrl(fileName);
      if (publicData) {
        this.project.fileUrl = publicData.publicUrl; // Assign the file URL
        console.log('✅ File uploaded successfully:', this.project.fileUrl);
      } else {
        console.error('❌ Failed to retrieve public URL');
      }
    } catch (err) {
      console.error('❌ Unexpected error during file upload:', err);
    }
  }


viewFileAttached(fileUrl: string) {
  console.log('✅ Correct file URL:', fileUrl);
  this.selectedImageUrl = fileUrl;
  this.showImageModal = true;
}

closeImageModal() {
  this.showImageModal = false;
  this.selectedImageUrl = '';
}

rejectEquipment(equipment: any) {
    equipment.status = 'rejected';
    // Optional: Restore quantity if needed
    const eq = this.equipmentList.find(e => e.id === equipment.equipment_id);
    if (eq) {
        eq.quantity += equipment.quantity;
    }
    console.log(`❌ Rejected equipment: ${equipment.name}`);
}

approveEquipment(equipment: any) {
    equipment.status = 'approved';
    // Optional: Deduct quantity if needed
    const eq = this.equipmentList.find(e => e.id === equipment.equipment_id);
    if (eq && eq.quantity >= equipment.quantity) {
        eq.quantity -= equipment.quantity;
    }
    console.log(`✅ Approved equipment: ${equipment.name}`);
}

  getTotalMaterials(projects: any[]): number {
    return projects.reduce((total, project) => total + (project.materials?.length || 0), 0);
  }

  getMaterialsCountClass(count: number): string {
    if (count === 0) return 'materials-badge-danger';
    if (count < 3) return 'materials-badge-warning';
    if (count < 5) return 'materials-badge-info';
    return 'materials-badge-success';
  }

  getTotalProjectValue(project: any): number {
    if (!project?.materials?.length) return 0;
    return project.materials.reduce((total: number, material: any) => {
      const actualCost = material.actual_cost || this.getActualCost(material);
      return total + actualCost;
    }, 0);
  }

  getStatusSeverity(status: string | undefined): string {
    if (!status) return 'primary';

    switch(status.toLowerCase()) {
      case 'delivered': return 'success';
      case 'delivering': return 'info';
      case 'pending': return 'warning';
      case 'cancelled': return 'danger';
      default: return 'primary';
    }
  }

  getDisplayStatus(status: string | undefined): string {
    if (!status) return 'Status Unknown';

    const statusMap: {[key: string]: string} = {
      'delivered': 'Delivered',
      'completed': 'Completed',
      'in progress': 'In Progress',
      'delivering': 'Delivering',
      'pending': 'Pending',
      'not yet delivered': 'Not Yet Delivered',
      'cancelled': 'Cancelled',
      'rejected': 'Rejected'
    };

    return statusMap[status.toLowerCase()] || status;
  }
}
