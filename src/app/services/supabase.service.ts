import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Router } from '@angular/router';
import * as tf from '@tensorflow/tfjs';
import * as use from '@tensorflow-models/universal-sentence-encoder';
import { environment } from '../../environments/environment';

interface UserProfileUpdates {
  first_name?: string;
  last_name?: string;
  email?: string;
  profile_image?: string;
}


interface EquipmentMovement {
  inhouse_equipment_id: string;
  movement_type: string;
  borrow_request_id?: string | null;
  project_id?: string | null;
  movement_date: string;
  employee_id: string;
  status: string;
}
const SUPABASE_URL = environment.SUPABASE_URL;
const SUPABASE_KEY = environment.SUPABASE_KEY;

interface VectorSearchParams {
  query_embedding: number[];
  similarity_threshold: number;
  match_count: number;
}

interface VectorMatch {
  id: string;
  similarity: number;
}

interface Equipment {
  id: string;
  name: string;
  model: string;
  brand: string;
  supplier_cost: number;
  srp: number;
  quantity: number;
  description?: string;
  image?: string;
  category?: string;
}

interface EquipmentWithSimilarity extends Equipment {
  similarity: number;
}

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private equipmentId: string | null = null;
  private model: any;
  private isModelLoading = false;
  private imageBucket = 'equipment-images';


  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }


  from(tableName: string) {
    return this.supabase.from(tableName);
  }

  rpc(functionName: string, params: any) {
    return this.supabase.rpc(functionName, params);
  }

  private handleError(error: any): string {
    console.error('❌ Supabase Error:', error);

    if (error.statusCode === '403') return 'Unauthorized action. Please check your permissions.';
    if (error.statusCode === '401') return 'You must be logged in to perform this action.';
    if (error.code === '22001') return 'Input value too long. Please shorten your input.';

    return 'An unexpected error occurred. Please try again later.';
  }


  async uploadFile(file: File, bucketName: 'profile-pictures' | 'equipment-images' | 'equipment-brochures'): Promise<string> {
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      throw new Error(`File too large (${file.size} bytes). Max allowed: 50MB.`);
    }

    const filePath = `${Date.now()}-${file.name}`; // Unique filename
    console.log(`🔄 Uploading File: ${file.name} | Path: ${filePath} | Bucket: ${bucketName}`);

    const { data, error } = await this.supabase.storage
      .from(bucketName)
      .upload(filePath, file, { upsert: false });

    if (error) {
      console.error(`❌ File upload failed to ${bucketName}:`, error.message);
      throw new Error(`Failed to upload file to ${bucketName}.`);
    }

    // ✅ Fetch public URL correctly
    const { data: publicUrlData } = this.supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    if (!publicUrlData || !publicUrlData.publicUrl) {
      console.error(`❌ Failed to get public URL for uploaded file in ${bucketName}.`);
      throw new Error(`Failed to get public URL for file in ${bucketName}.`);
    }

    console.log(`✅ File uploaded successfully to ${bucketName}: ${publicUrlData.publicUrl}`);
    return publicUrlData.publicUrl;
  }


  async softDeleteEquipment(equipmentId: string, reason: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('equipments')
      .update({
        deleted_at: new Date().toISOString(), // ✅ Marks as deleted
        delete_reason: reason // ✅ Stores the reason provided
      })
      .eq('id', equipmentId);

    if (error) {
      console.error('❌ Error moving equipment to trash:', error);
      return false;
    }

    console.log(`✅ Equipment ID ${equipmentId} moved to trash with reason: ${reason}`);
    return true;
}

  // 🔹 Insert into `equipment_images` table
  async addEquipmentImage(equipmentId: string, imageUrl: string) {
    const { data, error } = await this.supabase
      .from('equipment_images')
      .insert([{ equipment_id: equipmentId, image_url: imageUrl }]);

    if (error) {
      console.error('❌ Error inserting equipment image:', error);
      return null;
    }

    return data;
  }

  // 🔹 Insert into `equipment_repair_logs` table
  async addRepairLog(equipmentId: string, repairDetails: string) {
    const { data, error } = await this.supabase
      .from('equipment_repair_logs')
      .insert([
        {
          equipment_id: equipmentId,
          repair_details: repairDetails,
          repair_status: 'New',
          repair_date: new Date().toISOString(),
        },
      ]);

    if (error) {
      console.error('❌ Error inserting repair log:', error);
      return null;
    }

    return data;
  }

 async addEquipment(equipmentData: any) {
    // Ensure category is being passed in the equipment data
    if (!equipmentData.category) {
      equipmentData.category = 'Default Category'; // Set a default if not provided
    }

    // Remove any unwanted fields
    const { ...cleanEquipmentData } = equipmentData;

    // Determine if it's a new equipment or updating existing one
    if (this.equipmentId) {
      // 🔹 Edit Existing Equipment (Update Record)
      const { data, error } = await this.supabase
        .from('equipments')
        .update({
          serial_no: cleanEquipmentData.serial_no,
          name: cleanEquipmentData.name,
          model: cleanEquipmentData.model,
          brand: cleanEquipmentData.brand,
          supplier: cleanEquipmentData.supplier,
          supplier_cost: cleanEquipmentData.supplier_cost,
          srp: cleanEquipmentData.srp,
          quantity: cleanEquipmentData.quantity,
          location: cleanEquipmentData.location,
          description: cleanEquipmentData.description,
          variety: cleanEquipmentData.variety,
          qr_code: cleanEquipmentData.qr_code,
          barcode: cleanEquipmentData.barcode,
          damaged: cleanEquipmentData.damaged,
          return_slip: cleanEquipmentData.return_slip,
          product_images: cleanEquipmentData.product_images,
          condition: cleanEquipmentData.condition,
          date_acquired: cleanEquipmentData.date_acquired,
          lifespan_months: cleanEquipmentData.item_type === 'Semi-Expendable' ? cleanEquipmentData.lifespan_months : null,
          item_type: cleanEquipmentData.item_type || 'Expendable',
          category: cleanEquipmentData.category,
          brochure_url: cleanEquipmentData.brochure_url || null,
          ownership_type: cleanEquipmentData.ownership_type,

        })
        .eq('id', this.equipmentId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating equipment:', error);
        return null;
      }

      console.log('✅ Equipment updated successfully:', data);
      const equipmentId = data.id;

      // Handle image URLs if new ones are provided
      let imageUrls: string[] = [];
      if (cleanEquipmentData.product_images && cleanEquipmentData.product_images.length > 0) {
        for (const imageUrl of cleanEquipmentData.product_images) {
          const { data: imageData, error: imageError } = await this.supabase
            .from('equipment_images')
            .insert([{ equipment_id: equipmentId, image_url: imageUrl }])
            .select('image_url');

          if (imageError) {
            console.error('❌ Error inserting image:', imageError);
          } else if (imageData && imageData.length > 0) {
            imageUrls.push(imageData[0].image_url);
          }
        }
        console.log('✅ Image URLs inserted:', imageUrls);
      }

      // Update `equipments` table with new images
      const { error: updateImageError } = await this.supabase
        .from('equipments')
        .update({
          product_images: imageUrls.length > 0 ? imageUrls : null
        })
        .eq('id', equipmentId);

      if (updateImageError) {
        console.error('❌ Error updating equipment with images:', updateImageError);
      } else {
        console.log('✅ Equipment updated with images:', imageUrls);
      }

      // 🔹 Handle Repair Logs Update (if any)
      if (cleanEquipmentData.repair_logs && cleanEquipmentData.repair_logs.length > 0) {
        for (const repair of cleanEquipmentData.repair_logs) {
          const { data: repairData, error: repairError } = await this.supabase
            .from('equipment_repair_logs')
            .insert([{
              equipment_id: equipmentId,
              repair_details: repair.repair_details,
              repair_status: repair.repair_status || 'New',
              repair_date: repair.repair_date || new Date().toISOString(),
            }])
            .select();

          if (repairError) {
            console.error('❌ Error inserting repair log:', repairError);
          } else {
            console.log('✅ Repair log inserted successfully:', repairData);
          }
        }
      }

      // ✅ Log activity after editing
      await this.logActivity('edit', equipmentId, `Equipment "${data.name}" was updated.`);
      return data;
    } else {
      // 🔹 Add New Equipment
      const { data, error } = await this.supabase
        .from('equipments')
        .insert([{
          serial_no: cleanEquipmentData.serial_no,
          name: cleanEquipmentData.name,
          model: cleanEquipmentData.model,
          brand: cleanEquipmentData.brand,
          supplier: cleanEquipmentData.supplier,
          supplier_cost: cleanEquipmentData.supplier_cost,
          srp: cleanEquipmentData.srp,
          quantity: cleanEquipmentData.quantity,
          location: cleanEquipmentData.location,
          description: cleanEquipmentData.description,
          variety: cleanEquipmentData.variety,
          qr_code: cleanEquipmentData.qr_code,
          barcode: cleanEquipmentData.barcode,
          damaged: cleanEquipmentData.damaged,
          return_slip: cleanEquipmentData.return_slip,
          product_images: [],
          condition: cleanEquipmentData.condition,
          date_acquired: cleanEquipmentData.date_acquired,
          lifespan_months: cleanEquipmentData.item_type === 'Semi-Expendable' ? cleanEquipmentData.lifespan_months : null,
          item_type: cleanEquipmentData.item_type,
          category: cleanEquipmentData.category,
          brochure_url: cleanEquipmentData.brochure_url || null,
          ownership_type: cleanEquipmentData.ownership_type,
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ Error adding equipment:', error);
        return null;
      }

      console.log('✅ Equipment added successfully:', data);
      const equipmentId = data.id;

      let imageUrls: string[] = [];
      let repairLogs: any[] = [];

      // 🔹 Insert Product Images
      for (const imageUrl of cleanEquipmentData.product_images) {
        const { data: imageData, error: imageError } = await this.supabase
          .from('equipment_images')
          .insert([{ equipment_id: equipmentId, image_url: imageUrl }])
          .select('image_url');

        if (imageError) {
          console.error('❌ Error inserting image:', imageError);
        } else if (imageData && imageData.length > 0) {
          imageUrls.push(imageData[0].image_url);
        }
      }

      // Insert Repair Logs
      if (cleanEquipmentData.repair_logs && cleanEquipmentData.repair_logs.length > 0) {
        for (const repair of cleanEquipmentData.repair_logs) {
          const { data: repairData, error: repairError } = await this.supabase
            .from('equipment_repair_logs')
            .insert([{
              equipment_id: equipmentId,
              repair_details: repair.repair_details,
              repair_status: repair.repair_status || 'New',
              repair_date: repair.repair_date || new Date().toISOString(),
            }])
            .select();

          if (repairError) {
            console.error('❌ Error inserting repair log:', repairError);
          } else {
            repairLogs.push(repairData[0]);
          }
        }
      }

      // 🔹 Update equipment with images & repair logs
      const { error: updateError } = await this.supabase
        .from('equipments')
        .update({
          product_images: imageUrls.length > 0 ? imageUrls : null,
          repair_logs: repairLogs.length > 0 ? repairLogs : null
        })
        .eq('id', equipmentId);

      if (updateError) {
        console.error('❌ Error updating equipment with images & repair logs:', updateError);
      } else {
        console.log('✅ Equipment updated with images & repair logs');
      }

      await this.logActivity('add', equipmentId, `Equipment "${cleanEquipmentData.model}" was added to inventory.`);

      return data;
    }
  }

  async addInhouseEquipment(equipment: any) {
    const { data, error } = await this.supabase
      .from('inhouse') // inserting into the correct table
      .insert([equipment])
      .select(); // add .select() to return the inserted row

    if (error) {
      console.error('❌ Error adding inhouse equipment:', error);
      return null;
    }

    if (!data || data.length === 0) {
      console.error('❌ No data returned after inserting inhouse equipment.');
      return null;
    }

    return data[0]; // safely return the first inserted record
  }


  async getEquipmentList() {
    console.log("🔄 Fetching Equipment List from Supabase...");

    const { data, error } = await this.supabase
      .from('equipments')
      .select(`
        id,
        serial_no,
        name,
        model,
        brand,
        quantity,
        location,
        description,
        variety,
        item_type,
        condition,
        damaged,
        supplier,
        supplier_cost,
        srp,
        date_acquired,
        lifespan_months,
        qr_code,
        barcode,
        product_images,
        return_slip,
        deleted_at,
        delete_reason,
        repair_logs,
        ownership_type
      `)
      .is('deleted_at', null) // 🔍 Only fetch active equipment
      .order('date_acquired', { ascending: false });

    if (error) {
      console.error('❌ Error fetching equipment data:', error);
      return [];
    }

    console.log("✅ Raw Equipment Data Retrieved:", data);

    // ✅ Calculate expiration info
    const today = new Date();
    return data.map((equipment: any) => {
      const acquiredDate = equipment.date_acquired ? new Date(equipment.date_acquired) : null;
      const expirationDate = acquiredDate ? new Date(acquiredDate) : null;

      if (expirationDate) {
        expirationDate.setMonth(expirationDate.getMonth() + (equipment.lifespan_months || 0));
      }

      const timeRemaining = acquiredDate && expirationDate
        ? Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        id: equipment.id,
        serial_no: equipment.serial_no || '',
        name: equipment.name || '',
        model: equipment.model || '',
        brand: equipment.brand || '',
        quantity: equipment.quantity ?? 1,
        location: equipment.location || '',
        description: equipment.description || '',
        variety: equipment.variety || '',
        item_type: equipment.item_type || 'Expendable',
        condition: equipment.condition || "Unknown",
        damaged: equipment.damaged ?? false,
        supplier: equipment.supplier || '',
        supplier_cost: equipment.supplier_cost ?? 0,
        srp: equipment.srp ?? 0,
        date_acquired: equipment.date_acquired || null,
        lifespan_months: equipment.lifespan_months ?? 12,
        timeRemaining,
        nearExpiration: timeRemaining !== null && timeRemaining <= 60,
        qr_code: equipment.qr_code || null,
        barcode: equipment.barcode || null,
        product_images: equipment.product_images || [],
        return_slip: equipment.return_slip || null,
        repair_logs: equipment.repair_logs ? [...equipment.repair_logs] : [],
        deleted_at: equipment.deleted_at,
        delete_reason: equipment.delete_reason || null,
         ownership_type: equipment.ownership_type || null,
      };
    });
  }

  async addPCPart(pcPart: any) {
    const { data, error } = await this.supabase
      .from('pc_parts')
      .insert([
        {
          category: pcPart.category,
          name: pcPart.name,
          model: pcPart.model,
          brand: pcPart.brand,
          supplier: pcPart.supplier,
          cost: pcPart.cost,
          quantity: pcPart.quantity,
          images: pcPart.images, // Array of image URLs
        },
      ]);

    if (error) {
      console.error('Error inserting PC part:', error);
      throw new Error('Error inserting PC part');
    }

    return data;
  }

  async getTrashedEquipment(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('equipments')
      .select(`
        id,
        name,
        model,
        brand,
        quantity,
        item_type,
        date_acquired,
        lifespan_months,
        product_images,
        supplier_cost,
        srp,
        condition,
        deleted_at,
        delete_reason,
        qr_code,
        barcode
      `)
      .not('deleted_at', 'is', null) // 🔍 Get only trashed items
      .order('deleted_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching trashed equipment:', error);
      return [];
    }

    console.log("✅ Trashed Equipment List:", data);

    return data.map((equipment: any) => ({
      id: equipment.id,
      name: equipment.name,
      model: equipment.model,
      brand: equipment.brand,
      quantity: equipment.quantity,
      item_type: equipment.item_type || 'Expendable',
      product_images: equipment.product_images || [],
      supplier_cost: equipment.supplier_cost || 0,
      srp: equipment.srp || 0,
      condition: equipment.condition || "Unknown",
      date_acquired: equipment.date_acquired || null,
      deleted_at: equipment.deleted_at,  // ✅ Ensure this field is present
      delete_reason: equipment.delete_reason || "No reason provided", // ✅ Default text if empty
      qr_code: equipment.qr_code || null,
      barcode: equipment.barcode || null
    }));
}

  async restoreEquipment(equipmentId: string): Promise<boolean> {
    console.log(`♻ Restoring equipment: ${equipmentId}`);

    const { error } = await this.supabase
      .from('equipments')
      .update({ deleted_at: null }) // 🔄 Remove deleted_at timestamp
      .eq('id', equipmentId);

    if (error) {
      console.error('❌ Error restoring equipment:', error);
      return false;
    }

    console.log(`✅ Equipment restored: ${equipmentId}`);
    return true;
  }

  async permanentlyDeleteEquipment(equipmentId: string): Promise<boolean> {
    console.log(`🔥 Permanently deleting equipment: ${equipmentId}`);

    const { error } = await this.supabase
      .from('equipments')
      .delete()
      .eq('id', equipmentId);

    if (error) {
      console.error('❌ Error permanently deleting equipment:', error);
      return false;
    }

    console.log(`✅ Equipment permanently deleted: ${equipmentId}`);
    return true;
  }



