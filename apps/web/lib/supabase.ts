import { createClient } from "@supabase/supabase-js";

/**
 * Inisialisasi Supabase Client untuk Frontend (Next.js 14).
 * 
 * 🧠 CATATAN ARSITEKTUR & KEAMANAN KRUSIAL:
 * 1. HANYA gunakan 'NEXT_PUBLIC_SUPABASE_ANON_KEY' di sini.
 * 2. DILARANG KERAS menggunakan 'SUPABASE_SERVICE_ROLE_KEY' di layer frontend!
 *    Service Role Key memiliki privilege 'BYPASSRLS' di PostgreSQL, yang artinya
 *    jika kunci tersebut bocor ke browser client, penyerang dapat membaca dan
 *    mengubah SEMUA data milik SEMUA tenant tanpa batasan.
 * 3. Dengan 'anon' key, setiap query dari browser wajib melewati aturan Row-Level
 *    Security (RLS) PostgreSQL yang mengevaluasi context user/tenant aktif.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Peringatan di console jika environment variables belum disetel
  console.warn(
    "[Nexus Web] Peringatan: NEXT_PUBLIC_SUPABASE_URL atau NEXT_PUBLIC_SUPABASE_ANON_KEY belum dikonfigurasi di file .env.local"
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder-project.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
