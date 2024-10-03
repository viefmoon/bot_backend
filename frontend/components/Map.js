import React from "react";
import { GoogleMap, Marker } from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "300px",
  borderRadius: "8px",
  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
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
    <div className="mb-6">
      <h2 className="text-xl font-semibold mb-2">Selecciona tu ubicación</h2>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={selectedLocation || center}
        zoom={15}
        onClick={handleMapClick}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
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
  );
}
