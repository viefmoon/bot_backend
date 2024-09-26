import dotenv from "dotenv";
dotenv.config();
import { preprocessMessages } from "../../utils/messagePreprocess";
import { selectProducts, modifyOrder } from "./orderOperations";
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
          result = await selectProducts(toolUse, clientId);
          return [
            {
              text: result.text,
              sendToWhatsApp: result.sendToWhatsApp,
              isRelevant: true,
            },
          ];
        }
      }
    }

    // switch (toolCall.function.name) {
    //   case "modify_order":
    //     result = await modifyOrder(toolCall, clientId);
    //     shouldDeleteConversation = true;
    //     return { text: result.output };
    //   case "send_menu":
    //     return [
    //       { text: menu, isRelevant: false },
    //       {
    //         text: "El menú ha sido enviado, si tienes alguna duda, no dudes en preguntar",
    //         isRelevant: true,
    //       },
    //     ];
    //   case "select_products":
    //     result = await selectProducts(toolCall, clientId);
    //     return [
    //       {
    //         text: result.text,
    //         sendToWhatsApp: result.sendToWhatsApp,
    //         isRelevant: true,
    //       },
    //     ];
    //   default:
    //     return { error: "Función desconocida" };
    // }
    //   }
    // } else {
    //   // Si no hay llamadas a funciones, manejar la respuesta normal
    //   const assistantMessage = response.choices[0].message.content;
    //   return { text: assistantMessage };
    // }
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
