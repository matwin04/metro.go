// =========================
// CONFIG
// =========================

const ICON_BASE = "https://lacmta.github.io/metro-iconography/";

// Only routes listed here are drawn — anything else (missing/unknown route_code) is skipped.
const ROUTES = {
  801: { name: "A Line", letter: "A", color: "#0072BC", icon: ICON_BASE + "Service_ALine.svg" },
  802: { name: "B Line", letter: "B", color: "#EB131B", icon: ICON_BASE + "Service_BLine.svg" },
  803: { name: "C Line", letter: "C", color: "#58A738", icon: ICON_BASE + "Service_CLine.svg" },
  804: { name: "E Line", letter: "E", color: "#FDB913", icon: ICON_BASE + "Service_ELine2.svg" },
  805: { name: "D Line", letter: "D", color: "#A05DA5", icon: ICON_BASE + "Service_DLine.svg" },
  807: { name: "K Line", letter: "K", color: "#E56DB1", icon: ICON_BASE + "Service_KLine.svg" }
};

const WS_URL = "wss://api.metro.net/ws/LACMTA_Rail/vehicle_positions";
const STALE_SECONDS = 120; // ignore positions older than this
const REMOVE_AFTER_MS = 3 * 60000; // drop trains not heard from in this long
const ANIMATION_MS = 1000; // marker glide duration
const RECONNECT_MS = 5000;
const PING_MS = 30000;

const vehicles = {}; // id -> { marker, el, popup, routeCode, timestamp, lastSeen, data, anim }
let selectedId = null;

// =========================
// MAP
// =========================

function initMap() {
  const map = new maplibregl.Map({
    container: "map",
    style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    center: [-118.25, 34.05],
    zoom: 10,
    minZoom: 8
  });

  map.addControl(new maplibregl.NavigationControl(), "top-left");
  map.on("zoom", resizeMarkers);

  return map;
}

function markerSize() {
  return map.getZoom() >= 14 ? 28 : 18;
}

function resizeMarkers() {
  const size = markerSize();
  for (const id in vehicles) {
    vehicles[id].el.style.width = `${size}px`;
    vehicles[id].el.style.height = `${size}px`;
  }
}

// =========================
// MARKERS
// =========================

function styleMarker(el, route) {
  const size = markerSize();
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = "50%";
  el.style.background = `#fff url(${route.icon}) no-repeat center/cover`;
  el.style.boxShadow = `0 0 0 2px #fff, 0 1px 4px rgba(0,0,0,0.35)`;
  el.style.cursor = "pointer";
}

function popupHtml(id, route, data) {
  const v = data.vehicle;
  const speed = v.position?.speed != null ? `${Math.round(v.position.speed * 2.23694)} mph` : "—";
  const time = v.timestamp ? new Date(parseInt(v.timestamp, 10) * 1000).toLocaleTimeString() : "—";

  return `
    <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
      <img src="${route.icon}" style="width:24px;height:24px;border-radius:50%;">
      <strong>${route.name}</strong>
    </div>
    <div style="text-align:center;margin-top:4px;">
      Train Car #${id}<br>
      Stop: ${v.stopId ?? "—"}<br>
      Speed: ${speed}<br>
      Data from ${time}
    </div>`;
}

function createVehicle(id, route, data, lngLat, ts) {
  const el = document.createElement("div");
  el.className = "marker";
  el.dataset.vehicleId = id;
  el.dataset.route = data.route_code;
  styleMarker(el, route);

  const popup = new maplibregl.Popup({ offset: 12 }).setHTML(popupHtml(id, route, data));

  const marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(lngLat).setPopup(popup).addTo(map);

  el.addEventListener("click", () => {
    selectedId = id;
    updateCard(id);
  });

  vehicles[id] = {
    marker,
    el,
    popup,
    routeCode: String(data.route_code),
    timestamp: ts,
    lastSeen: Date.now(),
    data,
    anim: null
  };
}

