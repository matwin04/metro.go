let map;

// =============================================
// HELPER FUNCTIONS
// =============================================

function getDelayClass(scheduledTime, estimatedTime) {
  if (!scheduledTime || !estimatedTime) return "";
  
  const [sh, sm] = scheduledTime.split(":").map(Number);
  const [eh, em] = estimatedTime.split(":").map(Number);
  
  const scheduled = sh * 60 + sm;
  const estimated = eh * 60 + em;
  const delayMins = estimated - scheduled;
  
  if (delayMins < 0) return "early";
  if (delayMins === 0) return "ontime";
  if (delayMins <= 5) return "mild";
  if (delayMins <= 10) return "late";
  return "extreme";
}

function formatTime(timeStr) {
  if (!timeStr) return "—";
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function minsUntil(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  const now = new Date();
  const then = new Date();
  then.setHours(h, m, 0, 0);
  const diff = Math.round((then - now) / 60000);
  return diff;
}

function minsLabel(mins) {
  if (mins === null) return "";
  if (mins <= 0) return "Now";
  if (mins === 1) return "1 min";
  return `${mins} min`;
}

function hexColor(c) {
  if (!c) return "#888";
  return c.startsWith("#") ? c : `#${c}`;
}

function dmsToDecimal(dms) {
  const [deg, min, sec] = dms.split(":").map(Number);
  const sign = deg < 0 ? -1 : 1;
  return sign * (Math.abs(deg) + min / 60 + sec / 3600);
}

// =============================================
// DOM BUILDERS
// =============================================

function buildDepartureRows(departures) {
  if (!departures || departures.length === 0) {
    return `<tr class="empty-row"><td colspan="3">No upcoming departures</td></tr>`;
  }

  return departures.map(dep => {
    const route       = dep.trip?.route;
    const color       = hexColor(route?.route_color);
    const routeName   = route?.route_long_name || route?.route_id || "?";
    const headsign    = dep.stop_headsign || dep.trip?.trip_headsign || "—";
    const schedtime   = formatTime(dep.departure?.scheduled);
    const estimatedtime = formatTime(dep.departure?.estimated);
    const mins        = minsUntil(dep.departure?.scheduled || dep.departure_time);
    const delayClass  = getDelayClass(dep.departure?.scheduled, dep.departure?.estimated);
    const routeId     = route?.route_id;

    return `
      <tr>
        <td>
          <img class="popup-route-icon" src="/public/icons/route_icons/LACMTA_Rail/${routeId}.svg" alt="" />
        </td>
        <td>${headsign}</td>
        <td>
          <div class="dep-time">
            <span class="mdi mdi-clock-outline mdisched"></span>
            <span class="schedtime">${schedtime}</span>
          </div>
          <div class="dep-time">
            <span class="mdi mdi-signal-variant ${delayClass}"></span>
            <span class="${delayClass}">${estimatedtime}</span>
          </div>
          <div class="dep-mins">${minsLabel(mins)}</div>
        </td>
      </tr>`;
  }).join("");
}

function buildRouteBadges(departures) {
  if (!departures?.length) return "";
  const seen = new Set();
  return departures
      .filter(dep => {
        const id = dep.trip?.route?.route_id;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .map(dep => {
        const route = dep.trip?.route;
        const color = hexColor(route?.route_color);
        const name  = route?.route_long_name || route?.route_id || "?";
        return `
          <span class="route-badge" style="background:${color}">
            <span class="route-badge-dot"></span>
            ${name}
          </span>`;
      }).join("");
}

// =============================================
// PANEL STATE MANAGEMENT
// =============================================

async function renderDepartures(agencyId, gtfsId) {
  const panelEmpty   = document.getElementById("panel-empty");
  const panelStation = document.getElementById("panel-station");
  const stopNameEl   = document.getElementById("stop-name");
  const stopIdEl     = document.getElementById("panel-station-id");
  const badgesEl     = document.getElementById("panel-route-badges");
  const tableBody    = document.getElementById("departures-body");
  
  panelEmpty.hidden   = true;
  panelStation.hidden = false;
  stopNameEl.textContent = "Loading…";
  stopIdEl.textContent   = "";
  badgesEl.innerHTML     = "";
  tableBody.innerHTML    = `
    <tr class="loading-row">
      <td colspan="3"><span class="loading-spinner"></span> Loading…</td>
    </tr>`;
  
  try {
    const res  = await fetch(`/api/transitland/departures?agencyId=${agencyId}&gtfsId=${gtfsId}`);
    const data = await res.json();
    
    // Update station info
    const parentName = data.parent?.stop_name || data.stop_name || "Unknown Station";
    stopNameEl.textContent = parentName;
    stopIdEl.textContent   = `Stop ID: ${data.stop_id}`;
    
    // Build and render badges
    if (data.departures?.length) {
      const seen = new Set();
      badgesEl.innerHTML = data.departures
      .filter(dep => {
        const id = dep.trip?.route?.route_id;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .map(dep => {
        const color = hexColor(dep.trip?.route?.route_color);
        const name  = dep.trip?.route?.route_long_name || dep.trip?.route?.route_id || "?";
        return `
            <span class="route-badge" style="background:${color}">
              <span class="route-badge-dot"></span>
              ${name}
            </span>`;
      }).join("");
    }
    
    // Build and render departure rows
    if (!data.departures || data.departures.length === 0) {
      tableBody.innerHTML = `<tr class="empty-row"><td colspan="3">No upcoming departures</td></tr>`;
    } else {
      tableBody.innerHTML = data.departures.map(dep => {
        const route       = dep.trip?.route;
        const color       = hexColor(route?.route_color);
        const headsign    = dep.stop_headsign || dep.trip?.trip_headsign || "—";
        const schedtime   = formatTime(dep.departure?.scheduled);
        const estimatedtime = formatTime(dep.departure?.estimated);
        const mins        = minsUntil(dep.departure?.scheduled || dep.departure_time);
        const delayClass  = getDelayClass(dep.departure?.scheduled, dep.departure?.estimated);
        const routeId     = route?.route_id;
        
        return `
          <tr>
            <td>
              <img class="popup-route-icon" src="/public/data/${agencyId}/img/${routeId}.svg" alt="" />
            </td>
            <td>${headsign}</td>
            <td>
              <div class="dep-time">
                <span class="mdi mdi-clock-outline mdisched"></span>
                <span class="schedtime">${schedtime}</span>
              </div>
              <div class="dep-time">
                <span class="mdi mdi-signal-variant ${delayClass}"></span>
                <span class="${delayClass}">${estimatedtime}</span>
              </div>
              <div class="dep-mins">${minsLabel(mins)}</div>
            </td>
          </tr>`;
      }).join("");
    }
    
  } catch (err) {
    console.error("Error fetching departures:", err);
    tableBody.innerHTML = `<tr class="empty-row"><td colspan="3">Failed to load departures</td></tr>`;
  }
}


function showStationPanel(props, badgeColor = "#ff6600", badgeLabel = "Station") {
  const panelEmpty   = document.getElementById("panel-empty");
  const panelStation = document.getElementById("panel-station");
  const stopNameEl   = document.getElementById("stop-name");
  const stopIdEl     = document.getElementById("panel-station-id");
  const badgesEl     = document.getElementById("panel-route-badges");
  const tableBody    = document.getElementById("departures-body");

  panelEmpty.hidden   = true;
  panelStation.hidden = false;
  stopNameEl.textContent = props.stop_name || props.name || "Unknown Station";
  stopIdEl.textContent   = `Stop ID: ${props.stop_id || "—"}`;
  badgesEl.innerHTML     = `
    <span class="route-badge" style="background:${badgeColor}">
      <span class="route-badge-dot"></span>
      ${badgeLabel}
    </span>`;
  tableBody.innerHTML    = `<tr class="empty-row"><td colspan="3">Departures not available</td></tr>`;
}

// =============================================
// MAP INITIALIZATION
// =============================================

function initMap() {
  map = new maplibregl.Map({
    container: "map",
    style: "https://tiles.openfreemap.org/styles/liberty",
    center: [-118.2437, 34.0522],
    zoom: 9
  });

  const metroVehicles = {};
  const routeColors = {
    "801": "#0072ce",
    "802": "#d9232e",
    "803": "#00a651",
    "804": "#fdb913",
    "805": "#A05DA5",
    "807": "#e96bb0",
    unknown: "#888"
  };

  map.on("load", () => {
    setupSources();
    setupLayers();
    setupMetrolinkData();
    setupMetroWebSocket(metroVehicles, routeColors);
    setupCursorStates();
    setupClickHandlers();
  });

  return map;
}

// =============================================
// SOURCES
// =============================================

function setupSources() {
  // Real-time vehicle data
  map.addSource("metro-trains", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] }
  });

  map.addSource("metrolink-trains", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] }
  });

  // Static station data
  const stationSources = [
    { id: "rail-stations", path: "/public/data/f-9q5-metro~losangeles~rail/stations.geojson" },
    { id: "metrolink-stations", path: "/public/data/f-9qh-metrolinktrains/stops.geojson" },
    { id: "amtrak-ca-stations", path: "/public/data/f-9-amtrak~amtrakcalifornia~amtrakcharteredvehicle/stops.geojson" },
    { id: "northcounty-transit-stops", path: "/public/data/f-9mu-northcountytransitdistrict/stops.geojson" },
    { id: "mts-stops", path: "/public/data/f-9mu-mts/stops.geojson" }
  ];

  stationSources.forEach(({ id, path }) => {
    map.addSource(id, { type: "geojson", data: path });
  });

  // Vector tiles
  map.addSource("transit-routes", {
    type: "vector",
    tiles: ["https://transit.land/api/v2/tiles/routes/tiles/{z}/{x}/{y}.pbf?apikey=WOo9vL8ECMWN76EcKjsNGfo8YgNZ7c2u"],
    minzoom: 0,
    maxzoom: 14
  });

  map.addSource("transit-stops", {
    type: "vector",
    tiles: ["https://transit.land/api/v2/tiles/stops/tiles/{z}/{x}/{y}.pbf?apikey=WOo9vL8ECMWN76EcKjsNGfo8YgNZ7c2u"],
    minzoom: 0,
    maxzoom: 14
  });
}

