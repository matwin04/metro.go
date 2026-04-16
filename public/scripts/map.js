// --- Map setup ---
const map = new maplibregl.Map({
  container: "map",
  style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  center: [-118.25, 34.05], // LA (lon, lat)
  zoom: 10
});

const routeColors = {
  801: "#0072BC",
  802: "#EB131B",
  803: "#58A738",
  804: "#FDB913",
  805: "#A05DA5",
  807: "#E56DB1",
  unknown: "#AAAAAA"
};

const emptyFC = () => ({ type: "FeatureCollection", features: [] });

function setSourceData(sourceId, data) {
  const src = map.getSource(sourceId);
  if (src) src.setData(data);
}

function routeColor(routeId) {
  return routeColors[String(routeId)] || routeColors[routeId] || routeColors.unknown;
}

// --- Data loaders ---
async function loadBusStops() {
  try {
    const response = await fetch(
      "https://transit.land/api/v2/rest/stops.geojson?served_by_onestop_ids=o-9q5-metro~losangeles",
      {
        method: "GET",
        headers: { apikey: "WOo9vL8ECMWN76EcKjsNGfo8YgNZ7c2u" }
      }
    );
    const data = await response.json();
    setSourceData("bus-stops", data);
  } catch (err) {
    console.error("loadBusStops failed:", err);
  }
}

async function loadVehicles(kind, sourceId) {
  try {
    const response = await fetch(`/api/vehicles/${kind}`);
    const data = await response.json();

    const vehicles = data?.data?.vehicles;
    if (!Array.isArray(vehicles)) return;

    setSourceData(sourceId, {
      type: "FeatureCollection",
      features: vehicles
        .filter(v => v?.loc?.lon != null && v?.loc?.lat != null)
        .map(v => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [v.loc.lon, v.loc.lat]
          },
          properties: {
            id: v.id,
            tripId: v.tripId,
            headsign: v.headsign,
            route: v.routeId,
            shortName: v.routeShortName,
            heading: v.loc.heading,
            color: routeColor(v.routeId)
          }
        }))
    });
  } catch (err) {
    console.error(`loadVehicles(${kind}) failed:`, err);
  }
}

const loadBuses = () => loadVehicles("bus", "buses");
const loadTrains = () => loadVehicles("rail", "trains");

// --- Map layers & interactions ---
map.on("load", () => {
  // Sources
  map.addSource("lacmta-routes", {
    type: "geojson",
    data: "/static/data/LACMTA_Rail/routes.geojson"
  });

  map.addSource("stations", {
    type: "geojson",
    data: "/static/data/LACMTA_Rail/stations.geojson"
  });

  map.addSource("bike-stations", {
    type: "geojson",
    data: "https://bikeshare.metro.net/stations/json/"
  });

  map.addSource("bus-stops", {
    type: "geojson",
    data: emptyFC()
  });

  map.addSource("trains", { type: "geojson", data: emptyFC() });
  map.addSource("buses", { type: "geojson", data: emptyFC() });

  // Layers
  map.addLayer({
    id: "lacmta-routes",
    type: "line",
    source: "lacmta-routes",
    paint: {
      "line-width": 3,
      "line-color": [
        "case",
        ["has", "routeId"],
        [
          "match",
          ["to-string", ["get", "routeId"]],
          "801", routeColors[801],
          "802", routeColors[802],
          "803", routeColors[803],
          "804", routeColors[804],
          "805", routeColors[805],
          "807", routeColors[807],
          routeColors.unknown
        ],
        routeColors.unknown
      ]
    }
  });

  map.addLayer({
    id: "bike-station-dots",
    type: "circle",
    source: "bike-stations",
    paint: {
      "circle-radius": 4,
      "circle-color": "#fff211",
      "circle-stroke-width": 1,
      "circle-stroke-color": "#000"
    }
  });

  map.addLayer({
    id: "station-dots",
    type: "circle",
    source: "stations",
    paint: {
      "circle-radius": 5,
      "circle-stroke-width": 1,
      "circle-stroke-color": "#000",
      "circle-color": "#fff"
    }
  });

  map.addLayer({
    id: "bus-stop-dots",
    type: "circle",
    source: "bus-stops",
    paint: {
      "circle-radius": 2,
      "circle-opacity": 0.5,
      "circle-color": "#333",
      "circle-stroke-width": 1,
      "circle-stroke-color": "#fff"
    }
  });

  map.addLayer({
    id: "bus-dots",
    type: "circle",
    source: "buses",
    paint: {
      "circle-radius": 3,
      "circle-opacity": 0.8,
      "circle-color": "#ff6600",
      "circle-stroke-width": 1,
      "circle-stroke-color": "#fff"
    }
  });

  map.addLayer({
    id: "train-dots",
    type: "circle",
    source: "trains",
    paint: {
      "circle-radius": 6,
      "circle-opacity": 0.75,
      "circle-stroke-width": 2,
      "circle-stroke-color": "#fff",
      "circle-color": ["get", "color"]
    }
  });

  // Popups
  map.on("click", "bike-station-dots", (e) => {
    const p = e.features?.[0]?.properties || {};
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`
        <div class="popup">
          <b>${p.name ?? "Bike Station"}</b><br>
          <b>${p.bikesAvailable ?? "?"}</b> Available<br>
          <b>${p.docksAvailable ?? "?"}</b> Docks<br>
          <a href="/bikes/${p.id}">View More</a>
        </div>
      `)
      .addTo(map);
  });

  map.on("click", "station-dots", (e) => {
    const p = e.features?.[0]?.properties || {};
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`
        <div class="popup">
          <b>${p.Station ?? "Station"}</b><br>
          ${p.StopNumber ?? ""}<br>
          <a href="/departures/${p.StopNumber}">View Departures</a>
        </div>
      `)
      .addTo(map);
  });

  map.on("click", "bus-dots", (e) => {
    const p = e.features?.[0]?.properties || {};
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`
        <b>Route:</b> ${p.shortName ?? ""}<br>
        <b>To:</b> ${p.headsign ?? ""}<br>
        <b>ID:</b> ${p.id ?? ""}<br>
        <a href="/trips/${p.tripId}">View Trip</a>
      `)
      .addTo(map);
  });

  map.on("click", "train-dots", (e) => {
    const p = e.features?.[0]?.properties || {};
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`
        <b>Route:</b> ${p.shortName ?? ""}<br>
        <b>To:</b> ${p.headsign ?? ""}<br>
        <b>ID:</b> ${p.tripId ?? ""}<br>
        <a href="/trips/${p.tripId}">View Trip</a>
      `)
      .addTo(map);
  });

  // Initial load + refresh
  loadTrains();
  loadBuses();
  loadBusStops();

  setInterval(loadTrains, 5_000);
  setInterval(loadBuses, 5_000);
});