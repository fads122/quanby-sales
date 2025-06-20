import { Injectable } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

const SUPABASE_URL = environment.SUPABASE_URL;
const SUPABASE_KEY = environment.SUPABASE_KEY;

@Injectable({
  providedIn: 'root'
})
export class ClientService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  // Fetch all projects with client information
  async getAllProjects() {
    const { data, error } = await this.supabase
      .from('projects')
      .select(`
        id,
        name,
        client_name,
        client_phone,
        client_email,
        client_address,
        delivery_status,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
      throw error;
    }
    return data;
  }

  // Fetch a single project by ID
  async getProjectById(projectId: string) {
    const { data, error } = await this.supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) {
      console.error('Error fetching project:', error);
      throw error;
    }
    return data;
  }

  // Optional: Fetch projects by status
  async getProjectsByStatus(status: string) {
    const { data, error } = await this.supabase
      .from('projects')
      .select('*')
      .eq('delivery_status', status)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Error fetching ${status} projects:`, error);
      throw error;
    }
    return data;
  }

  async getProjectsGroupedByClient(offset: number = 0, limit: number = 5): Promise<{ data: any[], total: number }> {
    // First, get distinct clients with their latest project
    const { data: distinctClients, error: countError } = await this.supabase
      .from('projects')
      .select('client_name')
      .not('client_name', 'is', null)
      .order('created_at', { ascending: false });

    if (countError) throw countError;

    // Get unique client names
    const uniqueClients = [...new Set(distinctClients.map(p => p.client_name))];
    const total = uniqueClients.length;

    // Get the paginated unique clients
    const paginatedClientNames = uniqueClients.slice(offset, offset + limit);

    // Then get all projects for these paginated clients
    const { data, error } = await this.supabase
      .from('projects')
      .select('*')
      .in('client_name', paginatedClientNames)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Group projects by client
    const grouped = data.reduce((acc, project) => {
      const key = project.client_name;
      if (!acc[key]) {
        acc[key] = {
          client_name: project.client_name,
          client_phone: project.client_phone,
          client_email: project.client_email,
          client_address: project.client_address,
          projects: []
        };
      }
      acc[key].projects.push(project);
      return acc;
    }, {});

    return {
      data: Object.values(grouped),
      total: total
    };
  }

  async getDeliveryReceipts(projectId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('delivery_receipts')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching delivery receipts:', error);
      return [];
    }
    return data;
  }
}