async getEquipmentDetails(name: string, model: string, brand: string) {
  const { data, error } = await this.supabase
    .from('equipments')
    .select('*')
    .eq('name', name)
    .eq('model', model)
    .eq('brand', brand);

  if (error) {
    console.error('❌ Error fetching equipment details:', error);
    return [];
  }

  return data;
}

async getEquipmentDetailsById(id: string) {
  // First try inhouse table
  let { data: inhouseData, error: inhouseError } = await this.supabase
    .from('inhouse')
    .select('*')
    .eq('id', id)
    .maybeSingle(); // Use maybeSingle() to handle empty results

  if (!inhouseError && inhouseData) {
    return { ...inhouseData, source: 'inhouse' };
  }

  // If not found in inhouse, try equipments table
  let { data: equipmentsData, error: equipmentsError } = await this.supabase
    .from('equipments')
    .select('*')
    .eq('id', id)
    .maybeSingle(); // Use maybeSingle() to handle empty results

  if (!equipmentsError && equipmentsData) {
    return { ...equipmentsData, source: 'equipments' };
  }

  // If not found in either table
  console.error(`Equipment ${id} not found in any table`);
  return null;
}


async deleteEquipment(equipmentId: string): Promise<{ data: any; error: any }> {
  console.log(`🗑 Moving equipment to trash: ${equipmentId}`);

  // ✅ Fetch equipment details before deletion
  const { data: equipment, error: fetchError } = await this.supabase
    .from('equipments')
    .select('name')
    .eq('id', equipmentId)
    .single();

  if (fetchError || !equipment) {
    console.error(`❌ Equipment with ID ${equipmentId} not found.`);
    return { data: null, error: 'Equipment not found' };
  }

  // ✅ Mark as deleted (set `deleted_at` timestamp)
  const { data, error } = await this.supabase
    .from('equipments')
    .update({ deleted_at: new Date().toISOString() }) // 🕒 Set deleted_at timestamp
    .eq('id', equipmentId)
    .select()
    .single();

  if (error) {
    console.error('❌ Error moving equipment to trash:', error);
    return { data, error };
  }

  console.log(`✅ Equipment moved to trash: ${equipmentId}`);

  // ✅ Log Activity with the correct equipment name
  await this.logActivity('delete', equipmentId, `Equipment "${equipment.name}" was moved to the trash.`);

  return { data, error };
}

async addCostHistory(equipmentId: string, costEntry: {
  supplier_cost: number;
  srp: number;
  date_updated: string;
  entry_type?: string;
  supplier?: string;
}) {
  console.log(`🔄 Attempting to add cost history for Equipment ID: ${equipmentId}`);

  if (!equipmentId || equipmentId === "NULL") {
    console.error("❌ ERROR: Cannot insert cost history because Equipment ID is NULL!");
    return;
  }

  // Check if an initial entry already exists
  const { data: existingInitial, error: fetchError } = await this.supabase
    .from('equipment_cost_history')
    .select('id')
    .eq('equipment_id', equipmentId)
    .eq('entry_type', 'initial')
    .single();

  if (fetchError && !fetchError.message.includes('No rows found')) {
    console.error("❌ Error fetching initial cost entry:", fetchError);
  }

  if (!existingInitial) {
    console.log("🆕 No initial cost entry found, inserting it now...");
    costEntry.entry_type = 'initial';
  } else {
    costEntry.entry_type = costEntry.entry_type || 'edited';
  }

  console.log("📥 Final Cost Entry to be Inserted:", JSON.stringify(costEntry, null, 2));

  const { data, error: insertError } = await this.supabase
    .from('equipment_cost_history')
    .insert([{
      equipment_id: equipmentId,
      supplier_cost: costEntry.supplier_cost,
      srp: costEntry.srp,
      date_updated: costEntry.date_updated,
      entry_type: costEntry.entry_type,
      supplier: costEntry.supplier || null
    }])
    .select();

  if (insertError) {
    console.error("❌ Error inserting cost history:", insertError);
    throw insertError;
  } else {
    console.log(`✅ Cost history added successfully! Type: ${costEntry.entry_type}`);
    return data;
  }
}

