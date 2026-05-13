import {agencies} from "/public/scripts/agencies.js";
const map = L.map('map').setView([33.7455, -117.8677], 11);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

/**
 * -------------------------
 * AGENCIES
 * -------------------------
 */

/**
 * -------------------------
 * GLOBAL MARKERS STORAGE
 * -------------------------
 */
let markers = [];

/**
 * -------------------------
 * LOAD ONE AGENCY
 * -------------------------
 */
async function loadAgencyVehicles(agency) {
    const res = await fetch(
        `/api/feeds/${agency.agencyKey}/vehicle_positions.json`
    );
    console.log(res);

    const data = await res.json();

    if (!data.entity) return;

    data.entity.forEach(entity => {
        const v = entity.vehicle;
        if (!v?.position) return;

        const lat = v.position.latitude;
        const lon = v.position.longitude;

        const routeId = v.trip?.routeId || 'Unknown';
        const tripId = v.trip?.tripId || 'Unknown';
        const vehicleId = v.vehicle?.id || 'Unknown';

        const bearing = v.position.bearing || 0;
        const speed = v.position.speed || 0;

        const icon = L.divIcon({
            className: '',
            html: `
                <div style="
                    transform: rotate(${bearing}deg);
                    font-size: 18px;
                    color: ${agency.color};
                    line-height: 18px;
                ">
                    ▲
                </div>
            `,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        const marker = L.marker([lat, lon], { icon })
            .bindPopup(`
                <b>${agency.name}</b><br>
                <b>Route:</b> ${routeId}<br>
                <b>Trip:</b> ${tripId}<br>
                <b>Vehicle:</b> ${vehicleId}<br>
                <b>Bearing:</b> ${bearing}<br>
                <b>Speed:</b> ${speed}
            `)
            .addTo(map);

        markers.push(marker);
    });
}
async function loadRoutes() {
    for (const agency of agencies) {
        try {
            const res = await fetch(
                `./geojson/${agency.agencyKey}/lines-and-stops.geojson`
            );

            const geojson = await res.json();

            L.geoJSON(geojson, {
                style: () => ({
                    color: agency.color,
                    weight: 3,
                    opacity: 0.7
                }),

                pointToLayer: (feature, latlng) =>
                    L.circleMarker(latlng, {
                        radius: 3,
                        color: agency.color,
                        fillOpacity: 1
                    }),

                onEachFeature: (feature, layer) => {
                    const p = feature.properties || {};
                    layer.bindPopup(`
                        <b>${agency.name}</b><br>
                        <b>Route:</b> ${p.route_short_name || 'N/A'}<br>
                        <b>Name:</b> ${p.route_long_name || 'N/A'}
                    `);
                }
            }).addTo(map);

            console.log(`Loaded routes for ${agency.name}`);

        } catch (err) {
            console.error(`Route load failed for ${agency.name}`, err);
        }
    }
}
/**
 * -------------------------
 * LOAD ALL VEHICLES
 * -------------------------
 */
async function loadVehicles() {

    // clear old markers
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    for (const agency of agencies) {
        await loadAgencyVehicles(agency);
        console.log(`Loaded vehicles for ${agency.name}`);
    }

    console.log(`Loaded ${markers.length} vehicles`);
}

/**
 * -------------------------
 * START LOOP
 * -------------------------
 */
loadVehicles();
//loadRoutes();
setInterval(loadVehicles, 5000);