// =============================================
// LAYERS
// =============================================

function setupLayers() {
  // Route lines
  [
    { id: "rail-lines", type: 2 },
    { id: "subway-lines", type: 1 },
    { id: "lightrail-lines", type: 0 },
  ].forEach(({ id, type }) => {
    map.addLayer({
      id,
      type: "line",
      source: "transit-routes",
      "source-layer": "routes",
      filter: ["==", ["get", "route_type"], type],
      paint: {
        "line-color": ["get", "route_color"],
        "line-width": 3,
        "line-opacity": 0.9
      }
    });
  });

  // Station dots with consistent styling
  const stationLayers = [
    { id: "station-dots", source: "rail-stations", color: "#333" },
    { id: "metrolink-station-dots", source: "metrolink-stations", color: "#ff6600" },
    { id: "amtrak-ca-station-dots", source: "amtrak-ca-stations", color: "#000" },
    { id: "northcounty-transit-dots", source: "northcounty-transit-stops", color: "#666" },
    { id: "mts-station-dots", source: "mts-stops", color: "#999" }
  ];

  stationLayers.forEach(({ id, source, color }) => {
    map.addLayer({
      id,
      type: "circle",
      source,
      paint: {
        "circle-radius": 5,
        "circle-color": "#ffffff",
        "circle-stroke-width": 2,
        "circle-stroke-color": color
      }
    });
  });

  // Vehicle dots
  map.addLayer({
    id: "metro-train-dots",
    type: "circle",
    source: "metro-trains",
    paint: {
      "circle-radius": 7,
      "circle-color": ["get", "color"],
      "circle-stroke-width": 2,
      "circle-stroke-color": "#fff"
    }
  });

  map.addLayer({
    id: "metrolink-train-dots",
    type: "circle",
    source: "metrolink-trains",
    paint: {
      "circle-radius": 7,
      "circle-color": "#ff6600",
      "circle-stroke-width": 2,
      "circle-stroke-color": "#fff"
    }
  });
}

