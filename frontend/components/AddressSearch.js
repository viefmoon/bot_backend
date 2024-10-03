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
    <Autocomplete onLoad={(autocomplete) => autocomplete.addListener("place_changed", () => onPlaceChanged(autocomplete))}>
      <input
        type="text"
        placeholder="Busca tu dirección"
        className="w-full p-2 border border-gray-300 rounded mb-4"
      />
    </Autocomplete>
  );
}
