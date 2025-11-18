import requests

BASE_URL = "https://api.goswift.ly/real-time/lametro-rail"
API_KEY = "a083dc68622b251fd4fa2a63e055c3c9"

def getVehicles():
    url = f"{BASE_URL}/vehicles"
    response = requests.get(
        url,
        headers={"Authorization": API_KEY}
    )
    response.raise_for_status()
    return response.json()
def getDepartures(stopId):
    url = f"{BASE_URL}/predictions"
    response = requests.get(
        url,
        params={"stop": stopId},
        headers={"Authorization": API_KEY}
    )
    data = response.json()

    # Basic error handling
    if not data.get("success"):
        print("API returned an error.")
        return

    predictions_data = data["data"]["predictionsData"]
    return predictions_data