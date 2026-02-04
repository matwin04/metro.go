async function loadRouteColors() {
    const res = await fetch("/api/routes");
    const routes = await res.json();

    let routeColors = Object.fromEntries(
        routes.map((r) => [r.route_id, r.route_color ? `#${r.route_color}` : "#888888"])
    );
}


const map = new maplibregl.Map({
    container: "map",
    style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    center: [-118.25, 34.05],
    zoom: 9
});
function showTrainPopup(e) {
    const f = e.features[0];
    const p = f.properties;
    const train_info = document.getElementById("train-info");

    document.getElementById("headsign").textContent = p.headsign;
    document.getElementById("id").textContent = p.id;
    document.getElementById("trip-id").textContent = p.trip_id;
    document.getElementById("route_id").textContent = p.route_id;
    document.getElementById("route_name").textContent = p.route_long_name;
    train_info.style.background = p.route_color;
    train_info.style.color = p.route_text_color;
}
async function getDepartureBoard(e) {
    const f = e.features[0];
    const p = f.properties;
    const response = await fetch(`/api/departures?stop_id=${p.stop_id}`);

    const data = await response.json();
    console.log(data);
    const tableBody = document.getElementById("station-table-body");
    tableBody.innerHTML = "";
    data.forEach((departure) => {
        const row = `
            <tr>
                <td>${departure.arrival_time}</td>
                <td>${departure.trip_id}</td>
                <td>${departure.stop_headsign}</td>
            </tr>
        `;
        tableBody.insertAdjacentHTML("beforeend", row);
    });
}

async function getStationName(stop_id) {
     const response = await fetch(`/api/stops?stop_id=${stop_id}`);
     const data = await response.json();
     console.log(data[0].stop_name);
     return data[0].stop_name;
}

async function getTripBoard(e) {
    const { trip_id } = e.features[0].properties;
    const tableBody = document.getElementById('train-table-body');
    try {
        const [staticRes, realtimeRes] = await Promise.all([
            fetch(`/api/departures?trip_id=${trip_id}`),
            fetch(`/api/realtime/stop_time_updates?trip_id=${trip_id}`)
        ]);
        const staticData = await staticRes.json();
        const realtimeData = await realtimeRes.json();

        // Current time in seconds for comparison with GTFS-rt timestamps

        tableBody.innerHTML = '';
        const formatTime = (timestamp) => {
            if (!timestamp) return 'N/A';
            // Ensure we are working with milliseconds
            const date = new Date(timestamp * 1000);
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
            });
        };
        for (const st of staticData) {
            const rt = realtimeData.find(update => update.stop_id === st.stop_id);
            const now = Math.floor(Date.now() / 1000);
            const arrivalTime = rt?.arrival_timestamp || st.arrival_timestamp;
            // Use realtime arrival if available, otherwise fallback to static
            const rt_arrival = rt?.arrival_timestamp;
            const st_arrival = st.arrival_timestamp;
            const nowInSeconds = Math.floor(Date.now() / 1000);
            if (arrivalTime < (nowInSeconds - 43200)) {
                continue; // Skip this row if it's from > 12 hours ago
            }

            const name = await getStationName(st.stop_id);

            const row = `
                <tr class="${rt ? 'status-live' : 'status-scheduled'}">
                    <td>${name}</td>
                    <td>${formatTime(arrivalTime)}</td>
                    <td>${rt ? 'status-live' : 'status-scheduled'}</td>
                </tr>`;

            tableBody.insertAdjacentHTML('beforeend', row);
        }
    } catch (err) {
        console.error('Error loading trip board:', err);
    }
}


function showStopPopup(e) {
    const f = e.features[0];
    const p = f.properties;
    const station_info = document.getElementById("station-info");
    station_info.innerHTML = `
        <div class="stop_name">${p.stop_name}</div>
        ${p.stop_id}<br>
        
    `;
}
function vehiclesToGeoJSON(data) {
    return {
        type: "FeatureCollection",
        features: data
            .filter((v) => v.latitude && v.longitude)
            .map((v) => ({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [v.longitude, v.latitude]
                },
                properties: {
                    id: v.id,
                    route_id: v.route_id,
                    trip_id: v.trip_id,
                    timestamp: v.timestamp,
                    headsign: v.headsign,
                    route_color: v.route_color ? v.route_color : null,
                    route_text_color: v.route_text_color ? v.route_text_color : null
                }
            }))
    };
}
async function loadVehiclesPositions() {
    const res = await fetch("/api/realtime/vehicle_positions");
    const data = await res.json();
    console.log(data);
    const geojson = vehiclesToGeoJSON(data);
    console.log(geojson);
    if (map.getSource("vehicles")) {
        map.getSource("vehicles").setData(geojson);
        return;
    }
    map.addSource("vehicles", {
        type: "geojson",
        data: geojson
    });
    map.addLayer({
        id: "vehicles-layer",
        type: "circle",
        source: "vehicles",
        paint: {
            "circle-radius": 5,
            "circle-color": ["get", "route_color"],
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 1
        }
    });
}
map.addControl(new maplibregl.NavigationControl());

map.on("load", () => {
    loadVehiclesPositions();
    map.addSource("shapes", {
        type: "geojson",
        data: "/api/shapes"
    });
    map.addSource("stops", {
        type: "geojson",
        data: "/api/stops.geojson"
    });
    map.addLayer({
        id: "routes-layer",
        type: "line",
        source: "shapes",
        paint: {
            "line-width": 2,
            "line-color": ["get", "route_color"]
        }
    });

    map.addLayer({
        id: "stops-layer",
        type: "circle",
        source: "stops",
        paint: {
            "circle-radius": 4,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#000",
            "circle-color": "#fff"
        }
    });
    map.addLayer({
        id: "routes-layer",
        type: "line",
        source: "shapes",
        paint: {
            "circle-radius": 6,
            "circle-color": "#ff6000"
        }
    });

    map.on("click", "vehicles-layer", showTrainPopup);
    map.on("click", "stops-layer", showStopPopup);
    map.on("click", "stops-layer", getDepartureBoard);
    map.on("click", "vehicles-layer", getTripBoard);
    const REFRESH_MS = 30000;
    setInterval(() => {
        if (!map.isStyleLoaded()) return;
        loadVehiclesPositions();
        map.getSource("shapes")?.setData("/api/shapes");
        console.log(REFRESH_MS);
    }, REFRESH_MS);
});