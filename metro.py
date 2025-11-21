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
    print(tripId)
    url = f"https://api.metro.net/LACMTA_Rail/stop_times/trip_id/{tripId}"
    response = requests.get(url)
    data = response.json()
    return data
