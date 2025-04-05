const axios = require('axios');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Load environment variables
dotenv.config();

// Environment variables (store securely in production)
const VAPI_API_KEY = process.env.VAPI_API_KEY;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const LEADS_TABLE_ID = process.env.AIRTABLE_LEADS_TABLE;
const CALL_RECORDS_TABLE_ID = process.env.AIRTABLE_CALL_RECORDS_TABLE;
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;
// const WEBHOOK_URL = process.env.WEBHOOK_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Validate required environment variables
const requiredEnvVars = [
  'VAPI_API_KEY', 'AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID',
  'AIRTABLE_LEADS_TABLE', 'AIRTABLE_CALL_RECORDS_TABLE',
  'VAPI_ASSISTANT_ID', 'WEBHOOK_URL'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Headers for API requests
const vapiHeaders = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${VAPI_API_KEY}`
};

const airtableHeaders = {
  'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json'
};

/**
 * Fetch leads with 'TBC' status from Airtable
 * @returns {Promise<Array>} Array of lead records
 */
async function getTbcLeads() {
  try {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${LEADS_TABLE_ID}`;
    const params = {
      filterByFormula: "AND({Status} = 'TBC', {Attempt} < 3)",
      maxRecords: 10,
      sort: [{ field: "Date Time", direction: "asc" }]
    };
    
    const response = await axios.get(url, { 
      headers: airtableHeaders, 
      params: params 
    });
    
    return response.data.records || [];
  } catch (error) {
    console.error(`Error fetching leads: ${error.message}`);
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data: ${JSON.stringify(error.response.data)}`);
    }
    return [];
  }
}

/**
 * Update lead status in Airtable
 * @param {string} leadId - ID of the lead to update
 * @param {string} status - New status value
 * @param {number} attemptCount - Updated attempt count (optional)
 * @param {string} summary - Call summary (optional)
 * @returns {Promise<boolean>} Success status
 */
async function updateLeadStatus(leadId, status, attemptCount = null, summary = null) {
  try {
    if (!leadId) {
      console.error('Missing required leadId parameter');
      return false;
    }
    
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${LEADS_TABLE_ID}/${leadId}`;
    
    // Prepare fields to update
    const fields = { Status: status };
    
    if (attemptCount !== null) {
      fields.Attempt = attemptCount;
    }
    
    if (summary !== null) {
      fields.Summary = summary;
    }
    
    const data = { fields };
    
    const response = await axios.patch(url, data, { headers: airtableHeaders });
    return response.status === 200;
  } catch (error) {
    console.error(`Error updating lead ${leadId}: ${error.message}`);
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

/**
 * Create a new call record in Airtable
 * @param {Object} callData - Data about the call
 * @returns {Promise<boolean>} Success status
 */
async function createCallRecord(callData) {
  try {
    if (!callData) {
      console.error('Missing required callData parameter');
      return false;
    }
    
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CALL_RECORDS_TABLE_ID}`;
    
    // Prepare fields for the call record
    const fields = {
      callproviderID: callData.callproviderID || "",
      phonenumberID: callData.phonenumberID || "",
      customernumber: callData.customernumber || "",
      type: callData.type || "outbound",
      started: callData.started || "",
      ended: callData.ended || "",
      milliseconds: callData.milliseconds || 0,
      cost: callData.cost || 0,
      ended_reason: callData.ended_reason || "",
      transcript: callData.transcript || ""
    };
    
    const data = { fields };
    
    const response = await axios.post(url, data, { headers: airtableHeaders });
    return response.status === 200 || response.status === 201;
  } catch (error) {
    console.error(`Error creating call record: ${error.message}`);
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

/**
 * Initiate a call using Vapi API
 * @param {Object} lead - Lead information
 * @returns {Promise<string|null>} Call ID or null if failed
 */
async function initiateCall(lead) {
  try {
    if (!lead || !lead.id || !lead.fields) {
      console.error('Invalid lead object');
      return null;
    }
    
    const url = "https://api.vapi.ai/call/";
    
    // Extract lead information
    const fields = lead.fields || {};
    const firstName = fields["First Name"] || "";
    const lastName = fields["Last Name"] || "";
    const mobile = fields.Mobile || "";
    const email = fields.Email || "";
    
    if (!mobile) {
      console.error(`Lead ${lead.id} has no mobile number`);
      await updateLeadStatus(lead.id, "Failed", (fields.Attempt || 0) + 1, "Missing mobile number");
      return null;
    }
    
    // Create variables to pass to the assistant
    const variables = {
      first_name: firstName,
      last_name: lastName,
      email: email
    };
    
    // Prepare the call data
    // const callData = {
    //   assistant_id: VAPI_ASSISTANT_ID,
    //   to: mobile,
    //   variables: variables,
    //   webhook_url: WEBHOOK_URL,
    //   metadata: {
    //     lead_id: lead.id
    //   }
    // };

    // const callData = {
    //   assistantId: VAPI_ASSISTANT_ID,     // Changed from assistant_id to assistant
    //   recipient: {
    //     phone_number: mobile            // Changed from 'to' to recipient.phone_number
    //   },
    //   variables: variables,
    //   webhook: WEBHOOK_URL,             // Changed from webhook_url to webhook
    //   metadata: {
    //     lead_id: lead.id
    //   }
    // };

    const callData = {
        "assistantId": VAPI_ASSISTANT_ID,
      "phoneNumberId": "d4adee6b-3a81-4835-9735-d6bcffb32222",
      "customer": {
          "number": mobile
      },
      // variables: variables,
      // webhook: WEBHOOK_URL,             // Changed from webhook_url to webhook
      metadata: {
        // variables: variables,
        // webhook: WEBHOOK_URL,
        lead_id: lead.id,
        first_name: firstName,
        last_name: lastName,
        email: email
      }
    }
    
    // Make the API call
    const response = await axios.post(url, callData, { headers: vapiHeaders });

    console.log(`Call initiated successfully for lead ${lead.id}`);
    console.log('Vapi Response:', JSON.stringify(response.data, null, 2));
    
    // if (response.status === 200) {
      console.log("YES");
      const callId = response.data.id;
      
      // Update lead status to In-Progress
      await updateLeadStatus(lead.id, "In-Progress", (fields.Attempt || 0) + 1);
      
      return callId;
    // }
    return null;
  } catch (error) {
    console.error(`Error initiating call: ${error.message}`);
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data: ${JSON.stringify(error.response.data)}`);
    }
    
    // Update lead status to reflect failure
    if (lead && lead.id) {
      const fields = lead.fields || {};
      await updateLeadStatus(lead.id, "Failed", (fields.Attempt || 0) + 1, `Call initiation failed: ${error.message}`);
    }
    
    return null;
  }
}

