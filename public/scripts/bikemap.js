let map;

function initMap() {
  map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/liberty',
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

    // =========================
    // SOURCES
    // =========================

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
      data: "/public/data/LACMTA_Rail/stations.geojson"
    });

    // YOUR LOCAL METROLINK STATIONS (kept as-is)
    map.addSource("metrolink-stations", {
      type: "geojson",
      data: "/public/data/Metrolinktrains/stops.geojson"
    });

    map.addSource("transit-routes", {
      type: "vector",
      tiles: [
        "https://transit.land/api/v2/tiles/routes/tiles/{z}/{x}/{y}.pbf?apikey=WOo9vL8ECMWN76EcKjsNGfo8YgNZ7c2u"
      ],
      minzoom: 0,
      maxzoom: 14
    });

    map.addSource("transit-stops", {
      type: "vector",
      tiles: [
        "https://transit.land/api/v2/tiles/stops/tiles/{z}/{x}/{y}.pbf?apikey=WOo9vL8ECMWN76EcKjsNGfo8YgNZ7c2u"
      ],
      minzoom: 0,
      maxzoom: 14
    });

    // =========================
    // ROUTES
    // =========================

    map.addLayer({
      id: "rail-lines",
      type: "line",
      source: "transit-routes",
      "source-layer": "routes",
      filter: ["==", ["get", "route_type"], 2],
      paint: {
        "line-color": ["get", "route_color"],
        "line-width": 3,
        "line-opacity": 0.9
      }
    });

    map.addLayer({
      id: "subway-lines",
      type: "line",
      source: "transit-routes",
      "source-layer": "routes",
      filter: ["==", ["get", "route_type"], 1],
      paint: {
        "line-color": ["get", "route_color"],
        "line-width": 3,
        "line-opacity": 0.9
      }
    });

    map.addLayer({
      id: "lightrail-lines",
      type: "line",
      source: "transit-routes",
      "source-layer": "routes",
      filter: ["==", ["get", "route_type"], 0],
      paint: {
        "line-color": ["get", "route_color"],
        "line-width": 3,
        "line-opacity": 0.9
      }
    });

    // =========================
    // STATIONS
    // =========================

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

    // =========================
    // METRO TRAINS
    // =========================

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

    // =========================
    // METROLINK TRAINS
    // =========================

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

    // =========================
    // METRO DATA STREAM
    // =========================

    function dmsToDecimal(dms) {
      const parts = dms.split(":").map(Number);
      const degrees = parts[0];
      const minutes = parts[1];
      const seconds = parts[2];
      const sign = degrees < 0 ? -1 : 1;

      return sign * (Math.abs(degrees) + minutes / 60 + seconds / 3600);
    }

    async function loadMetrolink() {
      try {
        const res = await fetch("https://rtt.metrolinktrains.com/trainlist.json");
        const data = await res.json();

        const features = data.map(train => {
          const lat = dmsToDecimal(train.lat);
          const lng = dmsToDecimal(train.long);

          return {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [lng, lat]
            },
            properties: {
              data: JSON.stringify(train)
            }
          };
        });

        map.getSource("metrolink-trains").setData({
          type: "FeatureCollection",
          features
        });

      } catch (err) {
        console.error("Metrolink error:", err);
      }
    }

    loadMetrolink();
    setInterval(loadMetrolink, 5000);

    // =========================
    // METRO STREAM
    // =========================

    const ws = new WebSocket("wss://api.metro.net/ws/LACMTA_Rail/vehicle_positions");

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const vehicle = data.vehicle;
        if (!vehicle || !vehicle.position) return;

        const id = vehicle.vehicle?.id || data.id;

        const lat = vehicle.position.latitude;
        const lng = vehicle.position.longitude;

        const route =
            data.route_code ||
            data.vehicle?.trip?.routeId ||
            "unknown";

        metroVehicles[id] = {
          coordinates: [lng, lat],
          color: routeColors[route] || routeColors.unknown,
          data: JSON.stringify(data)
        };

        const features = Object.values(metroVehicles).map(v => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: v.coordinates
          },
          properties: {
            color: v.color,
            data: v.data
          }
        }));

        map.getSource("metro-trains").setData({
          type: "FeatureCollection",
          features
        });

      } catch (err) {
        console.error("Metro WebSocket error:", err);
      }
    };

    // =========================
    // CURSOR STATES
    // =========================

  return map;
}

initMap();