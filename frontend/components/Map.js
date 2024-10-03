import React from "react";
import { GoogleMap, Marker } from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "200px",
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
    <div className="mb-4">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={selectedLocation || center}
        zoom={15}
        onClick={handleMapClick}
      >
        {selectedLocation && <Marker position={selectedLocation} />}
      </GoogleMap>
    </div>
  );
}