async getFirstCostEntry(equipmentId: string, supplier?: string) {
  console.log(`🔍 Fetching first cost entry for Equipment ID: ${equipmentId}` +
              (supplier ? ` (Supplier: ${supplier})` : ''));

  let query = this.supabase
      .from('equipment_cost_history')
      .select('*')
      .eq('equipment_id', equipmentId)
      .eq('entry_type', 'initial')
      .order('date_updated', { ascending: true })
      .limit(1);

  if (supplier) {
      query = query.eq('supplier', supplier);
  }

  const { data, error } = await query.single();

  if (error) {
      console.error("❌ Error fetching first cost entry:", error);
  } else {
      console.log("✅ First cost entry found:", data);
  }

  return { data, error };
}


  async getSuppliers() {
    const { data, error } = await this.supabase
      .from('suppliers') // Ensure this matches your table name
      .select('supplier_name, contact_person');

    if (error) {
      console.error('❌ Error fetching suppliers:', error);
      return [];
    }
    return data;
  }

  async updateEquipment(equipmentId: string, equipmentData: any, router: Router) {
    // ✅ Ensure `repair_logs` and `product_images` are always arrays
    const repairLogs = Array.isArray(equipmentData.repair_logs) ? equipmentData.repair_logs : [];
    const productImages = Array.isArray(equipmentData.product_images) ? equipmentData.product_images : [];

    // 🔹 Step 1: Fetch the current equipment details
    const { data: existingEquipment, error: fetchError } = await this.supabase
        .from('equipments')
        .select('name, supplier_cost, srp, condition, barcode')
        .eq('id', equipmentId)
        .single();

    if (fetchError || !existingEquipment) {
        console.error(`❌ Error fetching existing equipment:`, fetchError);
        return null;
    }

    const oldCondition = existingEquipment.condition;
    const oldSupplierCost = existingEquipment.supplier_cost;
    const oldSrp = existingEquipment.srp;

    // 🔹 Step 2: Update Equipment Data
    const { data, error } = await this.supabase
        .from('equipments')
        .update({
            serial_no: equipmentData.serial_no,
            name: equipmentData.name,
            model: equipmentData.model,
            brand: equipmentData.brand,
            supplier: equipmentData.supplier,
            supplier_cost: equipmentData.supplier_cost,
            srp: equipmentData.srp,
            quantity: equipmentData.quantity,
            location: equipmentData.location,
            description: equipmentData.description,
            variety: equipmentData.variety,
            qr_code: equipmentData.qr_code,
            barcode: equipmentData.barcode,
            damaged: equipmentData.damaged,
            return_slip: equipmentData.return_slip,
            condition: equipmentData.condition,
            date_acquired: equipmentData.date_acquired,
            lifespan_months: equipmentData.item_type === 'Semi-Expendable' ? equipmentData.lifespan_months : null,
            item_type: equipmentData.item_type,
        })
        .eq('id', equipmentId)
        .select()
        .single();

    if (error) {
        console.error('❌ Error updating equipment:', error);
        return null;
    }

    console.log('✅ Equipment updated successfully:', data);

    // 🔹 Step 3: Log Condition Change
    if (oldCondition !== equipmentData.condition) {
        await this.logActivity(
            'update',
            equipmentId,
            `Condition for "${data.name}" changed from "${oldCondition || 'Unknown'}" to "${equipmentData.condition}".`
        );
    }

    // 🔹 Step 4: Log Cost Changes in `equipment_cost_history`
    if (oldSupplierCost !== equipmentData.supplier_cost || oldSrp !== equipmentData.srp) {
        // ✅ Fetch the first cost entry for this equipment
        const { data: existingCostHistory, error: historyFetchError } = await this.supabase
            .from('equipment_cost_history')
            .select('*')
            .eq('equipment_id', equipmentId)
            .order('date_updated', { ascending: true }) // Get the earliest recorded entry
            .limit(1);

        if (historyFetchError) {
            console.error('❌ Error fetching cost history:', historyFetchError);
        }

        // ✅ Ensure the initial cost entry remains untouched
        let firstEntry = existingCostHistory && existingCostHistory.length > 0 ? existingCostHistory[0] : null;

        // ✅ Add the new cost change entry
        const newEntry = {
            equipment_id: equipmentId,
            supplier_cost: equipmentData.supplier_cost,
            srp: equipmentData.srp,
            date_updated: new Date().toISOString()
        };

        const { error: costHistoryError } = await this.supabase
            .from('equipment_cost_history')
            .insert([newEntry]);

        if (costHistoryError) {
            console.error('❌ Error inserting cost history:', costHistoryError);
        } else {
            console.log('✅ Cost history recorded successfully!');
        }

        // ✅ Ensure the first recorded price is always preserved
        if (firstEntry) {
            console.log("🔹 Preserving initial cost entry:", firstEntry);
            const { error: preserveError } = await this.supabase
                .from('equipment_cost_history')
                .update(firstEntry)
                .eq('id', firstEntry.id); // Update the specific entry by its ID

            if (preserveError) {
                console.error('❌ Error preserving initial cost entry:', preserveError);
            } else {
                console.log('✅ Initial cost entry preserved successfully.');
            }
        }
    } else {
        console.log('⚠ No cost change detected, skipping cost history update.');
    }

    // 🔹 Step 5: Update Repair Logs (Now Safely Handled)
    if (repairLogs.length > 0) { // ✅ No more `.length` error
        for (const log of repairLogs) {
            if (log.id) {
                // ✅ Update existing repair log
                const { error: updateLogError } = await this.supabase
                    .from('equipment_repair_logs')
                    .update({
                        repair_details: log.repair_details,
                        repair_status: log.repair_status,
                        repair_date: log.repair_date
                    })
                    .eq('id', log.id);

                if (updateLogError) {
                    console.error(`❌ Error updating repair log (ID: ${log.id}):`, updateLogError);
                } else {
                    console.log(`✅ Repair log (ID: ${log.id}) updated successfully.`);
                }
            } else {
                // ✅ Insert new repair log
                const { error: insertLogError } = await this.supabase
                    .from('equipment_repair_logs')
                    .insert([{
                        equipment_id: equipmentId,
                        repair_details: log.repair_details,
                        repair_status: log.repair_status || 'New',
                        repair_date: log.repair_date || new Date().toISOString(),
                    }]);

                if (insertLogError) {
                    console.error('❌ Error inserting new repair log:', insertLogError);
                } else {
                    console.log('✅ New repair log inserted successfully.');
                }
            }
        }
        // ✅ Log repair log update activity
        await this.logActivity('update', equipmentId, `Repair logs updated for "${data.name}".`);
    }

    // ✅ Success alert
    alert(`✅ Equipment "${data.name}" updated successfully!`);

    // ✅ Redirect to `equipment-details`
    router.navigate(['/equipment-details', equipmentId]);

    return data;
}


async getEquipmentRepairLogs(equipmentId: string) {
  const { data, error } = await this.supabase
    .from('equipment_repair_logs') // ✅ Correct Table Name
    .select('repair_details, repair_status, repair_date')
    .eq('equipment_id', equipmentId);

  if (error) {
    console.error("❌ Error fetching repair logs:", error);
    return [];
  }

  return data; // ✅ Return repair logs as an array
}



async getEquipmentById(equipmentId: string) {
  // First try inhouse table
  const { data: inhouseData, error: inhouseError } = await this.supabase
    .from('inhouse')
    .select(`
      id,
      name,
      quantity,
      images,
      serial_number,
      qr_code,
      barcode,
      date_acquired,
      product_type
    `)
    .eq('id', equipmentId)
    .single();

  if (!inhouseError && inhouseData) {
    console.log("✅ Found equipment in inhouse table");
    return {
      ...inhouseData,
      product_images: inhouseData.images || [],
      source: 'inhouse'
    };
  }

  // If not found in inhouse, try equipments table
  const { data: equipmentData, error: equipmentError } = await this.supabase
    .from('equipments')
    .select('*')
    .eq('id', equipmentId)
    .single();

  if (!equipmentError && equipmentData) {
    console.log("✅ Found equipment in equipments table");
    return {
      ...equipmentData,
      source: 'equipments'
    };
  }

  console.error('❌ Equipment not found in either table');
  return null;
}


async getCostHistory(equipmentId: string) {
  try {
      // 🔹 Fetch historical cost changes with supplier information
      const { data: costHistory, error: costError } = await this.supabase
          .from('equipment_cost_history')
          .select(`
              supplier_cost,
              srp,
              date_updated,
              supplier
          `)  // Removed the relationship query since your schema stores supplier as text
          .eq('equipment_id', equipmentId)
          .order('date_updated', { ascending: true });

      if (costError) {
          console.error('❌ Error fetching cost history:', costError);
          return [];
      }

      // 🔹 Fetch the initial cost when the equipment was first acquired
      const { data: equipment, error: equipmentError } = await this.supabase
          .from('equipments')
          .select(`
              supplier_cost,
              srp,
              date_acquired,
              supplier
          `)  // Simplified to match your schema
          .eq('id', equipmentId)
          .single();

      if (equipmentError) {
          console.error('❌ Error fetching initial equipment cost:', equipmentError);
          return costHistory;
      }

      // ✅ Create an initial cost entry if it doesn't already exist in the history
      const initialEntry: any = {  // Added type annotation to resolve spread operator issue
          supplier_cost: equipment.supplier_cost,
          srp: equipment.srp,
          date_updated: equipment.date_acquired,
          supplier: equipment.supplier || null
      };

      // ✅ Prevent duplicate first entries with improved date comparison
      const hasInitialEntry = costHistory.some((entry: any) =>
          new Date(entry.date_updated).getTime() ===
          new Date(initialEntry.date_updated).getTime()
      );

      if (!hasInitialEntry) {
          costHistory.unshift(initialEntry);
      }

      // Format the data consistently
      return costHistory.map((entry: any) => ({  // Added type annotation
          ...entry,
          supplier: entry.supplier || null  // Simplified since we're not using relationships
      }));
  } catch (error) {
      console.error('❌ Unexpected error in getCostHistory:', error);
      return [];
  }
}

