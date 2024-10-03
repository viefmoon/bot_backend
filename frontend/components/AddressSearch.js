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
    <div className="mb-8">
      <h2 className="text-2xl font-bold mb-4 text-indigo-700">Busca tu dirección</h2>
      <div className="relative">
        <Autocomplete
          onLoad={(autocomplete) =>
            autocomplete.addListener("place_changed", () => onPlaceChanged(autocomplete))
          }
        >
          <input
            type="text"
            placeholder="Ingresa tu dirección"
            className="w-full p-4 pr-12 border-2 border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200 bg-white shadow-sm"
          />
        </Autocomplete>
        <svg
          className="absolute right-3 top-1/2 transform -translate-y-1/2 h-6 w-6 text-indigo-500"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
      </div>
    </div>
  );
}
