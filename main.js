import express from "express";
import path from "path";
import dotenv from "dotenv";
import { engine } from "express-handlebars";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

import fs from "node:fs/promises";
dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VIEWS_DIR = path.join(__dirname, "views");
const PARTIALS_DIR = path.join(VIEWS_DIR, "partials");

app.engine("html", engine({ extname: ".html", defaultLayout: false, partialsDir: PARTIALS_DIR }));
app.set("view engine", "html");
app.set("views", VIEWS_DIR);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/views", express.static(path.join(__dirname, "views")));

app.get("/", async (req, res) => {
    res.render("index");
});
app.get("/transit",async (req, res) => {
    res.render("map");
})
app.get("/bikes", async (req, res) => {
    res.render("bikes");
});
app.get("/api/metro/stop_data",async (req,res)=> {
    const {stopId} = req.query;
    const url = `https://api.metro.net/LACMTA_Rail/stops/${stopId}`;
    try {
        const response = await fetch(url);
        const data = await response.json();

        console.log(data[0].properties.stop_name);
        console.log(data[0].properties.stop_id);

        const stopData = data[0].properties;
        res.json(data[0].properties);
    } catch (error) {
        console.error(error);
    }
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
app.get("/api/swiftly/departures", async (req, res) => {
    const {stopId} = req.query;
    const url = `https://api.goswift.ly/real-time/lametro-rail/predictions?stop=${stopId}`;
    const options = {
        method: 'GET',
        headers: {authorization: 'a083dc68622b251fd4fa2a63e055c3c9', accept: 'application/json'}
    };

    try {
        const response = await fetch(url, options);
        const data = await response.json();
        console.log(data);
        res.json(data);
    } catch (error) {
        console.error(error);
    }
});
app.get("/api/transitland/departures", async (req, res) => {
    const {agencyId, gtfsId} = req.query;
    const url = `https://transit.land/api/v2/rest/stops/${agencyId}:${gtfsId}/departures?include_alerts=true&next=3000`;
    const options = {method: 'GET', headers: {apikey: 'dViq8onyBCISi9OShVwn2jbv2WPysTsn'}};
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        res.json(data.stops[0]);
    } catch (error) {
        console.error(error);
    }
});
app.get("/departures", async (req, res) => {
    res.render("station");
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