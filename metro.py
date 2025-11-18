import requests

BASE_URL = "https://api.goswift.ly/real-time/lametro-rail"
API_KEY = "a083dc68622b251fd4fa2a63e055c3c9"

def getVehicles():
    url = f"{BASE_URL}/vehicles"
    response = requests.get(url, headers={"Authorization": API_KEY})
    response.raise_for_status()
    return response.json()

def getDepartures(stopId):
    url = f"{BASE_URL}/predictions"
    response = requests.get(
        url,
        params={"stop": stopId, "verbose": True},
        headers={"Authorization": API_KEY}
    )
    data = response.json()
    if not data.get("success"):
        print(f"API returned an error for stop {stopId}")
        return []
    return data["data"]["predictionsData"]
def getTripStops(tripId):
    url = f"https://api.metro.net/LACMTA_Rail/stop_times/trip_id/{tripId}"
    response = requests.get(url)
    data = response.json()
    return data
def getAllStops():
    """Fetch all stops from the API and return their IDs"""
    url = f"{BASE_URL}/route_overview"
    response = requests.get(url, headers={"Authorization": API_KEY})
    response.raise_for_status()
    data = response.json()

    # Collect all unique stop IDs
    stop_ids = set()
    for route in data.get("data", {}).get("routes", []):
        for stop in route.get("stops", []):
            stop_ids.add(str(stop.get("stopId")))
    
    all_departures = []
    for stopId in stop_ids:
        departures = getDepartures(stopId)
        if departures:
            for dep in departures:
                dep["stopId"] = stopId  # track stop
            all_departures.extend(departures)
    
    return all_departures