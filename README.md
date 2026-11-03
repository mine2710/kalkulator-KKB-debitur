# Kalkulator Simulasi BRI KKB Debitur

Aplikasi web interaktif untuk simulasi perhitungan **Kredit Kendaraan Bermotor (KKB) BRI** yang dirancang menyerupai struktur analitik Kalkulator KPR BRI dengan penyesuaian khusus formula KKB (Bundling Asuransi Multi-Tahun, Depresiasi Nilai Pertanggungan, Biaya Fidusia, Provisi, Blokir BPKB, dan Minimal DP).

---

## Fitur Utama

### 1. Tiga Pilihan Skema Produk (Perhitungan Berbeda)
- **BRI KKB Regular** — Skema standar untuk nasabah umum, wiraswasta, dan profesional.
- **BRI KKB LNP (Layanan Nasabah Prioritas)** — Skema *privilege* khusus nasabah BRI Prioritas & Private dengan suku bunga spesial, diskon provisi dan biaya admin lebih ringan. Minimum DP tetap mengikuti merk dan model.
- **BRI KKB Karyawan** — Skema khusus pekerja tetap / Payroll BRI Group, BUMN, ASN, dan mitra PKS dengan suku bunga paling ringan serta opsi tenor hingga 60 bulan.

### 2. Input Utama & Minimum DP
1. **Skema Pembiayaan:** `Regular`, `LNP`, atau `Karyawan`.
2. **Jenis Pembiayaan & Jenis Suku Bunga:**
   - Pilihan Pembiayaan: `New Car`, `Used Car` (maks. 48 bulan), `Refinancing` (maks. 48 bulan), atau `Mobil Niaga` (s.d. 60 bulan).
   - Pilihan Jenis Suku Bunga: dropdown **`Bunga Efektif`** atau **`Bunga Flat`** (seluruh tarif default dimuat dari `rates.csv`).
   - `New Car`, `Used Car`, dan `Refinancing` otomatis dipetakan ke golongan asuransi **Non Bus dan Non Truk**, sedangkan `Mobil Niaga` ke **Truk dan Pick up**.
3. **Merk dan Tipe / Model:** dropdown tipe mengikuti merk yang dipilih.
4. **Minimum DP:** lookup langsung dari pasangan merk + tipe/model pada katalog kendaraan.
   - Tidak dipengaruhi jenis pembiayaan, skema, bahan bakar, kategori, atau depreciation.
   - Jika ada baris duplikat untuk pasangan yang sama, sistem mengambil **DP terkecil**.
   - Contoh: **SUZUKI KARIMUN = 20%**, karena terdapat nilai 25% dan 20%.
5. **Harga Kendaraan dan DP:** dapat diinput dalam persen atau Rupiah.
6. **Pengaturan lanjutan:** wilayah asuransi, coverage, syarat klaim / perluasan, biaya kredit (default Biaya Polis Rp 60.000 & Blokir BPKB Rp 500.000), dan skema angsuran.

### 3. Rumus Perhitungan
- **Rumus Angsuran & Skema ADDB vs ADDM:**
  - **ADDB (Angsuran Dibayar Di Belakang):** Angsuran pertama dibayar 1 bulan pasca akad sehingga bulan ke-1 sudah memiliki **Porsi Bunga** (baik mode Bunga Efektif maupun Bunga Flat).
  - **ADDM (Angsuran Dibayar Di Muka):** Angsuran pertama masuk TDP saat akad sehingga khusus bulan ke-1 **tidak dikenakan bunga** (`Porsi Bunga = Rp 0`, 100% mengurangi Pokok Hutang), dan bunga baru dihitung mulai bulan ke-2.
- **Rumus Biaya Kredit:** `Biaya Admin + Biaya Provisi (Rp) + Biaya Polis + Biaya Fidusia + Blokir BPKB`
- **Rumus Biaya Provisi (Rp):** `Biaya Provisi (%) × Pokok Hutang` *(dapat diubah ke basis Harga Kendaraan melalui menu Pengaturan Rate)*
- **Rumus Fidusia:** Otomatis mengacu pada tabel rentang Nilai Penjaminan (`s.d. 50 Jt` hingga `> 1 Miliar`).
- **Rumus Asuransi & Depresiasi:** Dihitung per tahun mengikuti persentase depresiasi (`Tahun 1: 100%`, `Tahun 2: 85%`, `Tahun 3: 70%`, `Tahun 4: 60%`, `Tahun 5: 50%`) dikalikan tarif dasar OJK sesuai Wilayah & golongan pembiayaan (`Non Bus dan Non Truk` / `Truk dan Pick up`) serta tarif perluasan klaim (`All Risk` / `TLO`).

