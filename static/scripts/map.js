// ------------------------------
// Initialize map
// ------------------------------
const map = L.map("map").setView([34.05, -118.25], 10);

L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19
}).addTo(map);

// ------------------------------
// Layers
// ------------------------------
const stationLayer = L.layerGroup().addTo(map);
const routeLayer = L.layerGroup().addTo(map);
const bikeLayer = L.layerGroup().addTo(map);
const vehicleLayer = L.layerGroup().addTo(map);
const metrolinkLayer = L.layerGroup().addTo(map);

// ------------------------------
// Route colors
// ------------------------------
const routeColors = {
    801: "#0072BC",
    802: "#EB131B",
    803: "#58A738",
    804: "#FDB913",
    805: "#A05DA5",
    807: "#E56DB1",
    unknown: "#AAAAAA"
};

// ------------------------------
// 1️⃣ Load Rail Routes
// ------------------------------
async function loadRoutes() {
    try {
        const response = await fetch("/static/data/LACMTA_Rail/routes.geojson");
        const data = await response.json();

        routeLayer.clearLayers();

        L.geoJSON(data, {
            style: (feature) => ({
                color: routeColors[feature.properties.route_id] || "#444",
                weight: 3
            })
        }).addTo(routeLayer);
    } catch (err) {
        console.error("Error loading routes:", err);
    }
}

// ------------------------------
// 2️⃣ Load Rail Stations
// ------------------------------
async function loadStations() {
    try {
        const response = await fetch("/static/data/LACMTA_Rail/stations.geojson");
        const data = await response.json();

        stationLayer.clearLayers();

        L.geoJSON(data, {
            pointToLayer: (feature, latlng) =>
                L.circleMarker(latlng, {
                    radius: 5,
                    weight: 0.5,
                    color: "#000",
                    fillColor: "#ffffff",
                    fillOpacity: 1
                }).bindPopup(`
                    <b>${feature.properties.Station}</b><br>
                    Stop: ${feature.properties.StopNumber}<br>
                    <a href="/departures/${feature.properties.StopNumber}">View Departures</a>
                `)
        }).addTo(stationLayer);
    } catch (err) {
        console.error("Error loading stations:", err);
    }
}

// ------------------------------
// 3️⃣ Load Bike Share Stations
// ------------------------------
async function loadBikeStations() {
    try {
        const response = await fetch("https://bikeshare.metro.net/stations/json/");
        const data = await response.json();

        bikeLayer.clearLayers();

        data.features.forEach((station) => {
            const p = station.properties;
            const [lon, lat] = station.geometry.coordinates;

            L.circleMarker([lat, lon], {
                radius: 4,
                weight: 0.5,
                color: "#000",
                fillColor: "#fff211",
                fillOpacity: 1
            })
                .bindPopup(
                    `
                <b>${p.name}</b><br>
                Bikes: ${p.bikesAvailable}<br>
                Docks: ${p.docksAvailable}<br>
                E-Bikes: ${p.electricBikesAvailable}
            `
                )
                .addTo(bikeLayer);
        });
    } catch (err) {
        console.error("Error loading bike stations:", err);
    }
}

// ------------------------------
// 4️⃣ Load Vehicles (Main API)
// ------------------------------
async function loadVehicles() {
    try {
        const response = await fetch("/api/vehicles");
        const data = await response.json();

        const vehicles = data?.data?.vehicles;
        if (!vehicles) return;

        vehicleLayer.clearLayers();

        vehicles.forEach((v) => {
            if (!v.loc?.lat || !v.loc?.lon) return;

            L.circleMarker([v.loc.lat, v.loc.lon], {
                radius: 6,
                weight: 2,
                color: "#fff",
                fillColor: routeColors[v.routeId] || routeColors.unknown,
                fillOpacity: 0.75
            })
                .bindPopup(
                    `
                <b>Route:</b> ${v.routeShortName}<br>
                <b>To:</b> ${v.headsign}<br>
                <b>ID:</b> ${v.id}<br>
                <a href="/trips/${v.tripId}">View Trip</a>
            `
                )
                .addTo(vehicleLayer);
        });
    } catch (err) {
        console.error("Error loading vehicles:", err);
    }
}

// ------------------------------
// 5️⃣ Load Metrolink Vehicles
// ------------------------------
async function loadMetrolinkVehicles() {
    try {
        const response = await fetch("/api/vehicles/metrolink");
        const data = await response.json();

        const entities = data?.entity;
        if (!entities) return;

        metrolinkLayer.clearLayers();

        entities.forEach((e) => {
            const v = e.vehicle;
            if (!v?.position) return;

            const lat = v.position.latitude;
            const lon = v.position.longitude;

            L.circleMarker([lat, lon], {
                radius: 6,
                weight: 2,
                color: "#fff",
                fillColor: "#0072BC",
                fillOpacity: 0.75
            })
                .bindPopup(
                    `
                <b>Route:</b> ${v.trip?.route_id || "Unknown"}<br>
                <b>Trip ID:</b> ${v.trip?.trip_id || "Unknown"}<br>
                <b>Vehicle ID:</b> ${v.vehicle?.id || "Unknown"}<br>
                <b>Label:</b> ${v.vehicle?.label || "Unknown"}
            `
                )
                .addTo(metrolinkLayer);
        });

        console.log("Loaded Metrolink vehicles:", entities.length);
    } catch (err) {
        console.error("Error loading Metrolink vehicles:", err);
    }
}

// ------------------------------
// Load all static layers once
// ------------------------------
loadStations();
loadRoutes();
loadBikeStations();

// ------------------------------
// Load dynamic layers and auto-refresh
// ------------------------------
loadVehicles();
loadMetrolinkVehicles();

// Auto-refresh vehicles every 10 seconds
setInterval(() => {
    loadVehicles();
    loadMetrolinkVehicles();
}, 10000);