async getPcPartCostHistory(pcPartId: string) {
  try {
    // 🔹 Fetch cost changes for this PC part from the shared cost history table
    const { data: costHistory, error: costError } = await this.supabase
      .from('equipment_cost_history')
      .select('supplier_cost, srp, date_updated')
      .eq('equipment_id', pcPartId)
      .eq('entry_type', 'pc_part') // ✅ Filter by entry type
      .order('date_updated', { ascending: true });

    if (costError) {
      console.error('❌ Error fetching PC part cost history:', costError);
      return [];
    }

    // 🔹 Get initial cost from the pc_parts table
    const { data: pcPart, error: partError } = await this.supabase
      .from('pc_parts')
      .select('cost, created_at')
      .eq('id', pcPartId)
      .single();

    if (partError) {
      console.error('❌ Error fetching initial PC part:', partError);
      return costHistory;
    }

    const initialEntry = {
      supplier_cost: pcPart.cost,
      srp: null, // SRP might not be used for PC parts
      date_updated: pcPart.created_at
    };

    if (!costHistory.some(entry => entry.date_updated === initialEntry.date_updated)) {
      costHistory.unshift(initialEntry);
    }

    return costHistory;
  } catch (error) {
    console.error('❌ Unexpected error in getPcPartCostHistory:', error);
    return [];
  }
}

async getCostHistoryBySupplier(equipmentId: string, supplierName: string) {
  const { data, error } = await this.supabase
    .from('equipment_cost_history')
    .select('*')
    .eq('equipment_id', equipmentId)
    .eq('supplier', supplierName)
    .order('date_updated', { ascending: true });

  if (error) throw error;
  return data;
}

async getUniqueSuppliersFromCostHistory(equipmentId: string) {
  const { data, error } = await this.supabase
    .from('equipment_cost_history')
    .select('supplier')
    .eq('equipment_id', equipmentId)
    .not('supplier', 'is', null)
    .order('supplier', { ascending: true });

  if (error) throw error;

  // Get unique suppliers
  const uniqueSuppliers = [...new Set(data.map(item => item.supplier))];
  return uniqueSuppliers;
}


  async getUser() {
    const { data, error } = await this.supabase.auth.getUser();

    if (error) {
      console.error('❌ Error fetching auth user:', error);
      return null;
    }

    const user = data.user;

    if (!user) {
      console.warn("⚠ No authenticated user found.");
      return null;
    }

    // ✅ Fetch user profile from `profiles` table
    const { data: profile, error: profileError } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();  // Fetch the profile linked to this user

    if (profileError) {
      console.error("❌ Error fetching user profile:", profileError);
      return { id: user.id, email: user.email, profile: null }; // Return auth user but no profile
    }

    console.log("✅ Fetched User Profile:", profile);

    return {
      id: user.id,        // ✅ User ID
      email: user.email,  // ✅ User Email
      profile: profile,   // ✅ Full Profile Data
    };
  }


  async getCurrentUser(): Promise<any | null> {
    const { data: authUser, error: authError } = await this.supabase.auth.getUser();

    if (authError || !authUser?.user) {
      console.error('❌ Error fetching authenticated user:', authError);
      return null;
    }

    const { data: userData, error: userError } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', authUser.user.id)
      .single(); // ⬅️ ensures it's not an array

    if (userError) {
      console.error('❌ Error fetching user data from users table:', userError);
      return null;
    }

    return userData; // ⬅️ This now includes usertype, name, etc.
  }



  async getTotalEquipmentCount(): Promise<number> {
    const { count, error } = await this.supabase
      .from('equipments')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('❌ Error fetching total equipment count:', error);
      return 0;
    }

    return count || 0;
  }

  async getInHouseEquipment(): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('inhouse')
        .select(`
          id,
          name,
          quantity,
          images,
          serial_number,
          qr_code,
          barcode,
          date_acquired,
          product_type,
          brand,
          model,
          status
        `)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching in-house equipment:', error);
        return [];
      }

      // Log the fetched data to verify barcode is present
      console.log('Fetched in-house equipment with barcodes:', data);

      return data || [];
    } catch (error) {
      console.error('Unexpected error fetching in-house equipment:', error);
      return [];
    }
  }

  async getRepairLogs(equipmentId: string): Promise<any[]> {
  const { data, error } = await this.supabase
    .from('repair_logs') // or whatever your repair logs table is called
    .select('*')
    .eq('equipment_id', equipmentId)
    .order('repair_date', { ascending: false });

  if (error) {
    console.error('Error fetching repair logs:', error);
    return [];
  }

  return data;
}

// In supabase.service.ts
async getInHouseEquipmentById(id: string): Promise<{ data: any, error: any }> {
  const { data, error } = await this.supabase
    .from('inhouse')
    .select('*')
    .eq('id', id)
    .single();

  return { data, error }; // Return both data and error
}

  async getForSaleEquipment(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('equipments')
      .select('*')
      .is('deleted_at', null) // Only non-deleted items
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching for-sale equipment:', error);
      return [];
    }
    return data || [];
  }

async getPCParts() {
  const { data, error } = await this.supabase
    .from('equipments')
    .select('*')
    .eq('category', 'PC Parts'); // Assuming you have a category field

  if (error) {
    console.error('Error fetching PC parts:', error);
    return null;
  }
  return data;
}

  async logActivity(activityType: string, equipmentId: string, message: string) {
    const { data, error } = await this.supabase
      .from('recent_activities')
      .insert([
        {
          activity_type: activityType,
          equipment_id: equipmentId ? equipmentId : null,
          message: message,
          timestamp: new Date().toISOString(), // Current timestamp
        },
      ])
      .select(); // Select inserted data for debugging

    if (error) {
      console.error('❌ Error logging activity:', error);
    } else {
      console.log(`✅ Activity logged: ${activityType} - ${message}`, data);
    }
  }

//   async logActivity(activityType: string, equipmentId: string | null, message: string) {
//   const { data, error } = await this.supabase
//     .from('recent_activities')
//     .insert([
//       {
//         activity_type: activityType,
//         equipment_id: equipmentId,  // This can now be null
//         message: message,
//         timestamp: new Date().toISOString(),
//       },
//     ])
//     .select();

//   if (error) {
//     console.error('❌ Error logging activity:', error);
//   } else {
//     console.log(`✅ Activity logged: ${activityType} - ${message}`, data);
//   }
// }



  async getRecentActivities(): Promise<any[]> {
    const { data, error } = await this.supabase
        .from('recent_activities')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

    if (error) {
        console.error('❌ Error logging activity:', error);
        return [];
    }

    if (!data || data.length === 0) {
        console.warn('⚠ No recent activities found in database.');
        return [];
    }

    const borrowActivities: any[] = [];
    const returnActivities: any[] = [];
    const groupedActivities: any[] = [];
    const projectActivities: any[] = [];
    const additionActivities: any[] = [];

    data.forEach(activity => {
    // console.log('🔍 Checking Activity:', activity.message);

          // Normalize message for comparison
          const normalizedMsg = activity.message.toLowerCase();

          // Check project activities first
          if (activity.activity_type === "project_created" || activity.activity_type === "project_deleted") {
              projectActivities.push(activity);
          }
          // Improved return activity detection
          else if (normalizedMsg.includes("return") ||
                  activity.activity_type === "equipment_returned" ||
                  activity.activity_type === "return_completed") {
              returnActivities.push(activity);
          }
          // Borrowed equipment detection
          else if (normalizedMsg.includes("borrow") ||
                  activity.activity_type === "equipment_borrowed") {
              borrowActivities.push(activity);
          }
          // Added equipment detection (keep your existing logic)
          else if (normalizedMsg.includes("added")) {
            // Improved equipment name extraction
            let quantity = 1;
            let equipmentModel = '';

            // Try multiple patterns to extract equipment info
            const patterns = [
                /Equipment "(.+?)" was added to inventory/,  // Pattern for "Equipment "X" was added"
                /Added (\d+)x? "(.+?)"/,                     // Pattern for "Added 2x "X""
                /Added "(.+?)"/,                             // Pattern for "Added "X""
                /Added (\d+) (.+?) to inventory/             // Pattern for "Added 2 X to inventory"
            ];

            let matchFound = false;
            for (const pattern of patterns) {
                const match = activity.message.match(pattern);
                if (match) {
                    if (match[2]) {
                        // Pattern with quantity and name (e.g., "Added 2x "X"")
                        quantity = parseInt(match[1]) || 1;
                        equipmentModel = match[2];
                    } else if (match[1]) {
                        // Pattern with just name (e.g., "Equipment "X" was added")
                        equipmentModel = match[1];
                    }
                    matchFound = true;
                    break;
                }
            }

            if (!matchFound) {
                // Fallback - keep original message if no pattern matches
                additionActivities.push(activity);
                return;
            }

            // Group similar additions
            const lastEntry = groupedActivities.length > 0 ? groupedActivities[groupedActivities.length - 1] : null;
            const lastTimestamp = lastEntry ? new Date(lastEntry.timestamp).getTime() : null;
            const currentTimestamp = new Date(activity.timestamp).getTime();

            if (
                lastEntry &&
                 lastEntry.equipmentModel === equipmentModel &&
                lastTimestamp &&
                currentTimestamp - lastTimestamp <= 60 * 1000
            ) {
                lastEntry.quantity += quantity;
                lastEntry.message = `${lastEntry.quantity} ${equipmentModel} ${lastEntry.quantity > 1 ? 'were' : 'was'} added to inventory.`;
                lastEntry.timestamp = activity.timestamp;
            } else {
                groupedActivities.push({
                    ...activity,
                    equipmentModel: equipmentModel,
                    quantity: quantity,
                    message: `${quantity} ${equipmentModel} ${quantity > 1 ? 'were' : 'was'} added to inventory.`
                });
            }
        } else {
            additionActivities.push(activity);
        }
    });

    // Combine all activities
    const combinedActivities = [
        ...projectActivities,
        ...borrowActivities,
        ...returnActivities,
        ...groupedActivities,
        ...additionActivities
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    console.log('✅ Final Activities:', combinedActivities);
    return combinedActivities;
}


async getAvailableEquipment(): Promise<any[]> {
  const { data, error } = await this.supabase
    .from('inhouse') // Changed from 'equipments' to 'inhouse'
    .select(`
      id,
      name,
      quantity,
      images,
      serial_number,
      qr_code,
      barcode,
      date_acquired,
      product_type
    `)
    .gt('quantity', 0)
    .is('deleted_at', null);

  if (error) {
    console.error('Error fetching available inhouse equipment:', error);
    throw error;
  }

  console.log('Fetched inhouse equipment:', data);
  return data?.map(item => ({
    ...item,
    // Map to expected structure if needed
    quantity_available: item.quantity, // Alias if your components expect this
    image_urls: item.images || [] // Transform array if needed
  })) || [];
}

// supabase.service.ts
// supabase.service.ts
async updateEquipmentStock(id: string, newStock: number): Promise<void> {
  // Remove invalid characters from UUID
  const cleanId = id.replace(/[^0-9a-fA-F-]/g, '');

  const { error } = await this.supabase
    .from('equipment')
    .update({ stock: newStock })
    .eq('id', cleanId);

  if (error) throw error;
}


  async createBorrowRequest(requestData: any): Promise<any> {
    const { data, error } = await this.supabase
      .from('borrow_requests')
      .insert([requestData])
      .select(); // Return the inserted record

    if (error) throw error;
    return data[0];
  }

  // async insertBorrowRequestEquipment(data: any[]): Promise<void> {
  //   const { error } = await this.supabase
  //     .from('borrow_request_equipment')
  //     .insert(data);

  //   if (error) {
  //     throw error;
  //   }
  // }



  async updateBorrowRequestStatus(requestId: string, status: string, notes?: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('borrow_requests')
      .update({ status, admin_notes: notes })
      .eq('id', requestId)
      .select();
    if (error) throw error;
    return data[0];
  }


  async updateEquipmentQuantity(equipmentId: string, newQuantity: number): Promise<{ success: boolean, updatedQuantity: number }> {
    try {
        // Validate UUID format
        if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(equipmentId)) {
            console.error('❌ Invalid UUID format:', equipmentId);
            return { success: false, updatedQuantity: 0 };
        }

        console.log(`🔄 Updating equipment ID: ${equipmentId} to quantity: ${newQuantity}`);

        // Update to use 'inhouse' table instead of 'equipments'
        const { data, error } = await this.supabase
            .from('inhouse')
            .update({
                quantity: newQuantity,
                status: newQuantity <= 0 ? 'Out of Stock' : 'Available'
            })
            .eq('id', equipmentId)
            .select('quantity, status')
            .single();

        if (error) {
            console.error('❌ Supabase Error:', error.message);
            return { success: false, updatedQuantity: 0 };
        }

        if (!data) {
            console.error('❌ Equipment not found:', equipmentId);
            return { success: false, updatedQuantity: 0 };
        }

        console.log('✅ Update successful. New quantity:', data.quantity);
        return { success: true, updatedQuantity: data.quantity };

    } catch (error) {
        console.error('❌ Critical Error:', error);
        return { success: false, updatedQuantity: 0 };
    }
}

