"""Run with Python + Playwright; uses the installed Microsoft Edge browser."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import atexit
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
atexit.register(server.server_close)
atexit.register(server.shutdown)
URL = f'http://127.0.0.1:{server.server_port}/index.html'

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True, args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(URL)
    page.wait_for_function("document.querySelectorAll('#inputModel option').length > 0")
    assert page.locator("#inputModel").input_value() == "AVANZA"
    assert page.locator("#inputDpValue").input_value() == "15"
    assert page.locator("#inputVehicleType").count() == 0
    assert page.locator("#inputPolisFee").input_value() == "60.000"
    assert page.locator("#inputBlokirFee").input_value() == "500.000"
    assert page.locator("#perilCheckboxesContainer .peril-rate").count() == 0
    assert page.locator(".table-amort th", has_text="Progres").count() == 0
    assert page.locator(".table-amort th", has_text="Anotasi").count() == 0
    assert page.locator("#amortizationBody .progress").count() == 0
    assert page.locator("details, summary").count() == 0
    assert page.locator("#btnAmortFlat, #btnAmortAnuitas").count() == 0
    assert page.get_by_text("Proporsional Flat", exact=False).count() == 0
    assert page.locator("#wrapYearlyInsurance").is_hidden()
    assert page.locator(".fee-subrow").first.is_hidden()
    logo = page.locator(".brand-logo")
    assert logo.get_attribute("src") == "LOGO_BRI_KKB.png"
    assert logo.evaluate("img => img.complete && img.naturalWidth > 0"), "logo failed to load"
    result = page.evaluate("""() => {
      const catalog = KKBVehicles;
      const calc = KKBCalculator;
      const cfg = KKBConfig;
      const assert = (condition, message) => { if (!condition) throw Error(message); };
      assert(cfg.VEHICLE_TYPES.length === 2, 'only 2 insurance vehicle types active');
      assert(new Set(cfg.INSURANCE_BASE_RATES.map(r => r.type)).size === 2, 'base rates limited to 2 types');
      const expectedFlat = {
        karyawan: {12: 4.00, 24: 4.25, 36: 4.50, 48: 4.75, 60: 5.00},
        lnp: {12: 4.50, 24: 4.75, 36: 5.00, 48: 5.25, 60: 5.50},
        regular: {12: 5.00, 24: 5.50, 36: 5.60, 48: 5.80, 60: 6.00}
      };
      const expectedEff = {
        karyawan: {12: 7.30, 24: 7.96, 36: 8.41, 48: 8.80, 60: 9.15},
        lnp: {12: 8.21, 24: 8.87, 36: 9.31, 48: 9.68, 60: 10.01},
        regular: {12: 9.10, 24: 10.23, 36: 10.38, 48: 10.63, 60: 10.85}
      };
      assert(cfg.DEFAULT_SCHEMES.regular.interestRates['New Car'][12] === 3.28, 'New Car regular flat 12');
      assert(cfg.DEFAULT_SCHEMES.lnp.effectiveRates['Refinancing'][48] === 9.94, 'Refi LNP eff 48');
      for (const [schId, tenorMap] of Object.entries(expectedFlat)) {
        const sch = cfg.DEFAULT_SCHEMES[schId];
        for (const [t, rate] of Object.entries(tenorMap)) {
          assert(sch.interestRates['Mobil Niaga'][t] === rate, `${schId} Mobil Niaga flat ${t}`);
          assert(sch.effectiveRates['Mobil Niaga'][t] === expectedEff[schId][t], `${schId} Mobil Niaga eff ${t}`);
        }
        for (const fin of ['Used Car', 'Refinancing']) {
          assert(JSON.stringify(sch.tenorsByFinancing[fin]) === '[12,24,36,48]', `${schId} ${fin} max 48`);
        }
        assert(sch.tenorsByFinancing['New Car'].length === 5, `${schId} New Car 60`);
        assert(cfg.DEFAULT_SCHEMES[schId].defaultPolis === 60000, `${schId} polis 60rb`);
        for (const fin of ['New Car', 'Used Car', 'Refinancing', 'Mobil Niaga']) {
          assert(cfg.DEFAULT_SCHEMES[schId].defaultBlokirByFinancing[fin] === 500000, `${schId} ${fin} blokir 500rb`);
        }
      }
      // Provisi = Biaya Provisi (%) * Pokok Hutang (bukan Harga Kendaraan)
      const sim = calc.calculateForTenor({
        schemeId: 'regular', financingType: 'Mobil Niaga', wilayah: '2',
        vehiclePrice: 300000000, dpAmount: 60000000, provisiPct: 1.0,
        polisFee: 60000, blokirFee: 500000, tenorMonths: 36
      });
      assert(sim.principalLoan === 240000000, 'principal loan');
      assert(sim.creditFees.provisiAmount === 2400000, 'provisi must be % * Pokok Hutang');
      assert(sim.flatRatePa === 5.60, 'Mobil Niaga 36m regular flat rate');
      assert(sim.effectiveRatePa === 10.38, 'Mobil Niaga 36m regular effective rate');
      // ADDB (default): bulan ke-1 SUDAH ada porsi bunga (bukan 0)
      const schedAddb = calc.generateAmortizationSchedule(sim);
      assert(schedAddb[0].interestPart > 0, 'ADDB month 1 must have interest');
      assert(schedAddb[1].interestPart > 0 && schedAddb[1].interestPart < schedAddb[0].interestPart, 'ADDB effective interest decreases');
      assert(schedAddb[schedAddb.length - 1].endingBalance === 0, 'ADDB loan fully paid');
      assert(schedAddb.reduce((a, r) => a + r.principalPart, 0) === sim.principalLoan, 'ADDB principal sum');
      assert(schedAddb.every(r => r.installment === sim.monthlyInstallment), 'ADDB constant installment');

      // ADDM: khusus ADDM bulan ke-1 seluruhnya porsi pokok tanpa bunga, bulan ke-2 dst ada bunga
      const simAddm = calc.calculateForTenor({
        schemeId: 'regular', financingType: 'Mobil Niaga', wilayah: '2',
        vehiclePrice: 300000000, dpAmount: 60000000, provisiPct: 1.0,
        polisFee: 60000, blokirFee: 500000, tenorMonths: 36,
        rateType: 'efektif', installmentType: 'ADDM'
      });
      const schedAddm = calc.generateAmortizationSchedule(simAddm);
      assert(schedAddm[0].interestPart === 0 && schedAddm[0].principalPart === simAddm.monthlyInstallment, 'ADDM month 1 principal only');
      assert(schedAddm[1].interestPart > 0, 'ADDM month 2 has interest');
      assert(schedAddm[schedAddm.length - 1].endingBalance === 0, 'ADDM loan fully paid');
      assert(schedAddm.reduce((a, r) => a + r.principalPart, 0) === simAddm.principalLoan, 'ADDM principal sum');
      assert(schedAddm.every(r => r.installment === simAddm.monthlyInstallment), 'ADDM constant installment');

      // Mode Bunga Flat (ADDB vs ADDM)
      const simFlatAddb = calc.calculateForTenor({
        schemeId: 'regular', financingType: 'Mobil Niaga', wilayah: '2',
        vehiclePrice: 300000000, dpAmount: 60000000, tenorMonths: 36,
        rateType: 'flat', installmentType: 'ADDB'
      });
      const schedFlatAddb = calc.generateAmortizationSchedule(simFlatAddb);
      assert(schedFlatAddb[0].interestPart > 0 && schedFlatAddb[0].interestPart === schedFlatAddb[1].interestPart, 'Flat ADDB month 1 has constant interest');
      assert(schedFlatAddb[schedFlatAddb.length - 1].endingBalance === 0, 'Flat ADDB fully paid');

      const simFlatAddm = calc.calculateForTenor({
        schemeId: 'regular', financingType: 'Mobil Niaga', wilayah: '2',
        vehiclePrice: 300000000, dpAmount: 60000000, tenorMonths: 36,
        rateType: 'flat', installmentType: 'ADDM'
      });
      const schedFlatAddm = calc.generateAmortizationSchedule(simFlatAddm);
      assert(schedFlatAddm[0].interestPart === 0 && schedFlatAddm[0].principalPart === simFlatAddm.monthlyInstallment, 'Flat ADDM month 1 no interest');
      assert(schedFlatAddm[1].interestPart > 0 && schedFlatAddm[1].interestPart === schedFlatAddm[2].interestPart, 'Flat ADDM month 2+ constant interest');
      assert(schedFlatAddm[schedFlatAddm.length - 1].endingBalance === 0, 'Flat ADDM fully paid');
      const usedSuite = calc.calculateFullSuite({brandValue: 'TOYOTA', modelValue: 'AVANZA', vehiclePrice: 300000000,
        dpAmount: 60000000, financingType: 'Used Car', schemeId: 'karyawan', selectedTenor: 60});
      assert(usedSuite.tenorResults.map(r => r.tenorMonths).join() === '12,24,36,48', 'used car tenors');
      assert(usedSuite.activeResult.tenorMonths === 48, 'used car falls back to 48');
      assert(sim.insurance.yearlyBreakdown[0].baseRatePct === 2.39, 'Mobil Niaga maps to Truk dan Pick up');
      // Urutan kolom Rincian TDP: Komponen Biaya | Nominal (Rp) | Keterangan
      const tdpHeaders = Array.from(document.querySelectorAll('#tdpTableBody')[0].closest('table').querySelectorAll('thead th')).map(th => th.textContent.trim());
      assert(tdpHeaders[1] === 'Nominal (Rp)' && tdpHeaders[2] === 'Keterangan', 'Nominal before Keterangan');

      const cases = [
        ['SUZUKI', 'KARIMUN', 20], ['DAIHATSU', 'SIRION', 25],
        ['HONDA', 'BRIO', 10], ['BMW', 'X6', 20], ['BMW', 'X5', 15],
        ['BYD', 'SEAL', 25], ['CITROEN', 'EC3', 25], ['MAXUS', 'MIFA', 25],
        ['FIAT', 'FIAT', 25], ['TOYOTA', 'BZ4X Panoramic', 25],
        ['MERCEDES-BENZ', 'EQA250 Electric', 25], ['WULING', 'AIR', 25]
      ];
      cases.forEach(([brand, model, dp]) => assert(catalog.find(brand, model)?.minDpPct === dp, model));
      assert(catalog.modelsFor('SUZUKI').filter(v => v.model === 'KARIMUN').length === 1, 'duplicate');
      assert(catalog.find(' toyota ', 'raize\\u00a0').minDpPct === 15, 'normalization');
      for (const row of catalog.vehicles) {
        for (const schemeId of ['regular', 'lnp', 'karyawan']) {
          for (const financingType of ['New Car', 'Used Car', 'Refinancing', 'Mobil Niaga']) {
            const params = {brandValue: row.brand, modelValue: row.model, vehiclePrice: 350000000,
              schemeId, financingType, fuelValue: 'ev', vehicleType: 'Truk dan Pick up',
              schemes: {regular: {dpSchemeModifier: -99}}};
            const min = calc.calculateMinDP(params);
            assert(min.minDpPct === row.minDpPct, 'DP changed with unrelated settings');
            assert(min.minDpAmount === 350000000 * row.minDpPct / 100, 'DP amount');
          }
        }
      }
      let rejected = false;
      try { calc.calculateMinDP({brandValue: 'HONDA', modelValue: 'INNOVA'}); }
      catch (error) { rejected = error instanceof RangeError; }
      assert(rejected, 'unknown pair must not silently use a default DP');
      const suite = calc.calculateFullSuite({brandValue: 'SUZUKI', modelValue: 'KARIMUN',
        vehiclePrice: 350000000, dpAmount: 70000000});
      assert(suite.minDpInfo.minDpPct === 20, 'suite lookup');
      assert(suite.tenorResults.every(r => Number.isFinite(r.totalDp)), 'finite results');
      return {brands: catalog.brands.length, models: catalog.vehicles.length};
    }""")

    page.select_option("#inputBrand", "SUZUKI")
    page.select_option("#inputModel", "KARIMUN")
    assert page.locator("#inputDpValue").input_value() == "20"
    page.click("#btnDpModeRp")
    assert page.locator("#inputDpValue").input_value() == "70.000.000"
    page.fill("#inputDpValue", "1000000")
    assert page.locator("#simulationNotice").is_visible()
    page.click("#btnApplyMinDp")
    assert page.locator("#inputDpValue").input_value() == "70.000.000"
    assert page.locator("#simulationNotice").is_hidden()
    page.click("#btnDpModePct")
    page.fill("#inputDpValue", "30")
    page.click('[data-scheme="lnp"]')
    assert page.locator("#inputDpValue").input_value() == "30"
    assert "20,0%" in page.locator("#dpMinText").inner_text()
    page.select_option("#inputFinancingType", "Refinancing")
    assert page.locator('tr[data-tenor="60"]').count() == 0
    assert "36 Bln" in page.locator("#kpiTenorLabel").text_content()
    page.select_option("#inputFinancingType", "Mobil Niaga")
    assert "9,31%" in page.locator("#kpiRateInfo").inner_text()
    page.click('[data-scheme="karyawan"]')
    assert "8,41%" in page.locator("#kpiRateInfo").inner_text()
    assert "Pokok Hutang" in page.locator("#provisiRpCaption").text_content()
    # Uji interaksi dropdown Jenis Suku Bunga (Efektif vs Flat) & Skema Angsuran (ADDB vs ADDM)
    assert page.locator("#inputRateType").input_value() == "efektif"
    assert page.locator("#amortizationBody tr").first.locator("td").nth(3).inner_text() != "Rp 0"
    page.select_option("#inputInstallmentType", "ADDM")
    assert page.locator("#amortizationBody tr").first.locator("td").nth(3).inner_text() == "Rp 0"
    assert page.locator("#amortizationBody tr").nth(1).locator("td").nth(3).inner_text() != "Rp 0"
    page.select_option("#inputRateType", "flat")
    assert "Bunga Flat" in page.locator("#kpiRateInfo").inner_text()
    assert page.locator("#amortizationBody tr").first.locator("td").nth(3).inner_text() == "Rp 0"
    page.select_option("#inputInstallmentType", "ADDB")
    assert page.locator("#amortizationBody tr").first.locator("td").nth(3).inner_text() != "Rp 0"
    page.click("#btnResetForm")
    assert page.locator("#inputRateType").input_value() == "efektif"
    assert page.locator("#inputInstallmentType").input_value() == "ADDB"
    assert page.locator("#inputBrand").input_value() == "TOYOTA"
    assert page.locator("#inputModel").input_value() == "AVANZA"
    assert page.locator("#inputDpValue").input_value() == "15"
    page.select_option("#inputBrand", "HONDA")
    assert page.locator('#inputModel option[value="AVANZA"]').count() == 0
    page.select_option("#inputModel", "BRIO")
    assert page.locator("#inputDpValue").input_value() == "10"
    page.fill("#inputVehiclePrice", "200000000")
    page.click("#btnDpModeRp")
    assert page.locator("#inputDpValue").input_value() == "20.000.000"
    page.click("#btnOpenRefModal")
    for tab in ["tabRates", "tabFees", "tabInsBase", "tabInsPeril", "tabFidusia"]:
        page.click(f'[data-tab="{tab}"]')
        assert page.locator("#refModalContent table").count() > 0
    page.click("#btnCloseRefModal")

    # Layout PC: form di atas (3 kolom sejajar), ringkasan di bawah
    layout = page.evaluate("""() => {
      const cols = [...document.querySelectorAll('.form-cols > .form-col')].map(c => c.getBoundingClientRect());
      return {count: cols.length, tops: cols.map(c => Math.round(c.top)), lefts: cols.map(c => c.left),
        formBottom: document.querySelector('.form-card').getBoundingClientRect().bottom,
        kpiTop: document.querySelector('.kpi-grid').getBoundingClientRect().top,
        asuransiInMiddle: !!cols.length && document.querySelectorAll('.form-cols > .form-col')[1].contains(document.querySelector('#inputCoverage')),
        biayaRight: document.querySelectorAll('.form-cols > .form-col')[2].contains(document.querySelector('#inputAdminFee'))};
    }""")
    assert layout["count"] == 3 and len(set(layout["tops"])) == 1, layout
    assert layout["lefts"][0] < layout["lefts"][1] < layout["lefts"][2], layout
    assert layout["formBottom"] <= layout["kpiTop"], layout
    assert layout["asuransiInMiddle"] and layout["biayaRight"], layout

    for width in [1440, 1024, 768, 390, 320]:
        page.set_viewport_size({"width": width, "height": 900})
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"overflow {width}"
        assert page.locator(".advanced-settings").is_visible()
        assert page.locator("#inputCoverage").is_visible()
        assert page.locator("#tdpTableBody").is_visible()
        page.click("#btnToggleInsurance")
        assert page.locator("#yearlyInsuranceBody").is_visible()
        page.click("#btnToggleInsurance")
        assert page.locator("#wrapYearlyInsurance").is_hidden()
        assert page.locator("#amortizationBody").is_visible()
        assert logo.is_visible()
    # Editing the CSV alone changes dropdown options and DP; removed defaults must also work on reset.
    csv_text = 'brand,model,category,depreciation,min_dp_pct\nTEST,NEW MODEL,Fast,Low,12\n'
    page.route('**/vehicles.csv', lambda route: route.fulfill(status=200, body=csv_text))
    page.reload()
    page.wait_for_function("document.querySelector('#inputModel').value === 'NEW MODEL'")
    assert page.locator('#inputDpValue').input_value() == '12'
    page.click('#btnResetForm')
    assert page.locator('#inputBrand').input_value() == 'TEST'
    assert page.locator('#inputDpValue').input_value() == '12'
    page.evaluate('''() => {
      const header = 'brand,model,category,depreciation,min_dp_pct\\n';
      KKBVehicles.loadText(header + 'A,"Model, ""Special""",Fast,Low,25\\nA,"Model, ""Special""",Fast,Low,20');
      if (KKBVehicles.vehicles.length !== 1 || KKBVehicles.vehicles[0].minDpPct !== 20) throw Error('quoted/duplicate');
      KKBVehicles.loadText('\\uFEFFbrand;model;category;depreciation;min_dp_pct\\r\\nA;B;Fast;Low;"12,5"');
      if (KKBVehicles.find('A', 'B').minDpPct !== 12.5) throw Error('Excel CSV');
      for (const invalid of ['', header, header + 'A,B,Fast,Low,abc', header + 'A,B,Fast,Low,101', header + 'A,B,Fast,Low,']) {
        let rejected = false;
        try { KKBVehicles.loadText(invalid); } catch { rejected = true; }
        if (!rejected) throw Error('Invalid CSV accepted');
      }
    }''')
    page.unroute('**/vehicles.csv')
    page.route('**/vehicles.csv', lambda route: route.fulfill(status=404, body='missing'))
    page.reload()
    page.wait_for_function("document.querySelector('#simulationNotice').textContent.includes('gagal dimuat')")
    assert page.locator('#inputBrand').is_disabled()
    assert page.locator('.kpi-grid').is_hidden()
    assert not errors, errors
    print(f"PASS: {result}, DP invariance, cascading models, reset, DP modes, warning, modal, responsive layouts")
    browser.close()