// =============================================
// REAL-TIME DATA
// =============================================

function setupMetrolinkData() {
  async function loadMetrolink() {
    try {
      const res = await fetch("https://rtt.metrolinktrains.com/trainlist.json");
      const data = await res.json();
      map.getSource("metrolink-trains").setData({
        type: "FeatureCollection",
        features: data.map(train => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [dmsToDecimal(train.long), dmsToDecimal(train.lat)] },
          properties: { data: JSON.stringify(train) }
        }))
      });
    } catch (err) {
      console.error("Metrolink error:", err);
    }
  }

  loadMetrolink();
  setInterval(loadMetrolink, 5000);
}

function setupMetroWebSocket(metroVehicles, routeColors) {
  const ws = new WebSocket("wss://api.metro.net/ws/LACMTA_Rail/vehicle_positions");

  ws.onmessage = (event) => {
    try {
      const data    = JSON.parse(event.data);
      const vehicle = data.vehicle;
      if (!vehicle?.position) return;

      const id    = vehicle.vehicle?.id || data.id;
      const route = data.route_code || data.vehicle?.trip?.routeId || "unknown";

      metroVehicles[id] = {
        coordinates: [vehicle.position.longitude, vehicle.position.latitude],
        color: routeColors[route] || routeColors.unknown,
        data: JSON.stringify(data)
      };

      map.getSource("metro-trains").setData({
        type: "FeatureCollection",
        features: Object.values(metroVehicles).map(v => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: v.coordinates },
          properties: { color: v.color, data: v.data }
        }))
      });
    } catch (err) {
      console.error("Metro WebSocket error:", err);
    }
  };
}

