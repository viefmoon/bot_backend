import { IncomingMessage, UnifiedResponse } from './types';
import { Customer } from '../../common/types';

export class MessageContext {
  public message: IncomingMessage;
  public customer?: Customer;
  public chatHistory: any[] = [];
  public unifiedResponses: UnifiedResponse[] = [];
  public metadata: Map<string, any> = new Map();
  public shouldStop: boolean = false;
  public error?: Error;

  constructor(message: IncomingMessage) {
    this.message = message;
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