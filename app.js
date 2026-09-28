function calculate() {
  const bew = parseFloat(document.getElementById("bew").value) || 0;
  const bewMoment = parseFloat(document.getElementById("bew_moment").value) || 0;
  const front = parseFloat(document.getElementById("front").value) || 0;
  const rear = parseFloat(document.getElementById("rear").value) || 0;
  const bag = parseFloat(document.getElementById("baggage").value) || 0;
  const fuelGal = parseFloat(document.getElementById("fuel").value) || 0;
  const tripFuelGal = parseFloat(document.getElementById("trip_fuel").value) || 0;

  const elev = parseFloat(document.getElementById("elev").value) || 0;
  const rwyLen = parseFloat(document.getElementById("rwy_len").value) || 0;
  const qnh = parseFloat(document.getElementById("qnh").value) || 29.92;
  const temp = parseFloat(document.getElementById("temp").value) || 0;
  const rwyHdg = parseFloat(document.getElementById("rwy_hdg").value) || 0;
  const windDir = parseFloat(document.getElementById("wind_dir").value) || 0;
  const windSpd = parseFloat(document.getElementById("wind_spd").value) || 0;

  const arms = (typeof ARMS !== 'undefined') ? ARMS : { frontSeats: 143.5, rearSeats: 180.0, baggage: 208.0, fuel: 153.8 };
  
  const fuelLbs = fuelGal * 6;
  const tripFuelLbs = tripFuelGal * 6;
  const zfm = bew + front + rear + bag;
  const tom = zfm + fuelLbs;
  const lm = tom - tripFuelLbs;

  const zfmMoment = bewMoment + (front * arms.frontSeats / 1000) + (rear * arms.rearSeats / 1000) + (bag * arms.baggage / 1000);
  const tomMoment = zfmMoment + (fuelLbs * arms.fuel / 1000);

  document.getElementById("out_zfm").innerText = zfm.toFixed(1);
  document.getElementById("out_to_fuel").innerText = fuelLbs.toFixed(0);
  document.getElementById("out_tom").innerText = tom.toFixed(1);
  document.getElementById("out_tom_moment").innerText = tomMoment.toFixed(1);
  document.getElementById("out_lw").innerText = lm.toFixed(1);
  document.getElementById("out_lm").innerText = lm.toFixed(1);

  if (tom <= 3150 && tomMoment >= 304 && tomMoment <= 448) {
    document.getElementById("out_cg_status").innerText = "WITHIN LIMITS";
    document.getElementById("out_cg_status").className = "font-bold text-green-600";
  } else {
    document.getElementById("out_cg_status").innerText = "OUT OF LIMITS!";
    document.getElementById("out_cg_status").className = "font-bold text-red-600";
  }

  const pa = elev + 145442 * (1 - Math.pow(qnh / 29.92, 0.190261));
  const isaTemp = 15 - (1.98 * (pa / 1000));
  const da = pa + 120 * (temp - isaTemp);

  document.getElementById("out_pa").innerText = Math.round(pa);
  document.getElementById("out_da").innerText = Math.round(da);

  const windRad = (windDir - rwyHdg) * (Math.PI / 180);
  const hwc = Math.round(windSpd * Math.cos(windRad));
  const cwc = Math.abs(Math.round(windSpd * Math.sin(windRad)));

  document.getElementById("out_wind_comp").innerText = hwc >= 0 ? `${hwc} KTS HW` : `${Math.abs(hwc)} KTS TW`;
  document.getElementById("out_cwc").innerText = cwc;

  // --- DEBUG LOGGING START ---
  console.log(`[CALC] Target PA: ${Math.round(pa)} FT | Target Temp: ${temp}°C | TOM: ${tom.toFixed(1)} lbs`);

  const toTable = (typeof DATA_TO3150 !== 'undefined') ? DATA_TO3150 : [];
  console.log(`[CALC] Loaded TO Table. Length: ${toTable.length}`);
  if (toTable.length === 0 && typeof logMsg === 'function') logMsg("TO Table is missing or empty!", "error");
  
  const perfTO = lookupGrid(toTable, pa, temp, "TAKEOFF");

  let tor = perfTO.gndRoll;
  let tod = perfTO.total50;
  if (hwc > 0 && typeof tor === 'number') {
    const factor = 1 - ((hwc / 12) * 0.10);
    tor = Math.round(tor * factor);
    tod = Math.round(tod * factor);
  }
  document.getElementById("out_tor").innerText = tor;
  document.getElementById("out_tod").innerText = tod;

  const ldgTable = (typeof DATA_LDGDISTANCESFLAPS100 !== 'undefined') ? DATA_LDGDISTANCESFLAPS100 : [];
  console.log(`[CALC] Loaded LDG Table. Length: ${ldgTable.length}`);
  if (ldgTable.length === 0 && typeof logMsg === 'function') logMsg("LDG Table is missing or empty!", "error");

  const perfLDG = lookupGrid(ldgTable, pa, temp, "LANDING");
  let ldr = perfLDG.gndRoll;
  document.getElementById("out_ldr").innerText = ldr;

  if (tod !== "--" && ldr !== "--" && rwyLen > 0) {
    if (tod <= rwyLen && ldr <= rwyLen) {
      document.getElementById("out_perf_status").innerText = "OK (Within Limits)";
      document.getElementById("out_perf_status").className = "font-bold text-green-600";
    } else {
      document.getElementById("out_perf_status").innerText = "NOT OK (Exceeds Rwy)";
      document.getElementById("out_perf_status").className = "font-bold text-red-600";
    }
  } else {
    document.getElementById("out_perf_status").innerText = "--";
    document.getElementById("out_perf_status").className = "font-bold text-slate-800";
  }

  const speedsTable = (typeof DATA_TOLDGSPEED !== 'undefined') ? DATA_TOLDGSPEED : [];
  const speeds = lookupSpeeds(speedsTable, tom);
  document.getElementById("out_vr").innerText = speeds.vr;
  document.getElementById("out_vlof").innerText = speeds.vlof;
  document.getElementById("out_vref").innerText = speeds.vref100;
  document.getElementById("out_vtgt").innerText = speeds.vref100 + Math.max(0, Math.round(hwc / 2));

  const rocTable = (typeof DATA_TOCLBPERFROC !== 'undefined') ? DATA_TOCLBPERFROC : [];
  document.getElementById("out_roc").innerText = lookupROC(rocTable, pa, temp);

  const cruiseTable = (typeof DATA_CRUISEPERF !== 'undefined') ? DATA_CRUISEPERF : [];
  document.getElementById("out_ff").innerText = lookupCruiseFF(cruiseTable, pa);
}

