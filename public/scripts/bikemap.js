let map;

function initMap() {
  map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [-118.2437, 34.0522],
    zoom: 9
  });

  map.on("load", () => {
    map.addSource("bike-stations", {
      type: "geojson",
      data: "https://bts-status.bicycletransit.workers.dev/lax"
    });

    map.addLayer({
      id: "bike-station-dots",
      type: "circle",
      source: "bike-stations",
      paint: {
        "circle-radius": 5,
        "circle-color": [
          "case",
          [">=", ["get", "bikesAvailable"], 5], "#00a651",
          [">", ["get", "bikesAvailable"], 0], "#fdb913",
          "#d9232e"
        ],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#333"
      }
    });
  });

  map.on("click", "bike-station-dots", (e) => {
    const props = e.features[0].properties;
    new maplibregl.Popup()
        .setLngLat(e.features[0].geometry.coordinates)
        .setHTML(`
        <strong>${props.name}</strong><br>
        Bikes available: ${props.bikesAvailable}<br>
        Docks available: ${props.docksAvailable}
      `)
        .addTo(map);
  });

  map.on("mouseenter", "bike-station-dots", () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "bike-station-dots", () => {
    map.getCanvas().style.cursor = "";
  });

  return map;
}

initMap();