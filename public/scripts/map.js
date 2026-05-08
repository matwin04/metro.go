let map;

// =============================================
// HELPERS
// =============================================

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

/**
 * Build the departure rows HTML for the sidebar table.
 */
function buildDepartureRows(departures) {
  if (!departures || departures.length === 0) {
    return `<tr class="empty-row"><td colspan="3">No upcoming departures</td></tr>`;
  }

  return departures.map(dep => {
    const route     = dep.trip?.route;
    const color     = hexColor(route?.route_color);
    const routeName = route?.route_long_name || route?.route_id || "?";
    const headsign  = dep.stop_headsign || dep.trip?.trip_headsign || "—";
    const schedtime      = formatTime(dep.departure?.scheduled);
    const estimatedtime = formatTime(dep.departure?.estimated);
    const mins      = minsUntil(dep.departure?.scheduled || dep.departure_time);

    const routeId     = route?.route_id;
    return `
      <tr>
        <td>
            <img class="popup-route-icon" src="/public/icons/route_icons/LACMTA_Rail/${routeId}.svg" alt="" />
        </td>
        <td>${headsign}</td>
        <td>
          <div class="dep-time">${schedtime}</div>
          <div class="dep-time">${estimatedtime}</div>
          <div class="dep-mins">${minsLabel(mins)}</div>
        </td>
      </tr>`;
  }).join("");
}

/**
 * Collect unique route badges from departures array.
 */
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
// RENDER DEPARTURES — sidebar only
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
    badgesEl.innerHTML     = buildRouteBadges(data.departures);
    tableBody.innerHTML    = buildDepartureRows(data.departures);

  } catch (err) {
    console.error("Error fetching departures:", err);
    tableBody.innerHTML = `<tr class="empty-row"><td colspan="3">Failed to load departures</td></tr>`;
  }
}

// =============================================
// MAP INIT
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

    // ── SOURCES ──────────────────────────────

    map.addSource("metro-trains", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] }
    });

    map.addSource("metrolink-trains", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] }
    });

    map.addSource("rail-stations", {
      type: "geojson",
      data: "/public/data/f-9q5-metro~losangeles~rail/stations.geojson"
    });
    map.addSource("amtrak-ca-stations", {
      type: "geojson",
      data: "/public/data/f-9-amtrak~amtrakcalifornia~amtrakcharteredvehicle/stops.geojson"
    });

    map.addSource("metrolink-stations", {
      type: "geojson",
      data: "/public/data/f-9qh-metrolinktrains/stops.geojson"
    });

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

    // ── ROUTE LINES ──────────────────────────

    [
      { id: "rail-lines",      type: 2 },
      { id: "subway-lines",    type: 1 },
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

    // ── STATION DOTS ─────────────────────────

    map.addLayer({
      id: "station-dots",
      type: "circle",
      source: "rail-stations",
      paint: {
        "circle-radius": 5,
        "circle-color": "#ffffff",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#333"
      }
    });

    map.addLayer({
      id: "metrolink-station-dots",
      type: "circle",
      source: "metrolink-stations",
      paint: {
        "circle-radius": 5,
        "circle-color": "#ffffff",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ff6600"
      }
    });
    map.addLayer({
      id:"amtrak-ca-station-dots",
      type: "circle",
      source: "amtrak-ca-stations",
      paint: {
        "circle-radius": 5,
        "circle-color": "#ffffff",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#000000"
      }
    })
    // ── VEHICLE DOTS ─────────────────────────

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

    // ── METROLINK DATA ────────────────────────

    function dmsToDecimal(dms) {
      const [deg, min, sec] = dms.split(":").map(Number);
      const sign = deg < 0 ? -1 : 1;
      return sign * (Math.abs(deg) + min / 60 + sec / 3600);
    }

    async function loadMetrolink() {
      try {
        const res  = await fetch("https://rtt.metrolinktrains.com/trainlist.json");
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

    // ── METRO WEBSOCKET ───────────────────────

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

    // ── CURSOR STATES ─────────────────────────

    ["metro-train-dots", "metrolink-train-dots", "station-dots", "metrolink-station-dots","amtrak-ca-station-dots"]
        .forEach(layer => {
          map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
        });

    // ── METRO TRAIN POPUP ─────────────────────

    map.on("click", "metro-train-dots", (e) => {
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
    });

    // ── METROLINK TRAIN POPUP ─────────────────

    map.on("click", "metrolink-train-dots", (e) => {
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
    });

    // ── METRO STATION CLICK → sidebar only ───────────────────

    map.on("click", "station-dots", (e) => {
      const props = e.features[0].properties;
      console.log(props);
      renderDepartures("f-9q5-metro~losangeles~rail", props.stop_id);
    });

    // ── METROLINK STATION CLICK → sidebar only ────────────────
    map.on("click", "amtrak-ca-station-dots", (e) => {
      const props = e.features[0].properties;
      renderDepartures("f-9-amtrak~amtrakcalifornia~amtrakcharteredvehicle", props.stop_id);
      // Metrolink uses a different agency feed — show name while we have no departures API
      const panelEmpty   = document.getElementById("panel-empty");
      const panelStation = document.getElementById("panel-station");
      const stopNameEl   = document.getElementById("stop-name");
      const stopIdEl     = document.getElementById("panel-station-id");
      const badgesEl     = document.getElementById("panel-route-badges");
      const tableBody    = document.getElementById("departures-body");

      panelEmpty.hidden   = true;
      panelStation.hidden = false;
      stopNameEl.textContent = props.stop_name || props.name || "Metrolink Station";
      stopIdEl.textContent   = `Stop ID: ${props.stop_id || "—"}`;
      badgesEl.innerHTML     = `<span class="route-badge" style="background:#ff6600">
                                    <span class="route-badge-dot">
                                    
                                </span>Metrolink
                                </span>`;
      tableBody.innerHTML    = `<tr class="empty-row"><td colspan="3">Metrolink departures not available</td></tr>`;
    })
    map.on("click", "metrolink-station-dots", (e) => {
      const props = e.features[0].properties;
      renderDepartures("f-9qh-metrolinktrains", props.stop_id);
      // Metrolink uses a different agency feed — show name while we have no departures API
      const panelEmpty   = document.getElementById("panel-empty");
      const panelStation = document.getElementById("panel-station");
      const stopNameEl   = document.getElementById("stop-name");
      const stopIdEl     = document.getElementById("panel-station-id");
      const badgesEl     = document.getElementById("panel-route-badges");
      const tableBody    = document.getElementById("departures-body");

      panelEmpty.hidden   = true;
      panelStation.hidden = false;
      stopNameEl.textContent = props.stop_name || props.name || "Metrolink Station";
      stopIdEl.textContent   = `Stop ID: ${props.stop_id || "—"}`;
      badgesEl.innerHTML     = `<span class="route-badge" style="background:#ff6600">
                                  <span class="route-badge-dot"></span>Metrolink
                                </span>`;
      tableBody.innerHTML    = `<tr class="empty-row"><td colspan="3">Metrolink departures not available</td></tr>`;
    });

  }); // end map.on("load")

  return map;
}

initMap();