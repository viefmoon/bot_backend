import { IncomingMessage, MessageResponse, UnifiedResponse } from './types';
import { Customer } from '../../common/types';

export class MessageContext {
  public message: IncomingMessage;
  public customer?: Customer;
  public chatHistory: any[] = [];
  public responses: MessageResponse[] = []; // Mantener para compatibilidad
  public unifiedResponses: UnifiedResponse[] = []; // Nuevo array para respuestas unificadas
  public metadata: Map<string, any> = new Map();
  public shouldStop: boolean = false;
  public error?: Error;

  constructor(message: IncomingMessage) {
    this.message = message;
  }

  // Método antiguo - mantener para compatibilidad
  addResponse(response: MessageResponse) {
    this.responses.push(response);
  }
  
  // Nuevo método para respuestas unificadas
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