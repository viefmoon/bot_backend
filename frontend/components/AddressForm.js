import React, { useEffect } from "react";

export default function AddressForm({
  selectedLocation,
  address,
  formData,
  setFormData,
}) {
  useEffect(() => {
    if (selectedLocation && typeof address === "string") {
      setFormData((prev) => ({
        ...prev,
        latitude: selectedLocation.lat?.toString() || prev.latitude,
        longitude: selectedLocation.lng?.toString() || prev.longitude,
        streetAddress: address || prev.streetAddress,
      }));
    }
  }, [selectedLocation, address, setFormData]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const fieldTranslations = {
    streetAddress: "Dirección completa",
    neighborhood: "Colonia",
    postalCode: "Código postal",
    city: "Ciudad",
    state: "Estado",
    country: "País",
  };

  return (
    <form className="space-y-2 bg-white p-2 rounded-lg shadow-md">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {/* Campo de dirección completa */}
        <div className="col-span-1 sm:col-span-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="streetAddress"
              className="block mb-0.5 text-xs font-medium text-gray-700"
            >
              {fieldTranslations.streetAddress}
            </label>
            <p className="text-xs text-red-600">
              Importante: Incluya la orientación de la calle si aplica (ej.
              Norte, Sur, etc.)
            </p>
          </div>
          <input
            type="text"
            id="streetAddress"
            name="streetAddress"
            value={formData.streetAddress}
            onChange={handleChange}
            className="w-full p-1 text-sm border rounded-md border-gray-300 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        {/* Campo de detalles adicionales */}
        <div className="col-span-1 sm:col-span-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="additionalDetails"
              className="block mb-0.5 text-xs font-medium text-gray-700"
            >
              Detalles adicionales
            </label>
            <p className="text-xs text-gray-600">
              Agregue información extra para ubicar su dirección más fácilmente
            </p>
          </div>
          <textarea
            id="additionalDetails"
            name="additionalDetails"
            value={formData.additionalDetails}
            onChange={handleChange}
            className="w-full p-1 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            rows="2"
            placeholder="ej. entre calles, puntos de referencia"
          ></textarea>
        </div>

        {/* Campos agrupados */}
        <div className="col-span-1 sm:col-span-2 grid grid-cols-3 gap-1">
          {["neighborhood", "postalCode", "city", "state", "country"].map(
            (field) => (
              <div key={field}>
                <label
                  htmlFor={field}
                  className="block mb-0.5 text-xs font-medium text-gray-700"
                >
                  {fieldTranslations[field]}
                </label>
                <input
                  type="text"
                  id={field}
                  name={field}
                  value={formData[field]}
                  onChange={handleChange}
                  className="w-full p-0.5 text-sm border rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                  readOnly
                />
              </div>
            )
          )}
        </div>
      </div>
    </form>
  );
}
