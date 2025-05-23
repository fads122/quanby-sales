import { Injectable } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xvcgubrtandfivlqcmww.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2Y2d1YnJ0YW5kZml2bHFjbXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkxNDk4NjYsImV4cCI6MjA1NDcyNTg2Nn0.yjd-SXfzJe6XmuNpI2HsZcI9EsS9AxBXI-qukzgcZig'; // Truncated for safety

@Injectable({
  providedIn: 'root'
})
export class SupplierService {
  private supabase: SupabaseClient;

  constructor() {
      this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  async getSupplierName(userId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('suppliers')
      .select('supplier_name')
      .eq('user_id', userId)  // ✅ use user_id, NOT id
      .single();

    if (error) {
      console.error('Error fetching supplier name:', error);
      return null;
    }

    return data?.supplier_name || null;
  }


  async getSupplierEquipments(userId: string): Promise<any[]> {
    const supplierName = await this.getSupplierName(userId);
    if (!supplierName) return [];

    const { data, error } = await this.supabase
      .from('equipments')
      .select('*')
      .eq('supplier', supplierName); // ✅ match by name

    if (error) {
      console.error('Error fetching supplier equipments:', error);
      return [];
    }

    return data || [];
  }



  async updateEquipment(equipmentId: string, updates: any): Promise<void> {
    const { error } = await this.supabase
      .from('equipments')
      .update(updates)
      .eq('id', equipmentId);

    if (error) throw error;
  }

  async addEquipment(equipment: any): Promise<void> {
    const { error } = await this.supabase
      .from('equipments')
      .insert([equipment]);

    if (error) throw error;
  }

  async getSupplierProfile(supplierId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('suppliers')
      .select('*')
      .eq('user_id', supplierId)
      .single();

    if (error) {
      console.error('Error fetching supplier profile:', error);
      return null;
    }
    return data;
  }


  async createSupplierProfile(supplierId: string, profileData: any): Promise<void> {
    // Since we're using the suppliers table, we'll update rather than create
    // This assumes the record already exists (created during user registration)
    const { error } = await this.supabase
      .from('suppliers')
      .update(profileData)
      .eq('user_id', supplierId);

    if (error) {
      console.error('Error creating supplier profile:', error);
      throw error;
    }
  }

  async upsertSupplierProfile(supplierId: string, profileData: any): Promise<void> {
    // First try to update existing profile
    const { error: updateError } = await this.supabase
      .from('suppliers')
      .update(profileData)
      .eq('user_id', supplierId);

    if (updateError) {
      // If update fails (maybe record doesn't exist), try to insert
      const { error: insertError } = await this.supabase
        .from('suppliers')
        .insert([{ ...profileData, user_id: supplierId }]);

      if (insertError) {
        console.error('Error creating supplier profile:', insertError);
        throw insertError;
      }
    }
  }

  // Rest of your existing methods...
  async validateToken(token: string): Promise<{ valid: boolean; supplier: { id: number; name: string } | null }> {
    const { data, error } = await this.supabase
      .from('supplier_access_tokens')
      .select('*, suppliers (id, name)')
      .eq('token', token)
      .gte('expires_at', new Date().toISOString())
      .eq('is_used', false)
      .single();

    if (error || !data || !data.suppliers) {
      return { valid: false, supplier: null };
    }

    await this.supabase
      .from('supplier_access_tokens')
      .update({ is_used: true })
      .eq('token', token);

    return {
      valid: true,
      supplier: data.suppliers
    };
  }

}
