
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

/**
 * Generates strategic financial insights using Google Gemini API.
 */
export const generateFinancialInsight = async (dataContext: string): Promise<string> => {
  // Use API_KEY directly from environment variable as required by guidelines
  if (!process.env.API_KEY || process.env.API_KEY === "undefined" || process.env.API_KEY === "" || process.env.API_KEY.length < 5) {
    console.error("Gemini API Error: Missing environment variable API_KEY.");
    return "The operational intelligence engine requires a valid API_KEY in the environment.";
  }

  try {
    // Initializing Gemini client with process.env.API_KEY directly as per guidelines
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Using gemini-3-pro-preview for strategic financial analysis as it involves complex reasoning.
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `
        Role: Strategic Financial Consultant. 
        Context: Quarterly Operational Analysis for a High-End Membership Facility.
        Data: ${dataContext}
        
        Instruction: Analyze these operational metrics and provide a high-level strategic observation. 
        Focus on:
        - Revenue stability based on active/frozen ratio.
        - Immediate risk factors (expirations).
        - One actionable growth strategy.
        
        Constraint: Use professional, authoritative, and concise language. Under 120 words.
      `,
    });

    // Accessing .text property directly instead of as a method to comply with @google/genai SDK.
    return response.text || "Operational analysis inconclusive. Refreshing data stream.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message?.includes("API Key") || error.message?.includes("key")) {
        return "Intelligence engine rejected the provided API Key. Check system configuration.";
    }
    return "The operational intelligence engine is temporarily unreachable.";
  }
};