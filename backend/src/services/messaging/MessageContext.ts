import { IncomingMessage, UnifiedResponse } from './types';
import { Customer } from '../../common/types';
import logger from '../../common/utils/logger';

export class MessageContext {
  public message: IncomingMessage;
  public runId: string;
  public customer?: Customer;
  public chatHistory: any[] = [];
  public unifiedResponses: UnifiedResponse[] = [];
  public metadata: Map<string, any> = new Map();
  public shouldStop: boolean = false;
  public error?: Error;

  constructor(message: IncomingMessage, runId: string) {
    this.message = message;
    this.runId = runId;
    
    // Validate runId
    if (!runId) {
      logger.warn('[MessageContext] Created without runId. This may cause issues with message cancellation.');
    }
  }
  
  addUnifiedResponse(response: UnifiedResponse) {
    this.unifiedResponses.push(response);
  }

  setCustomer(customer: Customer) {
    this.customer = customer;
  }

  setChatHistory(history: any[]) {
    this.chatHistory = history;
  }

  stop() {
    this.shouldStop = true;
  }

  setError(error: Error) {
    this.error = error;
    this.stop();
  }

  get(key: string): any {
    return this.metadata.get(key);
  }

  set(key: string, value: any): void {
    this.metadata.set(key, value);
  }
}