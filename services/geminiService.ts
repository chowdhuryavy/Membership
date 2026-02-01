import { GoogleGenAI } from "@google/genai";

export const generateFinancialInsight = async (dataContext: string): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key is missing. Please configure the environment to use AI Insights.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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

    return response.text || "No insight generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Failed to generate insight. Please try again later.";
  }
};
