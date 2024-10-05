import React, { useState } from "react";

const OrderCard = ({ order, onUpdateStatus }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const handleUpdateStatus = async (newStatus) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/update_order_status", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId: order.id, status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Error al actualizar el estado de la orden");
      }

      const updatedOrder = await response.json();
      onUpdateStatus(updatedOrder);
    } catch (error) {
      console.error("Error al actualizar el estado de la orden:", error);
      alert(
        "No se pudo actualizar el estado de la orden. Por favor, inténtelo de nuevo."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDetails = () => {
    setShowDetails(!showDetails);
  };

  const hasCoordinates =
    order.orderDeliveryInfo?.latitude != null &&
    order.orderDeliveryInfo?.longitude != null;
  const googleMapsLink = hasCoordinates
    ? `https://www.google.com/maps?q=${order.orderDeliveryInfo.latitude},${order.orderDeliveryInfo.longitude}`
    : null;

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden mb-4 border border-gray-200">
      <div className="p-4 lg:p-6">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center">
            <h5 className="text-lg lg:text-xl font-bold text-gray-800 mr-4">
              Pedido #{order.dailyOrderNumber}
            </h5>
            <span className="text-sm lg:text-base text-gray-600">
              {formatDateToMexicoTime(order.orderDate, true)}
            </span>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm lg:text-base font-semibold ${getStatusColor(
              order.status
            )}`}
          >
            {translateStatus(order.status)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm lg:text-base mb-2">
          <div>
            <p className="text-gray-600">Tipo:</p>
            <p className="font-medium">{translateOrderType(order.orderType)}</p>
          </div>
          <div>
            <p className="text-gray-600">Cliente:</p>
            <p className="font-medium">{order.clientId}</p>
          </div>
          <div>
            <p className="text-gray-600">Info de Entrega:</p>
            <p className="font-medium">
              {order.orderType === "delivery" && order.orderDeliveryInfo
                ? order.orderDeliveryInfo.streetAddress
                : order.orderDeliveryInfo?.pickupName || "N/A"}
            </p>
            <button onClick={toggleDetails} className="text-blue-500 underline">
              Ver detalles
            </button>
            {showDetails && (
              <div className="mt-2">
                <p>
                  <strong>Colonia:</strong>{" "}
                  {order.orderDeliveryInfo.neighborhood || "N/A"}
                </p>
                <p>
                  <strong>Código Postal:</strong>{" "}
                  {order.orderDeliveryInfo.postalCode || "N/A"}
                </p>
                <p>
                  <strong>Ciudad:</strong>{" "}
                  {order.orderDeliveryInfo.city || "N/A"}
                </p>
                <p>
                  <strong>Estado:</strong>{" "}
                  {order.orderDeliveryInfo.state || "N/A"}
                </p>
                <p>
                  <strong>País:</strong>{" "}
                  {order.orderDeliveryInfo.country || "N/A"}
                </p>
                <p>
                  <strong>Detalles Adicionales:</strong>{" "}
                  {order.orderDeliveryInfo.additionalDetails || "N/A"}
                </p>
                {hasCoordinates ? (
                  <a
                    href={googleMapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline"
                  >
                    Ver en Google Maps
                  </a>
                ) : (
                  <p className="text-gray-500">Mapa no disponible</p>
                )}
              </div>
            )}
          </div>
          <div>
            <p className="text-gray-600">Total:</p>
            <p className="font-bold text-green-600">
              ${order.totalCost.toFixed(2)}
            </p>
          </div>
        </div>

        {isExpanded && (
          <>
            {order.orderItems && order.orderItems.length > 0 && (
              <div className="mt-3">
                <h6 className="text-sm lg:text-base font-semibold mb-2">
                  Elementos de la orden:
                </h6>
                <ul className="space-y-2">
                  {order.orderItems.map((item, index) => (
                    <li key={index} className="text-sm lg:text-base">
                      <p className="font-medium">
                        {item.Product.name} - {item.ProductVariant.name} (x
                        {item.quantity})
                      </p>
                      {/* ... (resto del código para mostrar detalles del item) ... */}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <div className="mt-3 flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-blue-600 hover:text-blue-800 text-sm lg:text-base font-medium mb-2 sm:mb-0"
          >
            {isExpanded ? "Ver menos" : "Ver más"}
          </button>
          <div className="space-x-2 w-full sm:w-auto flex justify-end">
            <button
              className="px-3 py-1 lg:px-4 lg:py-2 bg-green-500 text-white text-sm lg:text-base rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition duration-300"
              onClick={() => handleUpdateStatus("accepted")}
              disabled={order.status === "accepted" || isLoading}
            >
              Aceptar
            </button>
            <button
              className="px-3 py-1 lg:px-4 lg:py-2 bg-red-500 text-white text-sm lg:text-base rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition duration-300"
              onClick={() => handleUpdateStatus("canceled")}
              disabled={order.status === "canceled" || isLoading}
            >
              Rechazar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const renderPizzaIngredients = (ingredients) => {
  const ingredientsByHalf = { left: [], right: [], full: [] };
  ingredients.forEach((ing) => {
    ingredientsByHalf[ing.half].push(
      `${ing.PizzaIngredient.name} (${translateAction(ing.action)})`
    );
  });

  return Object.entries(ingredientsByHalf).map(
    ([half, ings]) =>
      ings.length > 0 && (
        <div key={half}>
          <em>{translateHalf(half)}:</em> {ings.join(", ")}
        </div>
      )
  );
};

const renderModifiers = (modifiers) => {
  return modifiers
    .map((mod) => `${mod.Modifier.name} (+$${mod.Modifier.price.toFixed(2)})`)
    .join(", ");
};

const translateOrderType = (type) => {
  const translations = {
    delivery: "A domicilio",
    pickup: "Recolección",
  };
  return translations[type] || type;
};

const translateStatus = (status) => {
  const translations = {
    created: "Creado",
    accepted: "Aceptado",
    in_preparation: "En preparación",
    prepared: "Preparado",
    in_delivery: "En entrega",
    finished: "Finalizado",
    canceled: "Cancelado",
  };
  return translations[status] || status;
};

const translatePaymentStatus = (status) => {
  const translations = {
    pending: "Pendiente",
    paid: "Pagado",
    failed: "Fallido",
  };
  return translations[status] || status;
};

const translateHalf = (half) => {
  const translations = {
    left: "Izquierda",
    right: "Derecha",
    full: "Completa",
  };
  return translations[half] || half;
};

const translateAction = (action) => {
  const translations = {
    add: "Agregar",
    remove: "Quitar",
  };
  return translations[action] || action;
};

const getStatusColor = (status) => {
  const colors = {
    created: "primary",
    accepted: "success",
    in_preparation: "info",
    prepared: "secondary",
    in_delivery: "warning",
    finished: "success",
    canceled: "danger",
  };
  return colors[status] || "light";
};

const getPaymentStatusColor = (status) => {
  const colors = {
    pending: "warning",
    paid: "success",
    failed: "danger",
  };
  return colors[status] || "light";
};

const formatDateToMexicoTime = (dateString, dateOnly = false) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Fecha inválida";
  const options = {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  if (!dateOnly) {
    options.hour = "2-digit";
    options.minute = "2-digit";
    options.hour12 = true;
  }
  return date.toLocaleString("es-MX", options);
};

export default OrderCard;
