# Kalkulator Simulasi BRI KKB Debitur

Aplikasi web interaktif untuk simulasi perhitungan **Kredit Kendaraan Bermotor (KKB) BRI** yang dirancang menyerupai struktur analitik Kalkulator KPR BRI dengan penyesuaian khusus formula KKB (Bundling Asuransi Multi-Tahun, Depresiasi Nilai Pertanggungan, Biaya Fidusia, Provisi, Blokir BPKB, dan Minimal DP).

---

## Fitur Utama

### 1. Tiga Pilihan Skema Produk (Perhitungan Berbeda)
- **BRI KKB Regular** — Skema standar untuk nasabah umum, wiraswasta, dan profesional.
- **BRI KKB LNP (Layanan Nasabah Prioritas)** — Skema *privilege* khusus nasabah BRI Prioritas & Private dengan suku bunga spesial, diskon provisi, biaya admin lebih ringan, serta relaksasi batas Minimal DP.
- **BRI KKB Karyawan** — Skema khusus pekerja tetap / Payroll BRI Group, BUMN, ASN, dan mitra PKS dengan suku bunga paling ringan serta opsi tenor hingga 60 bulan.

### 2. Parameter Input Lengkap
1. **Wilayah Kendaraan (`1`, `2`, `3`):**
   - `1` : Pulau Sumatera
   - `2` : DKI Jakarta & Banten
   - `3` : Selain Wilayah 1 & 2
2. **Jenis Pembiayaan:** `New Car`, `Used Car`, `Refinancing`
3. **Spesifikasi Kendaraan & Minimal DP Dinamis:**
   - **Tipe Kendaraan:** `Non Bus dan Non Truk`, `Truk dan Pick up`, `Bus`, `Motor`
   - **Merk Kendaraan & Jenis Bahan Bakar:** `Bensin`, `Solar/Diesel`, `Hybrid (HEV/PHEV)`, `Listrik Murni (BEV/EV)`
   - Menghitung batas **Minimal DP (%) & (Rp)** secara otomatis disertai indikator validasi.
4. **Harga Kendaraan & Down Payment (`%` atau `Rp`):** Sinkronisasi dua arah otomatis antara persentase dan nominal Rupiah.
5. **Bundling Asuransi & Perluasan Klaim:**
   - Pilihan Coverage: `AllRisk`, `Kombinasi#1`, `Kombinasi#2`, `Kombinasi#3`, `Kombinasi#4`, `TLO` lengkap dengan deskripsi kriteria pertanggungan.
   - Pilihan Perluasan Klaim: `Banjir & Topan`, `Gempa & Tsunami`, `SRCC (Huru-Hara)`, dan `Terorisme`.
6. **Komponen Biaya Kredit:** `Biaya Admin`, `Biaya Provisi (%)`, `Biaya Polis`, `Blokir BPKB`, serta `Biaya Fidusia` otomatis berdasarkan rentang Nilai Penjaminan.

### 3. Rumus Perhitungan
- **Rumus TDP:** `DP Murni + Total Premi Asuransi + Total Biaya Kredit` *(+ Angsuran ke-1 apabila memilih mode ADDM)*
- **Rumus Biaya Kredit:** `Biaya Admin + Biaya Provisi (Rp) + Biaya Polis + Biaya Fidusia + Blokir BPKB`
- **Rumus Biaya Provisi (Rp):** `Biaya Provisi (%) × Harga Kendaraan` *(dapat diubah ke basis Pokok Hutang melalui menu Pengaturan Rate)*
- **Rumus Fidusia:** Otomatis mengacu pada tabel rentang Nilai Penjaminan (`s.d. 50 Jt` hingga `> 1 Miliar`).
- **Rumus Asuransi & Depresiasi:** Dihitung per tahun mengikuti persentase depresiasi (`Tahun 1: 100%`, `Tahun 2: 85%`, `Tahun 3: 70%`, `Tahun 4: 60%`, `Tahun 5: 50%`) dikalikan tarif dasar OJK sesuai Wilayah & Tipe serta tarif perluasan klaim (`All Risk` / `TLO`).

### 4. Output & Ekspor
1. **Tabel Perbandingan Tenor (`12`, `24`, `36`, `48`, `60` Bulan):** Menampilkan Suku Bunga, Premi Asuransi, Biaya Kredit, **Angsuran / Bulan**, dan **Total DP (TDP)**.
2. **Komparasi Lintas 3 Skema:** Membandingkan `BRI KKB Regular`, `BRI KKB LNP`, dan `BRI KKB Karyawan` secara berdampingan.
3. **Grafik Visualisasi & Rincian Premi Tahunan:** Donut Chart komposisi TDP dan kurva progres pelunasan pokok pinjaman.
4. **Jadwal Amortisasi & Anotasi Lengkap Per Bulan (Gaya KPR):** Mendukung tampilan **Anuitas / Efektif** maupun **Proporsional Flat**, lengkap dengan anotasi status proteksi asuransi setiap pergantian tahun.
5. **Ekspor CSV & Cetak PDF:** Unduh simulasi ke format `.csv` (Excel) atau cetak langsung sebagai dokumen PDF.

---

## Cara Menjalankan

Aplikasi ini dibuat tanpa ketergantungan *build tool* eksternal sehingga dapat dijalankan langsung:
1. Buka file `index.html` langsung menggunakan browser modern (Chrome, Edge, Firefox, Safari), atau
2. Jalankan melalui *local static server* (misal ekstensi **Live Server** di VS Code) maupun melalui **GitHub Pages**.

## Struktur Direktori

```text
kalkulator-KKB-debitur/
├── index.html          # Antarmuka utama aplikasi kalkulator KKB BRI
├── css/
│   └── styles.css      # Desain sistem perbankan BRI, responsif & print-ready
├── js/
│   ├── config.js       # Tabel referensi Fidusia, Rate Asuransi, Klaim, Depresiasi & Skema
│   ├── calculator.js   # Mesin kalkulasi finansial, asuransi multi-tahun & amortisasi
│   └── app.js          # Controller interaktif UI, grafik SVG, modal rate & ekspor CSV
└── README.md           # Dokumentasi proyek
```
