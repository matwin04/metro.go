// catenary.js
const BASE_URL = "https://birch.catenarymaps.org";

/**
 * Raw departures fetch, supports greater_than_time / less_than_time windowing.
 */
export async function getDeparturesAtStation(osmStationId, opts = {}) {
    const {
        greaterThanTime,
        lessThanTime,
        includeShapes = false
    } = opts;

    const params = new URLSearchParams();
    params.set("osm_station_id", osmStationId);
    if (greaterThanTime !== undefined && greaterThanTime !== null) {
        params.set("greater_than_time", greaterThanTime);
    }
    if (lessThanTime !== undefined && lessThanTime !== null) {
        params.set("less_than_time", lessThanTime);
    }
    params.set("include_shapes", includeShapes ? "true" : "false");
    const url = `${BASE_URL}/departures_at_osm_station?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Catenary API returned ${response.status}`);
    }

    return response.json();
}

/**
 * Get the Nth upcoming event at a station (0-indexed internally).
 * index=0 -> next departure, index=1 -> the one after that, etc.
 *
 * greaterThanTime/lessThanTime let you window the query (unix seconds),
 * otherwise it just pulls whatever the API returns and sorts by time.
 */
export async function getAllEvents(osmStationId) {
  const data = await getDeparturesAtStation(osmStationId);
  const events = data.events || [];
  return {
    events: data.events,
  }
}
export async function getEvent(osmStationId, index = 0, opts = {}) {
    const data = await getDeparturesAtStation(osmStationId, opts);
    const events = data.events || [];

    const sorted = [...events].sort((a, b) => {
        const aTime = a.scheduled_time ?? a.time ?? 0;
        const bTime = b.scheduled_time ?? b.time ?? 0;
        return aTime - bTime;
    });

    return {
        station: data.osm_station,
        stops: data.stops,
        event: sorted[index] ?? null,
        events: sorted
    };
}
/**
 * Get route info (color, name, shape, etc.) for a given chateau + route_id.
 * e.g. chateau="metro~losangeles", route_id="802"
 */

export async function getRouteInfo(chateau, routeId) {
  const url = `https://birch.catenarymaps.org/route_info_v2?chateau=${chateau}&route_id=${routeId}`;
  const options = { method: 'GET' };
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`Catenary API returned ${response.status}`);
    }
    const data = await response.json();
    console.log(data);
    return data;
  } catch (error) {
    console.error(error);
    throw error; // re-throw so your route's catch block still fires and renders the error page
  }
}
