// LOGGER HELPER
function logMsg(msg, type = 'info') {
  const logBox = document.getElementById("debug_log");
  if (!logBox) return;
  const time = new Date().toLocaleTimeString();
  let colorClass = "text-green-400";
  if (type === 'warn') colorClass = "text-yellow-400";
  if (type === 'error') colorClass = "text-red-400";

  const line = document.createElement("div");
  line.className = colorClass;
  line.innerText = `[${time}] ${msg}`;
  logBox.appendChild(line);
  logBox.scrollTop = logBox.scrollHeight;
}

function clearLog() {
  document.getElementById("debug_log").innerHTML = `<div>[SYSTEM] Log cleared.</div>`;
}

// AIRPORT DATA FETCHER
async function fetchAirportData() {
  const icao = document.getElementById("icao").value.trim().toUpperCase();
  const statusEl = document.getElementById("status_msg");
  const btn = document.getElementById("apt_btn");

  if (!icao) return alert("Enter an ICAO code.");

  logMsg(`--- START AIRPORT IMPORT: ${icao} ---`);
  statusEl.classList.remove("hidden");
  statusEl.innerText = `Loading airport data for ${icao}...`;
  btn.disabled = true;

  if (typeof AIRPORTS !== 'undefined' && AIRPORTS[icao]) {
    logMsg(`Found ${icao} in local AIRPORTS database!`);
    const apt = AIRPORTS[icao];
    document.getElementById("elev").value = apt.elev;
    
    const rwySelect = document.getElementById("rwy_select");
    rwySelect.innerHTML = "";
    
    apt.rwys.forEach(rwy => {
      const opt = document.createElement("option");
      opt.value = `${rwy.hdg},${rwy.len}`;
      opt.innerText = `Rwy ${rwy.name} (${rwy.len} FT)`;
      rwySelect.appendChild(opt);
    });

    const customOpt = document.createElement("option");
    customOpt.value = "custom";
    customOpt.innerText = "Custom Runway...";
    rwySelect.appendChild(customOpt);

    selectRunway();
    statusEl.innerText = `Airport Data Loaded: ${apt.name}`;
    statusEl.className = "text-xs text-green-600 font-semibold";
    btn.disabled = false;
    return;
  }

  logMsg(`Not found in local DB. Querying FAA API...`, 'warn');

  const faaIdent = icao.length === 4 && icao.startsWith("K") ? icao.substring(1) : icao;
  const targetUrl = `https://av-info.faa.gov/api/v2/airport/ident/${faaIdent}`;
  const urlsToTry = [
    targetUrl,
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
  ];

  let success = false;

  for (let url of urlsToTry) {
    logMsg(`Trying endpoint: ${url.substring(0, 60)}...`);
    try {
      const res = await fetch(url);
      logMsg(`Response status: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.airport) {
          const apt = data.airport;
          if (apt.elevation) document.getElementById("elev").value = Math.round(apt.elevation);

          const rwySelect = document.getElementById("rwy_select");
          rwySelect.innerHTML = "";

          if (apt.runways) {
            apt.runways.forEach(rwy => {
              const len = rwy.length || 0;
              const hdg = parseInt(rwy.ident.replace(/\D/g, '')) * 10 || 0;
              const opt = document.createElement("option");
              opt.value = `${hdg},${len}`;
              opt.innerText = `Rwy ${rwy.ident} (${len} FT)`;
              rwySelect.appendChild(opt);
            });
          }

          const customOpt = document.createElement("option");
          customOpt.value = "custom";
          customOpt.innerText = "Custom Runway...";
          rwySelect.appendChild(customOpt);

          selectRunway();
          statusEl.innerText = `Airport Data Imported: ${apt.name || icao}`;
          statusEl.className = "text-xs text-green-600 font-semibold";
          logMsg(`Successfully parsed FAA data for ${icao}!`);
          success = true;
          break;
        }
      }
    } catch (err) {
      logMsg(`Fetch failed on endpoint: ${err.message}`, 'error');
    }
  }

  if (!success) {
    statusEl.innerText = `Could not fetch FAA data. Enter runway specs manually.`;
    statusEl.className = "text-xs text-red-500 font-semibold";
    logMsg(`FAA Import failed for ${icao}.`, 'error');
  }

  btn.disabled = false;
}

function selectRunway() {
  const val = document.getElementById("rwy_select").value;
  if (val && val !== "custom") {
    const [hdg, len] = val.split(",");
    document.getElementById("rwy_hdg").value = hdg;
    document.getElementById("rwy_len").value = len;
    if (typeof calculate === 'function') calculate();
  }
}

// METAR FETCHER
async function fetchMetar() {
  const icaoInput = document.getElementById("icao").value.trim().toUpperCase();
  const statusEl = document.getElementById("status_msg");
  const btn = document.getElementById("metar_btn");

  if (!icaoInput) return alert("Please enter a valid ICAO code.");

  logMsg(`--- START METAR IMPORT: ${icaoInput} ---`);
  statusEl.classList.remove("hidden");
  statusEl.innerText = `Fetching METAR for ${icaoInput}...`;
  btn.disabled = true;

  const metarUrls = [
    `https://metar.vatsim.net/${icaoInput}`,
    `https://aviationweather.gov/api/data/metar?ids=${icaoInput}&format=json`
  ];

  let rawMetar = "";

  for (let url of metarUrls) {
    logMsg(`Fetching METAR from: ${url.substring(0, 60)}...`);
    try {
      const res = await fetch(url);
      logMsg(`Status: ${res.status}`);
      if (res.ok) {
        if (url.includes("vatsim")) {
          rawMetar = await res.text();
        } else {
          const data = await res.json();
          if (data && data.length > 0) rawMetar = data[0].rawOb || "";
        }
        if (rawMetar) {
          logMsg(`METAR text received: "${rawMetar.trim()}"`);
          break;
        }
      }
    } catch (err) {
      logMsg(`METAR fetch error: ${err.message}`, 'error');
    }
  }

  if (rawMetar) {
    parseAndApplyMetar(rawMetar);
    statusEl.innerText = `METAR Imported: ${rawMetar.trim()}`;
    statusEl.className = "text-xs text-green-600 font-semibold";
  } else {
    statusEl.innerText = `Could not fetch METAR for ${icaoInput}.`;
    statusEl.className = "text-xs text-red-500 font-semibold";
    logMsg(`All METAR endpoints failed for ${icaoInput}.`, 'error');
  }

  btn.disabled = false;
}

function parseAndApplyMetar(raw) {
  logMsg("Parsing METAR strings...");

  const tempMatch = raw.match(/\b(M?\d{2})\/(M?\d{2})?\b/);
  if (tempMatch) {
    let t = tempMatch[1].replace("M", "-");
    document.getElementById("temp").value = parseInt(t, 10);
    logMsg(`Parsed Temp: ${t}°C`);
  }

  const altMatch = raw.match(/\b([AQ])(\d{4})\b/);
  if (altMatch) {
    const type = altMatch[1];
    const val = parseInt(altMatch[2], 10);
    let qnhVal = 29.92;
    if (type === 'A') qnhVal = (val / 100).toFixed(2);
    if (type === 'Q') qnhVal = (val * 0.0295301).toFixed(2);
    document.getElementById("qnh").value = qnhVal;
    logMsg(`Parsed Altimeter: ${qnhVal} inHg`);
  }

  const windMatch = raw.match(/\b(\d{3}|VRB)(\d{2,3})(G\d{2,3})?KT\b/);
  if (windMatch) {
    const wdir = windMatch[1] === "VRB" ? 0 : parseInt(windMatch[1], 10);
    const wspd = parseInt(windMatch[2], 10);
    document.getElementById("wind_dir").value = wdir;
    document.getElementById("wind_spd").value = wspd;
    logMsg(`Parsed Wind: ${wdir}° @ ${wspd} KTS`);
  }

  if (typeof calculate === 'function') calculate();
}