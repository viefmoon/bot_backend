import React, { useEffect } from "react";
import axios from "axios";

export default function AddressForm({
  clientId,
  selectedLocation,
  address,
  formData,
  setFormData,
}) {
  useEffect(() => {
    if (selectedLocation) {
      setFormData((prev) => ({
        ...prev,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
        streetAddress: address.streetAddress,
        neighborhood: address.neighborhood,
        postalCode: address.postalCode,
        city: address.city,
        state: address.state,
        country: address.country,
      }));
    }
  }, [selectedLocation, address, setFormData]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post("/api/create-customer-delivery-info", {
        ...formData,
        clientId,
      });
      console.log("CustomerDeliveryInfo created:", response.data);
    } catch (error) {
      console.error("Error creating CustomerDeliveryInfo:", error);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 bg-white p-4 rounded-lg shadow-md"
    >
      <h2 className="text-xl font-bold mb-2 text-gray-800">
        Detalles de la dirección
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {[
          "streetAddress",
          "neighborhood",
          "postalCode",
          "city",
          "state",
          "country",
        ].map((field) => (
          <div key={field}>
            <label
              htmlFor={field}
              className="block mb-1 text-sm font-medium text-gray-700"
            >
              {field.charAt(0).toUpperCase() + field.slice(1)}
            </label>
            <input
              type="text"
              id={field}
              name={field}
              value={formData[field]}
              onChange={handleChange}
              className="w-full p-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required={field === "streetAddress"}
            />
          </div>
        ))}
      </div>
      <div>
        <label
          htmlFor="additionalDetails"
          className="block mb-1 text-sm font-medium text-gray-700"
        >
          Detalles adicionales
        </label>
        <textarea
          id="additionalDetails"
          name="additionalDetails"
          value={formData.additionalDetails}
          onChange={handleChange}
          className="w-full p-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows="2"
        ></textarea>
      </div>
      <button
        type="submit"
        className="w-full bg-blue-600 text-white px-3 py-1 rounded-md font-semibold hover:bg-blue-700 transition duration-300"
      >
        Guardar Dirección
      </button>
    </form>
  );
}
