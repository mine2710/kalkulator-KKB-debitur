/* Referensi kendaraan dari tabel pengguna. Nama model dipertahankan sesuai sumber. */
(function (global) {
  'use strict';


  const normalize = (value) => String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
  let unique = new Map();
  const api = {
    vehicles: [],
    brands: [],
    modelsFor: (brand) => api.vehicles.filter((row) => normalize(row.brand) === normalize(brand)),
    find: (brand, model) => unique.get(`${normalize(brand)}|${normalize(model)}`),
    loadText,
    async load() {
      const response = await fetch('vehicles.csv', { cache: 'no-store' });
      if (!response.ok) throw new Error(`vehicles.csv: HTTP ${response.status}`);
      loadText(await response.text());
    }
  };

  // Handles quoted fields, escaped quotes, CRLF, and Excel's semicolon delimiter.
  function parseCsv(text) {
    text = String(text).replace(/^\uFEFF/, '');
    const firstLine = text.split(/\r?\n/).find((line) => line.trim() && !line.trim().startsWith('#')) || '';
    const delimiter = firstLine.includes(';') ? ';' : ',';
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (quoted && text[i + 1] === '"') { field += '"'; i++; }
        else if (quoted || !field) quoted = !quoted;
        else throw new Error('Tanda kutip CSV tidak valid.');
      } else if (!quoted && (char === delimiter || char === '\n' || char === '\r')) {
        row.push(field.trim());
        field = '';
        if (char !== delimiter) {
          if (char === '\r' && text[i + 1] === '\n') i++;
          if (row.some(Boolean) && !row[0].startsWith('#')) rows.push(row);
          row = [];
        }
      } else field += char;
    }
    if (quoted) throw new Error('Tanda kutip CSV belum ditutup.');
    row.push(field.trim());
    if (row.some(Boolean) && !row[0].startsWith('#')) rows.push(row);
    return rows;
  }

  function loadText(text) {
    const rows = parseCsv(text);
    const header = rows.shift() || [];
    const columns = ['brand', 'model', 'category', 'depreciation', 'min_dp_pct'];
    if (columns.some((name) => !header.includes(name))) {
      throw new Error(`Kolom wajib CSV: ${columns.join(', ')}.`);
    }
    const next = new Map();
    rows.forEach((cells, index) => {
      const get = (name) => cells[header.indexOf(name)] || '';
      const brand = normalize(get('brand'));
      const model = get('model');
      const dp = get('min_dp_pct').replace(',', '.');
      const minDpPct = Number(dp);
      if (cells.length !== header.length || !brand || !model || !dp || !Number.isFinite(minDpPct) || minDpPct < 0 || minDpPct > 100) {
        throw new Error(`Data kendaraan CSV baris ${index + 2} tidak valid (merk, model, atau DP 0-100).`);
      }
      const key = `${brand}|${normalize(model)}`;
      const vehicle = { brand, model, category: get('category'), depreciation: get('depreciation'), minDpPct };
      // Duplikat merk-model selalu menggunakan DP terkecil.
      if (!next.has(key) || minDpPct < next.get(key).minDpPct) next.set(key, vehicle);
    });
    if (!next.size) throw new Error('CSV kendaraan tidak boleh kosong.');
    unique = next;
    api.vehicles = [...next.values()];
    api.brands = [...new Set(api.vehicles.map((vehicle) => vehicle.brand))].sort();
  }

  global.KKBVehicles = api;
})(window);
