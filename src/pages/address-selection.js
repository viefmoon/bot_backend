import React, { useState } from "react";
import Head from "next/head";
import AddressSearch from "../components/AddressSearch";
import Map from "../components/Map";
import AddressForm from "../components/AddressForm";

import dotenv from "dotenv";
dotenv.config();

export default function AddressSelection() {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [address, setAddress] = useState("");
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);

  const handleLocationSelect = (location, address) => {
    setSelectedLocation(location);
    setAddress(address);
  };

  // Asegúrate de que estás utilizando una clave de API válida
  const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <div>
      <Head>
        <title>Selección de Dirección - La Leña Pizza</title>
        <meta name="description" content="Selecciona tu dirección de entrega" />
      </Head>

      <main className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Selecciona tu dirección</h1>
        <AddressSearch onSelect={handleLocationSelect} />
        <Map
          apiKey={GOOGLE_MAPS_API_KEY}
          selectedLocation={selectedLocation}
          onLocationChange={handleLocationSelect}
          onError={(error) =>
            setMapError("Error al cargar el mapa: " + error.message)
          }
        />
        {mapError && <p className="text-red-500">{mapError}</p>}
        {isMapLoaded ? (
          <AddressForm selectedLocation={selectedLocation} address={address} />
        ) : (
          <p>Cargando mapa...</p>
        )}
      </main>
    </div>
  );
}
