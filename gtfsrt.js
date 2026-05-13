import fs from 'fs';
import path from 'path';
import gtfsRealtime from 'gtfs-realtime';
import gtfsToGeoJSON from 'gtfs-to-geojson';
import Database from "better-sqlite3";

const db = new Database("./public/data.db");

function getAgencies() {
    return db.prepare(`
        SELECT * FROM feeds
    `).all();
}

/**
 * -----------------------------
 * FILE HELPERS
 * -----------------------------
 */
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function deleteIfExists(file) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
}

/**
 * -----------------------------
 * STATIC GTFS → GEOJSON
 * -----------------------------
 */
async function buildGeoJSON(agency) {
    const outputDir = `./geojson/${agency.agencyKey}`;
    ensureDir(outputDir);

    console.log(`[${agency.name}] building GeoJSON...`);

    await gtfsToGeoJSON({
        agencies: [
            {
                agency_key: agency.agencyKey,
                url: agency.staticGtfs
            }
        ],

        outputType: 'agency'
    });

    console.log(`[${agency.name}] GeoJSON complete`);
}

/**
 * -----------------------------
 * REALTIME DOWNLOAD
 * -----------------------------
 */
function buildUrl(url, apiKey) {
    if (!apiKey) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}api_key=${apiKey}`;
}

async function downloadRealtime(agency) {
    const dir = `public/data/feeds/${agency.agencyKey}`;
    console.log(dir);
    ensureDir(dir);

    const vehicleFile = path.join(dir, 'vehicle_positions.json');
    const tripFile = path.join(dir, 'trip_updates.json');

    deleteIfExists(vehicleFile);
    deleteIfExists(tripFile);

    const vehicleUrl = buildUrl(agency.vehicleUrl, agency.apiKey);
    const tripUrl = buildUrl(agency.tripUrl, agency.apiKey);

    await gtfsRealtime({
        agencyKey: agency.agencyKey,
        url: vehicleUrl,
        output: vehicleFile
    });

    await gtfsRealtime({
        agencyKey: agency.agencyKey,
        url: tripUrl,
        output: tripFile
    });

    console.log(`[${agency.name}] realtime updated`);
}

/**
 * -----------------------------
 * FULL PIPELINE PER AGENCY
 * -----------------------------
 */
async function runAgency(agency) {
    try {
        //await buildGeoJSON(agency);
        await downloadRealtime(agency);
    } catch (err) {
        console.error(`[${agency.name}] error`, err);
    }
}

/**
 * -----------------------------
 * MASTER LOOP
 * -----------------------------
 */
export async function runAll() {
    const agencies = getAgencies();

    for (const agency of agencies) {
        await runAgency(agency);
        console.log(`[${agency.name}] done`);
    }
}