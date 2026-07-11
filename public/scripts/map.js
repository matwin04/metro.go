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
// DOM BUILDERS (unchanged — no map-library dependency)
// =============================================

function buildDepartureRows(departures) {
  if (!departures || departures.length === 0) {
    return `<tr class="empty-row"><td colspan="3">No upcoming departures</td></tr>`;
  }

  return departures.map(dep => {
    const route         = dep.trip?.route;
    const headsign       = dep.stop_headsign || dep.trip?.trip_headsign || "—";
    const schedtime      = formatTime(dep.departure?.scheduled);
    const estimatedtime  = formatTime(dep.departure?.estimated);
    const mins           = minsUntil(dep.departure?.scheduled || dep.departure_time);
    const delayClass     = getDelayClass(dep.departure?.scheduled, dep.departure?.estimated);
    const routeId        = route?.route_id;

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
// PANEL STATE MANAGEMENT (unchanged)
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

    const parentName = data.parent?.stop_name || data.stop_name || "Unknown Station";
    stopNameEl.textContent = parentName;
    stopIdEl.textContent   = `Stop ID: ${data.stop_id}`;

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

    if (!data.departures || data.departures.length === 0) {
      tableBody.innerHTML = `<tr class="empty-row"><td colspan="3">No upcoming departures</td></tr>`;
    } else {
      tableBody.innerHTML = data.departures.map(dep => {
        const route          = dep.trip?.route;
        const headsign        = dep.stop_headsign || dep.trip?.trip_headsign || "—";
        const schedtime       = formatTime(dep.departure?.scheduled);
        const estimatedtime   = formatTime(dep.departure?.estimated);
        const mins            = minsUntil(dep.departure?.scheduled || dep.departure_time);
        const delayClass      = getDelayClass(dep.departure?.scheduled, dep.departure?.estimated);
        const routeId         = route?.route_id;

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

// Leaflet layer groups take the place of MapLibre "sources"
const layers = {
  metroTrains: null,
  metroBuses: null,
  metrolinkTrains: null,
  amtrakTrains: null,
  octaVehicles: null
};

function initMap() {
  map = L.map("map", {
    center: [34.0522, -118.2437], // Leaflet is [lat, lng], MapLibre was [lng, lat]
    zoom: 9
  });

  // MapLibre style JSON (tiles.openfreemap.org/styles/liberty) isn't a raster
  // tile source, so Leaflet needs a raster basemap instead. CartoDB Voyager
  // is a similar clean, labeled basemap with no API key required.
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 20
  }).addTo(map);

  layers.metroTrains     = L.layerGroup().addTo(map);
  layers.metroBuses      = L.layerGroup().addTo(map);
  layers.metrolinkTrains = L.layerGroup().addTo(map);
  layers.amtrakTrains    = L.layerGroup().addTo(map);
  layers.octaVehicles    = L.layerGroup().addTo(map);

  const routeColors = {
    "801": "#0072ce",
    "802": "#d9232e",
    "803": "#00a651",
    "804": "#fdb913",
    "805": "#A05DA5",
    "807": "#e96bb0",
    unknown: "#888"
  };

  setupStationLayers();
  setupVectorTileLayers();
  setupMetrolinkData();
  setupAmtrakData();
  setupOctaData();
  setupMetroWebSocket(routeColors);
  setupMetroBusWebSocket();

  return map;
}

// =============================================
// STATIC STATION LAYERS
// (MapLibre used addSource + a circle "layer"; Leaflet fetches the GeoJSON
// itself and renders it directly with L.geoJSON + pointToLayer)
// =============================================

function setupStationLayers() {
  const stationSources = [
    { id: "rail-stations",              path: "/public/data/f-9q5-metro~losangeles~rail/stations.geojson", color: "#333", handler: onMetroStationClick },
    { id: "metrolink-stations",         path: "/public/data/f-9qh-metrolinktrains/stops.geojson",          color: "#ff6600", handler: onMetrolinkStationClick },
    { id: "amtrak-ca-stations",         path: "/public/data/f-9-amtrak~amtrakcalifornia~amtrakcharteredvehicle/stops.geojson", color: "#000", handler: onAmtrakStationClick },
    { id: "northcounty-transit-stops",  path: "/public/data/f-9mu-northcountytransitdistrict/stops.geojson", color: "#666", handler: onNorthCountyStationClick },
    { id: "mts-stops",                  path: "/public/data/f-9mu-mts/stops.geojson",                       color: "#999", handler: onMtsStationClick },
    { id: "f-9qh1-foothilltransit-stops", path: "/public/data/f-9qh1-foothilltransit-stops.geojson",        color: "#999", handler: null }
  ];

  stationSources.forEach(({ path, color, handler }) => {
    fetch(path)
      .then(res => res.json())
      .then(geojson => {
        const layer = L.geoJSON(geojson, {
          pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
            radius: 5,
            color,
            weight: 2,
            fillColor: "#ffffff",
            fillOpacity: 1
          })
        }).addTo(map);

        if (handler) {
          layer.eachLayer(marker => {
            marker.on("mouseover", () => { map.getContainer().style.cursor = "pointer"; });
            marker.on("mouseout",  () => { map.getContainer().style.cursor = ""; });
            marker.on("click", (e) => handler({ features: [{ properties: e.target.feature.properties }] }));
          });
        }
      })
      .catch(err => console.error(`Failed to load station source ${path}:`, err));
  });
}

// =============================================
// VECTOR TILE ROUTE / STOP LAYERS
// Leaflet has no built-in vector-tile support, so this relies on the
// Leaflet.VectorGrid plugin to render Transitland's protobuf tiles.
// Include this script tag alongside leaflet.js:
//   https://unpkg.com/leaflet.vectorgrid@latest/dist/Leaflet.VectorGrid.bundled.min.js
// =============================================

function setupVectorTileLayers() {
  if (typeof L.vectorGrid === "undefined") {
    console.warn("Leaflet.VectorGrid not loaded — route/stop vector tiles skipped.");
    return;
  }

  const routeTypeColors = {
    2: null, // rail — use feature's own route_color
    1: null, // subway
    0: null  // light rail
  };

  const routesLayer = L.vectorGrid.protobuf(
    "https://transit.land/api/v2/tiles/routes/tiles/{z}/{x}/{y}.pbf?apikey=WOo9vL8ECMWN76EcKjsNGfo8YgNZ7c2u",
    {
      vectorTileLayerStyles: {
        routes: (properties) => ({
          color: hexColor(properties.route_color),
          weight: 3,
          opacity: 0.9
        })
      },
      interactive: false,
      maxNativeZoom: 14
    }
  ).addTo(map);
  // Note: the Transitland "stops" vector tile layer is intentionally not
  // loaded here — station dots are already rendered from the GeoJSON
  // sources in setupStationLayers(), so fetching a second, invisible copy
  // of every stop tile was pure wasted bandwidth/render time.
}

// =============================================
// REAL-TIME VEHICLE DATA
//
// PERFORMANCE NOTE: the first version of this file cleared and rebuilt
// every marker in a layer on every single update — for a poll that's
// wasteful, but for the metro/bus websockets (which fire one message per
// vehicle, and dump a burst of ~1 message per vehicle right on connect)
// it meant the Nth vehicle to arrive triggered N marker creations, so a
// fleet of a few hundred vehicles meant tens of thousands of DOM/marker
// operations right at page load. That's what was freezing the tab.
//
// Fix: keep a persistent registry (vehicle id -> marker) per source. On
// update, move the existing marker with setLatLng() instead of recreating
// it; only create a marker the first time an id is seen; only remove a
// marker when that vehicle actually drops out of a poll's results.
// =============================================

function upsertVehicleMarker(registry, layerGroup, id, latlng, style, onClick) {
  const entry = registry[id];
  if (entry) {
    entry.marker.setLatLng(latlng);
    entry.onClick = onClick;
    return entry.marker;
  }

  const marker = L.circleMarker(latlng, style).addTo(layerGroup);
  const newEntry = { marker, onClick };
  marker.on("mouseover", () => { map.getContainer().style.cursor = "pointer"; });
  marker.on("mouseout",  () => { map.getContainer().style.cursor = ""; });
  marker.on("click", () => newEntry.onClick());
  registry[id] = newEntry;
  return marker;
}

function pruneVehicleMarkers(registry, layerGroup, currentIds) {
  Object.keys(registry).forEach(id => {
    if (!currentIds.has(id)) {
      layerGroup.removeLayer(registry[id].marker);
      delete registry[id];
    }
  });
}

function setupAmtrakData() {
  const registry = {};

  async function loadAmtrak() {
    try {
      const response = await fetch("/api/amtraker/trains");
      const data = await response.json();
      const trains = Object.values(data).flat();
      const currentIds = new Set();

      trains.forEach(train => {
        const id = train.trainID || train.trainNum;
        currentIds.add(id);
        upsertVehicleMarker(
          registry,
          layers.amtrakTrains,
          id,
          [train.lat, train.lon],
          { radius: 7, color: "#fff", weight: 2, fillColor: train.iconColor, fillOpacity: 1 },
          () => onAmtrakTrainClick({
            features: [{ geometry: { coordinates: [train.lon, train.lat] }, properties: { data: JSON.stringify(train) } }]
          })
        );
      });

      pruneVehicleMarkers(registry, layers.amtrakTrains, currentIds);
    } catch (error) {
      console.error("Amtrak error:", error);
    }
  }
  loadAmtrak();
  setInterval(loadAmtrak, 15000);
}

function setupOctaData() {
  const registry = {};

  async function loadOcta() {
    try {
      const res = await fetch("/api/swiftly/vehiclepos?agency=octa");
      const json = await res.json();
      const vehicles = (json?.data?.vehicles || []).filter(v => v.loc?.lat && v.loc?.lon);
      const currentIds = new Set();

      vehicles.forEach(vehicle => {
        currentIds.add(vehicle.id);
        upsertVehicleMarker(
          registry,
          layers.octaVehicles,
          vehicle.id,
          [vehicle.loc.lat, vehicle.loc.lon],
          { radius: 7, color: "#fff", weight: 2, fillColor: "#f58220", fillOpacity: 1 },
          () => onOctaBusClick({
            features: [{ geometry: { coordinates: [vehicle.loc.lon, vehicle.loc.lat] }, properties: { data: JSON.stringify(vehicle) } }]
          })
        );
      });

      pruneVehicleMarkers(registry, layers.octaVehicles, currentIds);
    } catch (err) {
      console.error("OCTA error:", err);
    }
  }
  loadOcta();
  setInterval(loadOcta, 5000);
}

function setupMetrolinkData() {
  const registry = {};

  async function loadMetrolink() {
    try {
      const res = await fetch("https://rtt.metrolinktrains.com/trainlist.json");
      const data = await res.json();
      const currentIds = new Set();

      data.forEach(train => {
        const lat = dmsToDecimal(train.lat);
        const lon = dmsToDecimal(train.long);
        const id  = train.trainId || train.symbol;
        currentIds.add(id);

        upsertVehicleMarker(
          registry,
          layers.metrolinkTrains,
          id,
          [lat, lon],
          { radius: 7, color: "#fff", weight: 2, fillColor: "#ff6600", fillOpacity: 1 },
          () => onMetrolinkTrainClick({
            features: [{ geometry: { coordinates: [lon, lat] }, properties: { data: JSON.stringify(train) } }]
          })
        );
      });

      pruneVehicleMarkers(registry, layers.metrolinkTrains, currentIds);
    } catch (err) {
      console.error("Metrolink error:", err);
    }
  }
  loadMetrolink();
  setInterval(loadMetrolink, 5000);
}

function setupMetroWebSocket(routeColors) {
  const registry = {};
  const ws = new WebSocket("wss://api.metro.net/ws/LACMTA_Rail/vehicle_positions");

  ws.onmessage = (event) => {
    try {
      const data    = JSON.parse(event.data);
      const vehicle = data.vehicle;
      if (!vehicle?.position) return;

      const id    = vehicle.vehicle?.id || data.id;
      const route = data.route_code || data.vehicle?.trip?.routeId || "unknown";
      const lat   = vehicle.position.latitude;
      const lon   = vehicle.position.longitude;
      const color = routeColors[route] || routeColors.unknown;

      upsertVehicleMarker(
        registry,
        layers.metroTrains,
        id,
        [lat, lon],
        { radius: 7, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 },
        () => onMetroTrainClick({
          features: [{ geometry: { coordinates: [lon, lat] }, properties: { data: JSON.stringify(data) } }]
        })
      );
    } catch (err) {
      console.error("Metro WebSocket error:", err);
    }
  };
}

function setupMetroBusWebSocket() {
  const registry = {};
  const ws = new WebSocket("wss://api.metro.net/ws/LACMTA/vehicle_positions");

  ws.onmessage = (event) => {
    try {
      const data    = JSON.parse(event.data);
      const vehicle = data.vehicle;
      if (!vehicle?.position) return;

      const id  = vehicle.vehicle?.id || data.id;
      const lat = vehicle.position.latitude;
      const lon = vehicle.position.longitude;

      upsertVehicleMarker(
        registry,
        layers.metroBuses,
        id,
        [lat, lon],
        { radius: 6, color: "#fff", weight: 2, fillColor: "#e4002b", fillOpacity: 1 },
        () => onMetroBusClick({
          features: [{ geometry: { coordinates: [lon, lat] }, properties: { data: JSON.stringify(data) } }]
        })
      );
    } catch (err) {
      console.error("Metro Bus WebSocket error:", err);
    }
  };
}

// =============================================
// POPUP HANDLERS
// (unchanged content — just now opened via L.popup instead of maplibregl.Popup)
// =============================================

function onOctaBusClick(e) {
  const feature = e.features[0];
  const [lon, lat] = feature.geometry.coordinates;
  const bus = JSON.parse(feature.properties.data);

  L.popup({ offset: [0, -10] })
    .setLatLng([lat, lon])
    .setContent(`
      <div class="popup">
        <div class="popup-header">
          <span class="popup-title">
            OCTA ${bus.routeShortName || ""}
          </span>
          <img class="popup-agency-logo" src="/public/icons/agency_logos/OCTA.png" alt="" />
        </div>
        <div class="popup-body">
          <div class="popup-row">
            <span class="popup-row-label">Vehicle</span>
            <span class="popup-row-value">${bus.id || "—"}</span>
          </div>
          <div class="popup-row">
            <span class="popup-row-label">Route</span>
            <span class="popup-row-value">${bus.routeShortName || "—"}</span>
          </div>
          <div class="popup-row">
            <span class="popup-row-label">Headsign</span>
            <span class="popup-row-value">${bus.headsign || "—"}</span>
          </div>
          <div class="popup-row">
            <span class="popup-row-label">Next Stop</span>
            <span class="popup-row-value">${bus.nextStopName || "—"}</span>
          </div>
          <div class="popup-row">
            <span class="popup-row-label">Speed</span>
            <span class="popup-row-value">${Math.round((bus.loc?.speed || 0) * 2.23694)} mph</span>
          </div>
          <div class="popup-row">
            <span class="popup-row-label">Direction</span>
            <span class="popup-row-value">${bus.directionId || "—"}</span>
          </div>
        </div>
      </div>
    `)
    .openOn(map);
}

function onMetroTrainClick(e) {
  const feature     = e.features[0];
  const [lon, lat]  = feature.geometry.coordinates;
  const vehicleData = JSON.parse(feature.properties.data);

  L.popup({ offset: [0, -10] })
    .setLatLng([lat, lon])
    .setContent(`
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
    .openOn(map);
}

function onMetroBusClick(e) {
  const feature     = e.features[0];
  const [lon, lat]  = feature.geometry.coordinates;
  const vehicleData = JSON.parse(feature.properties.data);

  L.popup({ offset: [0, -10] })
    .setLatLng([lat, lon])
    .setContent(`
      <div class="popup">
        <div class="popup-header">
          <span class="popup-title">Metro Bus ${vehicleData.vehicle?.vehicle?.id || "—"}</span>
          <img class="popup-agency-logo" src="/public/icons/agency_logos/LACMTA.png" alt="" />
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
    .openOn(map);
}

function onMetrolinkTrainClick(e) {
  const feature    = e.features[0];
  const [lon, lat] = feature.geometry.coordinates;
  const train      = JSON.parse(feature.properties.data);

  L.popup({ offset: [0, -10] })
    .setLatLng([lat, lon])
    .setContent(`
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
    .openOn(map);
}

function onAmtrakTrainClick(e) {
  const feature    = e.features[0];
  const [lon, lat] = feature.geometry.coordinates;
  const train      = JSON.parse(feature.properties.data);

  L.popup({ offset: [0, -10] })
    .setLatLng([lat, lon])
    .setContent(`
      <div class="popup">
        <div class="popup-header">
          <span class="popup-title">Amtrak ${train.trainNum}</span>
        </div>
        <div class="popup-body">
          <div class="popup-row">
            <span class="popup-row-label">Route</span>
            <span class="popup-row-value">${train.routeName}</span>
          </div>
          <div class="popup-row">
            <span class="popup-row-label">Destination</span>
            <span class="popup-row-value">${train.destName}</span>
          </div>
          <div class="popup-row">
            <span class="popup-row-label">Speed</span>
            <span class="popup-row-value">${Math.round(train.velocity)} mph</span>
          </div>
          <div class="popup-row">
            <span class="popup-row-label">Status</span>
            <span class="popup-row-value">${train.trainState}</span>
          </div>
        </div>
      </div>`)
    .openOn(map);
}

// =============================================
// STATION CLICK HANDLERS (unchanged)
// =============================================

function onMetroStationClick(e) {
  const props = e.features[0].properties;
  renderDepartures("f-9q5-metro~losangeles~rail", props.stop_id);
}

function onMetrolinkStationClick(e) {
  const props = e.features[0].properties;
  renderDepartures("f-9qh-metrolinktrains", props.stop_id);
}

function onAmtrakStationClick(e) {
  const props = e.features[0].properties;
  renderDepartures("f-9-amtrak~amtrakcalifornia~amtrakcharteredvehicle", props.stop_id);
}

function onNorthCountyStationClick(e) {
  const props = e.features[0].properties;
  renderDepartures("f-9mu-northcountytransitdistrict", props.stop_id);
}

function onMtsStationClick(e) {
  const props = e.features[0].properties;
  renderDepartures("f-9mu-mts", props.stop_id);
}

// =============================================
// START
// =============================================

initMap();