function animateTo(vehicle, target) {
  if (vehicle.anim) cancelAnimationFrame(vehicle.anim);

  // No point animating in a background tab — just jump.
  if (document.hidden) {
    vehicle.marker.setLngLat(target);
    return;
  }

  const start = vehicle.marker.getLngLat();
  const dLng = target[0] - start.lng;
  const dLat = target[1] - start.lat;
  const t0 = performance.now();

  const step = (now) => {
    const p = Math.min((now - t0) / ANIMATION_MS, 1);
    const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    vehicle.marker.setLngLat([start.lng + dLng * eased, start.lat + dLat * eased]);
    vehicle.anim = p < 1 ? requestAnimationFrame(step) : null;
  };
  vehicle.anim = requestAnimationFrame(step);
}

function removeVehicle(id) {
  const v = vehicles[id];
  if (!v) return;
  if (v.anim) cancelAnimationFrame(v.anim);
  v.marker.remove();
  delete vehicles[id];
  if (selectedId === id) selectedId = null;
}

function pruneVehicles() {
  const now = Date.now();
  for (const id in vehicles) {
    if (now - vehicles[id].lastSeen > REMOVE_AFTER_MS) removeVehicle(id);
  }
}

// =========================
// DATA
// =========================

function handleMessage(data) {
  const v = data?.vehicle;
  if (!v || !v.position || !v.trip) return;

  const route = ROUTES[data.route_code];
  if (!route) return; // skip unknown routes — no more grey dots

  const id = v.vehicle?.id || data.id;
  const lat = Number(v.position.latitude);
  const lng = Number(v.position.longitude);
  if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const ts = parseInt(v.timestamp, 10) || 0;
  if (ts && Date.now() / 1000 - ts > STALE_SECONDS) return;

  const existing = vehicles[id];

  if (!existing) {
    createVehicle(id, route, data, [lng, lat], ts);
  } else {
    if (ts && existing.timestamp && ts <= existing.timestamp) return; // out-of-order/duplicate

    existing.timestamp = ts;
    existing.lastSeen = Date.now();
    existing.data = data;

    if (existing.routeCode !== String(data.route_code)) {
      existing.routeCode = String(data.route_code);
      existing.el.dataset.route = data.route_code;
      styleMarker(existing.el, route);
    }

    animateTo(existing, [lng, lat]);
    existing.popup.setHTML(popupHtml(id, route, data));
  }

  if (selectedId === id) updateCard(id);
  setUpdateTime();
}

function setUpdateTime() {
  const div = document.getElementById("update-time");
  if (!div) return;
  div.textContent = `Updated at ${new Date().toLocaleTimeString()}`;
  div.style.fontSize = "12px";
}

// =========================
// TRAIN CARD
// =========================

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function updateCard(id) {
  const vehicle = vehicles[id];
  if (!vehicle) return;

  const route = ROUTES[vehicle.routeCode];
  const v = vehicle.data.vehicle;

  setText("trainId", id);
  setText("train-headsign", `Metro ${route.name}`);
  setText("train-route", `Trip ${v.trip?.tripId ?? "—"}`);
  setText("nextStop", v.stopId ?? "—");
  setText("trainSpeed", v.position?.speed != null ? `${Math.round(v.position.speed * 2.23694)} mph` : "—");
  setText("trainSchedule", v.trip?.scheduleRelationship ?? "—");
  setText("trainAdherence", "—");

  const badge = document.querySelector("#trainInfoCard .route-badge");
  if (badge) {
    badge.textContent = route.letter;
    badge.style.background = route.color;
  }
}

// =========================
// WEBSOCKET
// =========================

function connectVehicleFeed(url) {
  const ws = new WebSocket(url);
  let pingTimer = null;

  ws.onopen = () => {
    console.log("WebSocket connected");
    pingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send("ping");
    }, PING_MS);
  };

  ws.onmessage = (event) => {
    try {
      handleMessage(JSON.parse(event.data));
    } catch (err) {
      // non-JSON frames (e.g. pong) land here; ignore them
    }
  };

  ws.onerror = (err) => console.error("WebSocket error:", err);

  ws.onclose = () => {
    console.log("WebSocket closed — reconnecting");
    clearInterval(pingTimer);
    setTimeout(() => connectVehicleFeed(url), RECONNECT_MS);
  };

  return ws;
}
// Predictions

