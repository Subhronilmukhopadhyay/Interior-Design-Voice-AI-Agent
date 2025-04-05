// listModels.js
const OpenAI = require("openai");
const dotenv = require('dotenv');

dotenv.config();

// Replace this with your actual key or use dotenv
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY_HERE',
});

async function listModels() {
  try {
    const models = await openai.models.list();
    console.log("✅ Models available to your API key:\n");
    models.data.forEach((model) => {
      console.log(model.id);
    });
  } catch (error) {
    console.error("❌ Error listing models:", error.message);
  }
}

listModels();
