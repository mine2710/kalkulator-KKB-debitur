/**
 * Mesin Perhitungan Finansial & Asuransi BRI KKB Debitur
 * Mengimplementasikan seluruh rumus spesifikasi KKB BRI:
 * 1. TDP = DP + Asuransi + Biaya Kredit (+ Angsuran ke-1 bila ADDM aktif)
 * 2. Biaya Kredit = Admin + Provisi (Rp) + Polis + Fidusia + Blokir BPKB
 * 3. Biaya Provisi (Rp) = Biaya Provisi (%) * Harga Kendaraan (atau Pokok Hutang)
 * 4. Biaya Fidusia = Lookup tabel Nilai Penjaminan
 * 5. Premi Asuransi = Multi-tahun dengan Rate Dasar + Perluasan Klaim * Nilai Pertanggungan Terdepresiasi
 * 6. Jadwal Amortisasi & Anotasi Bulanan setara KPR (Anuitas Efektif Ekuivalen & Flat Proporsional)
 */
(function (global) {
  'use strict';

  const Config = global.KKBConfig;

  /**
   * Menghitung batas Minimal DP (%) & (Rp) berdasarkan:
   * Skema (Regular / LNP / Karyawan), Jenis Pembiayaan, Tipe Kendaraan, Merk, dan Jenis Bahan Bakar
   */
  function calculateMinDP(params) {
    const {
      schemeId = 'regular',
      financingType = 'New Car',
      vehicleType = 'Non Bus dan Non Truk',
      brandValue = 'toyota',
      fuelValue = 'bensin',
      vehiclePrice = 0,
      schemes = Config.DEFAULT_SCHEMES
    } = params;

    const scheme = schemes[schemeId] || Config.DEFAULT_SCHEMES.regular;
    const baseByFinancing = Config.BASE_MIN_DP_BY_FINANCING[financingType] || Config.BASE_MIN_DP_BY_FINANCING['New Car'];
    const basePct = baseByFinancing[vehicleType] !== undefined ? baseByFinancing[vehicleType] : 20;

    const brandObj = Config.VEHICLE_BRANDS.find((b) => b.value === brandValue) || Config.VEHICLE_BRANDS[0];
    const fuelObj = Config.FUEL_TYPES.find((f) => f.value === fuelValue) || Config.FUEL_TYPES[0];

    const brandMod = brandObj.dpModifier || 0;
    const fuelMod = fuelObj.dpModifier || 0;
    const schemeMod = scheme.dpSchemeModifier || 0;

    const rawPct = basePct + brandMod + fuelMod + schemeMod;
    const minFloor = fuelValue === 'ev' ? 10 : 10;
    const minDpPct = Math.min(50, Math.max(minFloor, rawPct));
    const minDpAmount = Math.round((vehiclePrice * minDpPct) / 100);

    const factors = [
      { label: `${financingType} (${vehicleType})`, value: `${basePct}%` }
    ];
    if (brandMod !== 0) {
      factors.push({ label: `Merk ${brandObj.origin}`, value: `${brandMod > 0 ? '+' : ''}${brandMod}%` });
    }
    if (fuelMod !== 0) {
      factors.push({ label: `Bahan Bakar ${fuelObj.badge}`, value: `${fuelMod > 0 ? '+' : ''}${fuelMod}%` });
    }
    if (schemeMod !== 0) {
      factors.push({ label: `Privilege ${scheme.name}`, value: `${schemeMod > 0 ? '+' : ''}${schemeMod}%` });
    }

    return {
      minDpPct,
      minDpAmount,
      basePct,
      brandOrigin: brandObj.origin,
      fuelBadge: fuelObj.badge,
      factors
    };
  }

  /**
   * Lookup Biaya Fidusia berdasarkan Nilai Penjaminan (default: Harga Kendaraan)
   */
  function calculateFidusia(basisAmount) {
    const val = Math.max(0, Math.round(basisAmount || 0));
    if (val === 0) {
      return { fee: 0, bracketLabel: '-', basisAmount: 0 };
    }
    for (let i = 0; i < Config.FIDUSIA_TABLE.length; i++) {
      const row = Config.FIDUSIA_TABLE[i];
      if (val >= row.from && val <= row.to) {
        return {
          fee: row.fee,
          bracketLabel: row.label,
          basisAmount: val
        };
      }
    }
    const last = Config.FIDUSIA_TABLE[Config.FIDUSIA_TABLE.length - 1];
    return {
      fee: last.fee,
      bracketLabel: last.label,
      basisAmount: val
    };
  }

  /**
   * Lookup Rate Dasar Asuransi (All Risk & TLO) berdasarkan Tipe, Wilayah, dan Harga/Nilai Pertanggungan
   */
  function lookupBaseInsuranceRate(vehicleType, wilayah, lookupAmount) {
    const w = String(wilayah || '2');
    const val = Math.max(0, Math.round(lookupAmount || 0));

    const matchingRows = Config.INSURANCE_BASE_RATES.filter(
      (r) => r.type === vehicleType && r.wilayah === w
    );

    if (matchingRows.length === 0) {
      return { tlo: 0.38, allRisk: 2.08, from: 0, to: 0 };
    }

    for (let i = 0; i < matchingRows.length; i++) {
      const row = matchingRows[i];
      if (val >= row.from && val <= row.to) {
        return row;
      }
    }

    return matchingRows[matchingRows.length - 1];
  }

  /**
   * Menghitung Premi Asuransi Multi-Tahun lengkap dengan Depresiasi & Perluasan Klaim
   */
  function calculateInsuranceForTenor(params) {
    const {
      vehiclePrice = 0,
      wilayah = '2',
      vehicleType = 'Non Bus dan Non Truk',
      coverageValue = 'AllRisk',
      selectedPerils = [],
      tenorMonths = 36,
      bracketBasis = 'depreciated' // 'depreciated' (Nilai Pertanggungan tahun berjalan) atau 'initial' (Harga Awal)
    } = params;

    const years = Math.max(1, Math.ceil(tenorMonths / 12));
    const coverageObj =
      Config.COVERAGE_OPTIONS.find((c) => c.value === coverageValue) || Config.COVERAGE_OPTIONS[0];

    const yearlyBreakdown = [];
    let totalBasePremium = 0;
    let totalPerilPremium = 0;
    let totalPremium = 0;

    for (let yr = 1; yr <= years; yr++) {
      const depEntry = Config.DEPRECIATION_BY_YEAR[yr] || { tenorMonths: yr * 12, ratePct: 50 };
      const depPct = depEntry.ratePct;
      const insuredValue = (vehiclePrice * depPct) / 100;
      const yearCoverageType = yr <= coverageObj.allRiskYears ? 'All Risk' : 'TLO';

      const bracketLookupValue = bracketBasis === 'initial' ? vehiclePrice : insuredValue;
      const rateRow = lookupBaseInsuranceRate(vehicleType, wilayah, bracketLookupValue);
      const baseRatePct = yearCoverageType === 'All Risk' ? rateRow.allRisk : rateRow.tlo;

      let perilRatePct = 0;
      const activePerils = [];

      selectedPerils.forEach((perilId) => {
        const perilDef = Config.INSURANCE_PERILS.find((p) => p.id === perilId);
        if (perilDef && perilDef.rates[yearCoverageType]) {
          const r = perilDef.rates[yearCoverageType][String(wilayah)] || 0;
          perilRatePct += r;
          activePerils.push({
            id: perilDef.id,
            label: perilDef.label,
            code: `${perilDef.codePrefix}${wilayah}${yearCoverageType}`,
            ratePct: r,
            amount: Math.round((insuredValue * r) / 100)
          });
        }
      });

      const combinedRatePct = baseRatePct + perilRatePct;
      const basePremium = Math.round((insuredValue * baseRatePct) / 100);
      const perilPremium = Math.round((insuredValue * perilRatePct) / 100);
      const yearTotalPremium = basePremium + perilPremium;

      totalBasePremium += basePremium;
      totalPerilPremium += perilPremium;
      totalPremium += yearTotalPremium;

      yearlyBreakdown.push({
        year: yr,
        monthRange: `${(yr - 1) * 12 + 1} – ${Math.min(yr * 12, tenorMonths)}`,
        depreciationPct: depPct,
        insuredValue,
        coverageType: yearCoverageType,
        baseRatePct,
        perilRatePct,
        combinedRatePct,
        basePremium,
        perilPremium,
        yearTotalPremium,
        activePerils,
        rateBracket: rateRow
      });
    }

    return {
      coverage: coverageObj,
      years,
      yearlyBreakdown,
      totalBasePremium,
      totalPerilPremium,
      totalPremium
    };
  }

  /**
   * Menghitung Komponen Biaya Kredit:
   * Biaya Kredit = Admin + Provisi (Rp) + Polis + Fidusia + Blokir BPKB
   */
  function calculateCreditFees(params) {
    const {
      vehiclePrice = 0,
      principalLoan = 0,
      adminFee = 0,
      provisiPct = 0,
      polisFee = 0,
      blokirFee = 0,
      provisiBasis = 'price', // 'price' = Biaya Provisi (%) * Harga Kendaraan (sesuai spesifikasi), 'principal' = * Pokok Hutang
      fidusiaBasis = 'price' // 'price' = Harga Kendaraan, 'principal' = Pokok Hutang
    } = params;

    const provisiBaseAmount = provisiBasis === 'principal' ? principalLoan : vehiclePrice;
    const provisiAmount = Math.round((provisiBaseAmount * provisiPct) / 100);

    const fidusiaBaseAmount = fidusiaBasis === 'principal' ? principalLoan : vehiclePrice;
    const fidusia = calculateFidusia(fidusiaBaseAmount);

    const totalCreditFees =
      Math.round(adminFee) +
      provisiAmount +
      Math.round(polisFee) +
      fidusia.fee +
      Math.round(blokirFee);

    return {
      adminFee: Math.round(adminFee),
      provisiPct,
      provisiBaseAmount,
      provisiAmount,
      polisFee: Math.round(polisFee),
      fidusiaFee: fidusia.fee,
      fidusiaBracket: fidusia.bracketLabel,
      fidusiaBaseAmount,
      blokirFee: Math.round(blokirFee),
      totalCreditFees
    };
  }

  /**
   * Mencari Suku Bunga Efektif / Anuitas Tahunan (p.a.) yang menghasilkan angsuran bulanan sama persis
   * dengan perhitungan Bunga Flat KKB (menggunakan metode iterasi Newton-Raphson setara fungsi RATE Excel).
   */
  function solveEffectiveAnnualRate(nMonths, monthlyInstallment, principal, isADDM) {
    if (principal <= 0 || nMonths <= 0 || monthlyInstallment <= 0) {
      return 0;
    }
    const totalPaid = monthlyInstallment * nMonths;
    if (totalPaid <= principal) {
      return 0;
    }

    // Jika ADDM, angsuran pertama dibayar saat akad (t=0), sehingga sisa n-1 angsuran melunasi (principal - pmt)
    const n = isADDM ? nMonths - 1 : nMonths;
    const pv = isADDM ? principal - monthlyInstallment : principal;

    if (n <= 0 || pv <= 0) {
      return 0;
    }

    // Tebakan awal suku bunga bulanan r
    let r = ((totalPaid / principal - 1) / nMonths) * 1.8;
    if (r <= 0) r = 0.005;

    for (let iter = 0; iter < 60; iter++) {
      const pow = Math.pow(1 + r, -n);
      const f = monthlyInstallment * ((1 - pow) / r) - pv;
      const df =
        monthlyInstallment *
        ((n * Math.pow(1 + r, -n - 1) * r - (1 - pow)) / (r * r));

      if (Math.abs(df) < 1e-12) break;
      const nextR = r - f / df;
      if (Math.abs(nextR - r) < 1e-10) {
        r = nextR;
        break;
      }
      r = Math.max(1e-7, nextR);
    }

    return r * 12 * 100; // dalam persen p.a.
  }

  /**
   * Menghitung simulasi lengkap untuk satu Tenor tertentu
   */
  function calculateForTenor(params) {
    const {
      schemeId = 'regular',
      financingType = 'New Car',
      wilayah = '2',
      vehicleType = 'Non Bus dan Non Truk',
      vehiclePrice = 0,
      dpAmount = 0,
      coverageValue = 'AllRisk',
      selectedPerils = [],
      adminFee = 0,
      provisiPct = 0,
      polisFee = 0,
      blokirFee = 0,
      tenorMonths = 36,
      installmentType = 'ADDB', // 'ADDB' (default: TDP = DP + Asuransi + Biaya Kredit) atau 'ADDM'
      provisiBasis = 'price',
      fidusiaBasis = 'price',
      bracketBasis = 'depreciated',
      schemes = Config.DEFAULT_SCHEMES
    } = params;

    const scheme = schemes[schemeId] || Config.DEFAULT_SCHEMES.regular;
    const safePrice = Math.max(0, vehiclePrice);
    const safeDp = Math.min(safePrice, Math.max(0, dpAmount));
    const dpPct = safePrice > 0 ? (safeDp / safePrice) * 100 : 0;
    const principalLoan = Math.max(0, safePrice - safeDp); // Pokok Hutang Murni

    // Suku bunga flat p.a. untuk skema, jenis pembiayaan, dan tenor
    const ratesForFinancing =
      (scheme.interestRates && scheme.interestRates[financingType]) ||
      Config.DEFAULT_SCHEMES.regular.interestRates['New Car'];
    const flatRatePa =
      ratesForFinancing[tenorMonths] !== undefined ? ratesForFinancing[tenorMonths] : 4.0;

    // Bunga & Angsuran per Bulan
    const tenorYears = tenorMonths / 12;
    const totalInterest = Math.round(principalLoan * (flatRatePa / 100) * tenorYears);
    const totalLoanWithInterest = principalLoan + totalInterest;
    const monthlyPrincipalFlat = tenorMonths > 0 ? principalLoan / tenorMonths : 0;
    const monthlyInterestFlat = tenorMonths > 0 ? totalInterest / tenorMonths : 0;
    const monthlyInstallment =
      tenorMonths > 0 ? Math.round(totalLoanWithInterest / tenorMonths) : 0;

    // Asuransi sesuai tenor
    const insurance = calculateInsuranceForTenor({
      vehiclePrice: safePrice,
      wilayah,
      vehicleType,
      coverageValue,
      selectedPerils,
      tenorMonths,
      bracketBasis
    });

    // Biaya Kredit
    const creditFees = calculateCreditFees({
      vehiclePrice: safePrice,
      principalLoan,
      adminFee,
      provisiPct,
      polisFee,
      blokirFee,
      provisiBasis,
      fidusiaBasis
    });

    const isADDM = installmentType === 'ADDM';
    const firstInstallmentInTdp = isADDM ? monthlyInstallment : 0;

    // Rumus Utama TDP = DP + Asuransi + Biaya Kredit (+ Angsuran ke-1 bila ADDM)
    const totalDp =
      Math.round(safeDp) +
      insurance.totalPremium +
      creditFees.totalCreditFees +
      firstInstallmentInTdp;

    const effectiveRatePa = solveEffectiveAnnualRate(
      tenorMonths,
      monthlyInstallment,
      principalLoan,
      false // konversi ekuivalen anuitas standar untuk tabel amortisasi bulanan
    );

    const remainingInstallmentsTotal = isADDM
      ? monthlyInstallment * Math.max(0, tenorMonths - 1)
      : monthlyInstallment * tenorMonths;

    const grandTotalOutflow = totalDp + remainingInstallmentsTotal;

    const allowedTenors =
      (scheme.tenorsByFinancing && scheme.tenorsByFinancing[financingType]) || [12, 24, 36, 48, 60];
    const isAvailable = allowedTenors.indexOf(tenorMonths) !== -1;

    return {
      schemeId,
      schemeName: scheme.name,
      tenorMonths,
      tenorYears,
      isAvailable,
      vehiclePrice: safePrice,
      dpAmount: Math.round(safeDp),
      dpPct,
      principalLoan,
      flatRatePa,
      effectiveRatePa,
      totalInterest,
      totalLoanWithInterest,
      monthlyPrincipalFlat,
      monthlyInterestFlat,
      monthlyInstallment,
      installmentType,
      firstInstallmentInTdp,
      insurance,
      creditFees,
      totalDp,
      grandTotalOutflow
    };
  }

  /**
   * Menghasilkan Jadwal Amortisasi & Anotasi Lengkap Per Bulan (gaya KPR BRI)
   * Mendukung 2 tampilan:
   * - 'anuitas' : Porsi bunga menurun & porsi pokok meningkat tiap bulan (seperti KPR)
   * - 'flat'    : Porsi pokok & bunga tetap tiap bulan (proporsional KKB)
   */
  function generateAmortizationSchedule(tenorResult, mode) {
    const scheduleMode = mode === 'flat' ? 'flat' : 'anuitas';
    const n = tenorResult.tenorMonths;
    const principal = tenorResult.principalLoan;
    const pmt = tenorResult.monthlyInstallment;
    const rMonthly = tenorResult.effectiveRatePa / 100 / 12;
    const yearlyIns = tenorResult.insurance.yearlyBreakdown;

    const rows = [];
    let remainingPrincipal = principal;
    let cumulativePrincipal = 0;
    let cumulativeInterest = 0;
    let cumulativePaid = 0;

    for (let m = 1; m <= n; m++) {
      const currentYear = Math.ceil(m / 12);
      const yearInsInfo = yearlyIns[currentYear - 1] || yearlyIns[yearlyIns.length - 1];

      let interestPart = 0;
      let principalPart = 0;
      let installmentThisMonth = pmt;

      if (principal <= 0) {
        interestPart = 0;
        principalPart = 0;
        installmentThisMonth = 0;
      } else if (scheduleMode === 'anuitas' && rMonthly > 0) {
        interestPart = Math.round(remainingPrincipal * rMonthly);
        if (m === n) {
          principalPart = remainingPrincipal;
          interestPart = Math.max(0, installmentThisMonth - principalPart);
          installmentThisMonth = principalPart + interestPart;
        } else {
          principalPart = Math.max(0, installmentThisMonth - interestPart);
          if (principalPart > remainingPrincipal) {
            principalPart = remainingPrincipal;
          }
        }
      } else {
        // Mode Flat Proporsional
        if (m === n) {
          principalPart = remainingPrincipal;
          interestPart = Math.max(0, tenorResult.totalInterest - cumulativeInterest);
          installmentThisMonth = principalPart + interestPart;
        } else {
          principalPart = Math.round(principal / n);
          interestPart = Math.max(0, installmentThisMonth - principalPart);
        }
      }

      const beginningBalance = remainingPrincipal;
      remainingPrincipal = Math.max(0, remainingPrincipal - principalPart);
      cumulativePrincipal += principalPart;
      cumulativeInterest += interestPart;
      cumulativePaid += installmentThisMonth;

      const paidPct = principal > 0 ? Math.min(100, (cumulativePrincipal / principal) * 100) : 100;

      // Susun anotasi kontekstual per bulan seperti KPR + spesifik KKB (proteksi asuransi & depresiasi)
      const annotations = [];
      let badgeType = 'regular';

      if (m === 1) {
        badgeType = 'start';
        if (tenorResult.installmentType === 'ADDM') {
          annotations.push('Dibayar di muka saat Akad (masuk TDP)');
        } else {
          annotations.push('Angsuran perdana (1 bln pasca Akad)');
        }
        if (yearInsInfo) {
          annotations.push(
            `Proteksi Thn 1: ${yearInsInfo.coverageType} (Nilai 100%)`
          );
        }
      } else if (m === n) {
        badgeType = 'finish';
        annotations.push('Pelunasan Akhir & Pengambilan BPKB Asli');
      } else if ((m - 1) % 12 === 0) {
        // Awal tahun baru (Bulan 13, 25, 37, 49)
        const prevIns = yearlyIns[currentYear - 2];
        badgeType = 'year-start';
        if (yearInsInfo) {
          const switchedToTlo =
            prevIns &&
            prevIns.coverageType === 'All Risk' &&
            yearInsInfo.coverageType === 'TLO';
          if (switchedToTlo) {
            badgeType = 'coverage-switch';
            annotations.push(
              `Awal Thn ke-${currentYear}: Peralihan Asuransi All Risk → TLO (Pertanggungan ${yearInsInfo.depreciationPct}%)`
            );
          } else {
            annotations.push(
              `Awal Thn ke-${currentYear}: Asuransi ${yearInsInfo.coverageType} (Pertanggungan ${yearInsInfo.depreciationPct}%)`
            );
          }
        }
      } else if (m % 12 === 0) {
        badgeType = 'year-end';
        annotations.push(
          `Akhir Tahun ke-${currentYear} • Pokok lunas ${paidPct.toFixed(1)}%`
        );
      } else if (paidPct >= 50 && ((cumulativePrincipal - principalPart) / (principal || 1)) * 100 < 50) {
        badgeType = 'milestone';
        annotations.push('Milestone: >50% Pokok Pinjaman telah terbayar');
      } else {
        annotations.push(
          `Tahun ke-${currentYear} (Bln ${((m - 1) % 12) + 1}/12) • ${yearInsInfo ? yearInsInfo.coverageType : '-'}`
        );
      }

      rows.push({
        month: m,
        year: currentYear,
        beginningBalance,
        principalPart,
        interestPart,
        installment: installmentThisMonth,
        endingBalance: remainingPrincipal,
        cumulativePrincipal,
        cumulativeInterest,
        cumulativePaid,
        paidPct,
        coverageType: yearInsInfo ? yearInsInfo.coverageType : '-',
        depreciationPct: yearInsInfo ? yearInsInfo.depreciationPct : 100,
        annotation: annotations.join(' • '),
        badgeType
      });
    }

    return rows;
  }

  /**
   * Menghitung semua pilihan Tenor standar (12, 24, 36, 48, 60 bulan) sekaligus
   * serta perbandingan lintas 3 skema (Regular, LNP, Karyawan)
   */
  function calculateFullSuite(baseParams) {
    const standardTenors = [12, 24, 36, 48, 60];
    const minDpInfo = calculateMinDP(baseParams);

    const tenorResults = standardTenors.map((tenorMonths) =>
      calculateForTenor(Object.assign({}, baseParams, { tenorMonths }))
    );

    const selectedTenor = baseParams.selectedTenor || 36;
    const activeResult =
      tenorResults.find((r) => r.tenorMonths === selectedTenor) || tenorResults[2];

    // Bandingkan 3 skema pada tenor terpilih (menggunakan default admin/provisi/blokir masing-masing skema
    // kecuali skema yang sedang aktif memakai input form saat ini)
    const schemeComparison = ['regular', 'lnp', 'karyawan'].map((sId) => {
      const sch = (baseParams.schemes || Config.DEFAULT_SCHEMES)[sId];
      const isCurrent = sId === baseParams.schemeId;
      const blokirDefault =
        (sch.defaultBlokirByFinancing && sch.defaultBlokirByFinancing[baseParams.financingType]) || 0;

      return calculateForTenor(
        Object.assign({}, baseParams, {
          schemeId: sId,
          tenorMonths: activeResult.tenorMonths,
          adminFee: isCurrent ? baseParams.adminFee : sch.defaultAdmin,
          provisiPct: isCurrent ? baseParams.provisiPct : sch.defaultProvisiPct,
          polisFee: isCurrent ? baseParams.polisFee : sch.defaultPolis,
          blokirFee: isCurrent ? baseParams.blokirFee : blokirDefault
        })
      );
    });

    return {
      minDpInfo,
      tenorResults,
      activeResult,
      schemeComparison
    };
  }

  global.KKBCalculator = {
    calculateMinDP,
    calculateFidusia,
    lookupBaseInsuranceRate,
    calculateInsuranceForTenor,
    calculateCreditFees,
    solveEffectiveAnnualRate,
    calculateForTenor,
    generateAmortizationSchedule,
    calculateFullSuite
  };
})(window);
