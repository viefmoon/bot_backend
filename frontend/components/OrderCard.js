import React, { useState } from "react";

const OrderCard = ({ order, onUpdateStatus }) => {
  const [isLoading, setIsLoading] = useState(false);

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
    <div className="bg-white shadow-lg rounded-lg overflow-hidden mb-6 border border-gray-200">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h5 className="text-2xl font-bold text-gray-800">
            Pedido #{order.dailyOrderNumber}
          </h5>
          <span
            className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(
              order.status
            )}`}
          >
            {translateStatus(order.status)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-600">Fecha de Pedido:</p>
            <p className="font-medium">
              {formatDateToMexicoTime(order.orderDate, true)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Tipo:</p>
            <p className="font-medium">{translateOrderType(order.orderType)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">ID del Cliente:</p>
            <p className="font-medium">{order.clientId}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Tiempo Estimado:</p>
            <p className="font-medium">{order.estimatedTime} minutos</p>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600">Info de Entrega:</p>
          <p className="font-medium">{order.deliveryInfo || "N/A"}</p>
        </div>

        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-sm text-gray-600">Total:</p>
            <p className="text-xl font-bold text-green-600">
              ${order.totalCost.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Estado de Pago:</p>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(
                order.paymentStatus
              )}`}
            >
              {translatePaymentStatus(order.paymentStatus)}
            </span>
          </div>
        </div>

        {order.orderItems && order.orderItems.length > 0 && (
          <div className="mt-6">
            <h6 className="text-lg font-semibold mb-3">
              Elementos del pedido:
            </h6>
            <ul className="space-y-4">
              {order.orderItems.map((item, index) => (
                <li key={index} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">
                        {item.Product.name} - {item.ProductVariant.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        Cantidad: {item.quantity}
                      </p>
                    </div>
                    <p className="font-medium">${item.price.toFixed(2)}</p>
                  </div>
                  {item.selectedPizzaIngredients &&
                    item.selectedPizzaIngredients.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium">
                          Ingredientes de pizza:
                        </p>
                        {renderPizzaIngredients(item.selectedPizzaIngredients)}
                      </div>
                    )}
                  {item.selectedModifiers &&
                    item.selectedModifiers.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium">Modificadores:</p>
                        <p className="text-sm">
                          {renderModifiers(item.selectedModifiers)}
                        </p>
                      </div>
                    )}
                  {item.comments && (
                    <div className="mt-2">
                      <p className="text-sm font-medium">Comentarios:</p>
                      <p className="text-sm italic">{item.comments}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex space-x-4">
          <button
            className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition duration-300"
            onClick={() => handleUpdateStatus("accepted")}
            disabled={order.status === "accepted" || isLoading}
          >
            Aceptar
          </button>
          <button
            className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition duration-300"
            onClick={() => handleUpdateStatus("canceled")}
            disabled={order.status === "canceled" || isLoading}
          >
            Rechazar
          </button>
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