async decrementEquipmentQuantity(equipmentId: string): Promise<void> {
    try {
        // Validate UUID format
        if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(equipmentId)) {
            throw new Error('Invalid UUID format');
        }

        console.log(`🔄 Decrementing quantity for equipment ID: ${equipmentId}`);

        // Using your existing function but with corrected parameter name
        const { error } = await this.supabase.rpc('decrement_inhouse_quantity', {
            equipment_id: equipmentId,  // Changed from request_id to equipment_id
            amount: 1
        });

        if (error) {
            console.error('❌ Supabase RPC Error:', error.message);
            throw error;
        }

        console.log(`✅ Successfully decremented quantity for equipment ID: ${equipmentId}`);

    } catch (error) {
        console.error('❌ Error in decrementEquipmentQuantity:', error instanceof Error ? error.message : 'Unknown error');
        throw error;
    }
}
  // async updateEquipmentQuantity(equipmentId: string, newQuantity: number): Promise<{ success: boolean, updatedQuantity: number }> {
  //   try {
  //     // Validate UUID format
  //     if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(equipmentId)) {
  //       console.error('❌ Invalid UUID format:', equipmentId);
  //       return { success: false, updatedQuantity: 0 };
  //     }

  //     console.log(`🔄 Updating equipment ID: ${equipmentId} to quantity: ${newQuantity}`);

  //     const { data, error } = await this.supabase
  //       .from('equipments')
  //       .update({ quantity: newQuantity })
  //       .eq('id', equipmentId)
  //       .select('quantity')
  //       .single();

  //     if (error) {
  //       console.error('❌ Supabase Error:', error.message);
  //       return { success: false, updatedQuantity: 0 };
  //     }

  //     if (!data) {
  //       console.error('❌ Equipment not found:', equipmentId);
  //       return { success: false, updatedQuantity: 0 };
  //     }

  //     console.log('✅ Update successful. New quantity:', data.quantity);
  //     return { success: true, updatedQuantity: data.quantity };

  //   } catch (error) {
  //     console.error('❌ Critical Error:', error);
  //     return { success: false, updatedQuantity: 0 };
  //   }
  // }

// async decrementEquipmentQuantity(equipmentId: string): Promise<void> {
//   // Option 1: Simple decrement
//   const { error } = await this.supabase
//     .from('inhouse')
//     .update({ quantity: this.supabase.rpc('decrement', { val: 1 }) })
//     .eq('id', equipmentId);

//   // Option 2: Using a stored procedure (if you have one for inhouse)
//   // const { error } = await this.supabase.rpc('decrement_inhouse_quantity', {
//   //   equipment_id: equipmentId,
//   //   amount: 1
//   // });

//   if (error) {
//     console.error('Error decrementing inhouse equipment quantity:', error);
//     throw error;
//   }

//   console.log(`✅ Successfully decremented quantity for inhouse ID: ${equipmentId}`);
// }
  // async decrementEquipmentQuantity(requestId: string): Promise<void> {
  //   const { data, error } = await this.supabase.rpc('decrement_equipment_quantity', {
  //     request_id: requestId,  // Ensure this is a valid UUID string
  //     amount: 1  // Default amount to decrement by
  //   });

  //   if (error) {
  //     console.error('Error decrementing equipment quantity:', error);
  //     throw error;
  //   }

  //   console.log(`✅ Successfully decremented quantity for request ID: ${requestId}`);
  // }


  async decrementEquipmentQuantityProject(equipmentId: string, quantity: number): Promise<void> {
    const { data, error } = await this.supabase.rpc('decrement_equipment_quantity', {
      request_id: equipmentId,
      amount: quantity

    });

    if (error) {
      console.error('Error decrementing equipment quantity:', error);
      throw error;
    }

    console.log(`✅ Successfully decremented quantity (${quantity}) for equipment ID: ${equipmentId}`);

  }

  async getPendingRequestsCount(): Promise<number> {
    const { count, error } = await this.supabase
      .from('project_material_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Pending');

    if (error) {
      console.error('❌ Error fetching pending requests count:', error);
      return 0;
    }

    return count || 0;
  }


  async getGroupedEquipmentList() {
    const { data, error } = await this.supabase
      .from('equipments')
      .select('*');

    if (error) {
      console.error('❌ Error fetching equipment:', error);
      return [];
    }

    // ✅ Group equipment by Name, Model, and Brand
    const groupedData = data.reduce((acc, item) => {
      const key = `${item.name}-${item.model}-${item.brand}`;
      if (!acc[key]) {
        acc[key] = { ...item, quantity: 1 };
      } else {
        acc[key].quantity++;
      }
      return acc;
    }, {});

    return Object.values(groupedData);
  }

  async getEquipmentMovements(equipmentId?: string) {
    console.log(`🛠 Fetching movements for ${equipmentId ? "Equipment ID: " + equipmentId : "ALL Equipment"}`);

    // 🔄 Fetch all movements (both project usage & borrowed), including "returned" logs
    let query = this.supabase
      .from('equipment_movements')
      .select(`
        id,
        movement_date,
        project_id,
        borrow_request_id,
        movement_type,
        inhouse_equipment_id
      `)
      .order('movement_date', { ascending: false });

    if (equipmentId) {
    query = query.eq('inhouse_equipment_id', equipmentId);
    }


    const { data: movementsData, error: movementsError } = await query;

    if (movementsError) {
        console.error("❌ Error fetching equipment movements:", movementsError);
        return [];
    }

    if (!movementsData || movementsData.length === 0) {
        console.warn(`⚠ No movements found for ${equipmentId ? "Equipment ID: " + equipmentId : "ALL Equipment"}`);
        return [];
    }

    console.log("📌 Raw Equipment Movements Data:", movementsData);

    // 🔄 Fetch related data in bulk (including deleted project references)
    const projectIds = movementsData.map(m => m.project_id).filter(id => id !== null);
    const borrowRequestIds = movementsData.map(m => m.borrow_request_id).filter(id => id !== null);

    // ✅ Fetch project details (even for deleted projects, use a LEFT JOIN-like approach)
    const { data: projectData, error: projectError } = projectIds.length
      ? await this.supabase.from('projects').select('id, name').in('id', projectIds)
      : { data: [], error: null };
    if (projectError) console.error("❌ Error fetching project details:", projectError);

    // ✅ Fetch borrow request details
    const { data: borrowRequestData, error: borrowError } = borrowRequestIds.length
      ? await this.supabase.from('borrow_requests').select('id, borrower_name').in('id', borrowRequestIds)
      : { data: [], error: null };
    if (borrowError) console.error("❌ Error fetching borrow requests:", borrowError);

    // ✅ Fetch borrowed quantity
    const { data: borrowQuantities, error: borrowQuantityError } = borrowRequestIds.length
      ? await this.supabase
          .from('borrow_request_equipment')
          .select('borrow_request_id, inhouse_equipment_id, quantity')
          .in('borrow_request_id', borrowRequestIds)
      : { data: [], error: null };
    if (borrowQuantityError) console.error("❌ Error fetching borrowed quantities:", borrowQuantityError);

    // ✅ Fetch project materials data (even for deleted projects)
    const { data: projectMaterialsData, error: projectMaterialError } = projectIds.length
      ? await this.supabase
          .from('project_materials')
          .select('project_id, equipment_id, quantity')
          .in('project_id', projectIds)
      : { data: [], error: null };
    if (projectMaterialError) console.error("❌ Error fetching project materials:", projectMaterialError);

    // ✅ Process movements
    const movements = movementsData.map(movement => {
        // Find project name or show "Deleted Project" if not found
        const project = projectData ? projectData.find(p => p.id === movement.project_id) : null;
        const projectName = project ? project.name : (movement.project_id ? "Deleted Project" : "N/A");

        // Find borrower details
        const borrowRequest = borrowRequestData ? borrowRequestData.find(b => b.id === movement.borrow_request_id) : null;
        const borrowerName = borrowRequest ? borrowRequest.borrower_name : "N/A";

        // Find used quantity (if applicable)
        const usedQuantity = projectMaterialsData?.find(pm => pm.project_id === movement.project_id)?.quantity || 0;
        const borrowedEntry = borrowQuantities?.find(bq => bq.borrow_request_id === movement.borrow_request_id);
        const borrowedQuantity = borrowedEntry ? borrowedEntry.quantity : 0;

        // 🔹 Determine movement status
        let movementStatus = "Available";
        if (movement.movement_type === "in use") movementStatus = "In Use";
        else if (movement.movement_type === "borrowed") movementStatus = "Borrowed";
        else if (movement.movement_type === "returned") movementStatus = "Returned";

        return {
            equipment_id: movement.inhouse_equipment_id,
            movement_date: movement.movement_date ? new Date(movement.movement_date).toISOString() : null,
            movement_type: movement.movement_type,
            status: movementStatus, // ✅ Status is now always preserved
            project_name: projectName, // ✅ Show "Deleted Project" if project is missing
            borrower_name: borrowerName,
            used_quantity: usedQuantity,
            borrowed_quantity: borrowedQuantity,
        };
    });

    console.log("✅ Final Equipment Movements Data:", movements);
    return movements;
}




  async getEquipmentByNameModelBrand(name: string, model: string, brand: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('equipments')
      .select()
      .eq('name', name)
      .eq('model', model)
      .eq('brand', brand);

    if (error) {
      console.error('Error fetching equipment:', error);
      return null;
    }

    return data[0] || null;
  }

  // In supabase.service.ts
