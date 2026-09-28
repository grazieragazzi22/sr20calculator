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

  // TAKEOFF PERFORMANCE LOOKUP
  const toTable = (typeof DATA_TO3150 !== 'undefined') ? DATA_TO3150 : [];
  const perfTO = lookupGrid(toTable, pa, temp);

  let tor = perfTO.gndRoll;
  let tod = perfTO.total50;
  if (hwc > 0 && typeof tor === 'number') {
    const factor = 1 - ((hwc / 12) * 0.10);
    tor = Math.round(tor * factor);
    tod = Math.round(tod * factor);
  }
  document.getElementById("out_tor").innerText = tor;
  document.getElementById("out_tod").innerText = tod;

  // LANDING PERFORMANCE LOOKUP
  const ldgTable = (typeof DATA_LDGDISTANCESFLAPS100 !== 'undefined') ? DATA_LDGDISTANCESFLAPS100 : [];
  const perfLDG = lookupGrid(ldgTable, pa, temp);
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

  // SPEEDS LOOKUP
  const speedsTable = (typeof DATA_TOLDGSPEED !== 'undefined') ? DATA_TOLDGSPEED : [];
  const speeds = lookupSpeeds(speedsTable, tom);
  document.getElementById("out_vr").innerText = speeds.vr;
  document.getElementById("out_vlof").innerText = speeds.vlof;
  document.getElementById("out_vref").innerText = speeds.vref100;
  document.getElementById("out_vtgt").innerText = speeds.vref100 + Math.max(0, Math.round(hwc / 2));

  // CLIMB RATE LOOKUP
  const rocTable = (typeof DATA_TOCLBPERFROC !== 'undefined') ? DATA_TOCLBPERFROC : [];
  document.getElementById("out_roc").innerText = lookupROC(rocTable, pa, temp);

  // CRUISE FUEL FLOW LOOKUP
  const cruiseTable = (typeof DATA_CRUISEPERF !== 'undefined') ? DATA_CRUISEPERF : [];
  document.getElementById("out_ff").innerText = lookupCruiseFF(cruiseTable, pa);
}

function lookupGrid(table, targetPA, targetTemp) {
  if (!table || table.length === 0) return { gndRoll: "--", total50: "--" };
  
  // Calculate nearest 10-degree increment for columns (0, 10, 20, 30, 40, 50)
  let roundedTemp = Math.round(targetTemp / 10) * 10;
  if (roundedTemp < 0) roundedTemp = 0;
  if (roundedTemp > 50) roundedTemp = 50;
  let tempKey = roundedTemp + "_C";

  let closestGndRow = null;
  let closestTotalRow = null;
  let minDiffGnd = Infinity;
  let minDiffTotal = Infinity;
  
  for (let row of table) {
    let paVal = parseFloat(row.PRESS_ALT_FT);
    if (isNaN(paVal)) continue;

    let diff = Math.abs(paVal - targetPA);

    // The JSON splits Gnd Roll and Total 50ft into separate rows
    if (row.DISTANCE_TYPE === "Gnd Roll" && diff < minDiffGnd) {
      minDiffGnd = diff;
      closestGndRow = row;
    } else if (row.DISTANCE_TYPE === "Total Over 50FT" && diff < minDiffTotal) {
      minDiffTotal = diff;
      closestTotalRow = row;
    }
  }

  let gndRoll = closestGndRow ? closestGndRow[tempKey] : "--";
  let total50 = closestTotalRow ? closestTotalRow[tempKey] : "--";

  // Fallback to ISA column if the selected temp cell is missing/NaN
  if (gndRoll === undefined || isNaN(gndRoll)) gndRoll = closestGndRow ? closestGndRow["ISA"] : "--";
  if (total50 === undefined || isNaN(total50)) total50 = closestTotalRow ? closestTotalRow["ISA"] : "--";

  return { gndRoll, total50 };
}

function lookupSpeeds(table, weight) {
  if (!table || table.length === 0) return { vr: 65, vlof: 68, vref100: 71 };
  
  let closest = table[0];
  let minDiff = Infinity;
  
  for (let row of table) {
    let w = parseFloat(row.WEIGHT_LBS);
    if (isNaN(w)) continue;
    
    let diff = Math.abs(w - weight);
    if (diff < minDiff) {
      minDiff = diff;
      closest = row;
    }
  }
  
  return {
    vr: closest.TAKEOFF_FLAPS_50_VR_KIAS || 65,
    vlof: closest.TAKEOFF_FLAPS_50_VLOF_KIAS || 68,
    vref100: closest.LANDING_VREF_FLAPS_100_KIAS || 71
  };
}

function lookupROC(table, targetPA, targetTemp) {
  if (!table || table.length === 0) return "--";
  
  let roundedTemp = Math.round(targetTemp / 10) * 10;
  if (roundedTemp < -20) roundedTemp = -20;
  if (roundedTemp > 50) roundedTemp = 50;
  let tempKey = roundedTemp < 0 ? `MINUS_${Math.abs(roundedTemp)}_C` : `${roundedTemp}_C`;

  let closest = table[0];
  let minDiff = Infinity;
  
  for (let row of table) {
    // Only parse ROC for Max Gross Weight (3150 lbs)
    let w = parseFloat(row.WEIGHT_LB);
    if (w !== 3150 || isNaN(w)) continue;

    let paVal = parseFloat(row.PRESS_ALT_FT);
    if (isNaN(paVal)) continue;

    let diff = Math.abs(paVal - targetPA);
    if (diff < minDiff) {
      minDiff = diff;
      closest = row;
    }
  }
  
  let roc = closest[tempKey];
  if (roc === undefined || isNaN(roc)) roc = closest["ISA"];
  
  return roc !== undefined && !isNaN(roc) ? roc : "--";
}

function lookupCruiseFF(table, targetPA) {
  if (!table || table.length === 0) return "--";
  
  let closest = table[0];
  let minDiff = Infinity;
  
  for (let row of table) {
    let paVal = parseFloat(row.PRESS_ALT_FT);
    if (isNaN(paVal)) continue;

    let diff = Math.abs(paVal - targetPA);
    if (diff < minDiff) {
      minDiff = diff;
      closest = row;
    }
  }
  
  return closest.ISA_GPH !== undefined && !isNaN(closest.ISA_GPH) ? closest.ISA_GPH : "--";
}

// Init
calculate();
