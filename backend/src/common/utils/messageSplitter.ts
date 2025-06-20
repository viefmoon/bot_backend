/**
 * Utilidad unificada para dividir mensajes largos de WhatsApp
 * Consolida la lógica duplicada de división de mensajes
 */

interface SplitOptions {
  maxLength?: number;
  preserveFormatting?: boolean;
  intelligentSplit?: boolean;
}

const DEFAULT_MAX_LENGTH = 4000; // Límite de WhatsApp con margen de seguridad

export class MessageSplitter {
  /**
   * Dividir un mensaje largo en partes respetando el límite de caracteres
   */
  static split(text: string, options: SplitOptions = {}): string[] {
    const {
      maxLength = DEFAULT_MAX_LENGTH,
      preserveFormatting = true,
      intelligentSplit = true
    } = options;
    
    // Si el mensaje cabe en una parte, devolverlo tal cual
    if (text.length <= maxLength) {
      return [text];
    }
    
    // Usar división inteligente si está habilitada
    if (intelligentSplit) {
      return this.intelligentSplit(text, maxLength, preserveFormatting);
    }
    
    // División simple por longitud
    return this.simpleSplit(text, maxLength);
  }
  
  /**
   * División inteligente que respeta estructura del contenido
   */
  private static intelligentSplit(
    text: string, 
    maxLength: number, 
    preserveFormatting: boolean
  ): string[] {
    const parts: string[] = [];
    const lines = text.split('\n');
    let currentPart = '';
    let currentSection = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Detectar encabezados de sección
      const isSectionHeader = this.isSectionHeader(line);
      
      // Si encontramos un nuevo encabezado y la parte actual + sección excede el límite
      if (isSectionHeader && currentSection && 
          (currentPart.length + currentSection.length > maxLength)) {
        // Guardar la parte actual si tiene contenido
        if (currentPart.trim()) {
          parts.push(currentPart.trim());
        }
        currentPart = currentSection;
        currentSection = line + '\n';
      } else if (currentPart.length + line.length + 1 > maxLength) {
        // Si agregar la línea actual excedería el límite
        
        if (!currentPart.trim() && line.length > maxLength) {
          // Si la línea es muy larga, dividirla por palabras
          const splitLine = this.splitLongLine(line, maxLength);
          parts.push(...splitLine.slice(0, -1));
          currentPart = splitLine[splitLine.length - 1] + '\n';
        } else {
          // Guardar la parte actual y empezar una nueva
          parts.push(currentPart.trim());
          currentPart = currentSection + line + '\n';
          currentSection = '';
        }
      } else {
        // Agregar línea a la sección actual
        currentSection += line + '\n';
      }
    }
    
    // Agregar cualquier contenido restante
    if (currentSection) {
      currentPart += currentSection;
    }
    if (currentPart.trim()) {
      parts.push(currentPart.trim());
    }
    
    // Agregar indicadores de continuación si se preserva el formato
    if (preserveFormatting && parts.length > 1) {
      return this.addContinuationIndicators(parts);
    }
    
    return parts;
  }
  
  /**
   * División simple por longitud máxima
   */
  private static simpleSplit(text: string, maxLength: number): string[] {
    const parts: string[] = [];
    let currentPart = '';
    
    const words = text.split(/\s+/);
    
    for (const word of words) {
      if (currentPart.length + word.length + 1 > maxLength) {
        if (currentPart) {
          parts.push(currentPart.trim());
          currentPart = word;
        } else {
          // La palabra es más larga que el límite, cortarla
          const chunks = this.chunkString(word, maxLength);
          parts.push(...chunks.slice(0, -1));
          currentPart = chunks[chunks.length - 1];
        }
      } else {
        currentPart += (currentPart ? ' ' : '') + word;
      }
    }
    
    if (currentPart) {
      parts.push(currentPart.trim());
    }
    
    return parts;
  }
  
  /**
   * Dividir una línea larga por palabras
   */
  private static splitLongLine(line: string, maxLength: number): string[] {
    const parts: string[] = [];
    const words = line.split(' ');
    let tempLine = '';
    
    for (const word of words) {
      if (tempLine.length + word.length + 1 <= maxLength) {
        tempLine += (tempLine ? ' ' : '') + word;
      } else {
        if (tempLine) parts.push(tempLine);
        
        // Si una sola palabra excede el límite, cortarla
        if (word.length > maxLength) {
          const chunks = this.chunkString(word, maxLength);
          parts.push(...chunks.slice(0, -1));
          tempLine = chunks[chunks.length - 1];
        } else {
          tempLine = word;
        }
      }
    }
    
    if (tempLine) {
      parts.push(tempLine);
    }
    
    return parts;
  }
  
  /**
   * Verificar si una línea es un encabezado de sección
   */
  private static isSectionHeader(line: string): boolean {
    // Patrones comunes de encabezados
    const patterns = [
      /^[🍕🍔🥤🍗🥗🍝🍰🌮🥟🍛📋🛒💰📍👤📅⏰]/,  // Emojis al inicio
      /^[A-Z\s]{3,}:/,                                  // MAYÚSCULAS:
      /^\*\*.*\*\*$/,                                   // **Negrita**
      /^#+\s/,                                          // # Markdown headers
      /^[-=]{3,}$/,                                     // Líneas divisorias
    ];
    
    return patterns.some(pattern => pattern.test(line));
  }
  
  /**
   * Dividir una cadena en chunks de tamaño fijo
   */
  private static chunkString(str: string, size: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < str.length; i += size) {
      chunks.push(str.slice(i, i + size));
    }
    return chunks;
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
   * Dividir un menú preservando categorías completas
   */
  static splitMenu(menuText: string, maxLength: number = DEFAULT_MAX_LENGTH): string[] {
    return this.split(menuText, {
      maxLength,
      preserveFormatting: false, // No agregar indicadores de continuación
      intelligentSplit: true
    });
  }
  
  /**
   * Dividir un mensaje de chat normal
   */
  static splitMessage(message: string, maxLength: number = DEFAULT_MAX_LENGTH): string[] {
    return this.split(message, {
      maxLength,
      preserveFormatting: true,
      intelligentSplit: true
    });
  }
}