async getProjectMaterialsByEquipment(equipmentId: string) {
  const { data, error } = await this.supabase
    .from('project_materials')
    .select('quantity, equipment_id')
    .eq('equipment_id', equipmentId);

  if (error) {
    console.error('Error fetching project materials:', error);
  }
  return { data, error };
}

async getUserProfile(userId: string): Promise<any> {
  const { data, error } = await this.supabase
    .from('users')  // Access the 'users' table
    .select('first_name, last_name, email, usertype, profile_image')  // ✅ Added 'profile_image'
    .eq('id', userId)  // Match the current user's ID
    .single();  // Return a single record

  if (error) {
    console.error('❌ Error fetching user profile:', error);
    return null;
  }

  console.log('✅ Fetched User Profile:', data);
  return data;
}


// Supplier CRUD functionalities


async getBorrowedEquipmentCount(): Promise<number> {
  // ✅ Step 1: Get active borrow request IDs
  const { data: activeRequests, error: requestError } = await this.supabase
    .from('borrow_requests')
    .select('id')
    .eq('status', 'borrowed'); // ✅ Only fetch active borrow requests

  if (requestError) {
    console.error('❌ Error fetching active borrow requests:', requestError);
    return 0;
  }

  if (!activeRequests || activeRequests.length === 0) {
    return 0; // ✅ If no active requests, return 0
  }

  const activeRequestIds = activeRequests.map(request => request.id);

  // ✅ Step 2: Get borrowed equipment linked to active borrow requests
  const { data, error } = await this.supabase
    .from('borrow_request_equipment') // ✅ Equipment table
    .select('quantity')
    .in('borrow_request_id', activeRequestIds); // ✅ Filter using active request IDs

  if (error) {
    console.error('❌ Error fetching borrowed equipment count:', error);
    return 0;
  }

  // ✅ Sum all borrowed quantities
  return data.reduce((total, item) => total + item.quantity, 0);
}




async getUsedInProjectsCount(): Promise<number> {
  const { data, error } = await this.supabase
    .from('project_materials') // Used in projects table
    .select('quantity');

  if (error) {
    console.error('❌ Error fetching used in projects count:', error);
    return 0;
  }

  // Sum the total quantity used in projects
  return data.reduce((total, item) => total + item.quantity, 0);
}


// async insertBorrowRequestEquipment(data: any[]): Promise<void> {
//   const { error } = await this.supabase
//     .from('borrow_request_equipment')
//     .insert(data);
//   if (error) {
//     console.error('Error inserting borrow request equipment:', error);
//     throw error;
//   }
// }
async insertBorrowRequestEquipment(data: {
  borrow_request_id: string,
  inhouse_equipment_id: string,
  quantity: number
}[]): Promise<void> {
  const { error } = await this.supabase
    .from('borrow_request_equipment')
    .insert(data);

  if (error) {
    console.error('Error inserting borrow request equipment:', {
      error,
      attemptedData: data
    });
    throw error;
  }
}



increment(value: number) {
  return { increment: value };
}

// Notification Function
async addNotification(notification: any) {
  // Convert to Philippines Time (UTC+8)
  const now = new Date();
  now.setHours(now.getHours() + 8); // Convert to UTC+8
  notification.created_at = now.toISOString(); // Store it properly

  try {
    // ✅ Final check to prevent duplicate notifications
    const exists = await this.checkExistingNotification(notification.message, new Date(notification.created_at));

    if (exists) {
      console.log("⏳ Duplicate notification detected. Skipping insert.");
      return;
    }

    // ✅ If not, proceed with inserting the new notification
    const { data, error } = await this.supabase.from('notifications').insert([notification]);

    if (error) {
      throw error; // Throw any unexpected errors
    }

    console.log('✅ Notification added:', data);
  } catch (err) {
    console.error('❌ Error adding notification:', err);
  }
}

async getNotifications() {
  const { data, error } = await this.supabase.from('notifications').select('*').order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching notifications:', error);
    return [];
  }
  return data;
}

async getUnreadNotificationCount(): Promise<number> {
  const { count, error } = await this.supabase
    .from('notifications')
    .select('id', { count: 'exact' })
    .eq('status', 'unread');

  if (error) {
    console.error('Error fetching unread notification count:', error);
    return 0;
  }

  console.log("📌 Unread Notification Count:", count);
  return count || 0;
}

async markNotificationsAsRead(): Promise<void> {
  const { error } = await this.supabase
    .from('notifications')
    .update({ status: 'read' })
    .eq('status', 'unread');

  if (error) {
    console.error('Error marking notifications as read:', error);
  } else {
    console.log("✅ Notifications marked as read");
  }
}

async checkExistingNotification(equipmentName: string, notificationDate: Date): Promise<boolean> {
  // 🔹 Get start & end of the current week (Monday to Sunday)
  const startOfWeek = new Date(notificationDate);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Move to Monday
  startOfWeek.setHours(0, 0, 0, 0); // Reset time to midnight

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6); // Move to Sunday
  endOfWeek.setHours(23, 59, 59, 999); // End of day

  console.log(`🔎 Checking for existing notifications from ${startOfWeek.toISOString()} to ${endOfWeek.toISOString()}`);

  const { data, error } = await this.supabase
    .from('notifications')
    .select('id')
    .eq('status', 'unread')
    .ilike('message', `%Equipment "${equipmentName}"%`) // ✅ Match any notification for this equipment
    .gte('created_at', startOfWeek.toISOString()) // Start of the week
    .lte('created_at', endOfWeek.toISOString()); // End of the week

  if (error) {
    console.error('❌ Error checking notifications:', error);
    return false;
  }

  console.log(`🔍 Found ${data.length} existing notifications this week.`);
  return data.length > 0; // ✅ Returns true if a notification exists
}

async checkScheduledNotification(equipmentName: string, notificationDate: Date): Promise<boolean> {
  const { data, error } = await this.supabase
    .from('notifications')
    .select('id')
    .eq('status', 'pending') // ✅ Check only "pending" notifications
    .eq('scheduled_for', notificationDate.toISOString()); // ✅ Check exact future date

  if (error) {
    console.error('❌ Error checking scheduled notifications:', error);
    return false;
  }

  return data.length > 0; // ✅ If data exists, a notification is already scheduled
}

async sendScheduledNotifications() {
  const today = new Date();
  today.setHours(today.getHours() + 8); // ✅ Convert system time to UTC+8
  today.setHours(0, 0, 0, 0); // ✅ Ensure time is set to midnight

  const { data, error } = await this.supabase
    .from('notifications')
    .select('*')
    .eq('status', 'pending') // ✅ Only fetch pending notifications
    .eq('scheduled_for', today.toISOString()); // ✅ Compare with Philippine Time (UTC+8)

  if (error) {
    console.error('❌ Error fetching scheduled notifications:', error);
    return;
  }

  for (const notification of data) {
    // ✅ Mark the notification as "sent"
    await this.supabase.from('notifications').update({ status: 'sent' }).match({ id: notification.id });

    // ✅ Send the notification (you can customize this)
    console.log("📢 Sending Notification at Philippine Time:", notification.message);
  }
}

async scheduleNotification(notification: any): Promise<void> {
  try {
    const scheduledDate = new Date(notification.scheduled_for);
    scheduledDate.setHours(scheduledDate.getHours() + 8); // ✅ Adjust to UTC+8

    notification.scheduled_for = scheduledDate.toISOString(); // ✅ Store the correct timestamp
    notification.status = 'unread'; // Ensure status is 'unread'

    const { data, error } = await this.supabase
      .from('notifications')
      .insert([notification]);

    if (error) {
      throw error;
    }

    console.log("✅ Notification scheduled at Philippine Time (UTC+8):", notification.scheduled_for);
    console.log("🔔 Notification status:", notification.status);
  } catch (err) {
    console.error("❌ Error scheduling notification:", err);
  }
}