async function loadStopTimes(stop) {
  const now = new Date().toISOString();
  const url = `https://api.goswift.ly/real-time/lametro-rail/predictions` + `?stop=80214`;

  console.log(url);
  lastStop = stop;
  document.getElementById("selected-stop").textContent = `${stop.name} (${stop.id})`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    const list = document.getElementById("stopTimesTable_body");

    list.innerHTML = "";

    const stopTimes = data.stopTimes || [];
    stopTimes.forEach((item) => {
      const scheduled = item.place?.scheduledDeparture;
      const realtime = item.place?.departure;
      const scheduledTime = scheduled
        ? new Date(scheduled).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit"
          })
        : "";

      const realtimeTime = realtime
        ? new Date(realtime).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit"
          })
        : "";

      const delayInfo = item.realTime ? getDelayInfo(scheduled, realtime) : null;

      const row = document.createElement("div");
      row.className = "departure-row";

      const routeColor = routeOrModeColor(item.routeColor, item.mode);

      const modeMeta = MODE_META[item.mode] || DEFAULT_MODE_META;

      row.innerHTML = `
                <div class="departure-main">
                    <span class="route-pill" style="
                        background:${routeColor};
                        color:#${item.routeTextColor || "ffffff"};
                    ">
                        ${item.routeShortName || item.displayName}
                    </span>

                    <div class="departure-info">
                        <div class="departure-headsign">${item.headsign || ""}</div>
                        <div class="departure-sub">
                            <span class="mode-badge" style="--marker-color:${routeOrModeColor(item.routeColor, item.mode)}">
                                <i class="mdi ${modeMeta.icon}"></i>
                                ${item.mode ? item.mode.replaceAll("_", " ") : ""}
                            </span>
                            <span class="departure-agency">${item.agencyName || ""}</span>
                        </div>
                    </div>
                </div>

                <div class="departure-time">
                    <span class="time-scheduled${delayInfo && delayInfo.diffMin !== 0 ? " time-scheduled--adjusted" : ""}">${scheduledTime}</span>
                    ${
                      item.realTime
                        ? `<span class="time-realtime status-${delayInfo.status}">
                                    <i class="mdi mdi-circle-medium"></i>
                                    ${realtimeTime} · ${delayInfo.label}
                               </span>`
                        : ""
                    }
                </div>
            `;

      row.addEventListener("click", () => loadTripDetails(item.tripId));

      list.appendChild(row);
    });
  } catch (error) {
    console.error("Stop times error:", error);
  }
}
// =========================
// LAX OVERLAY
// =========================

function addLaxLayer() {
  map.addSource("lax", {
    type: "geojson",
    data: "/data/LAX.geojson" // served from /public/data/LAX.geojson
  });

  // Polygons (terminals, airfield, etc.)
  map.addLayer({
    id: "lax-fill",
    type: "fill",
    source: "lax",
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: {
      "fill-color": ["coalesce", ["get", "fill"], "#6b7280"],
      "fill-opacity": 0.25
    }
  });

  map.addLayer({
    id: "lax-outline",
    type: "line",
    source: "lax",
    filter: ["in", ["geometry-type"], ["literal", ["Polygon", "LineString"]]],
    paint: {
      "line-color": ["coalesce", ["get", "stroke"], "#374151"],
      "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1, 15, 3]
    }
  });

  // Points (stops, labels, etc.)
  map.addLayer({
    id: "lax-points",
    type: "circle",
    source: "lax",
    filter: ["==", ["geometry-type"], "Point"],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 15, 6],
      "circle-color": ["coalesce", ["get", "marker-color"], "#111827"],
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 1.5
    }
  });

  // Popup with the feature's name on click
  map.on("click", "lax-points", (e) => {
    const p = e.features[0].properties;
    new maplibregl.Popup({ offset: 8 })
      .setLngLat(e.lngLat)
      .setHTML(`<strong>${p.name ?? p.Name ?? "LAX"}</strong>`)
      .addTo(map);
  });
  map.on("mouseenter", "lax-points", () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", "lax-points", () => (map.getCanvas().style.cursor = ""));
}
// =========================
// START
// =========================

const map = initMap();
map.on("load", () => {
  connectVehicleFeed(WS_URL);
  addLaxLayer();
  setInterval(pruneVehicles, 15000);
});
