import express from "express";
import path from "path";
import dotenv from "dotenv";
import { engine } from "express-handlebars";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import fs from "node:fs/promises";
import { fetchAllTrains } from "amtrak";
import session from 'express-session';
import { sql, setupDB } from "./db.js";
import gtfsRealtime from "gtfs-realtime";
import {runAll} from "./gtfsrt.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VIEWS_DIR = path.join(__dirname, "views");
const PARTIALS_DIR = path.join(VIEWS_DIR, "partials");
const DB_PATH = path.join(__dirname, "public", "data.db");
const FEEDS_PATH = path.join(__dirname, "public", "data","feeds");
// =============================================
// DATABASE INITIALIZATION
// =============================================

const db = new Database(DB_PATH);
setupDB();
//setInterval(runAll, 10000);
// =============================================
// VIEW & STATIC CONFIG
// =============================================

setInterval(runAll, 15000);
app.engine("html", engine({ extname: ".html", defaultLayout: false, partialsDir: PARTIALS_DIR }));
app.set("view engine", "html");
app.set("views", VIEWS_DIR);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/views", express.static(path.join(__dirname, "views")));
app.use(
    session({
        secret: process.env.SESSION_SECRET || "thing-secret",
        resave: false,
        saveUninitialized: true,
    })
);

// =============================================
// PAGE ROUTES
// =============================================
function getAllFeeds() {
    return db.prepare(`
        SELECT * FROM feeds ORDER BY name ASC
    `).all();
}

function getFeedByAgencyKey(agencyKey) {
    return db.prepare(`
        SELECT * FROM feeds WHERE agencyKey = ?
    `).get(agencyKey);
}

app.get("/", async (req, res) => {
    res.render("index");
});

app.get("/testing", async (req, res) => {
    res.render("rawgtfs");
});

app.get("/transit", async (req, res) => {
    res.render("map");
});

