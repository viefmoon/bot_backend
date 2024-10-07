export const translateOrderType = (type) => {
  const translations = {
    delivery: "A domicilio",
    pickup: "Recolección",
  };
  return translations[type] || type;
};

export const translateStatus = (status) => {
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

export const getStatusColor = (status) => {
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
