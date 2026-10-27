# AI Worker (Zona B - Sandbox Terisolasi)

Modul ini bertanggung jawab menjalankan workflow AI otonom berbasis **LangGraph**.

## ATURAN ARSITEKTUR KETAT (IRON RULES):
1. Worker AI DILARANG memiliki koneksi atau kredensial langsung ke tabel operasional utama:
   - `orders`
   - `stock_movements`
   - `stock_levels`
   - `payments`
2. Worker AI HANYA memiliki izin WRITE ke tabel:
   - `ai_drafts`
3. Semua hasil penalaran AI harus diverifikasi manusia (Human-in-the-Loop) atau melalui Rule Engine Core API sebelum dieksekusi menjadi transaksi riil.
