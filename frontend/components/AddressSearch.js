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
    <div className="mb-2 p-2 bg-white rounded-lg shadow-md">
      <h2 className="text-base font-semibold mb-1 text-gray-800">
        Busca tu dirección
      </h2>
      <Autocomplete
        onLoad={(autocomplete) =>
          autocomplete.addListener("place_changed", () =>
            onPlaceChanged(autocomplete)
          )
        }
      >
        <input
          type="text"
          placeholder="Ingresa tu dirección"
          className="w-full p-0.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
        />
      </Autocomplete>
    </div>
  );
}
