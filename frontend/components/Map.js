import React from "react";
import { GoogleMap, Marker } from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "220px",
};

const center = {
  lat: 20.6534,
  lng: -103.3474,
};

export default function Map({ selectedLocation, onLocationChange }) {
  const handleMapClick = (event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    onLocationChange({ lat, lng });
  };

  return (
    <div className="mb-2 p-2 bg-white rounded-lg shadow-md">
      <h2 className="text-base font-semibold mb-1 text-gray-800">
        Selecciona tu ubicación
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
            zoomControl: false, // Eliminamos el control de zoom para hacer el mapa más compacto
          }}
        >
          {selectedLocation && (
            <Marker
              position={selectedLocation}
              animation={window.google.maps.Animation.DROP}
            />
          )}
        </GoogleMap>
      </div>
    </div>
  );
}
