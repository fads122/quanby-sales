import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseAuthService } from '../services/supabase-auth.service';

const SUPABASE_URL = 'https://xvcgubrtandfivlqcmww.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2Y2d1YnJ0YW5kZml2bHFjbXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkxNDk4NjYsImV4cCI6MjA1NDcyNTg2Nn0.yjd-SXfzJe6XmuNpI2HsZcI9EsS9AxBXI-qukzgcZig';

@Injectable({
  providedIn: 'root',
})
export class SupabaseSupplierService {
  private supabase: SupabaseClient;

  constructor(private authService: SupabaseAuthService) {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  async addSupplier(supplierData: any): Promise<any> {
    const user = await this.authService.getUser();
    if (!user) {
        throw new Error('User is not authenticated');
    }

    const { data, error } = await this.supabase
        .from('suppliers')
        .insert([{ ...supplierData, user_id: user.id }])
        .select();

    if (error) {
        console.error('Error adding supplier:', error);
        throw error;
    }
    return data[0];
}



  // Fetch all suppliers
  async getSuppliers(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('suppliers')
      .select('id, supplier_name, contact_person, phone, email, address'); // Select specific fields

    if (error) {
      console.error('Error fetching suppliers:', error);
      throw error;
    }
    return data || [];
  }

  // Delete a supplier by ID
  async deleteSupplier(id: number): Promise<void> {
    const user = await this.authService.getUser();
    if (!user) {
        throw new Error('User is not authenticated');
    }

    try {
        console.log(`🔍 Attempting to delete supplier with ID: ${id}`);

        // Step 1: Delete all supplier items associated with the supplier
        const { error: deleteItemsError } = await this.supabase
            .from('supplier_items')
            .delete()
            .eq('supplier_id', id)
            .eq('user_id', user.id); // Ensure items belong to the user

        if (deleteItemsError) {
            console.error('❌ Error deleting supplier items:', deleteItemsError);
            throw deleteItemsError;
        }

        console.log(`✅ Deleted all items for supplier ID ${id}`);


        console.log(`✅ Deleted supplier ID ${id}`);
    } catch (error) {
        console.error('❌ Error during supplier deletion:', error);
        throw error;
    }
}

  // Expose the Supabase client's `from` method
  public from(tableName: string) {
    return this.supabase.from(tableName);
  }

  // Fetch a single supplier by ID
  async getSupplierById(id: number): Promise<any> {
    const { data, error } = await this.supabase
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      console.error('Error fetching supplier:', error);
      throw error;
    }
    return data;
  }


    // Update supplier details in the database
    async updateSupplier(id: number, supplierData: any): Promise<any> {
      const user = await this.authService.getUser();
      if (!user) {
        throw new Error('User is not authenticated');
      }
      const { data, error } = await this.supabase
        .from('suppliers')
        .update(supplierData)
        .eq('id', id) // Ensure the update targets the correct supplier
        .select(); // Optionally return the updated data
      if (error) {
        console.error('Error updating supplier:', error);
        throw error;
      }
      return data;
    }



async getCurrentUser(): Promise<any> {
  const { data, error } = await this.supabase.auth.getUser();
  if (error) {
    console.error('Error getting current user:', error);
    throw error;
  }
  return data.user ?? null;
}



}
