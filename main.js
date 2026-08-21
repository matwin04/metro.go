import express from "express";
import path from "path";
import dotenv from "dotenv";
import { engine } from "express-handlebars";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import fs from "node:fs/promises";
import { fetchAllTrains } from "amtrak";
import session from "express-session";
//import { sql, setupDB } from "./db.js";
//import gtfsRealtime from "gtfs-realtime";
//import {runAll} from "./gtfsrt.js";
import {getAllEvents,getEvent,getRouteInfo,getRealtimeVehiclesForRoute}from "./catenary.js"
dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VIEWS_DIR = path.join(__dirname, "views");
const PARTIALS_DIR = path.join(VIEWS_DIR, "partials");
//const DB_PATH = path.join(__dirname, "public", "data.db");
//const FEEDS_PATH = path.join(__dirname, "public", "data","feeds");
// =============================================
// DATABASE INITIALIZATION
// =============================================

//const db = new Database(DB_PATH);
//setupDB();
//setInterval(runAll, 10000);
// =============================================
// VIEW & STATIC CONFIG
// =============================================

//setInterval(runAll, 15000);
app.engine(
    "html",
    engine({
        extname: ".html",
        defaultLayout: false,
        partialsDir: PARTIALS_DIR,

        helpers: {
            formatTime(timestamp) {
                if (!timestamp) return "—";

                return new Date(timestamp * 1000).toLocaleTimeString(
                    "en-US",
                    {
                        timeZone: "America/Los_Angeles",
                        hour: "numeric",
                        minute: "2-digit"
                    }
                );
            }
        }
    })
);
app.set("view engine", "html");
app.set("views", VIEWS_DIR);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/views", express.static(path.join(__dirname, "views")));

app.get("/", async (req, res) => {
    res.render("index");
});
/*app.get("/departures/swiftly/:agencyid/:gtfsid", async (req, res) => {
  try {
    const { agencyid,gtfs_id } = req.params;
    const url =
      `https://api.goswift.ly/real-time/${agencyid}/predictions?stop=${stopid}`;
    const response = await fetch(url);
    res:re

  }
})*/

app.get("/departures/:osm_station_id", async (req, res) => {
    try {
        const { osm_station_id } = req.params;
        const url =
            `https://birch.catenarymaps.org/departures_at_osm_station` +
            `?osm_station_id=${encodeURIComponent(osm_station_id)}` +
            `&include_shapes=false`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Catenary API returned ${response.status}`);
        }
        const data = await response.json();
        res.render("station", {
            station: data.osm_station,
            stops: data.stops,
            events: data.events || []
        });

    } catch (err) {
        console.error("Departure error:", err);
        res.status(500).render("station", {
            error: err.message,
            station: null,
            stops: [],
            events: []
        });
    }
});
app.get("/route/:chateau/:route_id", async (req, res) => {
    try {
        const { chateau, route_id } = req.params;
        const data = await getRouteInfo(chateau, route_id);

        const stops = data.stops || {};

        res.render("routeinfo", {
            route: data,
          stops: data.stops,
                routeJson: JSON.stringify(data),
            connections_per_stop: data.connections_per_stop,
            chateau,
            route_id,
            error: null
        });
    } catch (err) {
        console.error("Route info error:", err);
        res.status(500).render("routeinfo", {
            route: null,
            stops: {},
            platformStops: [],
            routeJson: "null",
            chateau: req.params.chateau,
            route_id: req.params.route_id,
            error: err.message
        });
    }
});
app.get("/api/catenarymaps/departures/:osm_station_id",async (req,res) => {
  try {
    const osm_station_id = req.params.osm_station_id;
    console.log(osm_station_id);
    const url = `https://birch.catenarymaps.org/departures_at_osm_station?osm_station_id=${osm_station_id}&include_shapes=false`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
    console.log(data.osm_station.name);
    console.log(data.osm_station.mode_type);
    console.log("---");
    console.log(data.stops);
    console.log("Backend is Catenary Maps");
  } catch (err) {
    console.error(err);
  }
})
app.get("/api/catenarymaps/departures/:osm_station_id/:n", async (req, res) => {
    try {
        const { osm_station_id, n } = req.params;
        const nNum = parseInt(n, 10);

        if (isNaN(nNum) || nNum < 1) {
            return res.status(400).json({ error: "n must be a positive integer (1, 2, 3...)" });
        }

        const greaterThanTime = Math.floor(Date.now() / 1000);
        const result = await getEvent(osm_station_id, nNum - 1, { greaterThanTime });
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
app.get("/api/catenarymaps/vehicles/:chateau/:route_id", async (req, res) => {
    try {
        const { chateau, route_id } = req.params;
        const data = await getRealtimeVehiclesForRoute(chateau, route_id);
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
app.get("/testing", async (req, res) => {
    res.render("rawgtfs");
});
app.get("/maps", async (req, res) => {
    res.render("maps");
});

app.get("/maps/bikemap", async (req, res) => {
    res.render("bikemap");
});

app.get("/maps/transit", async (req, res) => {
    res.render("transitland");
});

app.get("/departures", async (req, res) => {
    res.render("station");
});

app.get("/about", (req, res) => {
    res.render("about");
});

// =============================================
// DATA MANAGEMENT ENDPOINTS
// =============================================

/**
 * Get all transit sources from database
 * GET /api/sources/transit
 */

if (!process.env.VERCEL && !process.env.NOW_REGION) {
    const PORT = process.env.PORT || 8088;
    app.listen(PORT, () => {
        console.log(`Server running: http://localhost:${PORT}`);
        console.log(`Database: MICHEAL BALLS PENIS`);
    });
}

export default app;
