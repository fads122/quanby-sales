import { Injectable } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xvcgubrtandfivlqcmww.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2Y2d1YnJ0YW5kZml2bHFjbXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkxNDk4NjYsImV4cCI6MjA1NDcyNTg2Nn0.yjd-SXfzJe6XmuNpI2HsZcI9EsS9AxBXI-qukzgcZig';

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


  async getProjectsGroupedByClient(): Promise<any[]> {
  const { data, error } = await this.supabase
    .from('projects')
    .select('*')
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

  return Object.values(grouped);
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
