import { ToolHandler } from '../types';
import { MenuSearchService } from '../../MenuSearchService';
import { ResponseBuilder, UnifiedResponse } from '../../../messaging/types/responses';
import logger from '../../../../common/utils/logger';

/**
 * Handles the get_menu_information function call.
 * This tool uses semantic search to find relevant menu items and returns them
 * as context for the AI to formulate a final answer.
 */
export const handleGetMenuInformation: ToolHandler = async (args): Promise<UnifiedResponse> => {
  const query = args.query;
  logger.debug(`Executing get_menu_information tool with query: "${query}"`);

  // 1. Use the existing powerful MenuSearchService to find relevant products
  const relevantMenuJSON = await MenuSearchService.getRelevantMenu(query);
  
  // 2. Return the found information as an "internal marker".
  // This response is NOT sent to the user. It's fed back into the AI's context
  // for its next turn, allowing it to generate an informed response.
  const toolResultText = `Aquí está la información encontrada para la consulta '${query}': ${relevantMenuJSON}`;
  
  return ResponseBuilder.internalMarker(toolResultText);
};