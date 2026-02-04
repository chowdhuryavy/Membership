
import { GoogleGenAI } from "@google/genai";

/**
 * Generates strategic financial insights using Google Gemini API.
 */
export const generateFinancialInsight = async (dataContext: string): Promise<string> => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    console.error("Gemini API Error: Missing environment variable API_KEY.");
    return "Intelligence engine configuration incomplete. API_KEY required.";
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
    console.error("Gemini API Error:", error);
    if (error.message?.includes("API Key")) {
        return "Intelligence engine rejected access key. Check system environment.";
    }
    return "Intelligence engine temporarily offline. Please verify connectivity.";
  }
};
