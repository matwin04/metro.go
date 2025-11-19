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
        const res = await fetch(`/api/departures/${stopId}`);
        const departures = await res.json();

        if (!departures || departures.length === 0) {
            stopNameEl.textContent = "No departures available.";
            tableBody.innerHTML = "";
            return;
        }

        stopNameEl.textContent = `Departures for Stop ${departures[0].stopName}`;

        // Flatten all predictions using flatMap
        const allPredictions = departures.flatMap(route =>
            route.destinations.flatMap(dest =>
                dest.predictions.map(pred => ({
                    routeId: route.routeId,
                    routeShortName: route.routeShortName,
                    headsign: dest.headsign,
                    min: pred.min,
                    time: pred.time,
                    vehicleId: pred.vehicleId,
                    block: pred.blockId,
                    trip: pred.tripId
                }))
            )
        );

        // Sort by minutes until arrival
        allPredictions.sort((a, b) => a.min - b.min);

        // Render table
        tableBody.innerHTML = "";
        allPredictions.forEach(dep => {
            const routeInfo = routeMap[dep.routeId] || routeMap["unknown"];

            // Convert Unix timestamp (seconds) to AM/PM time
            const arrivalTime = new Date(dep.time * 1000);
            const formattedTime = arrivalTime.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>
                    <img class="route-icon" src="/static/icons/routeicons/${dep.routeId}.svg"
                    alt="${dep.routeId}"
                    />
                </td>
                <td>${dep.headsign}</td>
                <td>${dep.min} min</td>
                <td>${formattedTime}</td>
                <td><a href="/api/trip/${dep.trip}" target="_blank">View Trip</a></td>
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
setInterval(renderDepartures, 30000);