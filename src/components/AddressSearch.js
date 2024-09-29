import React, { useState } from "react";
import { useJsApiLoader, Autocomplete } from "@react-google-maps/api";

const libraries = ["places"];

export default function AddressSearch({ onSelect }) {
  const [autocomplete, setAutocomplete] = useState(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    libraries: libraries,
  });

  const onLoad = (autocomplete) => {
    setAutocomplete(autocomplete);
  };

  const onPlaceChanged = () => {
    console.log("onPlaceChanged llamado");
    if (autocomplete !== null) {
      console.log("Autocomplete no es nulo");
      const place = autocomplete.getPlace();
      console.log("Lugar obtenido:", place);
      if (place.geometry) {
        console.log("Geometría encontrada");
        try {
          const selectedLocation = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          };
          console.log("Ubicación seleccionada:", selectedLocation);
          console.log("Dirección formateada:", place.formatted_address);
          onSelect(selectedLocation, place.formatted_address);
        } catch (error) {
          console.error("Error al procesar la ubicación:", error);
        }
      } else {
        console.log("No se encontró geometría para este lugar");
      }
    } else {
      console.log("Autocomplete es nulo");
    }
  };

  if (loadError) {
    return <div>Error al cargar Google Maps API</div>;
  }

  if (!isLoaded) return <div>Cargando...</div>;

  return (
    <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged}>
      <input
        type="text"
        placeholder="Busca tu dirección"
        className="w-full p-2 border border-gray-300 rounded"
      />
    </Autocomplete>
  );
}
