import { Routes } from '@angular/router';
import { SidebarComponent } from './nav/sidebar/sidebar.component';
import { LoginComponent } from './auth/login/login.component';
import { DashboardComponent } from './user/dashboard/dashboard.component';
import { EquipmentListComponent } from './user/equipment-list/equipment-list.component';
import { EquipmentDetailsComponent } from './user/equipment-details/equipment-details.component';
import { ProjectMaterialsComponent } from './user/project-materials/project-materials.component';
import { DeliveryReceiptComponent } from './user/delivery-receipt/delivery-receipt.component';
import { SupplierListComponent } from './user/supplier-list/supplier-list.component';
import { PartsPickerComponent } from './user/parts-picker/parts-picker.component';
import { SupplierPortalComponent } from './user/supplier-portal/supplier-portal.component';
import { SupplierFormComponent } from './user/supplier-form/supplier-form.component';
import { OperationalEquipmentDetailsComponent } from './user/operational-equipment-details/operational-equipment-details.component';
import { UserListComponent } from './admin/user-list/user-list.component';
import { ClientListComponent } from './user/client-list/client-list.component';
import { ProjectDetailsComponent } from './user/project-details/project-details.component';
import { SavedEquipmentComponent } from './user/saved-equipment/saved-equipment.component';
import { BorrowRequestComponent } from './user/borrow-request-form/borrow-request-form.component';
import { BorrowTableUserComponent } from './user/borrow-table-user/borrow-table-user.component';
import { SupplierProfileComponent } from './user/supplier-profile/supplier-profile.component';
import { BreadcrumbComponent } from './breadcrumb/breadcrumb.component';

export const routes: Routes = [

  { path: '', redirectTo: 'login', pathMatch: 'full' },

  { path: 'login', component: LoginComponent },
  { path: 'sidebar', component: SidebarComponent },
  { path: 'dashboard', component: DashboardComponent, data: { breadcrumb: 'Dashboard' } },
  { path: 'equipment-list', component: EquipmentListComponent, data: { breadcrumb: 'Equipment List' } },
  { path: 'equipment-details/:id', component: EquipmentDetailsComponent, data: { breadcrumb: 'Equipment Details' } },
  { path: 'project-materials', component: ProjectMaterialsComponent, data: { breadcrumb: 'Project Materials' } },
  { path: 'delivery-receipt', component: DeliveryReceiptComponent, data: { breadcrumb: 'Delivery Receipt' } },
  { path: 'supplier-list', component: SupplierListComponent, data: { breadcrumb: 'Supplier List' } },
  { path: 'parts-picker', component: PartsPickerComponent, data: { breadcrumb: 'Parts Picker' } },
  { path: 'supplier-portal', component: SupplierPortalComponent, data: { breadcrumb: 'Supplier Portal' } },
  { path: 'supplier-form', component: SupplierFormComponent, data: { breadcrumb: 'Supplier Form' } },
  { path: 'operational-equipment-details/:id', component: OperationalEquipmentDetailsComponent, data: { breadcrumb: 'Operational Equipment Details' } },
  { path: 'user-list', component: UserListComponent, data: { breadcrumb: 'User List' } },
  { path: 'client-list', component: ClientListComponent, data: { breadcrumb: 'Client List' } },
  { path: 'project-details/:id', component: ProjectDetailsComponent, data: { breadcrumb: 'Project Details' } },
  { path: 'saved-equipment', component: SavedEquipmentComponent, data: { breadcrumb: [
      { label: 'Parts Picker', url: 'parts-picker' },
      { label: 'Saved Equipment', url: '/saved-equipment' }
    ]  }},
  { path: 'borrow', component: BorrowRequestComponent, data: { breadcrumb: 'Borrow Request' } },
  { path: 'borrow-table-user', component: BorrowTableUserComponent, data: { breadcrumb: 'Borrow Table' } },
  { path: 'supplier-profile/:id', component: SupplierProfileComponent, data: { breadcrumb: 'Supplier Profile' } },

];
