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
dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VIEWS_DIR = path.join(__dirname, "views");
const PARTIALS_DIR = path.join(VIEWS_DIR, "partials");
const DB_PATH = path.join(__dirname, "public", "data.db");

// =============================================
// DATABASE INITIALIZATION
// =============================================

function initializeDatabase() {
  const db = new Database(DB_PATH);
  
  // Enable foreign keys
  db.pragma("foreign_keys = ON");
  
  // Create sources table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS "sources" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "feed_id" TEXT UNIQUE NOT NULL,
      "feed_type" TEXT NOT NULL,
      "source_type" INTEGER NOT NULL,
      "agency_name" TEXT,
      "agency_id" TEXT,
      "onestop_id" TEXT,
      "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
      "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

const db = initializeDatabase();
setupDB();
// =============================================
// VIEW & STATIC CONFIG
// =============================================

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

app.get("/", async (req, res) => {
    res.render("index");
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

/**
 * Get a specific source by feed_id
 * GET /api/sources/:feedId
 */
app.get("/api/sources/:feedId", async (req, res) => {
    try {
        const source = db.prepare("SELECT * FROM sources WHERE feed_id = ?").get(req.params.feedId);
        if (!source) {
            return res.status(404).json({ success: false, error: "Source not found" });
        }
        res.json({ success: true, data: source });
    } catch (error) {
        console.error("Error fetching source:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Add a new source to database
 * POST /api/sources
 * Body: { feed_id, feed_type, source_type, agency_name, agency_id, onestop_id }
 */
app.post("/api/sources", async (req, res) => {
    try {
        const { feed_onestop_id, feed_spec, type, url } = req.body;
        
      

        const stmt = db.prepare(`
            INSERT INTO sources (feed_onestop_id, feed_spec, type,url)
            VALUES (?, ?, ?, ?)
        `);
        
        const result = stmt.run(feed_onestop_id, feed_spec, type, url);
        
        res.status(201).json({ 
            success: true, 
            message: "Source added successfully",
            id: result.lastInsertRowid 
        });
    } catch (error) {
        console.error("Error adding source:", error);
        if (error.message.includes("UNIQUE constraint failed")) {
            return res.status(409).json({ success: false, error: "Feed ID already exists" });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update a source
 * PUT /api/sources/:feedId
 */
app.put("/api/sources/:feedId", async (req, res) => {
    try {
        const { feed_type, source_type, agency_name, agency_id, onestop_id } = req.body;
        
        const stmt = db.prepare(`
            UPDATE sources 
            SET feed_type = ?, source_type = ?, agency_name = ?, agency_id = ?, onestop_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE feed_id = ?
        `);
        
        const result = stmt.run(feed_type, source_type, agency_name || null, agency_id || null, onestop_id || null, req.params.feedId);
        
        if (result.changes === 0) {
            return res.status(404).json({ success: false, error: "Source not found" });
        }
        
        res.json({ success: true, message: "Source updated successfully" });
    } catch (error) {
        console.error("Error updating source:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Delete a source
 * DELETE /api/sources/:feedId
 */
app.delete("/api/sources/:feedId", async (req, res) => {
    try {
        const stmt = db.prepare("DELETE FROM sources WHERE feed_id = ?");
        const result = stmt.run(req.params.feedId);
        
        if (result.changes === 0) {
            return res.status(404).json({ success: false, error: "Source not found" });
        }
        
        res.json({ success: true, message: "Source deleted successfully" });
    } catch (error) {
        console.error("Error deleting source:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =============================================
// TRANSIT API ENDPOINTS
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
app.get("/api/amtraker/stations",async (req,res)=>{
  const {stationId} = req.query;
  const url =`https://asm-backend.transitdocs.com/station/${stationId}?points=true`;
  const options = {
    method:"GET"
  };
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    res.json(data);
  } catch (error){
    console.log("Error",error);
    res.status(500).json({ error: error.message });
  }
})
app.get("/api/amtraker/trains",async (req,res)=>{
  const trains = fetchAllTrains();
  const url = `https://api-v3.amtraker.com/v3/trains`;
  const options = {
    method: "GET"
  };
  try {
    const response = await fetch(url,options);
    const data = await response.json();
    res.json(data);
  } catch (error){
    console.log("Error",error);
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