async markSingleNotificationAsRead(notificationId: string): Promise<void> {
  try {
    const { error } = await this.supabase
      .from('notifications')
      .update({ isRead: true })
      .eq('id', notificationId);

    if (error) throw error;

    console.log(`✅ Notification ${notificationId} marked as read.`);

  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
  }
}

async getEquipmentIdByName(equipmentName: string): Promise<string | null> {
  try {
    console.log(`🔍 Searching for equipment name: ${equipmentName}`);

    const { data, error } = await this.supabase
      .from('equipments') // ✅ Correct table name
      .select('id, name') // ✅ Fetch 'id' & 'name' for debugging
      .ilike('name', `%${equipmentName}%`); // ✅ Case-insensitive search

    if (error) {
      console.error('❌ Supabase Query Error:', error);
      return null;
    }

    console.log(`📊 Query Results:`, data); // ✅ Debugging log

    if (!data || data.length === 0) {
      console.warn(`⚠ No matching equipment found for: "${equipmentName}"`);
      return null;
    }

    return data[0].id; // ✅ Return the first matched ID
  } catch (err) {
    console.error('❌ Error in getEquipmentIdByName:', err);
    return null;
  }
}
// End of Notification Function

async insertEquipmentMovement(movementData: EquipmentMovement): Promise<void> {
  try {
    const { error } = await this.supabase
      .from('equipment_movements')
      .insert([{
        inhouse_equipment_id: movementData.inhouse_equipment_id,  // Updated field
        movement_type: movementData.movement_type,
        borrow_request_id: movementData.borrow_request_id,
        project_id: movementData.project_id,
        movement_date: movementData.movement_date,
        employee_id: movementData.employee_id,
        status: movementData.status
      }]);

    if (error) {
      throw error;
    }

    console.log('✅ Equipment movement recorded:', movementData);
  } catch (error) {
    console.error('❌ Error inserting equipment movement:', error);
    throw error; // Re-throw to allow calling code to handle
  }
}

async incrementEquipmentQuantity(equipmentId: string, quantity: number = 1): Promise<void> {
  try {
    // First check if the equipment exists in 'inhouse' table
    const { data: inhouseData, error: inhouseError } = await this.supabase
      .from('inhouse')
      .select('quantity')
      .eq('id', equipmentId)
      .single();

    if (!inhouseError && inhouseData) {
      // Update inhouse table
      const updatedQuantity = inhouseData.quantity + quantity;
      const { error: updateError } = await this.supabase
        .from('inhouse')
        .update({ quantity: updatedQuantity })
        .eq('id', equipmentId);

      if (updateError) throw updateError;
      console.log(`✅ Inhouse equipment quantity updated. New quantity: ${updatedQuantity}`);
      return;
    }

    // Fallback to check equipments table if not found in inhouse
    console.log('⚠ Equipment not found in inhouse table, checking equipments table...');
    const { data: equipmentsData, error: equipmentsError } = await this.supabase
      .from('equipments')
      .select('quantity')
      .eq('id', equipmentId)
      .single();

    if (equipmentsError || !equipmentsData) {
      throw new Error('Equipment not found in either inhouse or equipments table');
    }

    const updatedQuantity = equipmentsData.quantity + quantity;
    const { error: updateError } = await this.supabase
      .from('equipments')
      .update({ quantity: updatedQuantity })
      .eq('id', equipmentId);

    if (updateError) throw updateError;
    console.log(`✅ Equipment quantity updated in fallback table. New quantity: ${updatedQuantity}`);

  } catch (error) {
    console.error('❌ Error incrementing equipment quantity:', error);
    throw error;
  }
}


// async incrementEquipmentQuantity(equipmentId: string, quantity: number): Promise<void> {
//   try {
//     const { data, error } = await this.supabase
//       .from('equipments')
//       .select('quantity')
//       .eq('id', equipmentId)
//       .single();

//     if (error || !data) {
//       throw new Error('Equipment not found or failed to fetch.');
//     }

//     const updatedQuantity = data.quantity + quantity;

//     const { error: updateError } = await this.supabase
//       .from('equipments')
//       .update({ quantity: updatedQuantity })
//       .eq('id', equipmentId);

//     if (updateError) {
//       throw updateError;
//     }

//     console.log(`✅ Equipment quantity updated. New quantity: ${updatedQuantity}`);
//   } catch (error) {
//     console.error('❌ Error incrementing equipment quantity:', error);
//   }
// }

async getProjectDetails(projectId: string | null) {
  try {
    if (!projectId) {
      console.warn('⚠ No project ID provided. Skipping fetch.');
      return null;
    }

    const { data, error } = await this.supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Error fetching project details:', error);
    return null;
  }
}

async getAssignedEquipment(): Promise<any[]> {
  try {
    const { data, error } = await this.supabase
      .from('borrow_request_equipment')
      .select('id, quantity, equipment_id, inhouse_id') // Include both possible column names
      .neq('status', 'returned');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching assigned equipment:', error);
    return [];
  }
}

async updateUserProfile(
  userId: string,
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null,
  profileImage?: string | null
) {
  const updates: { [key: string]: any } = {};

  if (firstName !== undefined && firstName !== null) {
    updates['first_name'] = firstName;
  }
  if (lastName !== undefined && lastName !== null) {
    updates['last_name'] = lastName;
  }
  if (email !== undefined && email !== null) {
    updates['email'] = email;
  }
  if (profileImage !== undefined && profileImage !== null) {
    updates['profile_image'] = profileImage; // Ensure this matches the column name in the database
  }

  console.log("Updating user profile with:", updates); // Log the updates

  const { data, error } = await this.supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select(); // Add .select() to return the updated record

  if (error) {
    console.error("Error updating profile:", error);
    throw error;
  }

  console.log("Updated user profile:", data); // Log the updated data
  return { message: "Profile updated successfully!" };
}


async getEquipmentByName(name: string) {
  console.log("Fetching equipment from Supabase with name:", name);

  const { data, error } = await this.supabase
      .from('equipments')
      .select('*')
      .ilike('name', name); // Fetch all records matching the name

  if (error) {
      console.error("Error fetching equipment by name:", error);
      return [];
  }

  console.log("Fetched Equipment Data:", data);

  // Duplicate each item based on its `current_quantity`
  const duplicatedItems = data.flatMap(item =>
      Array(item.current_quantity).fill(item)
  );

  return duplicatedItems;
}



async borrowEquipment(equipmentId: string, userId: string, quantity: number) {
  console.log(`Borrowing Equipment: ${equipmentId}, User: ${userId}, Quantity: ${quantity}`);

  if (!userId) {
      console.error("❌ No authenticated user found.");
      return { error: "User not authenticated" };
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
      console.error("❌ Invalid UUID format for user_id:", userId);
      return { error: "Invalid user_id format. Expected a valid UUID." };
  }

  // Insert into borrow_requests table
  const { error: insertError } = await this.supabase
      .from('borrow_requests')
      .insert([{
          user_id: userId,
          borrow_date: new Date().toISOString().split('T')[0],
          return_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Return in 7 days
          status: "pending",
          purpose: "Borrowing equipment",
          borrower_name: "John Doe",
          borrower_department: "IT Department",
      }]);

  if (insertError) {
      console.error("❌ Error inserting into borrow_requests:", insertError);
      return { error: insertError };
  }

  console.log("✅ Equipment borrowed successfully");
  return { success: true };
}

async getSupplierContactPerson(): Promise<string | null> {
  try {
    const { data, error } = await this.supabase
      .from('suppliers') // Replace with the correct table name
      .select('contact_person')
      .order('created_at', { ascending: false }) // Modify if needed
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching supplier contact person:', error);
      return null;
    }

    return data?.contact_person || null;
  } catch (err) {
    console.error('Unexpected error fetching supplier contact person:', err);
    return null;
  }
}

// end of edit user
async updateEquipmentStatus(equipmentId: string, status: string): Promise<void> {
  try {
    const { error } = await this.supabase
      .from('inhouse')  // Changed from inhouse_equipment to inhouse
      .update({ status })
      .eq('id', equipmentId);

    if (error) {
      console.error('Full error details:', error);
      throw new Error(`Failed to update status: ${error.message}`);
    }
  } catch (error) {
    console.error('Detailed update error:', error);
    throw error;
  }
}

async getBorrowedEquipment() {
  const { data, error } = await this.supabase
    .from('equipment_movements')
    .select('*')
    .eq('status', 'borrowed');

  if (error) {
    console.error('Error fetching borrowed equipment:', error);
    return [];
  }
  return data || [];
}
// async getBorrowedEquipment() {
//   const { data, error } = await this.supabase
//     .from('equipment_movements')
//     .select(`
//       inhouse_equipment_id,
//       inhouse_equipment:inhouse_equipment_id (id, name, status)
//     `)
//     .eq('status', 'borrowed');

//   if (error) {
//     console.error('Error fetching borrowed equipment:', error);
//     return [];
//   }

//   return data || [];
// }
// async getBorrowedEquipment() {
//   const { data, error } = await this.supabase
//     .from('equipment_movements')
//     .select('inhouse_equipment_id') // ✅ Correct column name
//     .eq('status', 'borrowed');      // Only get currently borrowed items

//   if (error) {
//     console.error('❌ Error fetching borrowed equipment:', error);
//     return [];
//   }

//   return data || [];
// }

// async getBorrowedEquipment() {
//   const { data, error } = await this.supabase
//     .from('equipment_movements')
//     .select('equipment_id')
//     .eq('status', 'borrowed'); // Only get currently borrowed items

//   if (error) {
//     console.error('❌ Error fetching borrowed equipment:', error);
//     return [];
//   }

//   return data || [];
// }

// Fetch Suppliers for Equipment based on Equipment Name
async getSuppliersForEquipmentByName(equipmentName: string) {
  const { data, error } = await this.supabase
    .from('equipment_suppliers') // Your table for suppliers
    .select('supplier_name, supplier_cost, srp, equipment_name')
    .eq('equipment_name', equipmentName);

  return { data, error };
}

