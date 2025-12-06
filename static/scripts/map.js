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
async function loadBusStops() {
    const response = await fetch("https://transit.land/api/v2/rest/stops.geojson?served_by_onestop_ids=o-9q5-metro~losangeles", {
      "method": "GET",
      "headers": {
            "apikey": "WOo9vL8ECMWN76EcKjsNGfo8YgNZ7c2u"
        }
    });
    const data = await response.json();
    console.log(data);
    map.getSource("bus-stops").setData(data);
}
async function loadBusses() {
    const response = await fetch(`/api/vehicles/bus`);
    const data = await response.json();

    const vehicles = data?.data?.vehicles;
    if (!vehicles) return;

    map.getSource("busses").setData({
        type: "FeatureCollection",
        features: vehicles.map((v) => ({
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
async function loadTrains() {
    const response = await fetch(`/api/vehicles/rail`);
    const data = await response.json();

    const vehicles = data?.data?.vehicles;
    if (!vehicles) return;

    map.getSource("trains").setData({
        type: "FeatureCollection",
        features: vehicles.map((v) => ({
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
                color: routeColors[v.routeId] || routeColors.unknown
            }
        }))
    });
}
map.on("load", () => {
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
    map.addSource("trains", {
        type: "geojson",
        data: {
            type: "FeatureCollection",
            features: []
        }
    });
    map.addSource("busses", {
        type: "geojson",
        data: {
            type: "FeatureCollection",
            features: []
        }
    });

    map.addLayer({
        id: "bus-dots",
        type: "circle",
        source: "busses",
        paint: {
            "circle-radius": 5,
            "circle-color": "#ff6600",
            "circle-stroke-width": 1,
            "circle-stroke-color": "#000"
        }
    });
    map.addLayer({
        id: "train-dots",
        type: "circle",
        source: "trains",
        paint: {
            "circle-opacity": 0.75,
            "circle-radius": 6,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#fff",
            "circle-color": ["get", "color"]
        }
    });
    map.on("click", "bike-station-dots", (e) => {
        const p = e.features[0].properties;
        console.log(p);
        new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(
                `
                <div class="popup">
                    <b>${p.name}</b><br>
                    <b>${p.bikesAvailable}<b> Available<br>
                    <b>${p.docksAvailable}<b> Docks<br>
                    <a href="/bikes/${p.id}>View More</a>
                </div>
                `
            )
            .addTo(map)

    });
    map.on("click", "station-dots", (e) => {
        const p = e.features[0].properties;
        console.log(p);
        new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(
                `
                <div class="popup">
                    <b>${p.Station}</b><br>
                    ${p.StopNumber}<br>
                    <a href="/departures/${p.StopNumber}">View Departures</a>
                </div>
            `
            )
            .addTo(map);
    });
    map.on("click", "bus-dots", (e) => {
        const p = e.features[0].properties;
        console.log(p);
        new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(
                `
                <b>Route:</b> ${p.shortName}<br>
                <b>To:</b> ${p.headsign}<br>
                <b>ID:</b> ${p.id}<br>
                <a href="/trips/${p.tripId}">View Trip</a>
            `
            )
            .addTo(map);
    });
    map.on("click", "train-dots", (e) => {
        const p = e.features[0].properties;
        console.log(p);
        new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(
                `
                <b>Route:</b> ${p.shortName}<br>
                <b>To:</b> ${p.headsign}<br>
                <b>ID:</b> ${p.tripId}<br>
                <a href="/trips/${p.tripId}">View Trip</a>
            `
            )
            .addTo(map);
    });
    loadTrains();
    loadBusses();
    setInterval(loadTrains, 10000);
    setInterval(loadTrains, 10000);
});