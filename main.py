from flask import *
import requests
import metro
from metro import *
app = Flask(__name__)
from google.transit import gtfs_realtime_pb2
from google.protobuf.json_format import MessageToDict

with open("agencies.json") as f:
    AGENCIES = json.load(f)


def fetch_gtfs_rt(url, api_key=None):
    headers = {}
    if api_key:
        headers["x-api-key"] = api_key

    r = requests.get(url, headers=headers)
    r.raise_for_status()

    feed = gtfs_realtime_pb2.FeedMessage()
    feed.ParseFromString(r.content)

    return MessageToDict(feed, preserving_proto_field_name=True)

@app.route("/")
def home():
    return render_template("index.html")
@app.route("/index.html")
def phoenixcode():
    return render_template("index.html")

@app.route("/test")
def test():
    return render_template("test.html")
@app.route("/about")
def about():
    return render_template("about.html")
#FLASK DYNAMIC ROUTES

@app.route("/trips/<tripId>")
def tripDestinations(tripId):
    trip = metro.getTripStops(tripId)
    print(trip)
    return render_template(
        "trips.html",
        trip=trip
    )
@app.route("/trips/bus/<tripId>")
def bustrip(tripId):
    trip = metro.getBusTripStops(tripId)
    print(trip)
    return render_template(
        "trips.html",
        trip=trip
    )
@app.route("/departures/<stopId>")
def stopDepartures(stopId):
    departures = metro.getDepartures(stopId)
    return render_template(
        "departures.html",
        departures=departures,
        stop_id=stopId  # pass stopId to template
    )
@app.route("/departures/bus/<stopId>")
def busDepartures(stopId):
    departures = metro.getBusDepartures(stopId)
    return render_template(
        "departures.html",
        departures=departures,
        stop_id=stopId  # pass stopId to template
    )

##JSON ROUTES
# FOR TESTING PURPOSES
@app.route("/api")
def api():
    return jsonify("helloworld")
@app.route("/api/vehicles/bus")
def vehicles():
    vehicles = metro.getBusses()
    return jsonify(vehicles)
@app.route("/api/vehicles/rail")
def busses():
    busses = metro.getTrains()
    return jsonify(busses)
@app.route("/api/departures/<stopId>")
def departures(stopId):
    departures = metro.getDepartures(stopId)
    return jsonify(departures)
@app.route("/api/trips/<tripId>")
def trip(tripId):
    trip = metro.getTripStops(tripId)
    return jsonify(trip)

@app.route("/api/routes/LACMTA_Rail")
def LACMTA_Rail():
    return redirect("/")
## Modern Api Url


if __name__ == "__main__":
    app.run(debug=True,port=5050)