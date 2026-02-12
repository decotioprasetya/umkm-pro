
import { createClient } from '@supabase/supabase-js';

// Konfigurasi Supabase Baru
const supabaseUrl = 'https://dixhqgsglgoqsqvpvbwa.supabase.co'; 
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGhxZ3NnbGdvcXNxdnB2YndhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4ODE3ODMsImV4cCI6MjA4NjQ1Nzc4M30.Efv9Ogtk4xWrLDZwwTdsOSPQvED0dWT_Orc1rBC2EzA';

/**
 * Mencegah error "supabaseUrl is required" saat runtime.
 * Jika URL/Key kosong, kita mengekspor objek dummy agar aplikasi tetap bisa berjalan (Offline Mode).
 */
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signInWithPassword: async () => ({ error: { message: 'Konfigurasi Supabase belum diisi di supabase.ts' } }),
        signUp: async () => ({ error: { message: 'Konfigurasi Supabase belum diisi di supabase.ts' } }),
        signOut: async () => ({ error: null })
      },
      from: () => ({
        select: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
          limit: () => Promise.resolve({ data: [], error: null })
        }),
        insert: () => Promise.resolve({ data: null, error: null }),
        update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
        upsert: () => Promise.resolve({ data: null, error: null }),
        delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
      })
    } as any;

// Helper untuk mengecek apakah koneksi cloud siap digunakan
export const isCloudReady = !!(supabaseUrl && supabaseAnonKey);
