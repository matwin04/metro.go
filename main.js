import express from "express";
import path from "path";
import dotenv from "dotenv";
import { engine } from "express-handlebars";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

import fs from "node:fs/promises";
dotenv.config();
import {
    getAgencies,
    getCalendars,
    getFareAttributes,
    getFareMedia,
    getFareProducts,
    getFareRules,
    getRoutes,
    getServiceAlerts,
    getShapes,
    getShapesAsGeoJSON,
    getStopAttributes,
    getStops,
    getStopsAsGeoJSON,
    getStoptimes,
    getStopTimeUpdates,
    getTimetables,
    getTrips,
    getTripUpdates,
    getVehiclePositions,
    importGtfs,
    openDb,
    updateGtfsRealtime
} from "gtfs";
import { agency, trips } from "gtfs/models";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VIEWS_DIR = path.join(__dirname, "views");
const PARTIALS_DIR = path.join(VIEWS_DIR, "partials");
const GTFSCFG = JSON.parse(await fs.readFile(new URL("./configs/socal.json", import.meta.url), "utf8"));
const db = openDb(GTFSCFG);
await importGtfs(GTFSCFG);

app.engine("html", engine({ extname: ".html", defaultLayout: false, partialsDir: PARTIALS_DIR }));
app.set("view engine", "html");
app.set("views", VIEWS_DIR);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/views", express.static(path.join(__dirname, "views")));

app.get("/", async (req, res) => {
    const agencies = await getAgencies();
    res.render("index", {
        agencies: agencies
    });
});
app.get("/agencies/:agency_id", async (req, res) => {
    const agency_id = req.params.agency_id;
    const agency_data = getAgencies({ agency_id });
    const agency_routes = getRoutes({ agency_id });
    res.render("info/agencies", {
        agency_id: agency_id,
        agencies: agency_data,
        routes: agency_routes
    });
});
app.get("/api/overview", (req, res) => {
    res.render("overview", overview);
});
app.get("/api/agencies/:agency_id", (req, res) => {
    const agency_id = req.params.agency_id;
    const agency = getAgencies({ agency_id });
    res.json(agency);
});
app.get("/api/agencies", async (req, res) => {
    const { agency_id } = req.query;
    const agencies = agency_id ? getAgencies({ agency_id }) : getAgencies();
    res.json(agencies);
});
app.get("/api/routes", async (req, res) => {
    const { route_id } = req.query;
    const routes = route_id ? getRoutes({ route_id }) : getRoutes();
    res.json(routes);
});
app.get("/api/stops", (req, res) => {
    const { stop_id } = req.query;
    const stops = stop_id ? getStops({ stop_id }) : getStops();
    res.json(stops);
});

app.get("/api/stops.geojson", async (req, res) => {
    const { stop_id } = req.query;
    const stops = stop_id ? getStopsAsGeoJSON(stop_id) : getStopsAsGeoJSON();
    res.json(stops);
});
app.get("/api/trips", (req, res) => {
    const { trip_id } = req.query;
    const trips = trip_id ? getTrips({ trip_id }) : getTrips();
    res.json(trips);
});
app.get("/api/departures", (req, res) => {
    const { stop_id, trip_id, date } = req.query;
    const stoptimes = getStoptimes({
        ...(stop_id && { stop_id }),
        ...(trip_id && { trip_id }),
        ...(date && { date })
    });
    res.json(stoptimes);
});
app.get("/api/calendar", (req, res) => {
    const calendars = getCalendars();
    res.json(calendars);
});
app.get("/api/fares", (req, res) => {
    const { agency_id } = req.query;
    const fares = getFareAttributes({
        ...(agency && { agency_id })
    });
    res.json(fares);
});
app.get("/api/fare/products", (req, res) => {
    const fare_products = getFareProducts();
    res.json(fare_products);
});
app.get("/api/fare/rules", (req, res) => {
    const fare_rules = getFareRules();
    res.json(fare_rules);
});
app.get("/api/fare/media", (req, res) => {
    const fare_media = getFareMedia();
    res.json(fare_media);
});
app.get("/api/timetables", (req, res) => {
    const timetables = getTimetables();
    res.json(timetables);
});

app.get("/api/realtime/alerts", async (req, res) => {
    await updateGtfsRealtime(GTFSCFG);
    const service_alerts = getServiceAlerts();
    res.json(service_alerts);
});
app.get("/api/realtime/trip_updates", async (req, res) => {
    await updateGtfsRealtime(GTFSCFG);
    const { trip_id } = req.query;
    const trip_updates = trip_id ? getTripUpdates({ trip_id }) : getTripUpdates();
    res.json(trip_updates);
});
app.get("/api/realtime/stop_time_updates", async (req, res) => {
    await updateGtfsRealtime(GTFSCFG);
    const { trip_id } = req.query;
    const stop_time_updates = trip_id ? getStopTimeUpdates({ trip_id }) : getStopTimeUpdates();
    res.json(stop_time_updates);
});
app.get("/api/realtime/vehicle_positions", async (req, res) => {
    try {
        await updateGtfsRealtime(GTFSCFG);
        const vehicle_positions = getVehiclePositions();
        const enriched = vehicle_positions.map((vehicle) => {
            const trip = getTrips({ trip_id: vehicle.trip_id })[0];
            if (trip) {
                const route = getRoutes({ route_id: trip.route_id })[0];
                const stoptimes = getStoptimes({ trip_id: trip.trip_id })[0];
                const stoptime_updates = getTripUpdates({ trip_id: trip.trip_id })[0];
                return {
                    ...vehicle,
                    headsign: stoptimes.stop_headsign,
                    route_id: trip.route_id,
                    route_color: route?.route_color ? `#${route.route_color}` : null,
                    route_text_color: route?.route_text_color ? `#${route.route_text_color}` : null
                };
            }
            return vehicle;
        });
        res.json(enriched);
    } catch (error) {
        console.error("Realtime enrichment error:", error);
        res.status(500).json({ error: "Failed to fetch enriched vehicle positions" });
    }
});
app.get("/api/shapes", (req, res) => {
    const shapes = getShapesAsGeoJSON();
    res.json(shapes);
});

app.get("/about", (req, res) => {
    res.render("about");
});

// START SERVER
if (!process.env.VERCEL && !process.env.NOW_REGION) {
    const PORT = process.env.PORT || 8088;
    app.listen(PORT, () => {
        console.log(`Server running: http://localhost:${PORT}`);
        console.log(`📘 Auto-generated API docs will appear at http://localhost:${PORT}/api-docs`);
    });
}

export default app;