/**
 * Get lead information from Airtable
 * @param {string} leadId - ID of the lead
 * @returns {Promise<Object>} Lead information
 */
async function getLeadInfo(leadId) {
  try {
    if (!leadId) {
      console.error('Missing required leadId parameter');
      return {};
    }
    
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${LEADS_TABLE_ID}/${leadId}`;
    
    const response = await axios.get(url, { headers: airtableHeaders });
    
    if (response.status === 200) {
      return response.data;
    }
    return {};
  } catch (error) {
    console.error(`Error fetching lead info: ${error.message}`);
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data: ${JSON.stringify(error.response.data)}`);
    }
    return {};
  }
}

/**
 * Generate a summary of the call from the transcript using AI
 * @param {string} transcript - Call transcript
 * @returns {Promise<string>} Summary of the call
 */

async function generateCallSummary(transcript) {
  // Retrieve the generative model
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const googleAI = new GoogleGenerativeAI(geminiApiKey);
  // const model = genAI.getGenerativeModel({ model: "gemini-pro" });

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

  // Define the prompt with the system instruction and user input
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

  try {
    // Generate content based on the prompt
    const result = await geminiModel.generateContent({ contents: prompt });
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error(`Error generating call summary: ${error.message}`);
    return "Error generating summary. Please review the transcript manually.";
  }
}

// async function generateCallSummary(transcript) {
//   const OpenAI = require("openai");
  
//   const openai = new OpenAI({
//     apiKey: OPENAI_API_KEY,
//   });
//   // const openai = new OpenAIApi(configuration);
  
//   try {
//     const response = await openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         {role: "system", content: "You are an assistant that summarizes interior design consultation calls. Extract key information like budget, project scope, timeline, and qualification status."},
//         {role: "user", content: transcript}
//       ],
//     });
    
//     return response.data.choices[0].message.content;
//   } catch (error) {
//     console.error(`Error generating call summary: ${error.message}`);
//     return "Error generating summary. Please review transcript manually.";
//   }
// }

/**
 * Process webhook data from completed call
 * @param {Object} webhookData - Data received from webhook
 * @returns {Promise<void>}
 */
