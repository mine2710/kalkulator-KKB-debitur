/**
 * Controller UI Interaktif Kalkulator BRI KKB Debitur
 * Fokus pada tampilan tabel responsif sesuai resolusi layar
 */
(function (global) {
  'use strict';

  const Config = global.KKBConfig;
  const Calc = global.KKBCalculator;

  const STORAGE_KEY = 'bri_kkb_custom_settings_v2';
  const SCHEME_IDS = ['regular', 'lnp', 'karyawan'];
  const TENORS = [12, 24, 36, 48, 60];

  function cloneDeep(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // State Aplikasi
  const state = {
    schemeId: 'regular',
    wilayah: '2',
    financingType: 'New Car',
    vehicleType: 'Non Bus dan Non Truk',
    brandValue: 'TOYOTA',
    modelValue: 'AVANZA',
    vehiclePrice: 350000000,
    dpMode: 'pct',
    dpPct: 20,
    dpAmount: 70000000,
    coverageValue: 'Kombinasi#1',
    selectedPerils: ['banjir'],
    adminFee: 2000000,
    provisiPct: 1.0,
    polisFee: 60000,
    blokirFee: 500000,
    installmentType: 'ADDB',
    selectedTenor: 36,
    activeModalTab: 'tabRates',
    modalFinancing: 'all',
    modalWilayah: 'all',
    provisiBasis: 'principal',
    fidusiaBasis: 'price',
    bracketBasis: 'depreciated',
    isCreditFeesCollapsed: true,
    schemes: cloneDeep(Config.DEFAULT_SCHEMES)
  };

  let lastSuiteResult = null;

  const $ = (id) => document.getElementById(id);

  // ======================== FORMATTERS ========================
  function formatNumberId(num) {
    const rounded = Math.round(Number(num) || 0);
    return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function formatRupiah(num) {
    const val = Math.round(Number(num) || 0);
    return (val < 0 ? '-Rp ' : 'Rp ') + formatNumberId(Math.abs(val));
  }

  function formatPct(num, decimals) {
    const d = decimals !== undefined ? decimals : 2;
    return (Number(num) || 0).toFixed(d).replace('.', ',') + '%';
  }

  function parseDigits(str) {
    const cleaned = String(str || '').replace(/[^\d]/g, '');
    return cleaned ? parseInt(cleaned, 10) : 0;
  }

  function parseDecimalId(str) {
    const normalized = String(str || '')
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
      if (saved.schemes) state.schemes = saved.schemes;
      if (saved.provisiBasis) state.provisiBasis = saved.provisiBasis;
      if (saved.fidusiaBasis) state.fidusiaBasis = saved.fidusiaBasis;
      if (saved.bracketBasis) state.bracketBasis = saved.bracketBasis;
    } catch (e) {
      // localStorage tidak tersedia
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
      // abaikan
    }
  }

  // ======================== DROPDOWNS & CHECKBOXES ========================
  function syncVehicleTypeFromFinancing() {
    state.vehicleType =
      (Config.VEHICLE_TYPE_BY_FINANCING && Config.VEHICLE_TYPE_BY_FINANCING[state.financingType]) ||
      'Non Bus dan Non Truk';
  }

  function populateStaticDropdowns() {
    syncVehicleTypeFromFinancing();

    if (!global.KKBVehicles.brands.includes(state.brandValue)) {
      state.brandValue = global.KKBVehicles.brands[0];
    }
    $('inputBrand').replaceChildren(...global.KKBVehicles.brands.map(
      (brand) => new Option(brand, brand)
    ));
    $('inputBrand').value = state.brandValue;
    populateModels();

    $('inputCoverage').innerHTML = Config.COVERAGE_OPTIONS.map(
      (c) => `<option value="${c.value}">${c.label}</option>`
    ).join('');
    $('inputCoverage').value = state.coverageValue;
  }

  function populateModels() {
    const models = global.KKBVehicles.modelsFor(state.brandValue);
    if (!models.some((row) => row.model === state.modelValue)) state.modelValue = models[0].model;
    $('inputModel').replaceChildren(...models.map((row) => new Option(row.model, row.model)));
    $('inputModel').value = state.modelValue;
  }

  function applyMinimumDp() {
    const minimum = getMinDp();
    state.dpPct = minimum.minDpPct;
    state.dpAmount = minimum.minDpAmount;
    syncDpInputField();
  }

  function renderPerilCheckboxes() {
    const container = $('perilCheckboxesContainer');

    container.innerHTML = Config.INSURANCE_PERILS.map((peril) => {
      const isChecked = state.selectedPerils.indexOf(peril.id) !== -1;

      return `
        <label class="peril-item ${isChecked ? 'checked' : ''}">
          <span class="peril-left">
            <input type="checkbox" class="peril-checkbox" value="${peril.id}" ${isChecked ? 'checked' : ''} />
            <span>${peril.label}</span>
          </span>
        </label>
      `;
    }).join('');

    container.querySelectorAll('.peril-checkbox').forEach((cb) => {
      cb.addEventListener('change', () => {
        state.selectedPerils = Array.from(
          container.querySelectorAll('.peril-checkbox:checked')
        ).map((el) => el.value);
        cb.closest('.peril-item').classList.toggle('checked', cb.checked);
        updateSelectAllLabel();
        recalculateAndRender();
      });
    });

    updateSelectAllLabel();
  }

  function updateSelectAllLabel() {
    const all = state.selectedPerils.length === Config.INSURANCE_PERILS.length;
    $('btnSelectAllPerils').textContent = all ? 'Hapus Semua' : 'Pilih Semua';
  }

  // ======================== SKEMA & DP ========================
  function getMinDp() {
    return Calc.calculateMinDP({
      schemeId: state.schemeId,
      financingType: state.financingType,
      vehicleType: state.vehicleType,
      brandValue: state.brandValue,
      modelValue: state.modelValue,
      vehiclePrice: state.vehiclePrice,
      schemes: state.schemes
    });
  }

  function ensureTenorAllowed() {
    const sch = state.schemes[state.schemeId];
    const allowed = (sch.tenorsByFinancing && sch.tenorsByFinancing[state.financingType]) || TENORS;
    if (allowed.indexOf(state.selectedTenor) === -1) {
      state.selectedTenor = allowed[allowed.length - 1] || 36;
    }
  }

  function applySchemeDefaults(schemeId) {
    state.schemeId = schemeId;
    syncVehicleTypeFromFinancing();
    const scheme = state.schemes[schemeId] || Config.DEFAULT_SCHEMES.regular;

    state.adminFee = scheme.defaultAdmin;
    state.provisiPct = scheme.defaultProvisiPct;
    state.polisFee = scheme.defaultPolis;
    state.blokirFee =
      scheme.defaultBlokirByFinancing &&
      scheme.defaultBlokirByFinancing[state.financingType] !== undefined
        ? scheme.defaultBlokirByFinancing[state.financingType]
        : 500000;

    $('inputAdminFee').value = formatNumberId(state.adminFee);
    $('inputProvisiPct').value = state.provisiPct.toFixed(2).replace('.', ',');
    $('inputPolisFee').value = formatNumberId(state.polisFee);
    $('inputBlokirFee').value = formatNumberId(state.blokirFee);

    ensureTenorAllowed();

    if (!lastSuiteResult) applyMinimumDp();

    updateSchemeUi();
    recalculateAndRender();
  }

  function updateSchemeUi() {
    document.querySelectorAll('.scheme-btn').forEach((btn) => {
      const selected = btn.getAttribute('data-scheme') === state.schemeId;
      btn.classList.toggle('active', selected);
      btn.setAttribute('aria-pressed', String(selected));
    });

    const metaIds = { regular: 'metaRegular', lnp: 'metaLnp', karyawan: 'metaKaryawan' };
    SCHEME_IDS.forEach((sId) => {
      const sch = state.schemes[sId];
      const rates = sch.interestRates[state.financingType] || {};
      const minRate = Math.min.apply(null, Object.values(rates));
      $(metaIds[sId]).textContent = `${sch.badge} • bunga mulai ${formatPct(minRate)}`;
    });

    const active = state.schemes[state.schemeId];
    $('activeSchemeSubtitle').textContent = `${active.name} • ${state.financingType}`;
    $('tableSchemeBadge').textContent = active.name;
  }

  function syncDpInputField() {
    const elInput = $('inputDpValue');
    const wrap = $('dpInputWrap');
    const isPct = state.dpMode === 'pct';

    wrap.className = 'input-group ' + (isPct ? 'has-right' : 'has-left');
    $('dpAddonLeft').hidden = isPct;
    $('dpAddonRight').hidden = !isPct;

    if (isPct) {
      elInput.value =
        state.dpPct % 1 === 0
          ? String(state.dpPct)
          : state.dpPct.toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
    } else {
      elInput.value = formatNumberId(state.dpAmount);
    }

    $('btnDpModePct').classList.toggle('active', isPct);
    $('btnDpModeRp').classList.toggle('active', !isPct);
  }

  // ======================== RENDERING UTAMA ========================
  function recalculateAndRender() {
    const covObj = Config.COVERAGE_OPTIONS.find((c) => c.value === state.coverageValue);
    if (covObj) {
      $('coverageCriteriaText').textContent = covObj.criteria;
      $('insSubtitleBadge').textContent = `${covObj.label} • Wilayah ${state.wilayah} • ${state.vehicleType}`;
    }

    const suite = Calc.calculateFullSuite({
      schemeId: state.schemeId,
      financingType: state.financingType,
      wilayah: state.wilayah,
      vehicleType: state.vehicleType,
      brandValue: state.brandValue,
      modelValue: state.modelValue,
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
    const minDp = suite.minDpInfo;

    // Info DP
    $('dpConvertedCaption').innerHTML =
      `DP Murni <strong>${formatRupiah(active.dpAmount)}</strong> (${formatPct(active.dpPct, 1)}) • Pokok Hutang <strong>${formatRupiah(active.principalLoan)}</strong>`;

    const isBelowMin = Math.round(active.dpAmount) < Math.round(minDp.minDpAmount);
    $('simulationNotice').hidden = !isBelowMin;
    $('simulationNotice').textContent = 'DP yang diisi belum memenuhi minimum kendaraan. Hasil ini hanya ilustrasi; gunakan tombol Pakai Min untuk menyesuaikan.';
    $('inputDpValue').setAttribute('aria-invalid', String(isBelowMin));
    $('dpMinBox').classList.toggle('warning', isBelowMin);
    $('dpMinText').innerHTML = isBelowMin
      ? `<strong>⚠ Di bawah minimal ${formatPct(minDp.minDpPct, 1)}</strong> (${formatRupiah(minDp.minDpAmount)})`
      : `<strong>✓ Minimal DP ${formatPct(minDp.minDpPct, 1)}</strong> (${formatRupiah(minDp.minDpAmount)})`;
    $('dpFactorsList').textContent = minDp.factors.map((f) => `${f.label} ${f.value}`).join(' • ');
    $('btnApplyMinDp').hidden = !isBelowMin && Math.abs(active.dpPct - minDp.minDpPct) < 0.01;

    // Info Biaya Provisi & Fidusia
    $('provisiRpCaption').textContent =
      `Provisi = ${formatRupiah(active.creditFees.provisiAmount)} (${formatPct(state.provisiPct)} × ${state.provisiBasis === 'price' ? 'Harga Kendaraan' : 'Pokok Hutang'})`;
    $('fidusiaBracketInfo').textContent = active.creditFees.fidusiaBracket;
    $('fidusiaFeeDisplay').textContent = formatRupiah(active.creditFees.fidusiaFee);

    // KPI Cards
    $('kpiTenorLabel').textContent = `Angsuran / Bulan • Tenor ${active.tenorMonths} Bln`;
    $('kpiMonthlyInstallment').textContent = formatRupiah(active.monthlyInstallment);
    $('kpiRateInfo').textContent =
      `Bunga Flat ${formatPct(active.flatRatePa)} p.a. • Setara ±${formatPct(active.effectiveRatePa)} Efektif`;
    $('kpiTotalDp').textContent = formatRupiah(active.totalDp);
    $('kpiTdpSub').textContent =
      active.installmentType === 'ADDM'
        ? 'DP + Asuransi + Biaya Kredit + Angsuran Ke-1'
        : 'DP Murni + Premi Asuransi + Biaya Kredit';
    $('kpiPrincipalLoan').textContent = formatRupiah(active.principalLoan);
    $('kpiTotalInterestSub').textContent = `Total bunga kredit ${formatRupiah(active.totalInterest)}`;

    // 1. Tabel Simulasi Tenor
    renderTenorTable(suite.tenorResults, active.tenorMonths);

    // 2. Tabel Rincian TDP & Biaya Kredit + Tabel Asuransi per Tahun
    $('detailTenorSpan').textContent = active.tenorMonths;
    renderTdpTable(active);
    renderInsuranceTable(active.insurance);

    // 3. Tabel Jadwal Amortisasi & Anotasi Bulanan
    $('amortTenorSpan').textContent = active.tenorMonths;
    const amortRows = Calc.generateAmortizationSchedule(active, 'anuitas');
    renderAmortizationTable(amortRows, active);

    if ($('refModalBackdrop').classList.contains('open')) {
      renderModalTabContent();
    }
  }

  function renderTenorTable(tenorResults, selectedTenor) {
    const tbody = $('tenorSummaryBody');
    tbody.innerHTML = tenorResults
      .map((row) => {
        const isSel = row.tenorMonths === selectedTenor;
        const cls = ['clickable', isSel ? 'selected' : '', !row.isAvailable ? 'unavailable' : '']
          .filter(Boolean)
          .join(' ');
        return `
          <tr class="${cls}" data-tenor="${row.tenorMonths}" tabindex="${row.isAvailable ? '0' : '-1'}" aria-disabled="${!row.isAvailable}">
            <td>
              <strong>${row.tenorMonths} Bulan</strong>
              <span class="muted">(${row.tenorYears} thn)</span>
              ${isSel ? '<span class="tag tag-orange">Dipilih</span>' : ''}
              ${!row.isAvailable ? '<span class="tag tag-gray">Tidak tersedia</span>' : ''}
            </td>
            <td class="num" data-label="Suku Bunga Flat">${formatPct(row.flatRatePa)}</td>
            <td class="num strong text-blue" data-label="Angsuran / Bulan">${formatRupiah(row.monthlyInstallment)}</td>
            <td class="num strong text-dark" data-label="Total DP (TDP)">${formatRupiah(row.totalDp)}</td>
          </tr>
        `;
      })
      .join('');

    tbody.querySelectorAll('tr.clickable').forEach((tr) => {
      const select = () => {
        if (tr.classList.contains('unavailable')) return;
        state.selectedTenor = parseInt(tr.getAttribute('data-tenor'), 10);
        recalculateAndRender();
      };
      tr.addEventListener('click', select);
      tr.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          select();
        }
      });
    });
  }

  function renderTdpTable(active) {
    const fees = active.creditFees;
    const ins = active.insurance;
    const covLabel = ins.coverage.label.split(' (')[0];
    const isCollapsed = state.isCreditFeesCollapsed;

    const rowsHtml = `
      <tr>
        <td class="strong">1. Down Payment (DP Murni)</td>
        <td class="num strong">${formatRupiah(active.dpAmount)}</td>
        <td class="muted col-ket">${formatPct(active.dpPct, 2)} × ${formatRupiah(active.vehiclePrice)}</td>
      </tr>
      <tr>
        <td class="strong">2. Total Premi Asuransi</td>
        <td class="num strong">${formatRupiah(ins.totalPremium)}</td>
        <td class="muted col-ket">${covLabel} (${active.tenorYears} Tahun • ${state.vehicleType})</td>
      </tr>
      <tr class="subtotal-row" id="btnToggleCreditFees" style="cursor:pointer;" title="Klik untuk menampilkan atau menyembunyikan rincian biaya kredit">
        <td class="strong" style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <span>3. Total Biaya Kredit</span>
          <span class="tag tag-gray" style="font-size:0.68rem; font-weight:600; cursor:pointer;">${isCollapsed ? '▶ Buka Rincian' : '▼ Sembunyikan'}</span>
        </td>
        <td class="num strong">${formatRupiah(fees.totalCreditFees)}</td>
        <td class="col-ket"></td>
      </tr>
      <tr class="subrow fee-subrow" style="${isCollapsed ? 'display:none;' : ''}">
        <td style="padding-left:28px;">• Biaya Admin</td>
        <td class="num">${formatRupiah(fees.adminFee)}</td>
        <td class="col-ket"></td>
      </tr>
      <tr class="subrow fee-subrow" style="${isCollapsed ? 'display:none;' : ''}">
        <td style="padding-left:28px;">• Biaya Provisi</td>
        <td class="num">${formatRupiah(fees.provisiAmount)}</td>
        <td class="col-ket"></td>
      </tr>
      <tr class="subrow fee-subrow" style="${isCollapsed ? 'display:none;' : ''}">
        <td style="padding-left:28px;">• Biaya Polis</td>
        <td class="num">${formatRupiah(fees.polisFee)}</td>
        <td class="col-ket"></td>
      </tr>
      <tr class="subrow fee-subrow" style="${isCollapsed ? 'display:none;' : ''}">
        <td style="padding-left:28px;">• Biaya Fidusia</td>
        <td class="num">${formatRupiah(fees.fidusiaFee)}</td>
        <td class="col-ket"></td>
      </tr>
      <tr class="subrow fee-subrow" style="${isCollapsed ? 'display:none;' : ''}">
        <td style="padding-left:28px;">• Blokir BPKB</td>
        <td class="num">${formatRupiah(fees.blokirFee)}</td>
        <td class="col-ket"></td>
      </tr>
      ${
        active.firstInstallmentInTdp > 0
          ? `
        <tr>
          <td class="strong">4. Angsuran Ke-1 (ADDM)</td>
          <td class="num strong">${formatRupiah(active.firstInstallmentInTdp)}</td>
          <td class="muted col-ket">Dibayar di muka saat akad</td>
        </tr>`
          : ''
      }
    `;

    $('tdpTableBody').innerHTML = rowsHtml;
    $('tdpTableFoot').innerHTML = `
      <tr>
        <td>TOTAL DOWN PAYMENT (TDP)</td>
        <td class="num strong text-dark">${formatRupiah(active.totalDp)}</td>
        <td class="muted col-ket">${
          active.installmentType === 'ADDM'
            ? 'DP + Asuransi + Biaya Kredit + Angsuran Ke-1'
            : 'DP + Asuransi + Biaya Kredit'
        }</td>
      </tr>
    `;

    const toggleBtn = $('btnToggleCreditFees');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        state.isCreditFeesCollapsed = !state.isCreditFeesCollapsed;
        renderTdpTable(active);
      });
    }
  }

  function renderInsuranceTable(insurance) {
    $('yearlyInsuranceBody').innerHTML = insurance.yearlyBreakdown
      .map((yr) => {
        const isAR = yr.coverageType === 'All Risk';
        const rateDetail =
          yr.perilRatePct > 0
            ? `${formatPct(yr.combinedRatePct, 3)} <span class="muted">(${formatPct(yr.baseRatePct)} + ${formatPct(yr.perilRatePct, 3)})</span>`
            : formatPct(yr.baseRatePct);
        return `
          <tr>
            <td><strong>Tahun ${yr.year}</strong> <span class="muted">(Bln ${yr.monthRange})</span></td>
            <td class="num strong" data-label="Premi (Rp)">${formatRupiah(yr.yearTotalPremium)}</td>
            <td class="num" data-label="Pertanggungan">${formatRupiah(yr.insuredValue)}</td>
            <td class="num" data-label="Depresiasi">${yr.depreciationPct}%</td>
            <td class="col-ket" data-label="Coverage"><span class="tag ${isAR ? 'tag-blue' : 'tag-amber'}">${yr.coverageType}</span></td>
            <td class="num" data-label="Total Rate">${rateDetail}</td>
          </tr>
        `;
      })
      .join('');

    $('yearlyInsuranceFoot').innerHTML = `
      <tr>
        <td>TOTAL PREMI ASURANSI (${insurance.years} TAHUN)</td>
        <td class="num strong text-dark" data-label="Total Premi">${formatRupiah(insurance.totalPremium)}</td>
        <td colspan="4" class="muted col-ket hide-sm">Akumulasi premi tahun 1 s.d. tahun ${insurance.years}</td>
      </tr>
    `;
  }

  function renderAmortizationTable(rows, active) {
    $('amortSubtitleInfo').textContent =
      `Metode Anuitas Efektif ±${formatPct(active.effectiveRatePa)} p.a. (setara KPR — porsi bunga menurun, porsi pokok meningkat tiap bulan)`;

    let tPrin = 0;
    let tInt = 0;
    let tPmt = 0;

    $('amortizationBody').innerHTML = rows
      .map((r) => {
        tPrin += r.principalPart;
        tInt += r.interestPart;
        tPmt += r.installment;
        return `
          <tr class="row-${r.badgeType}">
            <td><strong>${r.month}</strong></td>
            <td class="num hide-laptop">${formatRupiah(r.beginningBalance)}</td>
            <td class="num text-blue strong">${formatRupiah(r.principalPart)}</td>
            <td class="num">${formatRupiah(r.interestPart)}</td>
            <td class="num strong">${formatRupiah(r.installment)}</td>
            <td class="num">${formatRupiah(r.endingBalance)}</td>
          </tr>
        `;
      })
      .join('');

    $('amortizationFoot').innerHTML = `
      <tr>
        <td>TOTAL</td>
        <td class="num hide-laptop">-</td>
        <td class="num">${formatRupiah(tPrin)}</td>
        <td class="num">${formatRupiah(tInt)}</td>
        <td class="num">${formatRupiah(tPmt)}</td>
        <td class="num">Rp 0</td>
      </tr>
    `;
  }

  // ======================== MODAL TABEL REFERENSI & RATE ========================
  function segmentedHtml(id, options, activeValue) {
    return `
      <div class="segmented" id="${id}">
        ${options
          .map(
            (o) =>
              `<button type="button" data-value="${o.value}" class="${o.value === activeValue ? 'active' : ''}">${o.label}</button>`
          )
          .join('')}
      </div>
    `;
  }

  function bindSegmented(id, onChange) {
    const el = $(id);
    if (!el) return;
    el.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => onChange(btn.getAttribute('data-value')));
    });
  }

  function onSettingsChanged() {
    saveCustomSettings();
    updateSchemeUi();
    recalculateAndRender();
  }

  function renderModalTabContent() {
    const box = $('refModalContent');
    const tab = state.activeModalTab;
    const schemeHeaders = SCHEME_IDS.map(
      (sId) =>
        `<th class="num">${state.schemes[sId].name}${sId === state.schemeId ? ' <span class="tag tag-orange">Aktif</span>' : ''}</th>`
    ).join('');

    if (tab === 'tabRates') {
      const finFilter = state.modalFinancing;
      const finList =
        finFilter === 'all'
          ? Config.FINANCING_TYPES.map((f) => f.value)
          : [finFilter];

      const sectionsHtml = finList
        .map((fin) => {
          const rows = TENORS.map((t) => {
            const cells = SCHEME_IDS.map((sId) => {
              const sch = state.schemes[sId];
              const allowed = (sch.tenorsByFinancing[fin] || TENORS).indexOf(t) !== -1;
              return `
                <td class="num">
                  <input type="number" step="0.01" min="0" max="35" class="rate-input js-rate"
                    data-fin="${fin}" data-scheme="${sId}" data-tenor="${t}" value="${sch.interestRates[fin][t]}" />
                  ${allowed ? '' : '<div class="muted">di luar maks. skema</div>'}
                </td>`;
            }).join('');
            const isHl = fin === state.financingType && t === state.selectedTenor;
            return `<tr class="${isHl ? 'highlight' : ''}"><td><strong>${t} Bulan</strong> (${t / 12} Thn)</td>${cells}</tr>`;
          }).join('');

          return `
            <div class="modal-section">
              <div class="modal-section-head">
                <div>
                  <h4>Tabel Suku Bunga Flat p.a. (%) — ${fin}</h4>
                </div>
              </div>
              <div class="bordered">
                <div class="table-wrap">
                  <table class="table">
                    <thead><tr><th>Tenor</th>${schemeHeaders}</tr></thead>
                    <tbody>${rows}</tbody>
                  </table>
                </div>
              </div>
            </div>
          `;
        })
        .join('');

      const filterOpts = [{ value: 'all', label: 'Semua Pembiayaan' }].concat(
        Config.FINANCING_TYPES.map((f) => ({ value: f.value, label: f.value }))
      );

      box.innerHTML = `
        <div class="modal-section-head" style="margin-bottom:16px;">
          <div>
            <h4>Pengaturan Suku Bunga per Skema &amp; Jenis Pembiayaan</h4>
            <p>Ubah nilai persentase langsung pada tabel di bawah ini</p>
          </div>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            ${segmentedHtml('segModalFin', filterOpts, finFilter)}
            <button type="button" class="btn btn-ghost btn-xs" id="btnResetDefaultRates">↺ Reset Default</button>
          </div>
        </div>
        ${sectionsHtml}
      `;

      bindSegmented('segModalFin', (v) => {
        state.modalFinancing = v;
        renderModalTabContent();
      });

      box.querySelectorAll('.js-rate').forEach((inp) => {
        inp.addEventListener('change', () => {
          const fin = inp.getAttribute('data-fin');
          const sId = inp.getAttribute('data-scheme');
          const t = parseInt(inp.getAttribute('data-tenor'), 10);
          state.schemes[sId].interestRates[fin][t] = Math.max(0, parseFloat(inp.value) || 0);
          onSettingsChanged();
        });
      });

      bindResetButton();
    } else if (tab === 'tabFees') {
      const feeRows = [
        { key: 'defaultAdmin', label: 'Biaya Admin Default (Rp)', step: 50000 },
        { key: 'defaultProvisiPct', label: 'Biaya Provisi Default (%)', step: 0.05 },
        { key: 'defaultPolis', label: 'Biaya Polis Default (Rp)', step: 5000 },
        { key: 'blokir:New Car', label: 'Blokir BPKB — New Car (Rp)', step: 50000 },
        { key: 'blokir:Used Car', label: 'Blokir BPKB — Used Car (Rp)', step: 50000 },
        { key: 'blokir:Refinancing', label: 'Blokir BPKB — Refinancing (Rp)', step: 50000 },
        { key: 'blokir:Niaga Barang', label: 'Blokir BPKB — Niaga Barang (Rp)', step: 50000 }
      ];

      const getVal = (sch, key) =>
        key.indexOf('blokir:') === 0
          ? sch.defaultBlokirByFinancing[key.split(':')[1]] ?? 500000
          : sch[key];

      const rows = feeRows
        .map(
          (f) => `
          <tr>
            <td><strong>${f.label}</strong></td>
            ${SCHEME_IDS.map(
              (sId) => `<td class="num"><input type="number" step="${f.step}" class="rate-input js-fee"
                data-scheme="${sId}" data-key="${f.key}" value="${getVal(state.schemes[sId], f.key)}" style="max-width:130px;" /></td>`
            ).join('')}
          </tr>`
        )
        .join('');

      box.innerHTML = `
        <div class="modal-section">
          <div class="modal-section-head">
            <div>
              <h4>Biaya Default Masing-Masing Skema</h4>
              <p>Nilai otomatis yang terisi ketika tombol skema dipilih</p>
            </div>
            <button type="button" class="btn btn-ghost btn-xs" id="btnResetDefaultRates">↺ Reset Default</button>
          </div>
          <div class="bordered">
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Komponen Biaya</th>${schemeHeaders}</tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="modal-section">
          <div class="modal-section-head"><div><h4>Pengaturan Basis Rumus</h4></div></div>
          <div class="settings-grid">
            <div class="field">
              <label class="label" for="selProvisiBasis">Basis Biaya Provisi (Rp)</label>
              <select id="selProvisiBasis" class="control">
                <option value="principal" ${state.provisiBasis === 'principal' ? 'selected' : ''}>Biaya Provisi (%) × Pokok Hutang</option>
                <option value="price" ${state.provisiBasis === 'price' ? 'selected' : ''}>Biaya Provisi (%) × Harga Kendaraan</option>
              </select>
            </div>
            <div class="field">
              <label class="label" for="selFidusiaBasis">Basis Nilai Penjaminan Fidusia</label>
              <select id="selFidusiaBasis" class="control">
                <option value="price" ${state.fidusiaBasis === 'price' ? 'selected' : ''}>Rentang Harga Kendaraan</option>
                <option value="principal" ${state.fidusiaBasis === 'principal' ? 'selected' : ''}>Rentang Pokok Hutang</option>
              </select>
            </div>
            <div class="field">
              <label class="label" for="selBracketBasis">Penentuan Rentang Rate Asuransi</label>
              <select id="selBracketBasis" class="control">
                <option value="depreciated" ${state.bracketBasis === 'depreciated' ? 'selected' : ''}>Nilai Pertanggungan Setelah Depresiasi</option>
                <option value="initial" ${state.bracketBasis === 'initial' ? 'selected' : ''}>Harga Kendaraan Awal</option>
              </select>
            </div>
          </div>
        </div>
      `;

      box.querySelectorAll('.js-fee').forEach((inp) => {
        inp.addEventListener('change', () => {
          const sId = inp.getAttribute('data-scheme');
          const key = inp.getAttribute('data-key');
          const sch = state.schemes[sId];
          const v = parseFloat(inp.value) || 0;
          if (key.indexOf('blokir:') === 0) {
            sch.defaultBlokirByFinancing[key.split(':')[1]] = Math.max(0, v);
          } else {
            sch[key] = Math.max(0, v);
          }
          if (sId === state.schemeId) {
            state.adminFee = sch.defaultAdmin;
            state.provisiPct = sch.defaultProvisiPct;
            state.polisFee = sch.defaultPolis;
            state.blokirFee =
              sch.defaultBlokirByFinancing[state.financingType] !== undefined
                ? sch.defaultBlokirByFinancing[state.financingType]
                : 500000;
            $('inputAdminFee').value = formatNumberId(state.adminFee);
            $('inputProvisiPct').value = state.provisiPct.toFixed(2).replace('.', ',');
            $('inputPolisFee').value = formatNumberId(state.polisFee);
            $('inputBlokirFee').value = formatNumberId(state.blokirFee);
          }
          onSettingsChanged();
        });
      });

      [
        ['selProvisiBasis', 'provisiBasis'],
        ['selFidusiaBasis', 'fidusiaBasis'],
        ['selBracketBasis', 'bracketBasis']
      ].forEach(([id, key]) => {
        $(id).addEventListener('change', (e) => {
          state[key] = e.target.value;
          onSettingsChanged();
        });
      });

      bindResetButton();
    } else if (tab === 'tabInsBase') {
      const wFilter = state.modalWilayah;
      const curRow = Calc.lookupBaseInsuranceRate(state.vehicleType, state.wilayah, state.vehiclePrice);
      const filteredRows = Config.INSURANCE_BASE_RATES.filter(
        (r) => wFilter === 'all' || r.wilayah === wFilter
      );

      const rows = filteredRows
        .map((r) => {
          const hl = r === curRow;
          return `
            <tr class="${hl ? 'highlight' : ''}">
              <td><strong>${r.type}</strong>${hl ? ' <span class="tag tag-orange">Aktif di Form</span>' : ''}</td>
              <td>Wilayah ${r.wilayah}</td>
              <td class="num">${r.from === 0 ? 'Rp 0' : formatRupiah(r.from)}</td>
              <td class="num">${r.to >= 99999999999 ? 'Tanpa batas' : formatRupiah(r.to)}</td>
              <td class="num strong">${formatPct(r.tlo)}</td>
              <td class="num strong text-blue">${formatPct(r.allRisk)}</td>
            </tr>`;
        })
        .join('');

      const wilOpts = [{ value: 'all', label: 'Semua Wilayah' }].concat(
        Config.WILAYAH_OPTIONS.map((o) => ({ value: o.value, label: o.shortLabel }))
      );

      box.innerHTML = `
        <div class="modal-section">
          <div class="modal-section-head">
            <div>
              <h4>Tabel Rate Dasar Asuransi Kendaraan Bermotor (TLO &amp; All Risk)</h4>
              <p>Wilayah 1: Sumatera • Wilayah 2: DKI Jakarta &amp; Banten • Wilayah 3: Selain Wilayah 1 &amp; 2</p>
            </div>
            ${segmentedHtml('segModalWil', wilOpts, wFilter)}
          </div>
          <div class="bordered">
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>Tipe Kendaraan</th>
                    <th>Wilayah</th>
                    <th class="num">Rentang Dari</th>
                    <th class="num">Sampai Dengan</th>
                    <th class="num">Rate TLO</th>
                    <th class="num">Rate All Risk</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      bindSegmented('segModalWil', (v) => {
        state.modalWilayah = v;
        renderModalTabContent();
      });
    } else if (tab === 'tabInsPeril') {
      const perilRows = Config.INSURANCE_PERILS.map(
        (p) => `
        <tr>
          <td><strong>${p.label}</strong></td>
          ${['1', '2', '3'].map((w) => `<td class="num">${formatPct(p.rates['All Risk'][w], 3)}</td>`).join('')}
          ${['1', '2', '3'].map((w) => `<td class="num">${formatPct(p.rates['TLO'][w], 3)}</td>`).join('')}
        </tr>`
      ).join('');

      const depRows = Object.keys(Config.DEPRECIATION_BY_YEAR)
        .map((yr) => {
          const d = Config.DEPRECIATION_BY_YEAR[yr];
          return `
            <tr>
              <td><strong>Tahun ke-${yr}</strong></td>
              <td class="num">Tenor ${d.tenorMonths} Bulan</td>
              <td class="num strong">${d.ratePct}%</td>
              <td class="num">${formatRupiah((state.vehiclePrice * d.ratePct) / 100)}</td>
            </tr>`;
        })
        .join('');

      box.innerHTML = `
        <div class="modal-section">
          <div class="modal-section-head">
            <div>
              <h4>Tabel Syarat Klaim / Perluasan Jaminan Asuransi</h4>
              <p>Rate tambahan per tahun berdasarkan Wilayah (1 / 2 / 3) dan jenis Coverage (All Risk / TLO)</p>
            </div>
          </div>
          <div class="bordered">
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th rowspan="2">Jenis Perluasan Klaim</th>
                    <th class="num" colspan="3" style="text-align:center;">All Risk</th>
                    <th class="num" colspan="3" style="text-align:center;">TLO</th>
                  </tr>
                  <tr>
                    <th class="num">Wilayah 1</th><th class="num">Wilayah 2</th><th class="num">Wilayah 3</th>
                    <th class="num">Wilayah 1</th><th class="num">Wilayah 2</th><th class="num">Wilayah 3</th>
                  </tr>
                </thead>
                <tbody>${perilRows}</tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="modal-section">
          <div class="modal-section-head">
            <div>
              <h4>Tabel Rumus Depresiasi Nilai Pertanggungan</h4>
              <p>Simulasi otomatis terhadap harga kendaraan saat ini (${formatRupiah(state.vehiclePrice)})</p>
            </div>
          </div>
          <div class="bordered">
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>Tahun Berjalan</th>
                    <th class="num">Tenor (Bulan)</th>
                    <th class="num">Persentase Depresiasi</th>
                    <th class="num">Nilai Pertanggungan</th>
                  </tr>
                </thead>
                <tbody>${depRows}</tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } else if (tab === 'tabFidusia') {
      const basis =
        state.fidusiaBasis === 'principal' && lastSuiteResult
          ? lastSuiteResult.activeResult.principalLoan
          : state.vehiclePrice;
      const rows = Config.FIDUSIA_TABLE.map((f) => {
        const hl = basis >= f.from && basis <= f.to;
        return `
          <tr class="${hl ? 'highlight' : ''}">
            <td><strong>${f.label}</strong></td>
            <td class="num">${f.from === 0 ? 'Rp 0' : formatRupiah(f.from)}</td>
            <td class="num">${f.to === Infinity ? 'Tanpa batas' : formatRupiah(f.to)}</td>
            <td class="num strong text-blue">${formatRupiah(f.fee)} ${hl ? '<span class="tag tag-orange">Sesuai Input</span>' : ''}</td>
          </tr>`;
      }).join('');

      box.innerHTML = `
        <div class="modal-section">
          <div class="modal-section-head">
            <div>
              <h4>Tabel Biaya Netto Fidusia Berdasarkan Nilai Penjaminan</h4>
              <p>Nilai penjaminan saat ini: ${formatRupiah(basis)} (${state.fidusiaBasis === 'price' ? 'Harga Kendaraan' : 'Pokok Hutang'})</p>
            </div>
          </div>
          <div class="bordered">
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>Rentang Nilai Penjaminan</th>
                    <th class="num">Dari</th>
                    <th class="num">Sampai Dengan</th>
                    <th class="num">Biaya Netto Fidusia</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }
  }

  function bindResetButton() {
    const btn = $('btnResetDefaultRates');
    if (!btn) return;
    btn.addEventListener('click', () => {
      state.schemes = cloneDeep(Config.DEFAULT_SCHEMES);
      state.provisiBasis = 'principal';
      state.fidusiaBasis = 'price';
      state.bracketBasis = 'depreciated';
      saveCustomSettings();
      applySchemeDefaults(state.schemeId);
      renderModalTabContent();
    });
  }

  function openModal() {
    renderModalTabContent();
    $('refModalBackdrop').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    $('refModalBackdrop').classList.remove('open');
    document.body.style.overflow = '';
  }

  // ======================== EVENT LISTENERS ========================
  function updateDpFromPrice() {
    if (state.dpMode === 'pct') {
      state.dpAmount = Math.round((state.vehiclePrice * state.dpPct) / 100);
    } else {
      state.dpAmount = Math.min(state.dpAmount, state.vehiclePrice);
      state.dpPct = state.vehiclePrice > 0 ? (state.dpAmount / state.vehiclePrice) * 100 : 0;
    }
  }

  function bindEvents() {
    document.querySelectorAll('.scheme-btn').forEach((btn) => {
      btn.addEventListener('click', () => applySchemeDefaults(btn.getAttribute('data-scheme')));
    });

    $('inputWilayah').addEventListener('change', (e) => {
      state.wilayah = e.target.value;
      renderPerilCheckboxes();
      recalculateAndRender();
    });

    $('inputFinancingType').addEventListener('change', (e) => {
      state.financingType = e.target.value;
      syncVehicleTypeFromFinancing();
      const sch = state.schemes[state.schemeId];
      state.blokirFee =
        sch.defaultBlokirByFinancing &&
        sch.defaultBlokirByFinancing[state.financingType] !== undefined
          ? sch.defaultBlokirByFinancing[state.financingType]
          : 500000;
      $('inputBlokirFee').value = formatNumberId(state.blokirFee);
      ensureTenorAllowed();
      updateSchemeUi();
      recalculateAndRender();
    });

    $('inputBrand').addEventListener('change', (e) => {
      state.brandValue = e.target.value;
      state.modelValue = '';
      populateModels();
      applyMinimumDp();
      recalculateAndRender();
    });
    $('inputModel').addEventListener('change', (e) => {
      state.modelValue = e.target.value;
      applyMinimumDp();
      recalculateAndRender();
    });

    const elPrice = $('inputVehiclePrice');
    elPrice.addEventListener('input', () => {
      state.vehiclePrice = parseDigits(elPrice.value);
      elPrice.value = state.vehiclePrice > 0 ? formatNumberId(state.vehiclePrice) : '';
      updateDpFromPrice();
      if (state.dpMode === 'rp') syncDpInputField();
      recalculateAndRender();
    });

    document.querySelectorAll('.chip[data-price]').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.vehiclePrice = parseInt(chip.getAttribute('data-price'), 10);
        elPrice.value = formatNumberId(state.vehiclePrice);
        updateDpFromPrice();
        syncDpInputField();
        recalculateAndRender();
      });
    });

    $('btnDpModePct').addEventListener('click', () => {
      state.dpMode = 'pct';
      syncDpInputField();
    });
    $('btnDpModeRp').addEventListener('click', () => {
      state.dpMode = 'rp';
      syncDpInputField();
    });

    const elDp = $('inputDpValue');
    elDp.addEventListener('input', () => {
      if (state.dpMode === 'pct') {
        state.dpPct = Math.min(95, Math.max(0, parseDecimalId(elDp.value)));
        state.dpAmount = Math.round((state.vehiclePrice * state.dpPct) / 100);
      } else {
        state.dpAmount = Math.min(state.vehiclePrice, parseDigits(elDp.value));
        state.dpPct = state.vehiclePrice > 0 ? (state.dpAmount / state.vehiclePrice) * 100 : 0;
        elDp.value = state.dpAmount > 0 ? formatNumberId(state.dpAmount) : '';
      }
      recalculateAndRender();
    });

    $('btnApplyMinDp').addEventListener('click', () => {
      applyMinimumDp();
      recalculateAndRender();
    });

    $('inputCoverage').addEventListener('change', (e) => {
      state.coverageValue = e.target.value;
      renderPerilCheckboxes();
      recalculateAndRender();
    });

    $('btnSelectAllPerils').addEventListener('click', () => {
      state.selectedPerils =
        state.selectedPerils.length === Config.INSURANCE_PERILS.length
          ? []
          : Config.INSURANCE_PERILS.map((p) => p.id);
      renderPerilCheckboxes();
      recalculateAndRender();
    });

    [
      ['inputAdminFee', 'adminFee'],
      ['inputPolisFee', 'polisFee'],
      ['inputBlokirFee', 'blokirFee']
    ].forEach(([id, key]) => {
      const el = $(id);
      el.addEventListener('input', () => {
        state[key] = parseDigits(el.value);
        el.value = formatNumberId(state[key]);
        recalculateAndRender();
      });
    });

    $('inputProvisiPct').addEventListener('input', (e) => {
      state.provisiPct = Math.min(20, Math.max(0, parseDecimalId(e.target.value)));
      recalculateAndRender();
    });

    $('inputInstallmentType').addEventListener('change', (e) => {
      state.installmentType = e.target.value;
      recalculateAndRender();
    });

    const btnToggleIns = $('btnToggleInsurance');
    if (btnToggleIns) {
      btnToggleIns.addEventListener('click', () => {
        const wrap = $('wrapYearlyInsurance');
        const arrow = $('insArrowText');
        const isHidden = wrap.style.display === 'none';
        wrap.style.display = isHidden ? 'block' : 'none';
        if (arrow) arrow.textContent = isHidden ? '▼ Sembunyikan' : '▶ Buka Rincian';
      });
    }

    // Reset Form
    $('btnResetForm').addEventListener('click', () => {
      Object.assign(state, {
        wilayah: '2',
        financingType: 'New Car',
        vehicleType: 'Non Bus dan Non Truk',
        brandValue: 'TOYOTA',
        modelValue: 'AVANZA',
        vehiclePrice: 350000000,
        dpMode: 'pct',
        coverageValue: 'Kombinasi#1',
        selectedPerils: ['banjir'],
        installmentType: 'ADDB',
        selectedTenor: 36
      });
      $('inputWilayah').value = state.wilayah;
      $('inputFinancingType').value = state.financingType;
      populateStaticDropdowns();
      applyMinimumDp();
      $('inputVehiclePrice').value = formatNumberId(state.vehiclePrice);
      $('inputCoverage').value = state.coverageValue;
      $('inputInstallmentType').value = state.installmentType;
      renderPerilCheckboxes();
      applySchemeDefaults('regular');
    });

    // Modal
    $('btnOpenRefModal').addEventListener('click', openModal);
    $('btnCloseRefModal').addEventListener('click', closeModal);
    $('refModalBackdrop').addEventListener('click', (e) => {
      if (e.target === $('refModalBackdrop')) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('refModalBackdrop').classList.contains('open')) closeModal();
    });

    document.querySelectorAll('.modal-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-tab').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeModalTab = btn.getAttribute('data-tab');
        renderModalTabContent();
        $('refModalContent').scrollTop = 0;
      });
    });
  }

  // ======================== INIT ========================
  async function init() {
    const controls = [...document.querySelectorAll('button, input, select')];
    controls.forEach((control) => { control.disabled = true; });
    const status = $('simulationNotice');
    status.hidden = false;
    status.textContent = 'Memuat data kendaraan dari vehicles.csv...';
    try {
      await global.KKBVehicles.load();
      loadSavedSettings();
      populateStaticDropdowns();
      renderPerilCheckboxes();
      bindEvents();
      applySchemeDefaults(state.schemeId);
      controls.forEach((control) => { control.disabled = false; });
    } catch (error) {
      status.hidden = false;
      status.textContent = `Data kendaraan gagal dimuat: ${error.message} Jalankan melalui Live Server atau hosting HTTP, lalu periksa vehicles.csv dan muat ulang halaman.`;
      document.querySelector('.results').querySelectorAll('section').forEach((section) => { section.hidden = true; });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