// =============================================
// INTERACTIONS
// =============================================

function setupCursorStates() {
  const clickableLayers = [
    "metro-train-dots", "metrolink-train-dots", "station-dots",
    "metrolink-station-dots", "amtrak-ca-station-dots",
    "northcounty-transit-dots", "mts-station-dots"
  ];

  clickableLayers.forEach(layer => {
    map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
  });
}

function setupClickHandlers() {
  // Train popups
  map.on("click", "metro-train-dots", onMetroTrainClick);
  map.on("click", "metrolink-train-dots", onMetrolinkTrainClick);

  // Station sidebar handlers
  map.on("click", "station-dots", onMetroStationClick);
  map.on("click", "metrolink-station-dots", onMetrolinkStationClick);
  map.on("click", "amtrak-ca-station-dots", onAmtrakStationClick);
  map.on("click", "northcounty-transit-dots", onNorthCountyStationClick);
  map.on("click", "mts-station-dots", onMtsStationClick);
}

// =============================================
// POPUP HANDLERS
// =============================================

function onMetroTrainClick(e) {
  const feature     = e.features[0];
  const coords      = feature.geometry.coordinates.slice();
  const vehicleData = JSON.parse(feature.properties.data);

  new maplibregl.Popup({ offset: 10 })
      .setLngLat(coords)
      .setHTML(`
        <div class="popup">
          <div class="popup-header">
            <span class="popup-title">Metro Train ${vehicleData.vehicle?.vehicle?.id || "—"}</span>
            <img class="popup-agency-logo" src="/public/icons/agency_logos/LACMTA.png" alt="" />
            <img class="popup-route-icon" src="/public/icons/route_icons/LACMTA_Rail/${vehicleData.route_code}.svg" alt="" />
          </div>
          <div class="popup-body">
            <div class="popup-row">
              <span class="popup-row-label">Route</span>
              <span class="popup-row-value">${vehicleData.route_code || "Unknown"}</span>
            </div>
            <div class="popup-row">
              <span class="popup-row-label">Trip</span>
              <span class="popup-row-value">${vehicleData.vehicle?.trip?.tripId || "—"}</span>
            </div>
          </div>
        </div>`)
      .addTo(map);
}

function onMetrolinkTrainClick(e) {
  const feature = e.features[0];
  const coords  = feature.geometry.coordinates.slice();
  const train   = JSON.parse(feature.properties.data);

  new maplibregl.Popup({ offset: 10 })
      .setLngLat(coords)
      .setHTML(`
        <div class="popup">
          <div class="popup-header">
            <span class="popup-title">${train.symbol}</span>
            <span style="font-size:11px;color:#5a6080;">Metrolink</span>
          </div>
          <div class="popup-body ${train.delay_status}">
            <div class="popup-row">
              <span class="popup-row-label">Line</span>
              <span class="popup-row-value">${train.line}</span>
            </div>
            <div class="popup-row">
              <span class="popup-row-label">Direction</span>
              <span class="popup-row-value">${train.direction}</span>
            </div>
            <div class="popup-row">
              <span class="popup-row-label">Speed</span>
              <span class="popup-row-value">${train.speed} mph</span>
            </div>
            <div class="popup-row">
              <span class="popup-row-label">Status</span>
              <span class="popup-row-value popup-status">${train.delay_status}</span>
            </div>
            <div class="popup-row">
              <span class="popup-row-label">Updated</span>
              <span class="popup-row-value">${train.ptc_time}</span>
            </div>
          </div>
        </div>`)
      .addTo(map);
}

// =============================================
// STATION CLICK HANDLERS
// =============================================

function onMetroStationClick(e) {
  const props = e.features[0].properties;
  renderDepartures("f-9q5-metro~losangeles~rail", props.stop_id);
}

function onMetrolinkStationClick(e) {
  const props = e.features[0].properties;
  renderDepartures("f-9qh-metrolinktrains",props.stop_id);
}

function onAmtrakStationClick(e) {
  const props = e.features[0].properties;
  renderDepartures("f-9-amtrak~amtrakcalifornia~amtrakcharteredvehicle", props.stop_id);
}

function onNorthCountyStationClick(e) {
  const props = e.features[0].properties;
  renderDepartures("f-9mu-northcountytransitdistrict",props.stop_id);
}

function onMtsStationClick(e) {
  const props = e.features[0].properties;
  renderDepartures("f-9mu-mts",props.stop_id);
}

// =============================================
// START
// =============================================

initMap();