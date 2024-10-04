import React, { useState } from "react";

const OrderCard = ({ order, onUpdateStatus }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleUpdateStatus = async (newStatus) => {
    setIsLoading(true);
    try {
      await onUpdateStatus(order.id, newStatus);
    } catch (error) {
      console.error("Error al actualizar el estado del pedido:", error);
      alert(
        "No se pudo actualizar el estado del pedido. Por favor, inténtelo de nuevo."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden mb-4 border border-gray-200">
      <div className="p-4">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center">
            <h5 className="text-lg font-bold text-gray-800 mr-4">
              Pedido #{order.dailyOrderNumber}
            </h5>
            <span className="text-sm text-gray-600">
              {formatDateToMexicoTime(order.orderDate, true)}
            </span>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(
              order.status
            )}`}
          >
            {translateStatus(order.status)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm mb-2">
          <div>
            <p className="text-gray-600">Fecha:</p>
            <p className="font-medium">
              {formatDateToMexicoTime(order.orderDate, true)}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Tipo:</p>
            <p className="font-medium">{translateOrderType(order.orderType)}</p>
          </div>
          <div>
            <p className="text-gray-600">Cliente:</p>
            <p className="font-medium">{order.clientId}</p>
          </div>
          <div>
            <p className="text-gray-600">Total:</p>
            <p className="font-bold text-green-600">
              ${order.totalCost.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="mb-2">
          <p className="text-sm text-gray-600">Info de Entrega:</p>
          <p className="text-sm font-medium">{order.deliveryInfo || "N/A"}</p>
        </div>

        {isExpanded && (
          <>
            {order.orderItems && order.orderItems.length > 0 && (
              <div className="mt-3">
                <h6 className="text-sm font-semibold mb-2">
                  Elementos del pedido:
                </h6>
                <ul className="space-y-2">
                  {order.orderItems.map((item, index) => (
                    <li key={index} className="text-sm">
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

        <div className="mt-3 flex justify-between items-center">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            {isExpanded ? "Ver menos" : "Ver más"}
          </button>
          <div className="space-x-2">
            <button
              className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition duration-300"
              onClick={() => handleUpdateStatus("accepted")}
              disabled={order.status === "accepted" || isLoading}
            >
              Aceptar
            </button>
            <button
              className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition duration-300"
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
