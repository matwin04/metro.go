from flask import *
import requests
import metro
from metro import *
app = Flask(__name__)
@app.route("/")
def home():
    return render_template("index.html")
@app.route("/test")
def test():
    return render_template("test.html")

#FLASK DYNAMIC ROUTES
@app.route("/departures/<stopId>")
def stopDepartures(stopId):
    departures = metro.getDepartures(stopId)
    return render_template(
        "departures.html",
        departures=departures,
        stop_id=stopId  # pass stopId to template
    )
##JSON ROUTES
# FOR TESTING PURPOSES

@app.route("/api/vehicles")
def vehicles():
    vehicles = metro.getVehicles()
    return jsonify(vehicles)

@app.route("/api/departures/<stopId>")
def departures(stopId):
    departures = metro.getDepartures(stopId)
    return jsonify(departures)

@app.route("/api/trip/<tripId>")
def trip(tripId):
    trip = metro.getTripStops(tripId)
    return jsonify(trip)

@app.route("/api/routes/LACMTA_Rail")
def LACMTA_Rail():
    return redirect("/")
@app.route("/api/block/<blockId>")
def block(blockId):
    vehicles = metro.getVehicles()
    for v in vehicles.get("data", {}).get("vehicles", []):
        if v.get("blockId") == blockId:  # use .get() to avoid KeyError
            return jsonify(v)
    return jsonify({"error": "Block not found"}), 404
if __name__ == "__main__":
    app.run(debug=True,port=5050)