function lookupGrid(table, targetPA, targetTemp, debugName = "GRID") {
  if (!table || table.length === 0) return { gndRoll: "--", total50: "--" };
  
  let closest = table[0];
  let minDiff = Infinity;
  let foundPA = null;
  
  for (let row of table) {
    let paVal = row.PRESS_ALT_FT !== undefined ? row.PRESS_ALT_FT : (row.pa || 0);
    let diff = Math.abs(paVal - targetPA);
    if (diff < minDiff) {
      minDiff = diff;
      closest = row;
      foundPA = paVal;
    }
  }

  let tempKey = targetTemp <= 10 ? "0_C" : (targetTemp <= 30 ? "20_C" : "40_C");
  
  console.log(`[LOOKUP ${debugName}] Target PA: ${Math.round(targetPA)} -> Matched PA row: ${foundPA}`);
  console.log(`[LOOKUP ${debugName}] Target Temp: ${targetTemp} -> Using column key: ${tempKey}`);
  console.log(`[LOOKUP ${debugName}] Row object available data:`, closest);

  let gndRoll = "--";
  let total50 = "--";

  // Check Nested Object (e.g. row["20_C"].gndRoll)
  if (closest[tempKey] && typeof closest[tempKey] === 'object') {
    console.log(`[LOOKUP ${debugName}] Found nested object for ${tempKey}`);
    gndRoll = closest[tempKey].gndRoll || closest[tempKey].GROUND_ROLL || "--";
    total50 = closest[tempKey].total50 || closest[tempKey].TOTAL_50FT || "--";
  } else {
    // Check Flat Structure (e.g. row["20_C_GND_ROLL"])
    console.log(`[LOOKUP ${debugName}] Checking flat structure keys...`);
    gndRoll = closest[`${tempKey}_GND_ROLL`] || closest.gndRoll || closest.GROUND_ROLL || "--";
    total50 = closest[`${tempKey}_TOTAL_50`] || closest.total50 || closest.TOTAL_50FT || "--";
  }

  if (gndRoll === "--" && typeof logMsg === 'function') {
    logMsg(`${debugName} parsing failed for PA ${foundPA}. Keys mismatch.`, "error");
  }

  return { gndRoll, total50 };
}

function lookupSpeeds(table, weight) {
  if (!table || table.length === 0) return { vr: 65, vlof: 68, vref100: 71 };
  for (let row of table) {
    let w = row.WEIGHT_LBS !== undefined ? row.WEIGHT_LBS : (row.WEIGHT || 0);
    if (weight >= w) {
      return {
        vr: row.TAKEOFF_FLAPS_50_VR_KIAS || row.VR || 65,
        vlof: row.TAKEOFF_FLAPS_50_VLOF_KIAS || row.VLOF || 68,
        vref100: row.LANDING_VREF_FLAPS_100_KIAS || row.VREF || 71
      };
    }
  }
  return { vr: 71, vlof: 75, vref100: 78 };
}

function lookupROC(table, targetPA, targetTemp) {
  if (!table || table.length === 0) return "--";
  let closest = table[0];
  let minDiff = Infinity;
  for (let row of table) {
    let paVal = row.PRESS_ALT_FT !== undefined ? row.PRESS_ALT_FT : (row.pa || 0);
    let diff = Math.abs(paVal - targetPA);
    if (diff < minDiff) {
      minDiff = diff;
      closest = row;
    }
  }
  let tempKey = targetTemp <= 10 ? "0_C" : (targetTemp <= 30 ? "20_C" : "40_C");
  return closest[`${tempKey}_ROC`] || closest[tempKey] || closest.ISA || closest.ROC || "--";
}

function lookupCruiseFF(table, targetPA) {
  if (!table || table.length === 0) return "--";
  let closest = table[0];
  let minDiff = Infinity;
  for (let row of table) {
    let paVal = row.PRESS_ALT_FT !== undefined ? row.PRESS_ALT_FT : (row.pa || 0);
    let diff = Math.abs(paVal - targetPA);
    if (diff < minDiff) {
      minDiff = diff;
      closest = row;
    }
  }
  return closest.ISA_GPH || closest.GPH || closest.FF || "11.0";
}

// Init
calculate();
