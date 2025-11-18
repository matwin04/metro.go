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
        departures=departures
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
if __name__ == "__main__":
    app.run(debug=True,port=5050)