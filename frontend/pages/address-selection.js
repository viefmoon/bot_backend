import React, { useState, useEffect } from "react";
import Head from "next/head";
import AddressSearch from "../components/AddressSearch";
import Map from "../components/Map";
import AddressForm from "../components/AddressForm";

export default function AddressSelection() {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [address, setAddress] = useState("");

  useEffect(() => {
    solicitarUbicacion();
  }, []);

  const solicitarUbicacion = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setSelectedLocation({ lat: latitude, lng: longitude });
          // Aquí podrías hacer una llamada a la API de geocodificación inversa para obtener la dirección
        },
        (error) => {
          console.error("Error al obtener la ubicación:", error);
        }
      );
    } else {
      console.log("La geolocalización no está disponible en este navegador.");
    }
  };

  const handleLocationSelect = (location, address) => {
    try {
      setSelectedLocation(location);
      setAddress(address);
    } catch (error) {
      console.error("Error al seleccionar la ubicación:", error);
    }
  };

  return (
    <div>
      <Head>
        <title>Selección de Dirección - La Leña Pizza</title>
        <meta name="description" content="Selecciona tu dirección de entrega" />
      </Head>

      <main className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Selecciona tu dirección</h1>
        <AddressSearch onSelect={handleLocationSelect} />
        {selectedLocation ? (
          <Map
            selectedLocation={selectedLocation}
            onLocationChange={handleLocationSelect}
          />
        ) : (
          <p>Selecciona una ubicación para mostrar el mapa</p>
        )}
        <AddressForm selectedLocation={selectedLocation} address={address} />
        <button onClick={solicitarUbicacion} className="mb-4 bg-blue-500 text-white p-2 rounded">
          Usar mi ubicación actual
        </button>
      </main>
    </div>
  );
}
