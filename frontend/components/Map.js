import React from "react";
import { GoogleMap, Marker, Polygon } from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "350px",
};

const center = {
  lat: 20.54217,
  lng: -102.79222,
};


const polygonCoords = JSON.parse(process.env.NEXT_PUBLIC_POLYGON_COORDS || '[]');


export default function Map({ selectedLocation, onLocationChange, setError, isLocationAllowed }) {
  const handleMapClick = (event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    const location = { lat, lng };

    onLocationChange(location);
    if (!isLocationAllowed(location)) {
      setError("La ubicación seleccionada está fuera del área permitida.");
    } else {
      setError(null);
    }
  };

  const handleMarkerDragEnd = (event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    const location = { lat, lng };

    onLocationChange(location);
    if (!isLocationAllowed(location)) {
      setError("La ubicación seleccionada está fuera del área permitida.");
    } else {
      setError(null);
    }
  };

  return (
    <div className="mb-2 p-2 bg-white rounded-lg shadow-md">
      <h2 className="text-base font-semibold mb-1 text-gray-800">
        Ajusta el cursor a la ubicación exacta
      </h2>
      <div className="rounded-lg overflow-hidden">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={selectedLocation || center}
          zoom={15}
          onClick={handleMapClick}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            zoomControl: false,
          }}
        >
          {selectedLocation && (
            <Marker
              position={selectedLocation}
              draggable={true}
              onDragEnd={handleMarkerDragEnd}
              animation={window.google.maps.Animation.DROP}
            />
          )}
          <Polygon
            paths={polygonCoords}
            options={{
              fillColor: "rgba(255, 165, 0, 0.3)", 
              strokeColor: "green",
              strokeOpacity: 1,
              strokeWeight: 2,
            }}
          />
        </GoogleMap>
      </div>
    </div>
  );
}
