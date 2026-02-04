
import { GoogleGenAI } from "@google/genai";

/**
 * Generates strategic financial insights using Google Gemini API.
 */
export const generateFinancialInsight = async (dataContext: string): Promise<string> => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined" || apiKey.length < 5) {
    console.warn("Gemini API skipped: Missing or invalid API_KEY environment variable.");
    return "Operational intelligence engine is not configured. Please ensure API_KEY is set in the environment.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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

    return response.text || "Operational analysis inconclusive. Refreshing data stream.";
  } catch (error: any) {
    console.error("Gemini API Execution Error:", error);
    if (error.message?.includes("API Key") || error.message?.includes("403")) {
        return "Intelligence engine access denied. Please verify your system API Key.";
    }
    return "Intelligence engine temporarily unavailable. Please verify connectivity.";
  }
};