async getSuppliersForEquipment(equipmentId: string): Promise<{id: string, name: string}[]> {
  // Alternative approach using existing cost history data
  const { data, error } = await this.supabase
    .from('equipment_cost_history')
    .select('supplier')
    .eq('equipment_id', equipmentId);

  if (error) {
    console.error('Error fetching suppliers:', error);
    return [];
  }

  // Extract unique suppliers from cost history
  const uniqueSuppliers = [...new Set(data.filter(item => item.supplier).map(item => item.supplier))];

  return uniqueSuppliers.map(supplier => ({
    id: supplier, // Using supplier name as ID since we don't have actual IDs
    name: supplier
  }));
}

// supplier service
async validateToken(token: string): Promise<{ valid: boolean; supplier: { id: number; name: string } | null }> {
  const { data, error } = await this.supabase
    .from('suppliers')
    .select('id, name')
    .eq('access_token', token)
    .single();

  if (error || !data) {
    return { valid: false, supplier: null };
  }

  return { valid: true, supplier: data };
}

async getSupplierEquipments(supplierId: number): Promise<any[]> {
  const { data, error } = await this.supabase
    .from('equipments')
    .select('*')
    .eq('supplier_id', supplierId); // or 'supplier' if you're storing the name

  if (error) {
    console.error('Error fetching supplier equipments:', error);
    return [];
  }

  return data || [];
}

async getSupplierName(supplierId: number): Promise<string | null> {
  const { data, error } = await this.supabase
    .from('suppliers')
    .select('name')
    .eq('id', supplierId)
    .single();

  return data?.name || null;
}

//api integration//

// In supabase.service.ts
// Add to your SupabaseService

async checkPartCompatibility(partIds: string[]): Promise<{compatible: boolean, issues: string[]}> {
  // Get metadata for all selected parts
  const { data, error } = await this.supabase
    .from('pc_part_metadata')
    .select('*')
    .in('equipment_id', partIds);

  if (error) throw error;

  const issues: string[] = [];

  // Check CPU-Motherboard compatibility
  const cpu = data.find(p => p.category === 'CPU');
  const motherboard = data.find(p => p.category === 'Motherboard');

  if (cpu && motherboard) {
    if (!motherboard.supported_sockets.includes(cpu.cpu_socket)) {
      issues.push(`CPU socket (${cpu.cpu_socket}) not supported by motherboard`);
    }
  }

  // Check RAM-Motherboard compatibility
  const rams = data.filter(p => p.category === 'RAM');
  const mobo = data.find(p => p.category === 'Motherboard');

  if (rams.length && mobo) {
    rams.forEach(ram => {
      if (ram.ram_type !== mobo.ram_type) {
        issues.push(`RAM type (${ram.ram_type}) not supported by motherboard`);
      }
    });

    if (rams.length > mobo.ram_slots) {
      issues.push(`Not enough RAM slots on motherboard (needs ${rams.length}, has ${mobo.ram_slots})`);
    }
  }

  // Add more compatibility checks as needed

  return {
    compatible: issues.length === 0,
    issues
  };
}

async getCompatibleParts(partId: string, category: string) {
  // Get the selected part's metadata
  const { data: partData, error: partError } = await this.supabase
    .from('pc_part_metadata')
    .select('*')
    .eq('equipment_id', partId)
    .single();

  if (partError) throw partError;

  let compatiblePartsQuery = this.supabase
    .from('equipment')
    .select('*');

  // Add compatibility filters based on the selected part
  switch (category) {
    case 'CPU':
      compatiblePartsQuery = compatiblePartsQuery
        .eq('name', 'Motherboard')
        .contains('supported_sockets', [partData.cpu_socket]);
      break;

    case 'Motherboard':
      compatiblePartsQuery = compatiblePartsQuery
        .or(`name.eq.CPU,name.eq.RAM,name.eq.GPU`)
        .or(`cpu_socket.eq.${partData.supported_sockets[0]},ram_type.eq.${partData.ram_type}`);
      break;

    case 'RAM':
      compatiblePartsQuery = compatiblePartsQuery
        .eq('name', 'Motherboard')
        .eq('ram_type', partData.ram_type);
      break;

    // Add more cases for other categories
    default:
      return [];
  }

  const { data, error } = await compatiblePartsQuery;
  if (error) throw error;

  return data;
}

async semanticSearch(query: string, threshold = 0.3): Promise<any[]> {
  try {
    if (!this.model) {
      await this.loadModel();
    }

    console.log('🔍 Searching for:', query);

    // Convert search query to embedding
    const queryEmbedding = await this.model.embed([query.toLowerCase()]);
    const queryVector = await queryEmbedding.array();

    // Search for similar vectors
    const { data: matches, error } = await this.supabase.rpc(
      'match_equipment_embeddings',
      {
        query_embedding: queryVector[0],
        similarity_threshold: threshold,
        match_count: 20
      }
    );

    console.log('Vector matches:', matches);

    if (error) throw error;
    if (!matches || matches.length === 0) return [];

    // Get equipment IDs from matches
    interface SemanticMatch {
      id: string;
      similarity: number;
    }

    const equipmentIds: string[] = (matches as SemanticMatch[]).map((match: SemanticMatch) => match.id);

    // Fetch from equipments table
    const { data: equipment, error: equipmentError } = await this.supabase
      .from('equipments')  // Changed from 'inhouse' to 'equipments'
      .select('*')
      .in('id', equipmentIds);

    if (equipmentError) throw equipmentError;
    if (!equipment) return [];

    // Add similarity scores and sort
    return equipment
      .map(item => {
        const match: SemanticMatch | undefined = (matches as SemanticMatch[]).find((m: SemanticMatch) => m.id === item.id);
        return {
          ...item,
          similarity: match ? match.similarity : 0
        };
      })
      .sort((a, b) => b.similarity - a.similarity);

  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
}

  async loadModel() {
    if (this.model || this.isModelLoading) return;

    this.isModelLoading = true;
    try {
      await tf.ready();
      this.model = await use.load();
      console.log('✅ TensorFlow model loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load TensorFlow model:', error);
    } finally {
      this.isModelLoading = false;
    }
  }

  // Add this method to your SupabaseService class
  async createUserSupplierRelationships(supplierId: number, userIds: string[]): Promise<boolean> {
    try {
      console.log(`🔄 Creating user-supplier relationships for supplier ${supplierId} with users:`, userIds);

      // Create relationship records
      const relationships = userIds.map(userId => ({
        supplier_id: supplierId,
        user_id: userId,
        created_at: new Date().toISOString()
      }));

      const { data, error } = await this.supabase
        .from('user_supplier_relationships')
        .insert(relationships)
        .select();

      if (error) {
        console.error('❌ Error creating user-supplier relationships:', error);
        throw error;
      }

      console.log(`✅ Successfully created ${relationships.length} user-supplier relationships`);
      return true;

    } catch (error) {
      console.error('❌ Failed to create user-supplier relationships:', error);
      throw error;
    }
  }

  async getUserSupplierRelationships(supplierId?: number, userId?: string): Promise<any[]> {
    try {
      let query = this.supabase
        .from('user_supplier_relationships')
        .select(`
          id,
          supplier_id,
          user_id,
          created_at,
          suppliers!inner(supplier_name, contact_person),
          users!inner(first_name, last_name, email, usertype)
        `);

      if (supplierId) {
        query = query.eq('supplier_id', supplierId);
      }

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error fetching user-supplier relationships:', error);
        throw error;
      }

      return data || [];

    } catch (error) {
      console.error('❌ Failed to fetch user-supplier relationships:', error);
      return [];
    }
  }

  // Add these methods to your SupabaseService class
  async getAllUsers() {
    const { data, error } = await this.supabase
      .from('users')
      .select('id, first_name, last_name, email, usertype')
      .order('first_name', { ascending: true });

    return { data, error };
  }

  async getUsers() {
    const { data, error } = await this.supabase
      .from('users')
      .select('id, first_name, last_name, email, usertype')
      .eq('usertype', 'user');

    return { data, error };
  }

  async updateUser(userId: string, firstName: string, lastName: string, email: string) {
    const { error } = await this.supabase
      .from('users')
      .update({ first_name: firstName, last_name: lastName, email })
      .eq('id', userId);

    return { error };
  }

  async signUp(email: string, password: string) {
    return await this.supabase.auth.signUp({ email, password });
  }

  async insertProfile(userId: string, firstName: string, lastName: string, email: string) {
    const { error } = await this.supabase
      .from('users')
      .insert([{ id: userId, first_name: firstName, last_name: lastName, email }]);

    return { error };
  }

  async deleteUser(userId: string) {
    const { error } = await this.supabase
      .from('users')
      .delete()
      .eq('id', userId);

    return { error };
  }

  async insertSupplier(
    supplierName: string,
    contactPerson: string,
    phone: string,
    email: string,
    address: string,
    groupChatLink: string,
    facebook: string,
    viber: string,
    telegram: string,
    instagram: string,
    userId?: string
  ) {
    const { data, error } = await this.supabase
      .from('suppliers')
      .insert([{
        supplier_name: supplierName,
        contact_person: contactPerson,
        phone,
        email,
        address,
        group_chat_link: groupChatLink,
        facebook,
        viber,
        telegram,
        instagram,
        user_id: userId
      }])
      .select('id')
      .single();

    return { data, error };
  }

  async insertSupplierUser(userId: string, firstName: string, lastName: string, email: string, usertype: string) {
    const { error } = await this.supabase
      .from('users')
      .insert([{
        id: userId,
        first_name: firstName,
        last_name: lastName,
        email,
        usertype
      }]);

    return { error };
  }

  async insertSupplierToken(supplierId: number, token: string, expiresAt: string) {
    const { error } = await this.supabase
      .from('supplier_access_tokens')
      .insert([{
        supplier_id: supplierId,
        token,
        expires_at: expiresAt,
        is_used: false
      }]);

    return { error };
  }

async getImageUrl(filename: string): Promise<string> {
  try {
    const { data, error } = await this.supabase
      .storage
      .from('equipment-images')
      .createSignedUrl(filename, 3600); // 1 hour expiry
    
    if (error) throw error;
    return data.signedUrl;
  } catch (error) {
    console.error('Error getting image URL:', error);
    return 'assets/default-image.png';
  }
}
}
