const map = new maplibregl.Map({
    container: "map",
    style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    center: [-118.25, 34.05],
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
async function loadVehicles() {
    const response = await fetch("/api/vehicles");
    const data = await response.json();

    const vehicles = data?.data?.vehicles;
    if (!vehicles) return;

    map.getSource("vehicles").setData({
        type: "FeatureCollection",
        features: vehicles.map(v => ({
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [v.loc.lon, v.loc.lat]
            },
            properties: {
                id: v.id,
                headsign: v.headsign,
                route: v.routeId,
                shortName: v.routeShortName,
                heading: v.loc.heading,
                color: routeColors[v.routeId] || routeColors.unknown
            }
        }))
    });
}
map.on("load",()=>{
    map.addSource("vehicles", {
            type: "geojson",
            data: {
                type: "FeatureCollection",
                features: []
            }
        });
    map.addSource("lacmta-routes",
        {
            type: "geojson",
            data: "/static/data/LACMTA_Rail/routes.geojson"
        }
    );
    map.addSource("stations",
        {
            type:"geojson",
            data: "/static/data/LACMTA_Rail/stations.geojson"
        }
    );
    map.addSource("bike-stations",
        {
            type:"geojson",
            data:"https://bikeshare.metro.net/stations/json/"
        }
    );
    map.addLayer({
        id: "lacmta-routes",
        type: "line",
        source: "lacmta-routes",
        paint: {
            "line-color": ["get", "routeId"],
            "line-width": 3
        }
    });
    map.addLayer({
        id: "bike-station-dots",
        type: "circle",
        source: "bike-stations",
        paint: {
            "circle-radius": 2,
            "circle-color": "#fff211",
            "circle-stroke-width": 1,
            "circle-stroke-color": "#000",
        }
    });
    
    map.addLayer({
        id: "station-dots",
        type: "circle",
        source: "stations",
        paint: {
            "circle-radius": 3,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#000",
            "circle-color": "#fff"
        }
    });
    map.addLayer({
        id: "vehicle-dots",
        type: "circle",
        source: "vehicles", 
        paint: {
            "circle-radius": 6,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#000",
            "circle-color": ["get", "color"]
        
        }
    });
    
    map.on("click", "station-dots", (e)=>{
        const p = e.features[0].properties;
        console.log(p);
        new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
                <div class="popup">
                    <b>${p.Station}</b><br>
                    ${p.StopNumber}<br>
                    <a href="/departures/${p.StopNumber}">View Departures</a>
                </div>
            `)
            .addTo(map);
    });
    map.on("click", "vehicle-dots", (e) => {
        const p = e.features[0].properties;

        new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
                <b>Route:</b> ${p.shortName}<br>
                <b>To:</b> ${p.headsign}<br>
                <b>ID:</b> ${p.id}<br>
                <a href="/trips/${p.tripId}">View Trip</a>
            `)
            .addTo(map);
    });
    loadVehicles();
    setInterval(loadVehicles, 10000);
});