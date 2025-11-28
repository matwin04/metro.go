from flask import *
import requests

import amtrak
import metro
import transit
from metro import *
from amtrak import *
app = Flask(__name__)
@app.route("/")
def home():
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
@app.route("/api/amtrak/vehicles")
def amtrakVehicles():
    amtrakVehicles = amtrak.getVehicles()
    return jsonify(amtrakVehicles)
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

@app.route("/api/vehicles/<agencyId>")
def getAgency(agencyId):
    data = transit.getVehicles(agencyId)
    return jsonify(data)
if __name__ == "__main__":
    app.run(debug=True,port=5050)