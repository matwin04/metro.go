import requests

BASE_URL = "https://api.goswift.ly/real-time/lametro-rail"
BUS_URL = "https://api.goswift.ly/real-time/lametro"
TL_BASE_URL = "https://transit.land/api/v2/rest/"
API_KEY = "a083dc68622b251fd4fa2a63e055c3c9"
TL_API_KEY = "WOo9vL8ECMWN76EcKjsNGfo8YgNZ7c2u"
def getBusses():
    url = f"{BUS_URL}/vehicles"
    response = requests.get(url, headers={"Authorization": API_KEY})
    response.raise_for_status()
    return response.json()
def getTrains():
    url = f"{BASE_URL}/vehicles"
    response = requests.get(url, headers={"Authorization": API_KEY})
    response.raise_for_status()
    return response.json()
def getRoutes():
    url = f"{TL_BASE_URL}/routes.json"
    response = requests.get(
        url,
        params={
                "served_by_onestop_ids": "o-9q5-metro~losangeles",
            },
        headers={
                "apikey": "WOo9vL8ECMWN76EcKjsNGfo8YgNZ7c2u",
            },
        )
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
def getBusDepartures(stopId):
    url = f"{BUS_URL}/predictions"
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
def getBusTripStops(tripId):
    print(tripId)
    url = f"https://api.metro.net/LACMTA/stop_times/trip_id/{tripId}"
    response = requests.get(url)
    data = response.json()
    return data