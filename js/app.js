/**
 * Controller UI Interaktif Kalkulator BRI KKB Debitur
 */
(function (global) {
  'use strict';

  const Config = global.KKBConfig;
  const Calc = global.KKBCalculator;

  const STORAGE_KEY = 'bri_kkb_custom_settings_v1';

  // Deep clone helper
  function cloneDeep(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // State Aplikasi
  const state = {
    schemeId: 'regular',
    wilayah: '2',
    financingType: 'New Car',
    vehicleType: 'Non Bus dan Non Truk',
    brandValue: 'toyota',
    fuelValue: 'bensin',
    vehiclePrice: 350000000,
    dpMode: 'pct', // 'pct' atau 'rp'
    dpPct: 20,
    dpAmount: 70000000,
    coverageValue: 'Kombinasi#1',
    selectedPerils: ['banjir'],
    adminFee: 2000000,
    provisiPct: 1.0,
    polisFee: 50000,
    blokirFee: 0,
    installmentType: 'ADDB',
    selectedTenor: 36,
    amortMode: 'anuitas', // 'anuitas' atau 'flat'
    activeModalTab: 'tabRates',
    // Opsi lanjutan (default sesuai rumus spesifikasi user)
    provisiBasis: 'price', // Biaya Provisi (%) * Harga Kendaraan
    fidusiaBasis: 'price', // Rentang Harga Kendaraan
    bracketBasis: 'depreciated', // Nilai pertanggungan tahun berjalan
    schemes: cloneDeep(Config.DEFAULT_SCHEMES)
  };

  let lastSuiteResult = null;

  // ======================== FORMATTERS & PARSERS ========================
  function formatNumberId(num) {
    const rounded = Math.round(Number(num) || 0);
    return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function formatRupiah(num) {
    const val = Math.round(Number(num) || 0);
    if (val < 0) {
      return '-Rp ' + formatNumberId(Math.abs(val));
    }
    return 'Rp ' + formatNumberId(val);
  }

  function formatPct(num, decimals) {
    const d = decimals !== undefined ? decimals : 2;
    const val = Number(num) || 0;
    return val.toFixed(d).replace('.', ',') + '%';
  }

  function parseDigits(str) {
    if (!str) return 0;
    const cleaned = String(str).replace(/[^\d]/g, '');
    return cleaned ? parseInt(cleaned, 10) : 0;
  }

  function parseDecimalId(str) {
    if (!str) return 0;
    const normalized = String(str)
      .replace(/\s+/g, '')
      .replace(',', '.')
      .replace(/[^0-9.]/g, '');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  }

  // ======================== PERSISTENCE ========================
  function loadSavedSettings() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.schemes) {
        state.schemes = saved.schemes;
      }
      if (saved.provisiBasis) state.provisiBasis = saved.provisiBasis;
      if (saved.fidusiaBasis) state.fidusiaBasis = saved.fidusiaBasis;
      if (saved.bracketBasis) state.bracketBasis = saved.bracketBasis;
    } catch (e) {
      // Abaikan jika localStorage diblokir
    }
  }

  function saveCustomSettings() {
    try {
      global.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          schemes: state.schemes,
          provisiBasis: state.provisiBasis,
          fidusiaBasis: state.fidusiaBasis,
          bracketBasis: state.bracketBasis
        })
      );
    } catch (e) {
      // Abaikan
    }
  }

  // ======================== POPULATE SELECTS ========================
  function populateStaticDropdowns() {
    const elVehicleType = document.getElementById('inputVehicleType');
    elVehicleType.innerHTML = Config.VEHICLE_TYPES.map(
      (t) => `<option value="${t.value}">${t.label}</option>`
    ).join('');
    elVehicleType.value = state.vehicleType;

    const elBrand = document.getElementById('inputBrand');
    elBrand.innerHTML = Config.VEHICLE_BRANDS.map(
      (b) => `<option value="${b.value}">${b.label} (${b.origin})</option>`
    ).join('');
    elBrand.value = state.brandValue;

    const elFuel = document.getElementById('inputFuel');
    elFuel.innerHTML = Config.FUEL_TYPES.map(
      (f) => `<option value="${f.value}">${f.label}</option>`
    ).join('');
    elFuel.value = state.fuelValue;

    const elCoverage = document.getElementById('inputCoverage');
    elCoverage.innerHTML = Config.COVERAGE_OPTIONS.map(
      (c) => `<option value="${c.value}">${c.label}</option>`
    ).join('');
    elCoverage.value = state.coverageValue;
  }

  function renderPerilCheckboxes() {
    const container = document.getElementById('perilCheckboxesContainer');
    const covObj =
      Config.COVERAGE_OPTIONS.find((c) => c.value === state.coverageValue) ||
      Config.COVERAGE_OPTIONS[0];
    const year1Type = covObj.allRiskYears >= 1 ? 'All Risk' : 'TLO';

    container.innerHTML = Config.INSURANCE_PERILS.map((peril) => {
      const checked = state.selectedPerils.indexOf(peril.id) !== -1 ? 'checked' : '';
      const rAllRisk = peril.rates['All Risk'][state.wilayah];
      const rTlo = peril.rates['TLO'][state.wilayah];

      let badgeLabel = '';
      if (state.coverageValue === 'AllRisk') {
        badgeLabel = `AR ${formatPct(rAllRisk, 3)}`;
      } else if (state.coverageValue === 'TLO') {
        badgeLabel = `TLO ${formatPct(rTlo, 3)}`;
      } else {
        badgeLabel = `AR ${formatPct(rAllRisk, 3)} / TLO ${formatPct(rTlo, 3)}`;
      }

      return `
        <label class="peril-item">
          <span class="peril-left">
            <input type="checkbox" class="peril-checkbox" value="${peril.id}" ${checked} />
            <span>${peril.label}</span>
          </span>
          <span class="peril-rate-badge" title="Wilayah ${state.wilayah} (${year1Type})">${badgeLabel}</span>
        </label>
      `;
    }).join('');

    container.querySelectorAll('.peril-checkbox').forEach((cb) => {
      cb.addEventListener('change', () => {
        const checkedIds = [];
        container.querySelectorAll('.peril-checkbox:checked').forEach((el) => {
          checkedIds.push(el.value);
        });
        state.selectedPerils = checkedIds;
        recalculateAndRender();
      });
    });

    const btnAll = document.getElementById('btnSelectAllPerils');
    const allSelected = state.selectedPerils.length === Config.INSURANCE_PERILS.length;
    btnAll.textContent = allSelected ? 'Hapus Semua' : 'Pilih Semua';
  }

  // ======================== SCHEME SWITCHING ========================
  function applySchemeDefaults(schemeId, preserveDpIfHigher) {
    state.schemeId = schemeId;
    const scheme = state.schemes[schemeId] || Config.DEFAULT_SCHEMES.regular;

    state.adminFee = scheme.defaultAdmin;
    state.provisiPct = scheme.defaultProvisiPct;
    state.polisFee = scheme.defaultPolis;
    state.blokirFee =
      (scheme.defaultBlokirByFinancing &&
        scheme.defaultBlokirByFinancing[state.financingType]) ||
      0;

    document.getElementById('inputAdminFee').value = formatNumberId(state.adminFee);
    document.getElementById('inputProvisiPct').value = state.provisiPct
      .toFixed(2)
      .replace('.', ',');
    document.getElementById('inputPolisFee').value = formatNumberId(state.polisFee);
    document.getElementById('inputBlokirFee').value = formatNumberId(state.blokirFee);

    // Pastikan tenor terpilih tersedia di skema ini
    const allowedTenors =
      (scheme.tenorsByFinancing && scheme.tenorsByFinancing[state.financingType]) || [
        12, 24, 36, 48
      ];
    if (allowedTenors.indexOf(state.selectedTenor) === -1) {
      state.selectedTenor = allowedTenors[allowedTenors.length - 1] || 36;
    }

    // Sesuaikan DP ke minimal DP skema baru bila tidak sedang dipertahankan
    const minDpObj = Calc.calculateMinDP({
      schemeId: state.schemeId,
      financingType: state.financingType,
      vehicleType: state.vehicleType,
      brandValue: state.brandValue,
      fuelValue: state.fuelValue,
      vehiclePrice: state.vehiclePrice,
      schemes: state.schemes
    });

    if (!preserveDpIfHigher || state.dpPct < minDpObj.minDpPct) {
      state.dpPct = minDpObj.minDpPct;
      state.dpAmount = minDpObj.minDpAmount;
      syncDpInputField();
    }

    updateSchemeCardsUi();
    recalculateAndRender();
  }

  function updateSchemeCardsUi() {
    document.querySelectorAll('.scheme-card').forEach((card) => {
      const sId = card.getAttribute('data-scheme');
      card.classList.toggle('active', sId === state.schemeId);
    });

    // Update pill bunga terendah di tiap kartu skema
    ['regular', 'lnp', 'karyawan'].forEach((sId) => {
      const sch = state.schemes[sId];
      const rate12 = sch.interestRates[state.financingType]
        ? sch.interestRates[state.financingType][12]
        : 2.99;
      const elId =
        sId === 'regular'
          ? 'metaRateRegular'
          : sId === 'lnp'
          ? 'metaRateLnp'
          : 'metaRateKaryawan';
      const el = document.getElementById(elId);
      if (el) {
        el.textContent = `Bunga mulai ${formatPct(rate12, 2)}`;
      }
    });

    const activeScheme = state.schemes[state.schemeId];
    document.getElementById('activeSchemeSubtitle').textContent =
      `Skema Aktif: ${activeScheme.name} (${activeScheme.badge})`;
    document.getElementById('tableSchemeBadge').textContent = activeScheme.name;
  }

  function syncDpInputField() {
    const elInput = document.getElementById('inputDpValue');
    const addonLeft = document.getElementById('dpAddonLeft');
    const addonRight = document.getElementById('dpAddonRight');
    const wrap = document.getElementById('dpInputWrap');

    if (state.dpMode === 'pct') {
      wrap.className = 'input-suffix-wrap';
      addonLeft.style.display = 'none';
      addonRight.style.display = 'inline';
      const formattedPct =
        state.dpPct % 1 === 0
          ? String(state.dpPct)
          : state.dpPct.toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
      elInput.value = formattedPct;
    } else {
      wrap.className = 'input-prefix-wrap';
      addonLeft.style.display = 'inline';
      addonRight.style.display = 'none';
      elInput.value = formatNumberId(state.dpAmount);
    }

    document
      .getElementById('btnDpModePct')
      .classList.toggle('active', state.dpMode === 'pct');
    document
      .getElementById('btnDpModeRp')
      .classList.toggle('active', state.dpMode === 'rp');
  }

  // ======================== RENDERING OUTPUTS ========================
  function recalculateAndRender() {
    // Sinkronkan deskripsi Wilayah, Pembiayaan, Coverage
    const wilObj = Config.WILAYAH_OPTIONS.find((w) => w.value === state.wilayah);
    if (wilObj) {
      document.getElementById('wilayahDescription').textContent =
        `${wilObj.shortLabel} : ${wilObj.description}`;
    }

    const finObj = Config.FINANCING_TYPES.find((f) => f.value === state.financingType);
    if (finObj) {
      document.getElementById('financingDescription').textContent = finObj.description;
    }

    const covObj = Config.COVERAGE_OPTIONS.find((c) => c.value === state.coverageValue);
    if (covObj) {
      document.getElementById('coverageCriteriaText').innerHTML =
        `<strong>Kriteria ${covObj.label.split(' (')[0]}:</strong> ${covObj.criteria}`;
    }

    // Hitung Suite Lengkap
    const suite = Calc.calculateFullSuite({
      schemeId: state.schemeId,
      financingType: state.financingType,
      wilayah: state.wilayah,
      vehicleType: state.vehicleType,
      brandValue: state.brandValue,
      fuelValue: state.fuelValue,
      vehiclePrice: state.vehiclePrice,
      dpAmount: state.dpAmount,
      coverageValue: state.coverageValue,
      selectedPerils: state.selectedPerils,
      adminFee: state.adminFee,
      provisiPct: state.provisiPct,
      polisFee: state.polisFee,
      blokirFee: state.blokirFee,
      installmentType: state.installmentType,
      selectedTenor: state.selectedTenor,
      provisiBasis: state.provisiBasis,
      fidusiaBasis: state.fidusiaBasis,
      bracketBasis: state.bracketBasis,
      schemes: state.schemes
    });

    lastSuiteResult = suite;
    const active = suite.activeResult;
    const minDpInfo = suite.minDpInfo;

    // Update caption DP & validasi Minimal DP
    document.getElementById('dpConvertedCaption').innerHTML =
      `Nominal DP Murni: <strong>${formatRupiah(active.dpAmount)}</strong> (${formatPct(active.dpPct, 2)}) • Pokok Hutang: <strong>${formatRupiah(active.principalLoan)}</strong>`;

    const isBelowMin = Math.round(active.dpAmount) < Math.round(minDpInfo.minDpAmount);
    const dpMinBox = document.getElementById('dpMinBox');
    dpMinBox.classList.toggle('warning', isBelowMin);

    document.getElementById('dpMinText').innerHTML = isBelowMin
      ? `<strong>⚠ DP di bawah batas minimal ${formatPct(minDpInfo.minDpPct, 1)}</strong> (${formatRupiah(minDpInfo.minDpAmount)})`
      : `<strong>✓ Minimal DP: ${formatPct(minDpInfo.minDpPct, 1)}</strong> (${formatRupiah(minDpInfo.minDpAmount)})`;

    document.getElementById('dpFactorsList').innerHTML = minDpInfo.factors
      .map((f) => `<span class="dp-factor-tag">${f.label}: ${f.value}</span>`)
      .join('');

    // Update Provisi Rp & Fidusia di form kiri
    document.getElementById('provisiRpCaption').textContent =
      `= ${formatRupiah(active.creditFees.provisiAmount)} (${state.provisiBasis === 'price' ? 'dari Harga Kendaraan' : 'dari Pokok Hutang'})`;
    document.getElementById('fidusiaBracketInfo').textContent =
      `Nilai Penjaminan: ${active.creditFees.fidusiaBracket}`;
    document.getElementById('fidusiaFeeDisplay').textContent = formatRupiah(
      active.creditFees.fidusiaFee
    );

    // 1. Render KPI Cards
    document.getElementById('kpiTenorLabel').textContent =
      `Angsuran / Bulan (Tenor ${active.tenorMonths} Bln)`;
    document.getElementById('kpiMonthlyInstallment').textContent = formatRupiah(
      active.monthlyInstallment
    );
    document.getElementById('kpiRateInfo').textContent =
      `Bunga Flat ${formatPct(active.flatRatePa, 2)} p.a. (Setara ~${formatPct(active.effectiveRatePa, 2)} Efektif)`;

    document.getElementById('kpiTotalDp').textContent = formatRupiah(active.totalDp);
    document.getElementById('kpiTdpSub').textContent =
      active.installmentType === 'ADDM'
        ? 'DP + Asuransi + Biaya Kredit + Angsuran Ke-1 (ADDM)'
        : 'DP Murni + Premi Asuransi + Biaya Kredit';

    document.getElementById('kpiPrincipalLoan').textContent = formatRupiah(
      active.principalLoan
    );
    document.getElementById('kpiTotalInterestSub').textContent =
      `Total Bunga ${active.tenorMonths} Bln: ${formatRupiah(active.totalInterest)}`;

    // 2. Render Tabel Utama Tenor (12, 24, 36, 48, 60 bulan)
    renderTenorSummaryTable(suite.tenorResults, active.tenorMonths);

    // 3. Render Tabel Perbandingan 3 Skema
    document.getElementById('compTenorSpan').textContent = active.tenorMonths;
    renderSchemeComparisonTable(suite.schemeComparison, active.tenorMonths);

    // 4. Render Rincian Rumus TDP + Donut Chart + Tabel Asuransi Tahunan
    document.getElementById('detailTenorSpan').textContent = active.tenorMonths;
    renderTdpFormulaAndDonut(active);
    renderYearlyInsuranceTable(active.insurance);

    // 5. Render Tabel Amortisasi & Anotasi Bulanan + Grafik Progres
    document.getElementById('amortTenorSpan').textContent = active.tenorMonths;
    const amortRows = Calc.generateAmortizationSchedule(active, state.amortMode);
    renderAmortizationChart(amortRows, active);
    renderAmortizationTable(amortRows, active);
  }

  function renderTenorSummaryTable(tenorResults, selectedTenor) {
    const tbody = document.getElementById('tenorSummaryBody');
    tbody.innerHTML = tenorResults
      .map((row) => {
        const isSelected = row.tenorMonths === selectedTenor;
        const rowClass = [
          'tenor-row',
          isSelected ? 'selected' : '',
          !row.isAvailable ? 'unavailable' : ''
        ]
          .filter(Boolean)
          .join(' ');

        return `
          <tr class="${rowClass}" data-tenor="${row.tenorMonths}">
            <td>
              <span class="tenor-pill">
                ${row.tenorMonths} Bulan <span style="font-weight:500; color:var(--text-muted);">(${row.tenorYears} Thn)</span>
                ${isSelected ? '<span class="selected-tag">DIPILIH</span>' : ''}
                ${!row.isAvailable ? '<span class="cov-badge tlo">Di Luar Maks. Skema</span>' : ''}
              </span>
            </td>
            <td class="num">${formatPct(row.flatRatePa, 2)}</td>
            <td class="num">${formatRupiah(row.insurance.totalPremium)}</td>
            <td class="num">${formatRupiah(row.creditFees.totalCreditFees)}</td>
            <td class="num" style="font-weight:800; color:var(--bri-blue-dark);">${formatRupiah(row.monthlyInstallment)}</td>
            <td class="num" style="font-weight:800; color:var(--bri-orange-dark);">${formatRupiah(row.totalDp)}</td>
          </tr>
        `;
      })
      .join('');

    tbody.querySelectorAll('.tenor-row').forEach((tr) => {
      tr.addEventListener('click', () => {
        const t = parseInt(tr.getAttribute('data-tenor'), 10);
        if (t) {
          state.selectedTenor = t;
          recalculateAndRender();
        }
      });
    });
  }

  function renderSchemeComparisonTable(schemeCompRows) {
    const tbody = document.getElementById('schemeComparisonBody');
    tbody.innerHTML = schemeCompRows
      .map((item) => {
        const isCurrent = item.schemeId === state.schemeId;
        return `
          <tr class="${isCurrent ? 'selected' : ''}" style="${isCurrent ? 'background:var(--bri-blue-soft);' : ''}">
            <td>
              <strong>${item.schemeName}</strong>
              ${isCurrent ? '<span class="selected-tag" style="margin-left:6px;">AKTIF</span>' : ''}
            </td>
            <td class="num">${formatPct(item.flatRatePa, 2)}</td>
            <td class="num">${formatRupiah(item.creditFees.adminFee)}</td>
            <td class="num">${formatPct(item.creditFees.provisiPct, 2)} (${formatRupiah(item.creditFees.provisiAmount)})</td>
            <td class="num" style="font-weight:700;">${formatRupiah(item.monthlyInstallment)}</td>
            <td class="num" style="font-weight:700;">${formatRupiah(item.totalDp)}</td>
            <td class="num">
              ${
                isCurrent
                  ? '<span style="font-size:0.76rem; font-weight:700; color:var(--bri-blue);">Sedang Dipilih</span>'
                  : `<button type="button" class="btn btn-outline btn-xs btn-switch-scheme" data-scheme="${item.schemeId}">Gunakan</button>`
              }
            </td>
          </tr>
        `;
      })
      .join('');

    tbody.querySelectorAll('.btn-switch-scheme').forEach((btn) => {
      btn.addEventListener('click', () => {
        applySchemeDefaults(btn.getAttribute('data-scheme'), true);
      });
    });
  }

  function renderTdpFormulaAndDonut(active) {
    const fees = active.creditFees;
    const ins = active.insurance;

    // Render SVG Donut
    const segments = [
      { label: 'DP Murni', value: active.dpAmount, color: '#00529C' },
      { label: 'Premi Asuransi', value: ins.totalPremium, color: '#F36F21' },
      { label: 'Biaya Kredit', value: fees.totalCreditFees, color: '#0D9488' }
    ];
    if (active.firstInstallmentInTdp > 0) {
      segments.push({
        label: 'Angsuran Ke-1 (ADDM)',
        value: active.firstInstallmentInTdp,
        color: '#6366F1'
      });
    }

    const total = Math.max(1, active.totalDp);
    const radius = 62;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    const circlesSvg = segments
      .map((seg) => {
        const ratio = seg.value / total;
        const dash = ratio * circumference;
        const circle = `
          <circle
            cx="85" cy="85" r="${radius}"
            fill="transparent"
            stroke="${seg.color}"
            stroke-width="22"
            stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}"
            stroke-dashoffset="${(-offset).toFixed(2)}"
            transform="rotate(-90 85 85)"
          />
        `;
        offset += dash;
        return circle;
      })
      .join('');

    document.getElementById('tdpDonutSvgContainer').innerHTML = `
      <svg width="170" height="170" viewBox="0 0 170 170" role="img" aria-label="Komposisi Total DP">
        <circle cx="85" cy="85" r="${radius}" fill="transparent" stroke="#E2E8F0" stroke-width="22" />
        ${circlesSvg}
        <text x="85" y="80" text-anchor="middle" font-size="10" font-weight="700" fill="#64748B">TOTAL DP</text>
        <text x="85" y="97" text-anchor="middle" font-size="12" font-weight="800" fill="#0F172A">${
          active.totalDp >= 1000000
            ? (active.totalDp / 1000000).toFixed(1).replace('.', ',') + ' Jt'
            : formatRupiah(active.totalDp)
        }</text>
      </svg>
    `;

    document.getElementById('tdpDonutLegend').innerHTML = segments
      .map((seg) => {
        const pct = ((seg.value / total) * 100).toFixed(1).replace('.', ',');
        return `
          <div class="legend-row">
            <span class="legend-dot-wrap">
              <span class="legend-dot" style="background:${seg.color};"></span>
              <span>${seg.label}</span>
            </span>
            <span style="font-weight:700;">${pct}%</span>
          </div>
        `;
      })
      .join('');

    // Render Formula List
    const formulaHtml = `
      <div class="formula-item">
        <div class="formula-label">
          <strong>1. Uang Muka Murni (DP ${formatPct(active.dpPct, 2)})</strong>
          <small>Harga Kendaraan ${formatRupiah(active.vehiclePrice)} − Pokok Hutang ${formatRupiah(active.principalLoan)}</small>
        </div>
        <span class="formula-val">${formatRupiah(active.dpAmount)}</span>
      </div>

      <div class="formula-item">
        <div class="formula-label">
          <strong>2. Total Premi Asuransi (${active.tenorYears} Tahun — ${ins.coverage.label.split(' (')[0]})</strong>
          <small>Premi Dasar ${formatRupiah(ins.totalBasePremium)} + Perluasan Klaim ${formatRupiah(ins.totalPerilPremium)}</small>
        </div>
        <span class="formula-val">${formatRupiah(ins.totalPremium)}</span>
      </div>

      <div class="formula-item subtotal">
        <div class="formula-label">
          <strong>3. Total Biaya Kredit</strong>
          <small>
            Admin ${formatRupiah(fees.adminFee)} + Provisi ${formatRupiah(fees.provisiAmount)} + Polis ${formatRupiah(fees.polisFee)} + Fidusia ${formatRupiah(fees.fidusiaFee)} + Blokir BPKB ${formatRupiah(fees.blokirFee)}
          </small>
        </div>
        <span class="formula-val">${formatRupiah(fees.totalCreditFees)}</span>
      </div>

      ${
        active.firstInstallmentInTdp > 0
          ? `
        <div class="formula-item">
          <div class="formula-label">
            <strong>4. Angsuran Pertama (Skema ADDM)</strong>
            <small>Dibayar di muka bersamaan saat akad kredit</small>
          </div>
          <span class="formula-val">${formatRupiah(active.firstInstallmentInTdp)}</span>
        </div>
      `
          : ''
      }

      <div class="formula-item grandtotal">
        <div class="formula-label">
          <strong>TOTAL DOWN PAYMENT (TDP)</strong>
          <small>Rumus: DP + Asuransi + Biaya Kredit${active.firstInstallmentInTdp > 0 ? ' + Angsuran Ke-1' : ''}</small>
        </div>
        <span class="formula-val" style="color:var(--bri-orange-dark);">${formatRupiah(active.totalDp)}</span>
      </div>
    `;

    document.getElementById('formulaBreakdownList').innerHTML = formulaHtml;
  }

  function renderYearlyInsuranceTable(insurance) {
    const tbody = document.getElementById('yearlyInsuranceBody');
    const rowsHtml = insurance.yearlyBreakdown
      .map((yr) => {
        const badgeCls = yr.coverageType === 'All Risk' ? 'allrisk' : 'tlo';
        return `
          <tr>
            <td><strong>Tahun ke-${yr.year}</strong> <span style="color:var(--text-muted); font-size:0.75rem;">(Bln ${yr.monthRange})</span></td>
            <td><strong>${yr.depreciationPct}%</strong></td>
            <td class="num">${formatRupiah(yr.insuredValue)}</td>
            <td><span class="cov-badge ${badgeCls}">${yr.coverageType}</span></td>
            <td class="num">${formatPct(yr.baseRatePct, 2)} <span style="color:var(--text-muted); font-size:0.74rem;">(${formatRupiah(yr.basePremium)})</span></td>
            <td class="num">${formatPct(yr.perilRatePct, 3)} <span style="color:var(--text-muted); font-size:0.74rem;">(${formatRupiah(yr.perilPremium)})</span></td>
            <td class="num" style="font-weight:700;">${formatRupiah(yr.yearTotalPremium)}</td>
          </tr>
        `;
      })
      .join('');

    const footerRow = `
      <tr style="background:#f8fafc; font-weight:800;">
        <td colspan="4">TOTAL PREMI ASURANSI (${insurance.years} TAHUN)</td>
        <td class="num">${formatRupiah(insurance.totalBasePremium)}</td>
        <td class="num">${formatRupiah(insurance.totalPerilPremium)}</td>
        <td class="num" style="color:var(--bri-orange-dark);">${formatRupiah(insurance.totalPremium)}</td>
      </tr>
    `;

    tbody.innerHTML = rowsHtml + footerRow;
  }

  function renderAmortizationChart(amortRows, active) {
    const container = document.getElementById('amortChartContainer');
    if (!amortRows || amortRows.length === 0 || active.principalLoan <= 0) {
      container.innerHTML = '';
      return;
    }

    const w = 760;
    const h = 155;
    const padLeft = 56;
    const padRight = 20;
    const padTop = 16;
    const padBottom = 26;
    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    const maxVal = Math.max(active.totalLoanWithInterest, active.principalLoan, 1);
    const n = amortRows.length;

    function xAt(idx) {
      if (n <= 1) return padLeft + plotW;
      return padLeft + (idx / n) * plotW;
    }
    function yAt(val) {
      return padTop + plotH - (val / maxVal) * plotH;
    }

    // Kurva Sisa Pokok (mulai dari m=0 principalLoan sampai m=n 0)
    const balancePts = [`${xAt(0).toFixed(1)},${yAt(active.principalLoan).toFixed(1)}`];
    const paidPts = [`${xAt(0).toFixed(1)},${yAt(0).toFixed(1)}`];

    amortRows.forEach((r) => {
      balancePts.push(`${xAt(r.month).toFixed(1)},${yAt(r.endingBalance).toFixed(1)}`);
      paidPts.push(`${xAt(r.month).toFixed(1)},${yAt(r.cumulativePaid).toFixed(1)}`);
    });

    const areaBalance =
      `M ${xAt(0).toFixed(1)},${(padTop + plotH).toFixed(1)} L ` +
      balancePts.join(' L ') +
      ` L ${xAt(n).toFixed(1)},${(padTop + plotH).toFixed(1)} Z`;

    const yearTicks = [];
    for (let m = 12; m <= n; m += 12) {
      const x = xAt(m);
      yearTicks.push(`
        <line x1="${x.toFixed(1)}" y1="${padTop}" x2="${x.toFixed(1)}" y2="${padTop + plotH}" stroke="#E2E8F0" stroke-dasharray="3 3" />
        <text x="${x.toFixed(1)}" y="${h - 6}" text-anchor="middle" font-size="10" fill="#64748B">Bln ${m}</text>
      `);
    }

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-size:0.76rem; color:var(--text-secondary); flex-wrap:wrap; gap:8px;">
        <span><strong>Kurva Pelunasan Pokok vs Akumulasi Angsuran</strong> (Bulan 1 s.d. ${n})</span>
        <span style="display:inline-flex; gap:14px;">
          <span><span style="display:inline-block;width:10px;height:10px;background:#00529C;border-radius:2px;margin-right:5px;"></span>Sisa Pokok Pinjaman</span>
          <span><span style="display:inline-block;width:10px;height:10px;background:#0D9488;border-radius:2px;margin-right:5px;"></span>Akumulasi Angsuran Masuk</span>
        </span>
      </div>
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="155" role="img" aria-label="Grafik Kurva Amortisasi">
        <line x1="${padLeft}" y1="${padTop + plotH}" x2="${padLeft + plotW}" y2="${padTop + plotH}" stroke="#CBD5E1" />
        ${yearTicks.join('')}
        <text x="${padLeft - 6}" y="${padTop + 8}" text-anchor="end" font-size="9.5" fill="#64748B">${(maxVal / 1000000).toFixed(0)} Jt</text>
        <text x="${padLeft - 6}" y="${padTop + plotH}" text-anchor="end" font-size="9.5" fill="#64748B">0</text>
        <path d="${areaBalance}" fill="rgba(0, 82, 156, 0.10)" />
        <polyline fill="none" stroke="#00529C" stroke-width="2.4" points="${balancePts.join(' ')}" />
        <polyline fill="none" stroke="#0D9488" stroke-width="2.2" stroke-dasharray="5 3" points="${paidPts.join(' ')}" />
      </svg>
    `;
  }

  function renderAmortizationTable(amortRows, active) {
    document.getElementById('amortSubtitleInfo').textContent =
      state.amortMode === 'anuitas'
        ? `Metode Anuitas / Efektif Setara KPR (~${formatPct(active.effectiveRatePa, 2)} p.a.) • Porsi bunga menurun & pokok meningkat setiap bulan`
        : `Metode Proporsional Flat (${formatPct(active.flatRatePa, 2)} p.a.) • Porsi pokok & bunga merata setiap bulan`;

    const tbody = document.getElementById('amortizationBody');
    let totalPrin = 0;
    let totalInt = 0;
    let totalPmt = 0;

    const rowsHtml = amortRows
      .map((r) => {
        totalPrin += r.principalPart;
        totalInt += r.interestPart;
        totalPmt += r.installment;

        return `
          <tr class="row-${r.badgeType}">
            <td><strong>${r.month}</strong></td>
            <td class="num">${formatRupiah(r.beginningBalance)}</td>
            <td class="num" style="color:var(--bri-blue-dark); font-weight:600;">${formatRupiah(r.principalPart)}</td>
            <td class="num" style="color:var(--bri-orange-dark);">${formatRupiah(r.interestPart)}</td>
            <td class="num" style="font-weight:700;">${formatRupiah(r.installment)}</td>
            <td class="num">${formatRupiah(r.endingBalance)}</td>
            <td style="white-space:nowrap;">
              <span class="progress-mini"><span class="progress-mini-bar" style="width:${r.paidPct.toFixed(1)}%;"></span></span>
              <span style="font-size:0.74rem; font-weight:600;">${r.paidPct.toFixed(0)}%</span>
            </td>
            <td class="annot-cell">
              <span class="annot-dot"></span>${r.annotation}
            </td>
          </tr>
        `;
      })
      .join('');

    const summaryRow = `
      <tr style="background:#f1f5f9; font-weight:800;">
        <td>TOTAL</td>
        <td class="num">-</td>
        <td class="num">${formatRupiah(totalPrin)}</td>
        <td class="num">${formatRupiah(totalInt)}</td>
        <td class="num">${formatRupiah(totalPmt)}</td>
        <td class="num">Rp 0</td>
        <td>100%</td>
        <td>Akumulasi ${amortRows.length} Bulan Angsuran</td>
      </tr>
    `;

    tbody.innerHTML = rowsHtml + summaryRow;
  }

  // ======================== MODAL TABEL REFERENSI & EDITOR RATE ========================
  function renderModalTabContent() {
    const box = document.getElementById('refModalContent');
    const tab = state.activeModalTab;

    if (tab === 'tabRates') {
      const fin = state.financingType;
      const cardsHtml = ['regular', 'lnp', 'karyawan']
        .map((sId) => {
          const sch = state.schemes[sId];
          const rates = sch.interestRates[fin];
          const tenorInputs = [12, 24, 36, 48, 60]
            .map(
              (t) => `
              <div class="mini-rate-row">
                <span>Tenor ${t} Bln (% Flat p.a.)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="35"
                  class="mini-rate-input js-scheme-rate-input"
                  data-scheme="${sId}"
                  data-tenor="${t}"
                  value="${rates[t]}"
                />
              </div>
            `
            )
            .join('');

          return `
            <div class="rate-edit-card">
              <h4>${sch.name}</h4>
              <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:10px;">Jenis Pembiayaan: <strong>${fin}</strong></div>
              ${tenorInputs}
              <hr style="border:none; border-top:1px solid var(--border-color); margin:10px 0;" />
              <div class="mini-rate-row">
                <span>Default Admin (Rp)</span>
                <input type="number" step="50000" min="0" class="mini-rate-input js-scheme-admin-input" style="width:115px;" data-scheme="${sId}" value="${sch.defaultAdmin}" />
              </div>
              <div class="mini-rate-row">
                <span>Default Provisi (%)</span>
                <input type="number" step="0.05" min="0" max="10" class="mini-rate-input js-scheme-prov-input" data-scheme="${sId}" value="${sch.defaultProvisiPct}" />
              </div>
            </div>
          `;
        })
        .join('');

      box.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
          <p style="margin:0; font-size:0.84rem; color:var(--text-secondary);">
            Sesuaikan Suku Bunga Flat p.a. untuk kategori <strong>${fin}</strong> serta basis rumus jika terdapat penyesuaian kebijakan cabang/program promo BRI.
          </p>
          <button type="button" class="btn btn-outline btn-xs" id="btnResetDefaultRates">Kembalikan Rate Default</button>
        </div>
        <div class="rate-edit-grid">${cardsHtml}</div>

        <div class="form-section-divider" style="margin-top:22px;">Pengaturan Basis Rumus Perhitungan</div>
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label" for="selProvisiBasis">Basis Biaya Provisi (Rp)</label>
            <select id="selProvisiBasis" class="select-control">
              <option value="price" ${state.provisiBasis === 'price' ? 'selected' : ''}>Biaya Provisi (%) × Harga Kendaraan (Sesuai Spesifikasi)</option>
              <option value="principal" ${state.provisiBasis === 'principal' ? 'selected' : ''}>Biaya Provisi (%) × Pokok Hutang</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="selFidusiaBasis">Basis Nilai Penjaminan Fidusia</label>
            <select id="selFidusiaBasis" class="select-control">
              <option value="price" ${state.fidusiaBasis === 'price' ? 'selected' : ''}>Rentang Harga Kendaraan (Sesuai Spesifikasi)</option>
              <option value="principal" ${state.fidusiaBasis === 'principal' ? 'selected' : ''}>Rentang Pokok Hutang</option>
            </select>
          </div>
        </div>
      `;

      box.querySelectorAll('.js-scheme-rate-input').forEach((inp) => {
        inp.addEventListener('change', () => {
          const sId = inp.getAttribute('data-scheme');
          const t = parseInt(inp.getAttribute('data-tenor'), 10);
          const v = Math.max(0, parseFloat(inp.value) || 0);
          state.schemes[sId].interestRates[state.financingType][t] = v;
          saveCustomSettings();
          updateSchemeCardsUi();
          recalculateAndRender();
        });
      });

      box.querySelectorAll('.js-scheme-admin-input').forEach((inp) => {
        inp.addEventListener('change', () => {
          const sId = inp.getAttribute('data-scheme');
          const v = Math.max(0, parseInt(inp.value, 10) || 0);
          state.schemes[sId].defaultAdmin = v;
          if (sId === state.schemeId) {
            state.adminFee = v;
            document.getElementById('inputAdminFee').value = formatNumberId(v);
          }
          saveCustomSettings();
          recalculateAndRender();
        });
      });

      box.querySelectorAll('.js-scheme-prov-input').forEach((inp) => {
        inp.addEventListener('change', () => {
          const sId = inp.getAttribute('data-scheme');
          const v = Math.max(0, parseFloat(inp.value) || 0);
          state.schemes[sId].defaultProvisiPct = v;
          if (sId === state.schemeId) {
            state.provisiPct = v;
            document.getElementById('inputProvisiPct').value = v.toFixed(2).replace('.', ',');
          }
          saveCustomSettings();
          recalculateAndRender();
        });
      });

      document.getElementById('selProvisiBasis').addEventListener('change', (e) => {
        state.provisiBasis = e.target.value;
        saveCustomSettings();
        recalculateAndRender();
      });

      document.getElementById('selFidusiaBasis').addEventListener('change', (e) => {
        state.fidusiaBasis = e.target.value;
        saveCustomSettings();
        recalculateAndRender();
      });

      document.getElementById('btnResetDefaultRates').addEventListener('click', () => {
        state.schemes = cloneDeep(Config.DEFAULT_SCHEMES);
        state.provisiBasis = 'price';
        state.fidusiaBasis = 'price';
        state.bracketBasis = 'depreciated';
        saveCustomSettings();
        applySchemeDefaults(state.schemeId, false);
        renderModalTabContent();
      });
    } else if (tab === 'tabInsBase') {
      box.innerHTML = `
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Tipe Kendaraan</th>
                <th>Wilayah</th>
                <th class="num">Rentang Harga Dari</th>
                <th class="num">Sampai Dengan</th>
                <th class="num">Rate TLO</th>
                <th class="num">Rate All Risk</th>
              </tr>
            </thead>
            <tbody>
              ${Config.INSURANCE_BASE_RATES.map(
                (r) => `
                <tr>
                  <td><strong>${r.type}</strong></td>
                  <td>Wilayah ${r.wilayah}</td>
                  <td class="num">${r.from === 0 ? '-' : formatRupiah(r.from)}</td>
                  <td class="num">${formatRupiah(r.to)}</td>
                  <td class="num">${formatPct(r.tlo, 2)}</td>
                  <td class="num">${formatPct(r.allRisk, 2)}</td>
                </tr>
              `
              ).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else if (tab === 'tabInsPeril') {
      const perilRows = [];
      ['All Risk', 'TLO'].forEach((cov) => {
        Config.INSURANCE_PERILS.forEach((p) => {
          ['1', '2', '3'].forEach((w) => {
            perilRows.push(`
              <tr>
                <td>${p.codePrefix}${w}</td>
                <td><span class="cov-badge ${cov === 'All Risk' ? 'allrisk' : 'tlo'}">${cov}</span></td>
                <td>${p.codePrefix}${w}${cov}</td>
                <td class="num"><strong>${formatPct(p.rates[cov][w], 3)}</strong></td>
              </tr>
            `);
          });
        });
      });

      const depRows = Object.keys(Config.DEPRECIATION_BY_YEAR)
        .map((yr) => {
          const d = Config.DEPRECIATION_BY_YEAR[yr];
          return `
            <tr>
              <td>Tahun ke-${yr} (${d.tenorMonths} Bulan)</td>
              <td class="num"><strong>${d.ratePct}%</strong> dari Harga Kendaraan</td>
            </tr>
          `;
        })
        .join('');

      box.innerHTML = `
        <div class="form-section-divider">Tabel Depresiasi Nilai Pertanggungan Asuransi</div>
        <div class="table-wrap" style="margin-bottom:20px;">
          <table class="data-table">
            <thead>
              <tr><th>Tenor / Tahun Berjalan</th><th class="num">Persentase Nilai Pertanggungan</th></tr>
            </thead>
            <tbody>${depRows}</tbody>
          </table>
        </div>

        <div class="form-section-divider">Tabel Syarat Klaim / Perluasan Risiko</div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>Jenis Perluasan &amp; Wilayah</th><th>Coverage</th><th>Kode Lookup</th><th class="num">Rate Tambahan</th></tr>
            </thead>
            <tbody>${perilRows.join('')}</tbody>
          </table>
        </div>
      `;
    } else if (tab === 'tabFidusia') {
      box.innerHTML = `
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Rentang Nilai Penjaminan</th>
                <th class="num">Dari</th>
                <th class="num">Sampai Dengan</th>
                <th class="num">Biaya Netto Fidusia</th>
              </tr>
            </thead>
            <tbody>
              ${Config.FIDUSIA_TABLE.map(
                (f) => `
                <tr>
                  <td><strong>${f.label}</strong></td>
                  <td class="num">${f.from === 0 ? '-' : formatRupiah(f.from)}</td>
                  <td class="num">${f.to === Infinity ? 'Tak Terbatas' : formatRupiah(f.to)}</td>
                  <td class="num" style="font-weight:700; color:var(--bri-blue-dark);">${formatRupiah(f.fee)}</td>
                </tr>
              `
              ).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  // ======================== CSV EXPORT ========================
  function exportSimulationToCsv() {
    if (!lastSuiteResult) return;
    const active = lastSuiteResult.activeResult;
    const amortRows = Calc.generateAmortizationSchedule(active, state.amortMode);

    const lines = [
      ['SIMULASI KALKULATOR BRI KKB DEBITUR'],
      ['Skema Produk', active.schemeName],
      ['Wilayah', `Wilayah ${state.wilayah}`],
      ['Jenis Pembiayaan', state.financingType],
      ['Tipe Kendaraan', state.vehicleType],
      ['Harga Kendaraan', active.vehiclePrice],
      ['Down Payment Murni (Rp)', active.dpAmount],
      ['Down Payment (%)', active.dpPct.toFixed(2) + '%'],
      ['Pokok Hutang', active.principalLoan],
      ['Asuransi Coverage', state.coverageValue],
      ['Total Premi Asuransi', active.insurance.totalPremium],
      ['Biaya Admin', active.creditFees.adminFee],
      ['Biaya Provisi', active.creditFees.provisiAmount],
      ['Biaya Polis', active.creditFees.polisFee],
      ['Biaya Fidusia', active.creditFees.fidusiaFee],
      ['Biaya Blokir BPKB', active.creditFees.blokirFee],
      ['Total Biaya Kredit', active.creditFees.totalCreditFees],
      ['Total Down Payment (TDP)', active.totalDp],
      ['Tenor Dipilih (Bulan)', active.tenorMonths],
      ['Suku Bunga Flat p.a.', active.flatRatePa.toFixed(2) + '%'],
      ['Angsuran per Bulan', active.monthlyInstallment],
      [],
      ['TABEL PERBANDINGAN TENOR'],
      ['Tenor (Bulan)', 'Suku Bunga Flat', 'Total Asuransi', 'Biaya Kredit', 'Angsuran per Bulan', 'Total DP (TDP)']
    ];

    lastSuiteResult.tenorResults.forEach((r) => {
      lines.push([
        r.tenorMonths,
        r.flatRatePa.toFixed(2) + '%',
        r.insurance.totalPremium,
        r.creditFees.totalCreditFees,
        r.monthlyInstallment,
        r.totalDp
      ]);
    });

    lines.push([]);
    lines.push([`JADWAL AMORTISASI & ANOTASI PER BULAN (${state.amortMode.toUpperCase()})`]);
    lines.push([
      'Bulan Ke',
      'Pinjaman Awal',
      'Porsi Pokok',
      'Porsi Bunga',
      'Total Angsuran',
      'Sisa Pokok',
      'Progres (%)',
      'Anotasi'
    ]);

    amortRows.forEach((r) => {
      lines.push([
        r.month,
        r.beginningBalance,
        r.principalPart,
        r.interestPart,
        r.installment,
        r.endingBalance,
        r.paidPct.toFixed(2) + '%',
        `"${r.annotation.replace(/"/g, '""')}"`
      ]);
    });

    const csvContent = '\uFEFF' + lines.map((row) => row.join(';')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Simulasi_BRI_KKB_${state.schemeId}_${active.tenorMonths}bln.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ======================== EVENT BINDINGS ========================
  function bindEvents() {
    // Klik Kartu 3 Skema (BRI KKB Regular / LNP / Karyawan)
    document.querySelectorAll('.scheme-card').forEach((card) => {
      card.addEventListener('click', () => {
        const sId = card.getAttribute('data-scheme');
        applySchemeDefaults(sId, false);
      });
    });

    // Wilayah
    document.getElementById('inputWilayah').addEventListener('change', (e) => {
      state.wilayah = e.target.value;
      renderPerilCheckboxes();
      recalculateAndRender();
    });

    // Jenis Pembiayaan
    document.getElementById('inputFinancingType').addEventListener('change', (e) => {
      state.financingType = e.target.value;
      const sch = state.schemes[state.schemeId];
      state.blokirFee =
        (sch.defaultBlokirByFinancing && sch.defaultBlokirByFinancing[state.financingType]) || 0;
      document.getElementById('inputBlokirFee').value = formatNumberId(state.blokirFee);

      const allowed = sch.tenorsByFinancing[state.financingType] || [12, 24, 36, 48];
      if (allowed.indexOf(state.selectedTenor) === -1) {
        state.selectedTenor = allowed[allowed.length - 1];
      }

      updateSchemeCardsUi();
      recalculateAndRender();
    });

    // Tipe, Merk, Bahan Bakar
    document.getElementById('inputVehicleType').addEventListener('change', (e) => {
      state.vehicleType = e.target.value;
      recalculateAndRender();
    });

    document.getElementById('inputBrand').addEventListener('change', (e) => {
      state.brandValue = e.target.value;
      recalculateAndRender();
    });

    document.getElementById('inputFuel').addEventListener('change', (e) => {
      state.fuelValue = e.target.value;
      recalculateAndRender();
    });

    // Harga Kendaraan + Preset Chips
    const elPrice = document.getElementById('inputVehiclePrice');
    elPrice.addEventListener('input', () => {
      const val = parseDigits(elPrice.value);
      state.vehiclePrice = val;
      elPrice.value = val > 0 ? formatNumberId(val) : '';

      if (state.dpMode === 'pct') {
        state.dpAmount = Math.round((state.vehiclePrice * state.dpPct) / 100);
      } else {
        state.dpPct = state.vehiclePrice > 0 ? (state.dpAmount / state.vehiclePrice) * 100 : 0;
      }
      recalculateAndRender();
    });

    document.querySelectorAll('.chip-btn[data-price]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const val = parseInt(chip.getAttribute('data-price'), 10);
        state.vehiclePrice = val;
        elPrice.value = formatNumberId(val);
        if (state.dpMode === 'pct') {
          state.dpAmount = Math.round((state.vehiclePrice * state.dpPct) / 100);
        } else {
          state.dpPct = state.vehiclePrice > 0 ? (state.dpAmount / state.vehiclePrice) * 100 : 0;
        }
        recalculateAndRender();
      });
    });

    // Mode DP (% vs Rp) & Input DP
    document.getElementById('btnDpModePct').addEventListener('click', () => {
      state.dpMode = 'pct';
      syncDpInputField();
    });

    document.getElementById('btnDpModeRp').addEventListener('click', () => {
      state.dpMode = 'rp';
      syncDpInputField();
    });

    const elDp = document.getElementById('inputDpValue');
    elDp.addEventListener('input', () => {
      if (state.dpMode === 'pct') {
        const pct = Math.min(95, Math.max(0, parseDecimalId(elDp.value)));
        state.dpPct = pct;
        state.dpAmount = Math.round((state.vehiclePrice * pct) / 100);
      } else {
        const rp = Math.min(state.vehiclePrice, parseDigits(elDp.value));
        state.dpAmount = rp;
        state.dpPct = state.vehiclePrice > 0 ? (rp / state.vehiclePrice) * 100 : 0;
        elDp.value = rp > 0 ? formatNumberId(rp) : '';
      }
      recalculateAndRender();
    });

    document.getElementById('btnApplyMinDp').addEventListener('click', () => {
      if (!lastSuiteResult) return;
      state.dpPct = lastSuiteResult.minDpInfo.minDpPct;
      state.dpAmount = lastSuiteResult.minDpInfo.minDpAmount;
      syncDpInputField();
      recalculateAndRender();
    });

    // Coverage & Perluasan
    document.getElementById('inputCoverage').addEventListener('change', (e) => {
      state.coverageValue = e.target.value;
      renderPerilCheckboxes();
      recalculateAndRender();
    });

    document.getElementById('btnSelectAllPerils').addEventListener('click', () => {
      if (state.selectedPerils.length === Config.INSURANCE_PERILS.length) {
        state.selectedPerils = [];
      } else {
        state.selectedPerils = Config.INSURANCE_PERILS.map((p) => p.id);
      }
      renderPerilCheckboxes();
      recalculateAndRender();
    });

    // Biaya Admin, Provisi %, Polis, Blokir BPKB, Tipe Angsuran
    function bindRupiahInput(id, stateKey) {
      const el = document.getElementById(id);
      el.addEventListener('input', () => {
        const v = parseDigits(el.value);
        state[stateKey] = v;
        el.value = v > 0 ? formatNumberId(v) : '0';
        recalculateAndRender();
      });
    }

    bindRupiahInput('inputAdminFee', 'adminFee');
    bindRupiahInput('inputPolisFee', 'polisFee');
    bindRupiahInput('inputBlokirFee', 'blokirFee');

    const elProv = document.getElementById('inputProvisiPct');
    elProv.addEventListener('input', () => {
      state.provisiPct = Math.min(20, Math.max(0, parseDecimalId(elProv.value)));
      recalculateAndRender();
    });

    document.getElementById('inputInstallmentType').addEventListener('change', (e) => {
      state.installmentType = e.target.value;
      recalculateAndRender();
    });

    // Mode Tabel Amortisasi (Anuitas KPR vs Flat)
    document.getElementById('btnAmortAnuitas').addEventListener('click', () => {
      state.amortMode = 'anuitas';
      document.getElementById('btnAmortAnuitas').classList.add('active');
      document.getElementById('btnAmortFlat').classList.remove('active');
      recalculateAndRender();
    });

    document.getElementById('btnAmortFlat').addEventListener('click', () => {
      state.amortMode = 'flat';
      document.getElementById('btnAmortFlat').classList.add('active');
      document.getElementById('btnAmortAnuitas').classList.remove('active');
      recalculateAndRender();
    });

    // Reset Form
    document.getElementById('btnResetForm').addEventListener('click', () => {
      state.wilayah = '2';
      state.financingType = 'New Car';
      state.vehicleType = 'Non Bus dan Non Truk';
      state.brandValue = 'toyota';
      state.fuelValue = 'bensin';
      state.vehiclePrice = 350000000;
      state.dpMode = 'pct';
      state.coverageValue = 'Kombinasi#1';
      state.selectedPerils = ['banjir'];
      state.installmentType = 'ADDB';
      state.selectedTenor = 36;

      document.getElementById('inputWilayah').value = state.wilayah;
      document.getElementById('inputFinancingType').value = state.financingType;
      document.getElementById('inputVehicleType').value = state.vehicleType;
      document.getElementById('inputBrand').value = state.brandValue;
      document.getElementById('inputFuel').value = state.fuelValue;
      document.getElementById('inputVehiclePrice').value = formatNumberId(state.vehiclePrice);
      document.getElementById('inputCoverage').value = state.coverageValue;
      document.getElementById('inputInstallmentType').value = state.installmentType;

      renderPerilCheckboxes();
      applySchemeDefaults('regular', false);
    });

    // Header Actions: Modal, CSV, Print
    const modal = document.getElementById('refModalBackdrop');
    document.getElementById('btnOpenRefModal').addEventListener('click', () => {
      renderModalTabContent();
      modal.classList.add('open');
    });

    document.getElementById('btnCloseRefModal').addEventListener('click', () => {
      modal.classList.remove('open');
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });

    document.querySelectorAll('.modal-tab').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        document.querySelectorAll('.modal-tab').forEach((b) => b.classList.remove('active'));
        tabBtn.classList.add('active');
        state.activeModalTab = tabBtn.getAttribute('data-tab');
        renderModalTabContent();
      });
    });

    document.getElementById('btnExportCsv').addEventListener('click', exportSimulationToCsv);
    document.getElementById('btnPrintPdf').addEventListener('click', () => {
      global.print();
    });
  }

  // ======================== INIT ========================
  function init() {
    loadSavedSettings();
    populateStaticDropdowns();
    renderPerilCheckboxes();
    bindEvents();
    applySchemeDefaults(state.schemeId, false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
