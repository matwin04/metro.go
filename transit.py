import json
import requests
from google.transit import gtfs_realtime_pb2
from google.protobuf.json_format import MessageToDict


# Load configuration
with open("agencies.json") as f:
    AGENCIES = json.load(f)


def fetch_gtfs_rt(url, api_key=None):
    headers = {}

    # API key is optional — use only if present
    if api_key:
        headers["x-api-key"] = api_key

    resp = requests.get(url, headers=headers)
    resp.raise_for_status()
    feed = gtfs_realtime_pb2.FeedMessage()
    feed.ParseFromString(resp.content)
    return MessageToDict(feed, preserving_proto_field_name=True)

def getVehicles(AGENCY_ID):
    if AGENCY_ID not in AGENCIES:
        return {"error": f"Unknown agency '{AGENCY_ID}'"}

    agency = AGENCIES[AGENCY_ID]
    vehicle_url = agency.get("vehicle_url")
    api_key = agency.get("api_key")
    if not vehicle_url:
        return {"error": "Agency is missing vehicle_url"}
    return fetch_gtfs_rt(vehicle_url, api_key)