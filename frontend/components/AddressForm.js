import React, { useState, useEffect } from "react";
import axios from "axios";

export default function AddressForm({ clientId, selectedLocation, address }) {
  const [formData, setFormData] = useState({
    streetAddress: "",
    neighborhood: "",
    postalCode: "",
    city: "",
    state: "",
    country: "",
    latitude: "",
    longitude: "",
    additionalDetails: "",
  });

  useEffect(() => {
    if (selectedLocation) {
      setFormData((prev) => ({
        ...prev,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
        streetAddress: address,
      }));
    }
  }, [selectedLocation, address]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        "/api/create-customer-delivery-info",
        { ...formData, clientId }
      );
      console.log("CustomerDeliveryInfo created:", response.data);
      // Aquí puedes agregar lógica adicional, como redireccionar al usuario o mostrar un mensaje de éxito
    } catch (error) {
      console.error("Error creating CustomerDeliveryInfo:", error);
      // Aquí puedes manejar el error, como mostrar un mensaje al usuario
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 bg-white p-8 rounded-lg shadow-lg">
      <h2 className="text-3xl font-bold mb-6 text-indigo-700">Detalles de la dirección</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="streetAddress" className="block mb-2 font-semibold text-gray-700">
            Dirección
          </label>
          <input
            type="text"
            id="streetAddress"
            name="streetAddress"
            value={formData.streetAddress}
            onChange={handleChange}
            className="w-full p-3 border-2 border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200"
            required
          />
        </div>
        <div>
          <label htmlFor="neighborhood" className="block mb-2 font-semibold text-gray-700">
            Colonia
          </label>
          <input
            type="text"
            id="neighborhood"
            name="neighborhood"
            value={formData.neighborhood}
            onChange={handleChange}
            className="w-full p-3 border-2 border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200"
          />
        </div>
        {/* Agrega campos similares para postalCode, city, state, country */}
      </div>
      <div>
        <label htmlFor="additionalDetails" className="block mb-2 font-semibold text-gray-700">
          Detalles adicionales
        </label>
        <textarea
          id="additionalDetails"
          name="additionalDetails"
          value={formData.additionalDetails}
          onChange={handleChange}
          className="w-full p-3 border-2 border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200"
          rows="4"
        ></textarea>
      </div>
      <button
        type="submit"
        className="w-full bg-indigo-600 text-white px-6 py-4 rounded-lg font-bold text-lg hover:bg-indigo-700 transition duration-300 transform hover:scale-105"
      >
        Guardar Dirección
      </button>
    </form>
  );
}