### 4. Output Tabel Responsif
1. **Tabel Simulasi Tenor (`12`, `24`, `36`, `48`, `60` Bulan):** Menampilkan Suku Bunga Flat, **Angsuran / Bulan**, dan **Total DP (TDP)**. Premi asuransi dan biaya kredit tersedia dalam rincian yang selalu tampil.
2. **Tabel Rincian TDP & Biaya Kredit:** Menampilkan urutan kolom **Komponen Biaya | Nominal (Rp) | Keterangan** (DP Murni, Premi Asuransi, Admin, Provisi, Polis Rp 60.000, Fidusia, dan Blokir BPKB Rp 500.000).
3. **Tabel Asuransi & Depresiasi per Tahun:** Menampilkan **Premi (Rp)** terlebih dahulu diikuti nilai pertanggungan, persentase depresiasi (`100%`, `85%`, `70%`, `60%`, `50%`), jenis *coverage* per tahun, dan total *rate*.
4. **Jadwal Amortisasi & Anotasi Lengkap Per Bulan (Gaya KPR):** Menggunakan tampilan **Anuitas (Gaya KPR)** lengkap dengan anotasi status proteksi asuransi setiap pergantian tahun.
5. **Modal Tabel Referensi & Kustomisasi Rate:** Menampilkan seluruh tabel ketentuan (Suku Bunga, Biaya Default, Rate Asuransi Wilayah 1–3, Perluasan Klaim, Depresiasi, dan Fidusia) secara terbuka dan dapat disesuaikan langsung.

---

## Cara Menjalankan

Aplikasi tidak memerlukan build tool. Jalankan melalui **Live Server** di VS Code atau **GitHub Pages**. Jangan membuka `index.html` dengan klik dua kali (`file://`), karena browser memblokir pembacaan CSV melalui fetch.

## Katalog dan Pengujian

Katalog `vehicles.csv` berisi 46 merk dan 263 pasangan merk-model unik (264 baris sumber termasuk duplikat). `js/vehicles.js` hanya membaca dan memvalidasi CSV. Ejaan model mengikuti tabel sumber. Kategori dan depreciation disimpan sebagai metadata, bukan penentu DP atau pengganti persentase depresiasi asuransi tahunan.

### Mengubah Data Dropdown

1. Buka `vehicles.csv` di Excel atau editor teks. Saat impor Excel, gunakan tipe **Text** untuk kolom merk/model agar model berupa angka tidak berubah format.
2. Satu baris mewakili satu kendaraan. Pertahankan header: `brand,model,category,depreciation,min_dp_pct`.
3. Ubah/tambahkan merk pada `brand`, tipe pada `model`, dan DP pada `min_dp_pct`. Isi DP sebagai angka 0-100 tanpa tanda persen; contoh `20` berarti 20%.
4. Kolom `category` dan `depreciation` adalah metadata dan boleh kosong. Baris duplikat merk-model tetap mengambil DP terkecil.
5. Simpan sebagai **CSV UTF-8**, lalu refresh halaman. Pemisah koma atau titik koma (Excel) didukung, termasuk nilai desimal berkoma jika pemisahnya titik koma.

Contoh baris: `TOYOTA,AVANZA,Fast,Medium,15`. Mengubah angka terakhir menjadi `20` mengubah minimum DP AVANZA menjadi 20% tanpa mengedit JavaScript.

Jika CSV hilang atau datanya tidak valid, kalkulator menampilkan pesan kesalahan dan menonaktifkan simulasi, bukan menggunakan DP perkiraan. Perubahan ini mencakup dropdown **merk dan tipe/model**; pilihan pembiayaan, coverage, dan tabel suku bunga masih menggunakan konfigurasi yang ada.

Pergantian merk/model mengisi DP minimum secara otomatis. Pergantian skema mempertahankan DP yang sudah diinput. DP di bawah minimum tetap dapat disimulasikan sebagai ilustrasi, dengan peringatan pada input dan hasil.

Uji browser tersedia di `tests/smoke_test.py` dan dijalankan dengan Python, paket Playwright, serta Microsoft Edge yang terpasang. Uji mencakup lookup seluruh katalog, duplikat KARIMUN, dropdown bertingkat, reset, mode DP, modal, dan lebar layar 320-1440 px.

## Struktur Direktori

```text
kalkulator-KKB-debitur/
├── BRI_2025.png        # Logo resmi BRI
├── vehicles.csv        # Data dropdown merk-model dan minimum DP yang dapat diedit
├── rates.csv           # Data default suku bunga Flat & Efektif per pembiayaan dan skema
├── index.html          # Antarmuka utama aplikasi kalkulator KKB BRI
├── css/
│   └── styles.css      # Desain UI tabel responsif menyesuaikan resolusi layar
├── tests/
│   └── smoke_test.py    # Uji lookup DP, interaksi UI, modal, dan responsive
├── js/
│   ├── vehicles.js      # Loader dan validasi CSV kendaraan
│   ├── config.js       # Tabel referensi Fidusia, Rate Asuransi, Klaim, Depresiasi & Skema
│   ├── calculator.js   # Mesin kalkulasi finansial, asuransi multi-tahun & amortisasi
│   └── app.js           # Controller interaktif UI, tabel output & modal pengaturan rate
└── README.md           # Dokumentasi proyek
```
