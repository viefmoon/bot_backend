import dotenv from "dotenv";
dotenv.config();
import { preprocessMessages } from "../../utils/messagePreprocess";
// const { selectProductsTool } = require("../../aiTools/aiTools");
// const OpenAI = require("openai");
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });
const { selectProductsToolClaude } = require("../../aiTools/aiTools");
const Anthropic = require("@anthropic-ai/sdk");
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function handleChatRequest(req) {
  const { relevantMessages, conversationId } = req;
  try {
    // Preprocesar los mensajes
    const preprocessedContent = await preprocessMessages(relevantMessages);

    // Si preprocessMessages retorna una respuesta directa
    if (preprocessedContent.isDirectResponse) {
      return [
        {
          text: preprocessedContent.text,
          sendToWhatsApp: true,
          isRelevant: preprocessedContent.isRelevant,
          confirmationMessage: preprocessedContent.confirmationMessage,
        },
      ];
    }

    const systemContent = [
      "Basándote en el objeto proporcionado, utiliza la función `select_products`",
      "- Utiliza los `relevantMenuItems` proporcionados para mapear las descripciones de los productos a sus respectivos IDs.",
      "- No es necesario usar todos los relevantMenuItems si no aplican",
      "- Es OBLIGATORIO usar la función `select_products` para completar esta tarea.",
    ].join("\n");

    console.log(
      "preprocessedContent",
      JSON.stringify(
        preprocessedContent,
        (key, value) => {
          if (key === "relevantMenuItems") {
            return JSON.parse(JSON.stringify(value));
          }
          return value;
        },
        2
      )
    );

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      system: systemContent,
      messages: [
        { role: "user", content: JSON.stringify(preprocessedContent) },
      ],
      max_tokens: 4096,
      tools: [selectProductsToolClaude],
      tool_choice: { type: "tool", name: "select_products" },
    });

    let shouldDeleteConversation = false;

    // Manejar la respuesta directamente
    if (response.content) {
      const toolUses = response.content;
      for (const toolUse of toolUses) {
        console.log("toolUse", toolUse);
        const clientId = conversationId;
        let result;

        if (toolUse.type === "tool_use" && toolUse.name === "select_products") {
          try {
            const {
              orderItems,
              orderType,
              deliveryInfo,
              scheduledDeliveryTime,
            } = toolUse.input;

            const selectProductsResponse = await axios.post(
              `${process.env.BASE_URL}/api/orders/select_products`,
              {
                orderItems,
                clientId,
                orderType,
                deliveryInfo,
                scheduledDeliveryTime,
              }
            );

            return [
              {
                text: selectProductsResponse.data.mensaje,
                sendToWhatsApp: false,
                isRelevant: true,
              },
            ];
          } catch (error) {
            console.error("Error al seleccionar los productos:", error);

            if (error.response) {
              const errorMessage =
                error.response.data?.error || "Error desconocido";
              return [
                { text: errorMessage, sendToWhatsApp: true, isRelevant: true },
              ];
            } else {
              return [
                {
                  text: "Error al seleccionar los productos. Por favor, inténtalo de nuevo.",
                  sendToWhatsApp: true,
                  isRelevant: true,
                },
              ];
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error general:", error);
    return [
      {
        text: "Error al procesar la solicitud: " + error.message,
        sendToWhatsApp: true,
        isRelevant: true,
      },
    ];
  }
}
