const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
dotenv.config();

const geminiApiKey = process.env.GEMINI_API_KEY;
const googleAI = new GoogleGenerativeAI(geminiApiKey);

const geminiConfig = {
  temperature: 0.9,
  topP: 1,
  topK: 1,
  maxOutputTokens: 4096,
};

const geminiModel = googleAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  generationConfig: geminiConfig,
});

async function generateCallSummary(transcript) {
  try {
    const prompt = [
      {
        role: "user",
        parts: [{ text: "You are an assistant that summarizes interior design consultation calls. Extract key information like budget, project scope, timeline, and qualification status." }],
      },
      {
        role: "user",
        parts: [{ text: transcript }],
      },
    ];

    const result = await geminiModel.generateContent({ contents: prompt });
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error(`Error generating call summary: ${error.message}`);
    return "Error generating summary. Please review the transcript manually.";
  }
}

const transcript = `Assistant: Hello. This is Maya from Interior Design. I'm calling regarding your interest in our luxury interior design services that you expressed through our website.`;

async function main() {
  try {
    const summary = await generateCallSummary(transcript);
    console.log("Call Summary:", summary);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
