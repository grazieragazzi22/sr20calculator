# SR20 Performance & W&B Calculator

Client-side web app for Cirrus SR20 Weight & Balance and performance calculations. Built with HTML, Tailwind CSS, and vanilla JavaScript. Runs fully offline once cached.

> **⚠️ ALPHA BUILD**  
> Informational reference only. Does NOT replace official flight planning. Always verify with the official SR20 POH/THB.

### 1. `index.html` (View Layer)
* **Role**: Layout and UI binding. Uses Tailwind via CDN. 
* **Mechanics**: No inline logic other than DOM event triggers (`oninput="calculate()"`, `onclick="fetchMetar()"`). Scripts must be loaded in strict dependency order at the bottom of the `<body>`.

### 2. `js/config.js` (Constants & State)
* **Role**: Global constants and session management.
* **Mechanics**: 
  * `ARMS` / `LIMITS`: Defines station arms and max weights. Edit this file to port the calculator to a different airframe (e.g., SR22).
  * `dismissDisclaimer()`: Manages `sessionStorage` so the Alpha warning modal only blocks the UI once per browser session.

### 3. `js/airports.js` (Offline Database)
* **Role**: Hardcoded fallback for cockpit use without internet.
* **Mechanics**: Contains the `AIRPORTS` object. Maps ICAO codes to field elevation and runway vectors. `api.js` searches this object before attempting any network requests.

### 4. `js/api.js` (Networking & Regex)
* **Role**: External data fetching and DOM logging.
* **Mechanics**:
  * `fetchAirportData()`: Checks `airports.js` first. If missing, queries the NWS API (`api.weather.gov/stations/`) for elevation. (Note: FAA endpoints are avoided here because Cloudflare blocks public CORS proxies with 403 errors).
  * `fetchMetar()`: Pings VATSIM first (open CORS), falls back to AviationWeather.
  * `parseAndApplyMetar(raw)`: Uses Regex to extract Temp (`M?\d{2}/\d{2}`), QNH (`[AQ]\d{4}`), and Wind (`\d{3}\d{2}G?\d{2}KT`). Injects them into the DOM and triggers `calculate()`.
  * `logMsg()`: Appends timestamped network events to the UI debug console.

### 5. `js/app.js` (Math Engine)
* **Role**: Reads inputs, calculates limits, and queries performance tables.
* **Mechanics**:
  * `calculate()`: Pulls values from DOM. Computes Zero Fuel Mass, Take-off Mass, Landing Mass, Moments, PA, DA, and Headwind/Crosswind components.
  * `lookupGrid()`: Iterates over the arrays in `perf_data.js`. Finds the closest matching Pressure Altitude (`minDiff`). Selects the correct temperature column (`0_C`, `20_C`, `40_C`). Uses fallback logic to handle both nested and flat JSON structures to return Ground Roll and Total 50ft distances.
  * `lookupSpeeds() / lookupROC()`: Similar nearest-neighbor lookups for V-Speeds and climb rates.

### 6. `js/perf_data.js` (Data Store)
* **Role**: JSON representation of the POH/THB performance tables.
* **Mechanics**: Auto-generated arrays. **Do not edit manually.** The lookup functions in `app.js` depend on the specific keys generated here.

### 7. `convert_tables.py` (Ingestion Pipeline)
* **Role**: Maintenance script.
* **Mechanics**: Parses raw POH CSVs or text files and formats them into the JSON structures expected by `perf_data.js`. Run this locally when updating to a new POH revision.

## Data Flow
`User Input / API` → `DOM Fields` → `app.js:calculate()` → `Math & Physics` → `app.js:lookupGrid()` → `perf_data.js` → `DOM Output`
