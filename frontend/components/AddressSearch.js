import React from "react";
import { Autocomplete } from "@react-google-maps/api";

export default function AddressSearch({ onSelect }) {
  const onPlaceChanged = (autocomplete) => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.geometry) {
        const selectedLocation = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };
        onSelect(selectedLocation, place.formatted_address);
      }
    }
  };

  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold mb-2">Busca tu dirección</h2>
      <Autocomplete
        onLoad={(autocomplete) =>
          autocomplete.addListener("place_changed", () => onPlaceChanged(autocomplete))
        }
      >
        <input
          type="text"
          placeholder="Ingresa tu dirección"
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
        />
      </Autocomplete>
    </div>
  );
}
