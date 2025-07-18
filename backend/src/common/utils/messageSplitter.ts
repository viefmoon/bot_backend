/**
 * Utilidad unificada para dividir mensajes largos de WhatsApp
 * Consolida la lógica duplicada de división de mensajes
 */

interface SplitOptions {
  maxLength?: number;
  preserveFormatting?: boolean;
}

const DEFAULT_MAX_LENGTH = 4000; // Límite de WhatsApp con margen de seguridad

export class MessageSplitter {
  /**
   * Dividir un mensaje largo en partes respetando el límite de caracteres
   */
  static split(text: string, options: SplitOptions = {}): string[] {
    const {
      maxLength = DEFAULT_MAX_LENGTH,
      preserveFormatting = true
    } = options;
    
    // Si el mensaje cabe en una parte, devolverlo tal cual
    if (text.length <= maxLength) {
      return [text];
    }
    
    // División simple por longitud
    const parts = this.simpleSplit(text, maxLength);
    
    // Agregar indicadores de continuación si se preserva el formato
    if (preserveFormatting && parts.length > 1) {
      return this.addContinuationIndicators(parts);
    }
    
    return parts;
  }
  
  
  /**
   * División simple por longitud respetando saltos de línea
   */
  private static simpleSplit(text: string, maxLength: number): string[] {
    const parts: string[] = [];
    let currentPart = '';
    
    // Dividir por líneas para mantener la estructura
    const lines = text.split('\n');
    
    for (const line of lines) {
      // Si agregar esta línea excede el límite
      if (currentPart.length + line.length + 1 > maxLength) {
        // Si la parte actual tiene contenido, guardarla
        if (currentPart.trim()) {
          parts.push(currentPart.trim());
          currentPart = '';
        }
        
        // Si la línea sola excede el límite, dividirla por palabras
        if (line.length > maxLength) {
          const words = line.split(/\s+/);
          let tempLine = '';
          
          for (const word of words) {
            if (tempLine.length + word.length + 1 > maxLength) {
              if (tempLine) {
                parts.push(tempLine.trim());
                tempLine = word;
              } else {
                // Palabra muy larga, añadirla tal cual
                parts.push(word);
              }
            } else {
              tempLine += (tempLine ? ' ' : '') + word;
            }
          }
          
          if (tempLine) {
            currentPart = tempLine;
          }
        } else {
          currentPart = line;
        }
      } else {
        // Agregar la línea a la parte actual
        currentPart += (currentPart ? '\n' : '') + line;
      }
    }
    
    // Agregar cualquier contenido restante
    if (currentPart.trim()) {
      parts.push(currentPart.trim());
    }
    
    return parts;
  }
  
  
  /**
   * Agregar indicadores de continuación a las partes
   */
  private static addContinuationIndicators(parts: string[]): string[] {
    return parts.map((part, index) => {
      if (index === 0) {
        return part + '\n\n_(Continúa...)_';
      } else if (index === parts.length - 1) {
        return `_(Continuación ${index + 1}/${parts.length})_\n\n` + part;
      } else {
        return `_(Continuación ${index + 1}/${parts.length})_\n\n` + 
               part + '\n\n_(Continúa...)_';
      }
    });
  }
  
  /**
   * Dividir un menú sin indicadores de continuación
   */
  static splitMenu(menuText: string, maxLength: number = DEFAULT_MAX_LENGTH): string[] {
    return this.split(menuText, {
      maxLength,
      preserveFormatting: false // No agregar indicadores de continuación
    });
  }
  
  /**
   * Dividir un mensaje de chat normal con indicadores
   */
  static splitMessage(message: string, maxLength: number = DEFAULT_MAX_LENGTH): string[] {
    return this.split(message, {
      maxLength,
      preserveFormatting: true
    });
  }
}