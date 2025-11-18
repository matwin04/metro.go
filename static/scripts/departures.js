const tableBody = document.getElementById("departures-body");
const stopNameEl = document.getElementById("stop-name");

// LA Metro route colors and letters
const routeMap = {
    "801": { color: "#0072BC", letter: "A" },
    "802": { color: "#EB131B", letter: "B" },
    "803": { color: "#58A738", letter: "C" },
    "804": { color: "#FDB913", letter: "E" },
    "805": { color: "#A05DA5", letter: "D" },
    "807": { color: "#E56DB1", letter: "K" },
    "unknown": { color: "#AAAAAA", letter: "?" }
};

async function renderDepartures() {
    try {
        const stopId = window.STOP_ID;
        const res = await fetch(`http://127.0.0.1:5050/api/departures/${stopId}`);
        const departures = await res.json();

        if (!departures || departures.length === 0) {
            stopNameEl.textContent = "No departures available.";
            tableBody.innerHTML = "";
            return;
        }

        stopNameEl.textContent = `Departures for Stop ${departures[0].stopName}`;

        // Flatten all predictions
        const allPredictions = [];
        departures.forEach(route => {
            route.destinations.forEach(dest => {
                dest.predictions.forEach(pred => {
                    allPredictions.push({
                        routeId: route.routeId,
                        routeShortName: route.routeShortName,
                        headsign: dest.headsign,
                        min: pred.min,
                        vehicleId: pred.vehicleId
                    });
                });
            });
        });

        // Sort by minutes
        allPredictions.sort((a, b) => a.min - b.min);

        // Render table
        tableBody.innerHTML = "";
        allPredictions.forEach(dep => {
            const routeInfo = routeMap[dep.routeId] || routeMap["unknown"];
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>
                    <span class="route-circle" style="background:${routeInfo.color}">
                        ${routeInfo.letter}
                    </span>
                </td>
                <td>${dep.headsign}</td>
                <td>${dep.min} min</td>
                <td>${dep.vehicleId}</td>
            `;
            tableBody.appendChild(row);
        });

    } catch (err) {
        console.error("Error fetching departures:", err);
        stopNameEl.textContent = "Error loading departures.";
        tableBody.innerHTML = "";
    }
}

// Initial render
renderDepartures();

// Update every 10 seconds
setInterval(renderDepartures, 10000);