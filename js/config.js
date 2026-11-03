/**
 * Konfigurasi Data, Tabel Referensi & Skema Produk BRI KKB
 * Mencakup:
 * 1. Tiga Skema Fitur: BRI KKB Regular, BRI KKB LNP, BRI KKB Karyawan
 * 2. Wilayah (1, 2, 3), Jenis Pembiayaan, Golongan Kendaraan Asuransi
 *    Referensi merk, model, dan minimum DP berada di vehicles.js.
 * 3. Tabel Biaya Fidusia
 * 4. Tabel Rate Dasar Asuransi (All Risk & TLO)
 * 5. Tabel Perluasan / Syarat Klaim Asuransi (Banjir, Gempa, SRCC, Terorisme)
 * 6. Tabel Depresiasi Nilai Pertanggungan per Tahun
 */
(function (global) {
  'use strict';

  const WILAYAH_OPTIONS = [
    {
      value: '1',
      label: 'Wilayah 1 — Pulau Sumatera',
      shortLabel: 'Wilayah 1',
      description: 'Pulau Sumatera dan kepulauan di sekitarnya'
    },
    {
      value: '2',
      label: 'Wilayah 2 — DKI Jakarta & Banten',
      shortLabel: 'Wilayah 2',
      description: 'DKI Jakarta & Banten (termasuk wilayah Jabodetabek/Jabar sesuai ketentuan OJK)'
    },
    {
      value: '3',
      label: 'Wilayah 3 — Selain Wilayah 1 & 2',
      shortLabel: 'Wilayah 3',
      description: 'Jawa Tengah, DI Yogyakarta, Jawa Timur, Bali, Kalimantan, Sulawesi, NTB, NTT, Maluku & Papua'
    }
  ];

  const FINANCING_TYPES = [
    {
      value: 'New Car',
      label: 'New Car (Kendaraan Baru)',
      vehicleType: 'Non Bus dan Non Truk',
      description: 'Pembiayaan unit kendaraan penumpang baru melalui dealer rekanan resmi BRI'
    },
    {
      value: 'Used Car',
      label: 'Used Car (Kendaraan Bekas)',
      vehicleType: 'Non Bus dan Non Truk',
      description: 'Pembiayaan unit kendaraan bekas berkualitas melalui showroom/rekanan maupun perorangan'
    },
    {
      value: 'Refinancing',
      label: 'Refinancing (Fasilitas Dana BPKB)',
      vehicleType: 'Non Bus dan Non Truk',
      description: 'Pembiayaan kembali / multiguna dengan agunan BPKB kendaraan bermotor'
    },
    {
      value: 'Mobil Niaga',
      label: 'Mobil Niaga',
      vehicleType: 'Truk dan Pick up',
      description: 'Pembiayaan kendaraan niaga (Truk & Pick Up)'
    }
  ];

  const VEHICLE_TYPE_BY_FINANCING = {
    'New Car': 'Non Bus dan Non Truk',
    'Used Car': 'Non Bus dan Non Truk',
    'Refinancing': 'Non Bus dan Non Truk',
    'Mobil Niaga': 'Truk dan Pick up'
  };

  const VEHICLE_TYPES = [
    {
      value: 'Non Bus dan Non Truk',
      label: 'Non Bus dan Non Truk (Mobil Penumpang)',
      category: 'passenger'
    },
    {
      value: 'Truk dan Pick up',
      label: 'Truk dan Pick Up (Mobil Niaga)',
      category: 'commercial'
    }
  ];

  const COVERAGE_OPTIONS = [
    {
      value: 'AllRisk',
      label: 'All Risk (Comprehensive)',
      allRiskYears: 99,
      criteria: 'Meliputi semua jenis risiko (kecelakaan ringan / berat / kehilangan / dll) selama seluruh masa tenor kredit.'
    },
    {
      value: 'Kombinasi#1',
      label: 'Kombinasi #1 (1 Thn All Risk + TLO)',
      allRiskYears: 1,
      criteria: '1 Tahun pertama All Risk, tahun-tahun selanjutnya menggunakan proteksi TLO.'
    },
    {
      value: 'Kombinasi#2',
      label: 'Kombinasi #2 (2 Thn All Risk + TLO)',
      allRiskYears: 2,
      criteria: '2 Tahun pertama All Risk, tahun-tahun selanjutnya menggunakan proteksi TLO.'
    },
    {
      value: 'Kombinasi#3',
      label: 'Kombinasi #3 (3 Thn All Risk + TLO)',
      allRiskYears: 3,
      criteria: '3 Tahun pertama All Risk, tahun-tahun selanjutnya menggunakan proteksi TLO.'
    },
    {
      value: 'Kombinasi#4',
      label: 'Kombinasi #4 (4 Thn All Risk + TLO)',
      allRiskYears: 4,
      criteria: '4 Tahun pertama All Risk, tahun-tahun selanjutnya menggunakan proteksi TLO.'
    },
    {
      value: 'TLO',
      label: 'TLO (Total Loss Only)',
      allRiskYears: 0,
      criteria: 'Menjamin kerugian jika kendaraan mengalami kerusakan total (tingkat kerusakan minimal 70%) atau hilang karena pencurian dengan nilai coverage senilai harga kendaraan setelah depresiasi (sesuai penilaian pihak Asuransi).'
    }
  ];

  // Tabel Biaya Fidusia berdasarkan rentang Nilai Penjaminan (Harga Kendaraan)
  const FIDUSIA_TABLE = [
    { from: 0, to: 50000000, fee: 150000, label: 's.d. Rp 50.000.000' },
    { from: 50000001, to: 100000000, fee: 200000, label: 'Rp 50.000.001 – Rp 100.000.000' },
    { from: 100000001, to: 250000000, fee: 350000, label: 'Rp 100.000.001 – Rp 250.000.000' },
    { from: 250000001, to: 500000000, fee: 550000, label: 'Rp 250.000.001 – Rp 500.000.000' },
    { from: 500000001, to: 1000000000, fee: 1000000, label: 'Rp 500.000.001 – Rp 1.000.000.000' },
    { from: 1000000001, to: 2500000001, fee: 2000000, label: 'Rp 1.000.000.001 – Rp 2.500.000.001' },
    { from: 2500000002, to: Infinity, fee: 2500000, label: '> Rp 2.500.000.001' }
  ];

  // Tabel Rate Dasar Asuransi (dalam persen, contoh 3.82 berarti 3,82%)
  const INSURANCE_BASE_RATES = [
    // Non Bus dan Non Truk - Wilayah 1
    { type: 'Non Bus dan Non Truk', wilayah: '1', from: 0, to: 125000000, tlo: 0.47, allRisk: 3.82 },
    { type: 'Non Bus dan Non Truk', wilayah: '1', from: 125000001, to: 200000000, tlo: 0.63, allRisk: 2.67 },
    { type: 'Non Bus dan Non Truk', wilayah: '1', from: 200000001, to: 400000000, tlo: 0.41, allRisk: 2.18 },
    { type: 'Non Bus dan Non Truk', wilayah: '1', from: 400000001, to: 800000000, tlo: 0.25, allRisk: 1.20 },
    { type: 'Non Bus dan Non Truk', wilayah: '1', from: 800000001, to: 20000000000, tlo: 0.20, allRisk: 1.05 },

    // Non Bus dan Non Truk - Wilayah 2
    { type: 'Non Bus dan Non Truk', wilayah: '2', from: 0, to: 125000000, tlo: 0.65, allRisk: 3.26 },
    { type: 'Non Bus dan Non Truk', wilayah: '2', from: 125000001, to: 200000000, tlo: 0.44, allRisk: 2.47 },
    { type: 'Non Bus dan Non Truk', wilayah: '2', from: 200000001, to: 400000000, tlo: 0.38, allRisk: 2.08 },
    { type: 'Non Bus dan Non Truk', wilayah: '2', from: 400000001, to: 800000000, tlo: 0.25, allRisk: 1.20 },
    { type: 'Non Bus dan Non Truk', wilayah: '2', from: 800000001, to: 20000000000, tlo: 0.20, allRisk: 1.05 },

    // Non Bus dan Non Truk - Wilayah 3
    { type: 'Non Bus dan Non Truk', wilayah: '3', from: 0, to: 125000000, tlo: 0.51, allRisk: 2.53 },
    { type: 'Non Bus dan Non Truk', wilayah: '3', from: 125000001, to: 200000000, tlo: 0.44, allRisk: 2.69 },
    { type: 'Non Bus dan Non Truk', wilayah: '3', from: 200000001, to: 400000000, tlo: 0.29, allRisk: 1.79 },
    { type: 'Non Bus dan Non Truk', wilayah: '3', from: 400000001, to: 800000000, tlo: 0.23, allRisk: 1.14 },
    { type: 'Non Bus dan Non Truk', wilayah: '3', from: 800000001, to: 20000000000, tlo: 0.20, allRisk: 1.05 },

    // Truk dan Pick up
    { type: 'Truk dan Pick up', wilayah: '1', from: 0, to: 99999999999, tlo: 0.88, allRisk: 2.42 },
    { type: 'Truk dan Pick up', wilayah: '2', from: 0, to: 99999999999, tlo: 1.68, allRisk: 2.39 },
    { type: 'Truk dan Pick up', wilayah: '3', from: 0, to: 99999999999, tlo: 0.81, allRisk: 2.23 }
  ];

  // Tabel Syarat Klaim / Perluasan Jaminan Asuransi (dalam persen)
  const INSURANCE_PERILS = [
    {
      id: 'banjir',
      label: 'Banjir, Angin Topan & Badai',
      codePrefix: 'Asrs. Banjir, topan',
      rates: {
        'All Risk': { '1': 0.075, '2': 0.100, '3': 0.075 },
        'TLO': { '1': 0.050, '2': 0.075, '3': 0.050 }
      }
    },
    {
      id: 'gempa',
      label: 'Gempa Bumi & Tsunami',
      codePrefix: 'Asrs. Gempa, tsunami',
      rates: {
        'All Risk': { '1': 0.120, '2': 0.100, '3': 0.075 },
        'TLO': { '1': 0.085, '2': 0.075, '3': 0.050 }
      }
    },
    {
      id: 'srcc',
      label: 'Huru-Hara & Kerusuhan (SRCC)',
      codePrefix: 'Asrs. SRCC',
      rates: {
        'All Risk': { '1': 0.050, '2': 0.050, '3': 0.050 },
        'TLO': { '1': 0.035, '2': 0.035, '3': 0.035 }
      }
    },
    {
      id: 'terorisme',
      label: 'Terorisme & Sabotase',
      codePrefix: 'Asrs. Terorisme',
      rates: {
        'All Risk': { '1': 0.050, '2': 0.050, '3': 0.050 },
        'TLO': { '1': 0.035, '2': 0.035, '3': 0.035 }
      }
    }
  ];

  // Tabel Depresiasi Nilai Pertanggungan Asuransi per Tahun / Tenor (bulan)
  const DEPRECIATION_BY_YEAR = {
    1: { tenorMonths: 12, ratePct: 100 },
    2: { tenorMonths: 24, ratePct: 85 },
    3: { tenorMonths: 36, ratePct: 70 },
    4: { tenorMonths: 48, ratePct: 60 },
    5: { tenorMonths: 60, ratePct: 50 }
  };

  // Konfigurasi 3 Skema Fitur Utama BRI KKB
  const DEFAULT_SCHEMES = {
    regular: {
      id: 'regular',
      name: 'BRI KKB Regular',
      badge: 'Umum & Wiraswasta',
      tagline: 'Skema standar pembiayaan kendaraan bermotor untuk nasabah umum, profesional, dan pelaku usaha.',
      highlights: [
        'Suku bunga kompetitif sesuai rates.csv',
        'Tenor 12 s.d. 60 bulan (Used Car & Refinancing maks. 48 bulan)',
        'DP minimum 10%-25% sesuai merk dan tipe kendaraan',
        'Provisi standar 1,00% & Admin Rp 2.000.000'
      ],
      defaultAdmin: 2000000,
      defaultProvisiPct: 1.00,
      defaultPolis: 60000,
      defaultBlokirByFinancing: {
        'New Car': 500000,
        'Used Car': 500000,
        'Refinancing': 500000,
        'Mobil Niaga': 500000
      },
      // interestRates (flat), effectiveRates, dan tenorsByFinancing dimuat dari rates.csv (js/rates.js)
      interestRates: {},
      effectiveRates: {},
      tenorsByFinancing: {}
    },

    lnp: {
      id: 'lnp',
      name: 'BRI KKB LNP',
      badge: 'Nasabah Prioritas',
      tagline: 'Program eksklusif Layanan Nasabah Prioritas (BRI Prioritas & Private) dengan rate khusus & keringanan biaya.',
      highlights: [
        'Special rate Prioritas sesuai rates.csv',
        'Diskon 50% Biaya Provisi (0,50%) & Admin ringan Rp 1.250.000',
        'DP minimum sesuai tabel merk dan tipe kendaraan',
        'Proses persetujuan jalur cepat (Fast Track RM Prioritas)'
      ],
      defaultAdmin: 1250000,
      defaultProvisiPct: 0.50,
      defaultPolis: 60000,
      defaultBlokirByFinancing: {
        'New Car': 500000,
        'Used Car': 500000,
        'Refinancing': 500000,
        'Mobil Niaga': 500000
      },
      // interestRates (flat), effectiveRates, dan tenorsByFinancing dimuat dari rates.csv (js/rates.js)
      interestRates: {},
      effectiveRates: {},
      tenorsByFinancing: {}
    },

    karyawan: {
      id: 'karyawan',
      name: 'BRI KKB Karyawan',
      badge: 'Payroll & Pekerja BRI Group',
      tagline: 'Fasilitas khusus pekerja tetap / Payroll BRI, BUMN, ASN, dan instansi mitra PKS dengan bunga paling ringan.',
      highlights: [
        'Suku bunga spesial karyawan sesuai rates.csv',
        'Keringanan Biaya Admin Rp 1.000.000 & Provisi ringan 0,25%',
        'DP minimum sesuai tabel merk dan tipe kendaraan',
        'Potong gaji otomatis (Auto-Debet Payroll)'
      ],
      defaultAdmin: 1000000,
      defaultProvisiPct: 0.25,
      defaultPolis: 60000,
      defaultBlokirByFinancing: {
        'New Car': 500000,
        'Used Car': 500000,
        'Refinancing': 500000,
        'Mobil Niaga': 500000
      },
      // interestRates (flat), effectiveRates, dan tenorsByFinancing dimuat dari rates.csv (js/rates.js)
      interestRates: {},
      effectiveRates: {},
      tenorsByFinancing: {}
    }
  };

  global.KKBConfig = {
    WILAYAH_OPTIONS,
    FINANCING_TYPES,
    VEHICLE_TYPE_BY_FINANCING,
    VEHICLE_TYPES,
    COVERAGE_OPTIONS,
    FIDUSIA_TABLE,
    INSURANCE_BASE_RATES,
    INSURANCE_PERILS,
    DEPRECIATION_BY_YEAR,
    DEFAULT_SCHEMES
  };
})(window);
