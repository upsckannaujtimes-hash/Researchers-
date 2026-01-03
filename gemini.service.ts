import { Injectable, signal } from '@angular/core';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';

export interface ResearchResult {
  text: string;
  sources: { title: string; url: string }[];
}

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private readonly MODEL_ID = 'gemini-2.5-flash';
  private ai: GoogleGenAI;

  constructor() {
    // Initialize Gemini Client
    const apiKey = process.env['API_KEY'] || '';
    this.ai = new GoogleGenAI({ apiKey });
  }

  async performResearch(
    query: string, 
    files: { mimeType: string; data: string }[] = [],
    useThinking: boolean = false
  ): Promise<ResearchResult> {
    
    // Construct parts
    const parts: any[] = [];
    
    // Add files if any
    files.forEach(file => {
      parts.push({
        inlineData: {
          mimeType: file.mimeType,
          data: file.data
        }
      });
    });

    // Add text query
    parts.push({ text: query });

    // Configure tools and model
    const config: any = {
      tools: [{ googleSearch: {} }], // Enable Search Grounding
      systemInstruction: `You are an expert research assistant. 
      Your goal is to provide accurate, comprehensive, and well-structured information.
      If the user provides a link or asks for current information, use your search tools to verify facts.
      Format your response with clear Markdown headings, bullet points, and concise paragraphs.
      If you use search results, ensure the information is up-to-date.`
    };

    if (useThinking) {
      // Add thinking budget for deeper reasoning
      config.thinkingConfig = { thinkingBudget: 1024 };
      // When thinking is enabled, we need to ensure maxOutputTokens is set high enough 
      // or managed correctly. The default is usually sufficient for flash but let's be safe.
      config.maxOutputTokens = 4096; 
    }

    try {
      const response: GenerateContentResponse = await this.ai.models.generateContent({
        model: this.MODEL_ID,
        contents: { parts },
        config: config
      });

      // Extract Text
      const text = response.text || "No result generated.";

      // Extract Grounding Metadata (Sources)
      const sources: { title: string; url: string }[] = [];
      
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      
      if (chunks) {
        chunks.forEach((chunk: any) => {
          if (chunk.web) {
            sources.push({
              title: chunk.web.title || 'Web Source',
              url: chunk.web.uri
            });
          }
        });
      }

      return { text, sources };

    } catch (error) {
      console.error('Gemini Research Error:', error);
      throw error;
    }
  }
}