/* Memuat suku bunga default (flat & efektif) dari rates.csv ke KKBConfig.DEFAULT_SCHEMES. */
(function (global) {
  'use strict';

  const SCHEME_COLUMNS = ['karyawan', 'lnp', 'regular'];
  const RATE_TYPES = { flat: 'interestRates', efektif: 'effectiveRates' };
  const VALID_TENORS = [12, 24, 36, 48, 60];

  function parseRate(raw, lineNo) {
    if (!raw) return null;
    const value = Number(String(raw).replace('%', '').replace(',', '.'));
    if (!Number.isFinite(value) || value < 0 || value > 50) {
      throw new Error(`Bunga CSV baris ${lineNo} tidak valid (0-50%).`);
    }
    return value;
  }

  function loadText(text) {
    const Config = global.KKBConfig;
    const rows = global.KKBCsv.parse(text);
    const header = rows.shift() || [];
    const columns = ['jenis_bunga', 'pembiayaan', 'tenor'].concat(SCHEME_COLUMNS);
    if (columns.some((name) => !header.includes(name))) {
      throw new Error(`Kolom wajib rates.csv: ${columns.join(', ')}.`);
    }
    const financingValues = Config.FINANCING_TYPES.map((f) => f.value);
    const table = {}; // table[schemeId][rateKey][financing][tenor]
    SCHEME_COLUMNS.forEach((s) => {
      table[s] = { interestRates: {}, effectiveRates: {} };
      financingValues.forEach((fin) => {
        table[s].interestRates[fin] = {};
        table[s].effectiveRates[fin] = {};
      });
    });

    rows.forEach((cells, index) => {
      const lineNo = index + 2;
      const get = (name) => cells[header.indexOf(name)] || '';
      const rateKey = RATE_TYPES[get('jenis_bunga').toLowerCase()];
      const fin = financingValues.find((v) => v.toLowerCase() === get('pembiayaan').toLowerCase());
      const tenor = Number(get('tenor'));
      if (!rateKey || !fin || VALID_TENORS.indexOf(tenor) === -1) {
        throw new Error(`Baris ${lineNo} rates.csv tidak valid (jenis_bunga flat/efektif, pembiayaan, tenor 12-60).`);
      }
      SCHEME_COLUMNS.forEach((s) => {
        const value = parseRate(get(s), lineNo);
        if (value !== null) table[s][rateKey][fin][tenor] = value;
      });
    });

    // Tenor tersedia = tenor yang memiliki bunga flat DAN efektif.
    SCHEME_COLUMNS.forEach((s) => {
      const scheme = Config.DEFAULT_SCHEMES[s];
      scheme.interestRates = table[s].interestRates;
      scheme.effectiveRates = table[s].effectiveRates;
      scheme.tenorsByFinancing = {};
      financingValues.forEach((fin) => {
        const tenors = VALID_TENORS.filter(
          (t) => table[s].interestRates[fin][t] !== undefined && table[s].effectiveRates[fin][t] !== undefined
        );
        if (!tenors.length) throw new Error(`rates.csv: ${fin} (${s}) belum memiliki bunga flat & efektif.`);
        scheme.tenorsByFinancing[fin] = tenors;
      });
    });
  }

  global.KKBRates = {
    loadText,
    async load() {
      const response = await fetch('rates.csv', { cache: 'no-store' });
      if (!response.ok) throw new Error(`rates.csv: HTTP ${response.status}`);
      loadText(await response.text());
    }
  };
})(window);
