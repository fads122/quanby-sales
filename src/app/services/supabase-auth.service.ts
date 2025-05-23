import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, AuthError } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';

const SUPABASE_URL = 'https://xvcgubrtandfivlqcmww.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2Y2d1YnJ0YW5kZml2bHFjbXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkxNDk4NjYsImV4cCI6MjA1NDcyNTg2Nn0.yjd-SXfzJe6XmuNpI2HsZcI9EsS9AxBXI-qukzgcZig'; // Replace with your Supabase Key

@Injectable({
  providedIn: 'root',
})
export class SupabaseAuthService {
  private supabase: SupabaseClient;
  private isAdminSubject = new BehaviorSubject<boolean>(false);
  isAdmin$: Observable<boolean> = this.isAdminSubject.asObservable();

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    this.initializeAdminStatus();
  }

  private async initializeAdminStatus(): Promise<void> {
    const user = await this.getUser();
    if (user) {
      const profile = await this.getUserProfile(user.id);
      this.isAdminSubject.next(profile?.usertype === 'admin');
    }
  }

  // Sign in with email and password
  async signIn(email: string, password: string): Promise<{ data: any; error: AuthError | null }> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }
      if (data.user) {
        await this.initializeAdminStatus();
      }
      return { data, error };
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }

  // Sign up with email and password
  async signUp(email: string, password: string): Promise<{ data: any; error: AuthError | null }> {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/login` },
      });
      if (error) {
        throw error;
      }
      return { data, error };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  // Sign out the user
  async signOut(): Promise<void> {
    try {
      const { error } = await this.supabase.auth.signOut();
      if (error) {
        throw error;
      }
      this.isAdminSubject.next(false);
    } catch (error) {
      console.error('Sign-out error:', error);
      throw error;
    }
  }

  // ✅ Change password for logged-in users
  async changePassword(newPassword: string): Promise<void> {
    try {
      console.log("🔍 Debug: Trying to update password:", newPassword, "Length:", newPassword.length);

      if (!newPassword || newPassword.trim().length < 6) {
        throw new Error("Password must be at least 6 characters long.");
      }

      const { error } = await this.supabase.auth.updateUser({
        password: newPassword.trim(), // Trim whitespace just in case
      });

      if (error) {
        throw error;
      }

      console.log('✅ Password updated successfully');

      // 🔥 Force logout and re-login to refresh session
      await this.supabase.auth.signOut();
      console.log('✅ User signed out. Please log in again.');

    } catch (error: any) {
      console.error('❌ Error updating password:', error.message);
      throw error;
    }
  }

  // ✅ Get the current user session
  async getUser(): Promise<any | null> {
    try {
      const { data } = await this.supabase.auth.getUser();
      return data?.user || null;
    } catch (error) {
      console.error('❌ Error fetching user:', error);
      return null;
    }
  }



  // Check if the user is logged in
  async isLoggedIn(): Promise<boolean> {
    const user = await this.getUser();
    return !!user;
  }

  async restoreSession(): Promise<void> {
    const { data, error } = await this.supabase.auth.getSession();

    if (error || !data.session) {
      console.warn('⚠️ No active session found, user may need to log in again.');
    } else {
      console.log('✅ Session restored successfully:', data.session);
    }
  }

  // Upload an image to Supabase Storage
async uploadImage(file: File): Promise<string | null> {
  const fileName = `${Date.now()}-${file.name}`;
  try {
    // Upload the file to the bucket
    const { data: uploadData, error: uploadError } = await this.supabase.storage
      .from('supplier-images') // Ensure this matches your bucket name
      .upload(fileName, file);

    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      return null;
    }

    // Get the public URL of the uploaded image
    const { data: urlData } = this.supabase.storage
      .from('supplier-images')
      .getPublicUrl(uploadData.path);

    // Return the public URL of the image
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error during image upload:', error);
    return null;
  }


}
async getUserProfile(userId: string): Promise<any> {
  const { data, error } = await this.supabase
    .from('users')  // Access the 'users' table
    .select('first_name, usertype')  // Fetch 'first_name' and 'usertype'
    .eq('id', userId)  // Match the current user's ID
    .single();  // Return a single record

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }

  // Update admin status when profile is fetched
  this.isAdminSubject.next(data?.usertype === 'admin');
  return data;
}

// Add this method to your SupabaseAuthService
async isAuthenticated(): Promise<boolean> {
  const { data: { session } } = await this.supabase.auth.getSession();
  return !!session;
}
}
