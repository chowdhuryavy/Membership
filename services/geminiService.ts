
import { GoogleGenAI } from "@google/genai";

/**
 * Generates financial insights using Google Gemini API.
 * Follows the latest @google/genai SDK standards.
 */
export const generateFinancialInsight = async (dataContext: string): Promise<string> => {
  try {
    // Initializing the GenAI client with the environment API key as per guidelines.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Using gemini-3-pro-preview for complex financial reasoning tasks.
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `
        Role: Senior Financial Analyst. 
        Task: Analyze the following monthly revenue dataset for a membership business.
        Data: ${dataContext}
        
        Please provide:
        1. A brief summary of the revenue trend.
        2. Identify any anomalies (e.g., dips or spikes).
        3. Strategic advice on how to improve deferred revenue stability.
        
        Keep it concise (under 150 words) and professional.
      `,
    });

    // Accessing the .text property directly as per modern response object definition.
    return response.text || "No insight generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Failed to generate insight. Please try again later.";
  }
};
