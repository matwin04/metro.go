// catenary.js
const BASE_URL = "https://birch.catenarymaps.org";
const BASE_URL_RT = "https://birch_rt.catenarymaps.org";

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
export async function getRealtimeVehiclesForRoute(chateau, routeId, lastUpdatedTimeMs) {
    const params = new URLSearchParams();
    params.set("chateau", chateau);
    params.set("route_id", routeId);
    if (lastUpdatedTimeMs !== undefined && lastUpdatedTimeMs !== null) {
        params.set("last_updated_time_ms", lastUpdatedTimeMs);
    }

    const url = `${BASE_URL_RT}/get_rt_of_single_route?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Catenary RT API returned ${response.status}`);
    }

    return response.json();
}
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
