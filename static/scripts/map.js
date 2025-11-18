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

map.on("load",()=>{
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
        id: "bike-station-dots",
        type: "circle",
        source: "bike-stations",
        paint: {
            "circle-radius": 2,
            "circle-color": "#d85757ff",
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
})