app.get("/bikes", async (req, res) => {
    res.render("bikes");
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
app.get("/api/sources/transit", async (req, res) => {
    try {
        const sources = db.prepare("SELECT * FROM sources WHERE source_type = 0 ORDER BY agency_name ASC").all();
        res.json({ success: true, data: sources, count: sources.length });
    } catch (error) {
        console.error("Error fetching transit sources:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get all bikeshare sources from database
 * GET /api/sources/bikeshare
 */
app.get("/api/sources/bikeshare", async (req, res) => {
    try {
        const sources = db.prepare("SELECT * FROM sources WHERE source_type = 1 ORDER BY agency_name ASC").all();
        res.json({ success: true, data: sources, count: sources.length });
    } catch (error) {
        console.error("Error fetching bikeshare sources:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});


// =============================================
// TRANSIT AGENCIES ENDPOINTS
// =============================================

/**
 * Get all transit agencies (for the transit map)
 * GET /api/agencies
 * Returns agencies formatted for the transit map
 */
app.get("/api/feeds", async (req, res) => {
    try {
        const feeds = getAllFeeds();

        res.json({
            success: true,
            data: feeds.map(feed => ({
                agencyKey: feed.agencyKey,
                name: feed.name,
                color: feed.color || "#000000",
                staticGtfs: feed.staticGtfs,
                vehicleUrl: feed.vehicleUrl,
                tripUrl: feed.tripUrl
            })),
            count: feeds.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get a specific agency by key
 * GET /api/agencies/:agencyKey
 */
app.get("/api/feeds/:agencyKey", async (req, res) => {
    try {
        const feed = db.prepare("SELECT * FROM feeds WHERE agencyKey = ?").get(req.params.agencyKey);
        if (!feed) {
            return res.status(404).json({ success: false, error: "Agency not found" });
        }
        res.json({
            success: true,
            data: {
                agencyKey: feed.agencyKey,
                name: feed.name,
                color: feed.color || '#000000',
                staticGtfs: feed.staticGtfs || null,
                vehicleUrl: feed.vehicleUrl,
                tripUrl: feed.tripUrl
            }
        });
    } catch (error) {
        console.error("Error fetching agency:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get("/api/feeds/:agencyKey", async (req, res) => {
    try {
        const feed = getFeedByAgencyKey(req.params.agencyKey);

        if (!feed) {
            return res.status(404).json({
                success: false,
                error: "Feed not found"
            });
        }

        res.json({
            success: true,
            data: feed
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * Add a new transit agency
 * POST /api/agencies
 * Required Body: {
 *   agencyKey,       // unique identifier (e.g., 'f-foothilltransit')
 *   name,            // display name (e.g., 'Foothill Transit')
 *   staticGtfs,      // GTFS static data URL
 *   vehicleUrl,      // real-time vehicle positions URL
 *   tripUrl,         // real-time trip updates URL
 *   color            // hex color (optional, defaults to #000000)
 * }
 *
 * Example:
 * {
 *   "agencyKey": "f-test-transit",
 *   "name": "Test Transit Agency",
 *   "staticGtfs": "https://example.com/gtfs.zip",
 *   "vehicleUrl": "https://example.com/vehicles",
 *   "tripUrl": "https://example.com/trips",
 *   "color": "#ff0000"
 * }
 */
app.post("/api/agencies", async (req, res) => {
    try {
        const {
            agencyKey,
            name,
            color = '#000000',
            staticGtfs,
            vehicleUrl,
            tripUrl
        } = req.body;

        // Validate required fields
        if (!agencyKey || !name) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields: agencyKey, name"
            });
        }

        if (!staticGtfs || !vehicleUrl || !tripUrl) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields: staticGtfs, vehicleUrl, tripUrl"
            });
        }

        // Validate color format (basic hex validation)
        if (!/^#[0-9A-F]{6}$/i.test(color)) {
            return res.status(400).json({
                success: false,
                error: "Invalid color format. Use hex format (e.g., #ff6600)"
            });
        }

        const stmt = db.prepare(`
            INSERT INTO sources (
                feed_onestop_id, 
                feed_spec, 
                type, 
                url, 
                source_type, 
                agency_name, 
                color,
                static_gtfs_url,
                vehicle_url,
                trip_url
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            agencyKey,           // feed_onestop_id
            'gtfs',              // feed_spec
            'transit',           // type
            staticGtfs,          // url
            0,                   // source_type (0 = transit)
            name,                // agency_name
            color,               // color
            staticGtfs,          // static_gtfs_url
            vehicleUrl,          // vehicle_url
            tripUrl              // trip_url
        );

        res.status(201).json({
            success: true,
            message: "Agency added successfully",
            data: {
                agencyKey,
                name,
                color,
                staticGtfs,
                vehicleUrl,
                tripUrl,
                feedId: result.lastInsertRowid
            }
        });
    } catch (error) {
        console.error("Error adding agency:", error);
        if (error.message.includes("UNIQUE constraint failed")) {
            return res.status(409).json({
                success: false,
                error: "Agency with this key already exists"
            });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update a transit agency
 * PUT /api/agencies/:agencyKey
 * Body: partial update { name, color, staticGtfs, vehicleUrl, tripUrl }
 */
app.put("/api/agencies/:agencyKey", async (req, res) => {
    try {
        const { name, color, staticGtfs, vehicleUrl, tripUrl } = req.body;

        // Validate color if provided
        if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
            return res.status(400).json({
                success: false,
                error: "Invalid color format. Use hex format (e.g., #ff6600)"
            });
        }

        const stmt = db.prepare(`
            UPDATE sources 
            SET 
                agency_name = COALESCE(?, agency_name), 
                color = COALESCE(?, color), 
                static_gtfs_url = COALESCE(?, static_gtfs_url), 
                vehicle_url = COALESCE(?, vehicle_url), 
                trip_url = COALESCE(?, trip_url),
                updated_at = CURRENT_TIMESTAMP
            WHERE feed_onestop_id = ? AND source_type = 0
        `);

        const result = stmt.run(
            name || null,
            color || null,
            staticGtfs || null,
            vehicleUrl || null,
            tripUrl || null,
            req.params.agencyKey
        );

        if (result.changes === 0) {
            return res.status(404).json({ success: false, error: "Agency not found" });
        }

        res.json({
            success: true,
            message: "Agency updated successfully"
        });
    } catch (error) {
        console.error("Error updating agency:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Delete a transit agency
 * DELETE /api/agencies/:agencyKey
 */
/**
 * Get static feed JSON file by agencyId
 * GET /api/feeds/:agencyId
 */
app.get("/api/feeds/:agencyId", async (req, res) => {
    try {
        const { agencyId } = req.params;

        const filePath = path.join(
            __dirname,
            "public",
            "data",
            "feeds",
            `${agencyId}.json`
        );

        // read file
        const file = await fs.readFile(filePath, "utf-8");
        const json = JSON.parse(file);

        res.json({
            success: true,
            agencyId,
            data: json
        });

    } catch (error) {
        console.error("Error loading feed file:", error);

        if (error.code === "ENOENT") {
            return res.status(404).json({
                success: false,
                error: "Feed file not found"
            });
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
app.get("/api/feeds/:agencyId/:file", async (req, res) => {
    try {
        const { agencyId, file } = req.params;

        // prevent path traversal attacks
        const safeAgencyId = path.basename(agencyId);
        const safeFile = path.basename(file);

        const filePath = path.join(
            __dirname,
            "public",
            "data",
            "feeds",
            safeAgencyId,
            safeFile
        );

        const data = await fs.readFile(filePath, "utf-8");

        // try JSON parse, fallback to raw text
        try {
            res.json(JSON.parse(data));
        } catch {
            res.type("text/plain").send(data);
        }
    } catch (error) {
        console.error("Feed file error:", error.message);
        res.status(404).json({
            success: false,
            error: "Feed file not found"
        });
    }
});
app.delete("/api/agencies/:agencyKey", async (req, res) => {
    try {
        const stmt = db.prepare("DELETE FROM sources WHERE feed_onestop_id = ? AND source_type = 0");
        const result = stmt.run(req.params.agencyKey);

        if (result.changes === 0) {
            return res.status(404).json({ success: false, error: "Agency not found" });
        }

        res.json({ success: true, message: "Agency deleted successfully" });
    } catch (error) {
        console.error("Error deleting agency:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =============================================
// OTHER TRANSIT API ENDPOINTS
// =============================================

app.get("/api/metro/stop_data", async (req, res) => {
    const { stopId } = req.query;
    const url = `https://api.metro.net/LACMTA_Rail/stops/${stopId}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        res.json(data[0].properties);
    } catch (error) {
        console.error("Error fetching Metro stop data:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/swiftly/departures", async (req, res) => {
    const { stopId } = req.query;
    const url = `https://api.goswift.ly/real-time/lametro-rail/predictions?stop=${stopId}`;
    const options = {
        method: "GET",
        headers: {
            authorization: process.env.SWIFTLY_API_KEY || "a083dc68622b251fd4fa2a63e055c3c9",
            accept: "application/json"
        }
    };
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Error fetching Swiftly departures:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/transitland/departures", async (req, res) => {
    const { agencyId, gtfsId } = req.query;
    const url = `https://transit.land/api/v2/rest/stops/${agencyId}:${gtfsId}/departures?include_alerts=true&next=6000`;
    const options = {
        method: "GET",
        headers: {
            apikey: process.env.TRANSITLAND_API_KEY || "dViq8onyBCISi9OShVwn2jbv2WPysTsn"
        }
    };
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        res.json(data.stops[0]);
    } catch (error) {
        console.error("Error fetching Transitland departures:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/amtraker/stations", async (req, res) => {
    const { stationId } = req.query;
    const url = `https://asm-backend.transitdocs.com/station/${stationId}?points=true`;
    const options = {
        method: "GET"
    };
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.log("Error", error);
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/amtraker/trains", async (req, res) => {
    const trains = fetchAllTrains();
    const url = `https://api-v3.amtraker.com/v3/trains`;
    const options = {
        method: "GET"
    };
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.log("Error", error);
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/swiftly/vehiclepos", async (req, res) => {
    const { agency } = req.query;
    const url = `https://api.goswift.ly/real-time/${agency}/vehicles`;
    const options = {
        method: "GET",
        headers: {
            authorization: process.env.SWIFTLY_API_KEY || "a083dc68622b251fd4fa2a63e055c3c9",
            accept: "application/json"
        }
    };
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.log("Error", error);
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// START SERVER
// =============================================

if (!process.env.VERCEL && !process.env.NOW_REGION) {
    const PORT = process.env.PORT || 8088;
    app.listen(PORT, () => {
        console.log(`Server running: http://localhost:${PORT}`);
        console.log(`Database: ${DB_PATH}`);
    });
}

export default app;