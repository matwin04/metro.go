export const agencies = [
    {
        agencyKey: "f-foothilltransit",
        name:"Foothill Transit",
        staticGtfs: "https://foothilltransit.rideralerts.com/myStop/GTFS-Zip.ashx",
        vehicleUrl:"https://foothilltransit.rideralerts.com/myStop/GTFS-Realtime.ashx?Type=VehiclePosition",
        tripUrl:"https://foothilltransit.rideralerts.com/myStop/GTFS-Realtime.ashx?Type=TripUpdate"
    },
    {
        agencyKey: 'f-9mu-orangecountytransportationauthority',
        name: 'OCTA',
        color: '#ff6600',
        staticGtfs: 'https://www.octa.net/current/google_transit.zip',
        vehicleUrl: 'https://api.octa.net/GTFSRealTime/protoBuf/VehiclePositions.aspx',
        tripUrl: 'https://api.octa.net/GTFSRealTime/protoBuf/TripUpdates.aspx'
    },

    {
        agencyKey: 'f-9mu-irvine~ca~us',
        name: 'Irvine Shuttle',
        color: '#0055ff',

        staticGtfs:
            'https://passio3.com/irvine/passioTransit/gtfs/google_transit.zip',

        vehicleUrl:
            'https://passio3.com/irvine/passioTransit/gtfs/realtime/vehiclePositions',

        tripUrl:
            'https://passio3.com/irvine/passioTransit/gtfs/realtime/tripUpdates'
    }
];