async function processCallWebhook(webhookData) {
  try {
    if (!webhookData) {
      console.error('Invalid webhook data received');
      return;
    }
    // console.log("🧾 Webhook Received:", JSON.stringify(webhookData, null, 2));
    // console.log(JSON.stringify(webhookData.message.call, null, 2));
    // Extract relevant information
    const callId = webhookData.message?.call?.id;
    const status = webhookData.message?.status || "In-progress";
    console.log("status: "+status);
    const leadId = webhookData.message?.call?.metadata?.lead_id;
    console.log("leadId: "+leadId);
    const messages = webhookData.message?.artifact?.messagesOpenAIFormatted || "";
    const filteredMessages = messages.filter(msg => msg.role !== "system");
    const transcript = filteredMessages.map(msg => `${msg.role}: ${msg.content}`).join("\n");
    console.log("transcript: "+transcript);

    if (!leadId) {
      console.error(`Missing lead_id in webhook metadata for call ${callId}`);
      return;
    }

    console.log("customernumber: "+webhookData.message?.call?.customer?.number);
    console.log("started: "+webhookData.message?.timestamp);
    console.log("ended: "+webhookData.message?.artifact?.messages[0]?.time);
    console.log("milliseconds: "+webhookData.message?.artifact?.messages[0]?.secondsFromStart);
    
    // Create call record
    const callRecordData = {
      callproviderID: callId,
      phonenumberID: webhookData.message.phoneNumber.id,
      customernumber: webhookData.message.call.customer.number,
      type: "outbound",
      started: String(webhookData.message.timestamp),
      ended: String(webhookData.message?.artifact?.messages[0]?.time),
      milliseconds: webhookData.message?.artifact?.messages[0]?.secondsFromStart,
      cost: 0.01,
      ended_reason: status,
      transcript: transcript
    };
    
    await createCallRecord(callRecordData);
    console.log("status after call:"+status);
    // Update lead status based on call outcome
    if (status === "ended") {
      // Extract summary from transcript or AI analysis
      // console.log("status after call:"+status);
      const summary = await generateCallSummary(transcript);
      await updateLeadStatus(leadId, "Called", null, summary);
    } else if (status === "no-answer") {
      // Get current attempt count
      const leadInfo = await getLeadInfo(leadId);
      const currentAttempt = leadInfo.fields?.Attempt || 1;
      
      if (currentAttempt >= 2) {
        // Mark as failed after 2 attempts
        await updateLeadStatus(leadId, "Failed", currentAttempt, "Unreachable after multiple attempts");
      } else {
        // Schedule retry 
        await updateLeadStatus(leadId, "TBC", currentAttempt);
      }
    } else {
      // Handle other call statuses
      await updateLeadStatus(leadId, "Failed", null, `Call failed: ${status}`);
    }
  } catch (error) {
    console.error(`Error processing webhook: ${error.message}`);
  }
}

/**
 * Main function to process TBC leads
 */
async function main() {
  try {
    console.log('Starting lead processing...');
    
    // Get leads with TBC status
    const leads = await getTbcLeads();
    console.log(`Found ${leads.length} leads to process`);
    
    for (const lead of leads) {
      // Initiate call for each lead
      const callId = await initiateCall(lead);
      
      if (callId) {
        console.log(`Initiated call for lead ${lead.id}, call ID: ${callId}`);
      } else {
        console.log(`Failed to initiate call for lead ${lead.id}`);
      }
      
      // Add a small delay between calls to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('Lead processing completed');
  } catch (error) {
    console.error(`Error in main function: ${error.message}`);
  }
}

// Express webhook handler
const express = require('express');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.post('/webhook', async (req, res) => {
  try {
    const webhookData = req.body;
    // console.log(`Received webhook: ${JSON.stringify(webhookData)}`);
    // console.log("Working webhook");
    
    // Immediately respond to webhook
    res.status(200).send('Webhook received');
    
    // Process the webhook data asynchronously
    processCallWebhook(webhookData).catch(error => {
      console.error(`Error processing webhook: ${error.message}`);
    });
  } catch (error) {
    console.error(`Webhook error: ${error.message}`);
    res.status(500).send('Error processing webhook');
  }
});

// Healthcheck endpoint
app.get('/health', (req, res) => {
  res.status(200).send('Service is running');
});

// Start server only if not being imported
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  
  if (process.argv.includes('--server')) {
    // Start the Express server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } else {
    // Run the main function
    main().catch(console.error);
  }
}

module.exports = {
  getTbcLeads,
  updateLeadStatus,
  createCallRecord,
  initiateCall,
  processCallWebhook,
  getLeadInfo,
  generateCallSummary
};