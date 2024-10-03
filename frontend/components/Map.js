import React from "react";
import { GoogleMap, Marker } from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "400px", // Aumentamos la altura para mejor visibilidad
  borderRadius: "12px", // Más redondeado
  boxShadow: "0 6px 10px rgba(0, 0, 0, 0.15)", // Sombra más pronunciada
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
    <div className="mb-6 p-4 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-semibold mb-4">Selecciona tu ubicación</h2>
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
