import React, { useState } from "react";

const OrderCard = ({ order, onUpdateStatus }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const handleUpdateStatus = async (newStatus) => {
    // Validación para pedidos sincronizados que se intentan cancelar
    if (newStatus === "canceled" && order.syncedWithLocal) {
      const confirmar = window.confirm(
        "¡Advertencia! Este pedido ya está sincronizado con el servidor local. " +
          "Si lo cancela, deberá eliminar el pedido manualmente del servidor local. " +
          "¿Desea continuar con la cancelación?"
      );
      if (!confirmar) {
        return;
      }
    }

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

  const scheduledDeliveryTime = order.scheduledDeliveryTime
    ? formatDateToMexicoTime(order.scheduledDeliveryTime)
    : null;

  const finishedTime = order.finishedAt
    ? formatDateToMexicoTime(order.finishedAt)
    : null;

  const getOrderTypeColor = (type) => {
    return type === "delivery" ? "bg-blue-400" : "bg-purple-400";
  };

  const renderPizzaIngredients = (ingredients) => {
    const ingredientsByHalf = { left: [], right: [], full: [] };
    ingredients.forEach((ing) => {
      const action = ing.action === "remove" ? "sin" : "";
      ingredientsByHalf[ing.half].push(`${action} ${ing.PizzaIngredient.name}`);
    });

    // Agregar ingredientes 'full' a ambas mitades
    ingredientsByHalf.left = [
      ...ingredientsByHalf.left,
      ...ingredientsByHalf.full,
    ];
    ingredientsByHalf.right = [
      ...ingredientsByHalf.right,
      ...ingredientsByHalf.full,
    ];

    if (
      ingredientsByHalf.left.length === 0 &&
      ingredientsByHalf.right.length === 0
    ) {
      return null;
    }

    if (
      ingredientsByHalf.left.length === ingredientsByHalf.right.length &&
      ingredientsByHalf.left.every(
        (ing, i) => ing === ingredientsByHalf.right[i]
      )
    ) {
      return `(${ingredientsByHalf.left.join(", ")})`;
    }

    return `(${ingredientsByHalf.left.join(
      ", "
    )} / ${ingredientsByHalf.right.join(", ")})`;
  };

  const getSyncStatusColor = (synced) => {
    return synced ? "text-green-500" : "text-orange-500";
  };

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden mb-4 border border-gray-200">
      <div className="p-4 lg:p-6">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center">
            <h5 className="text-lg lg:text-xl font-bold text-gray-800 mr-4">
              Pedido #{order.dailyOrderNumber}
            </h5>
            <span
              className={`px-2 py-1 rounded-full text-xs lg:text-sm font-semibold text-white mr-2 ${getOrderTypeColor(
                order.orderType
              )}`}
            >
              {translateOrderType(order.orderType)}
            </span>
            <span className="text-sm lg:text-base text-gray-600">
              {formatDateToMexicoTime(order.createdAt, true)}
            </span>
          </div>
          <div className="flex items-center">
            <span
              className={`px-3 py-1 rounded-full text-sm lg:text-base font-semibold text-white mr-2 ${getStatusColor(
                order.status
              )}`}
            >
              {translateStatus(order.status)}
            </span>
            {order.paymentStatus && (
              <span
                className={`px-3 py-1 rounded-full text-sm lg:text-base font-semibold text-white ${getPaymentStatusColor(
                  order.paymentStatus
                )}`}
              >
                {translatePaymentStatus(order.paymentStatus)}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm lg:text-base mb-2">
          <div>
            <p className="text-gray-600">Cliente:</p>
            <p className="font-medium">{order.customerId}</p>
          </div>
          <div>
            <p className="text-gray-600">Total:</p>
            <p className="font-bold text-green-600">
              ${order.totalCost.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Entrega a:</p>
            <p className="font-medium">
              {order.orderType === "delivery" && order.orderDeliveryInfo
                ? `${order.orderDeliveryInfo.streetAddress}${
                    order.orderDeliveryInfo.additionalDetails
                      ? `, ${order.orderDeliveryInfo.additionalDetails}`
                      : ""
                  }`
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
            <p className="text-gray-600">ID Servidor Local:</p>
            <p
              className={`font-medium ${getSyncStatusColor(
                order.syncedWithLocal
              )}`}
            >
              {order.syncedWithLocal
                ? `Pedido #${order.localId}`
                : "No sincronizado"}
            </p>
          </div>
          {finishedTime && (
            <div>
              <p className="text-gray-600">Finalizado:</p>
              <p className="font-medium">{finishedTime}</p>
            </div>
          )}
          {scheduledDeliveryTime && (
            <div>
              <p className="text-gray-600">Entrega programada:</p>
              <p className="font-medium">{scheduledDeliveryTime}</p>
            </div>
          )}
        </div>
        {isExpanded && (
          <>
            {order.orderItems && order.orderItems.length > 0 && (
              <div className="mt-3">
                <h6 className="text-sm lg:text-base font-semibold mb-2">
                  Elementos de la orden:
                </h6>
                <ul className="space-y-4">
                  {order.orderItems.map((item, index) => (
                    <li
                      key={index}
                      className="text-sm lg:text-base border-b pb-2"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">
                            {item.productVariant.name || item.product.name} (x
                            {item.quantity})
                            {item.selectedPizzaIngredients &&
                              item.selectedPizzaIngredients.length > 0 &&
                              ` ${renderPizzaIngredients(
                                item.selectedPizzaIngredients
                              )}`}
                          </p>
                          <p className="text-gray-600">
                            Precio base: $
                            {(
                              item.productVariant.price ||
                              item.product.price ||
                              0
                            ).toFixed(2)}
                          </p>
                        </div>
                        <p className="font-bold">
                          Total: ${item.price.toFixed(2)}
                        </p>
                      </div>
                      {item.selectedModifiers &&
                        item.selectedModifiers.length > 0 && (
                          <div className="mt-1 text-gray-600">
                            <p className="font-medium">Modificadores:</p>
                            <ul className="list-disc list-inside pl-2">
                              {item.selectedModifiers.map((mod, modIndex) => (
                                <li key={modIndex}>
                                  {mod.modifier.name} (+$
                                  {mod.modifier.price.toFixed(2)})
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      {item.comments && (
                        <p className="mt-1 text-gray-600">
                          <span className="font-medium">Comentarios:</span>{" "}
                          {item.comments}
                        </p>
                      )}
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
              disabled={
                order.status === "accepted" ||
                order.status === "finished" ||
                isLoading
              }
            >
              Aceptar
            </button>
            <button
              className="px-3 py-1 lg:px-4 lg:py-2 bg-red-500 text-white text-sm lg:text-base rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition duration-300"
              onClick={() => handleUpdateStatus("canceled")}
              disabled={
                order.status === "canceled" ||
                order.status === "finished" ||
                isLoading
              }
            >
              Rechazar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
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
    pending: "Pago pendiente",
    paid: "Pagado",
  };
  return translations[status] || status;
};

const getStatusColor = (status) => {
  const colors = {
    created: "bg-blue-500",
    accepted: "bg-green-500",
    in_preparation: "bg-yellow-500",
    prepared: "bg-purple-500",
    in_delivery: "bg-orange-500",
    finished: "bg-green-700",
    canceled: "bg-red-500",
  };
  return colors[status] || "bg-gray-500";
};

const getPaymentStatusColor = (status) => {
  const colors = {
    pending: "bg-yellow-500",
    paid: "bg-green-500",
  };
  return colors[status] || "bg-gray-500";
};

const formatDateToMexicoTime = (dateString, dateOnly = false) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Fecha inválida";

  // Convertir a la zona horaria de México
  const mexicoDate = new Date(
    date.toLocaleString("en-US", { timeZone: "America/Mexico_City" })
  );

  const day = mexicoDate.getDate().toString().padStart(2, "0");
  const month = (mexicoDate.getMonth() + 1).toString().padStart(2, "0");
  const year = mexicoDate.getFullYear();
  const hours = mexicoDate.getHours().toString().padStart(2, "0");
  const minutes = mexicoDate.getMinutes().toString().padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

export default OrderCard;
