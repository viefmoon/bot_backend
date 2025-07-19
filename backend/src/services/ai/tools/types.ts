import { MessageContext } from '../../messaging/MessageContext';
import { UnifiedResponse } from '../../messaging/types/responses';

/**
 * Base type for all tool handler functions
 */
export type ToolHandler = (args: any, context?: MessageContext) => Promise<UnifiedResponse | UnifiedResponse[] | null>;