const axios = require('axios');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const express = require('express');
const bodyParser = require('body-parser');

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
  'VAPI_ASSISTANT_ID', 'WEBHOOK_URL', 'GEMINI_API_KEY'
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
      transcript: callData.transcript || "",
      Lead: callData.Lead || ""
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
 * Update an existing call record in Airtable
 * @param {string} callId - ID of the call provider to update
 * @param {Object} callData - Updated call data
 * @returns {Promise<boolean>} Success status
 */
async function updateCallRecord(callId, callData) {
  try {
    if (!callId) {
      console.error('Missing required callId parameter');
      return false;
    }
    
    // First, find the record ID by querying for the callproviderID
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CALL_RECORDS_TABLE_ID}`;
    const params = {
      filterByFormula: `{callproviderID} = '${callId}'`
    };
    
    const response = await axios.get(url, { 
      headers: airtableHeaders, 
      params: params 
    });
    
    const records = response.data.records || [];
    if (records.length === 0) {
      console.error(`No record found with callproviderID: ${callId}`);
      return false;
    }
    
    // Get the record ID from Airtable
    const recordId = records[0].id;
    
    // Update the record with new data
    const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CALL_RECORDS_TABLE_ID}/${recordId}`;
    const data = { fields: callData };
    
    const updateResponse = await axios.patch(updateUrl, data, { headers: airtableHeaders });
    return updateResponse.status === 200;
  } catch (error) {
    console.error(`Error updating call record: ${error.message}`);
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
    
    // Create metadata to pass to the assistant
    const callData = {
        "assistantId": VAPI_ASSISTANT_ID,
      "phoneNumberId": "d4adee6b-3a81-4835-9735-d6bcffb32222",
      "customer": {
          "number": mobile
      },
      metadata: {
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
    
    console.log("YES");
    const callId = response.data.id;

    const initialCallData = {
      callproviderID: callId,
      phonenumberID: "d4adee6b-3a81-4835-9735-d6bcffb32222",
      customernumber: mobile,
      type: "outbound",
      started: new Date().toISOString(),
      ended: "",
      milliseconds: 0,
      cost: 0,
      ended_reason: "initiated",
      transcript: "",
      Lead: lead.id
    };

    await createCallRecord(initialCallData);
    
    // Update lead status to In-Progress
    await updateLeadStatus(lead.id, "In-Progress", (fields.Attempt || 0) + 1);
    
    return callId;
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
  const geminiApiKey = GEMINI_API_KEY;
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

/**
 * Parse the call summary and extract structured data
 * @param {string} summary - Generated summary from AI
 * @returns {Object} Extracted fields
 */
async function parseCallSummary(summary) {
  try {
    if (!summary) {
      console.error('Empty summary provided');
      return {};
    }

    // Initialize results object with fields we want to extract
    const extractedData = {
      assignee: "Maya Agent",
      Qualification: null,
      Budget: null,
      Location: null,
      "Project Type": null,
      "Property Size": null,
      Timeline: null,
      "Consultation Date": null
    };

    // Use regex patterns to extract information
    // Budget extraction (looking for dollar amounts)
    const budgetRegex = /(?:budget|cost|willing to spend|looking to spend|price range)[:\s]*(?:is|of|around|about|approximately)?[:\s]*\$?([\d,]+(?:\.\d+)?(?:\s*[kK])?(?:\s*-\s*\$?[\d,]+(?:\.\d+)?(?:\s*[kK])?)?)/i;
    const budgetMatch = summary.match(budgetRegex);
    if (budgetMatch) {
      extractedData.Budget = budgetMatch[1].trim();
    }

    // Location extraction
    const locationRegex = /(?:location|area|neighborhood|city|based in|living in|property in)[:\s]*([\w\s,]+?)(?:\.|,|\n|and)/i;
    const locationMatch = summary.match(locationRegex);
    if (locationMatch) {
      extractedData.Location = locationMatch[1].trim();
    }

    // Project Type extraction
    const projectTypeRegex = /(?:project|renovation|redesign|design) type[:\s]*([\w\s,]+?)(?:\.|,|\n|and)/i;
    const projectTypeMatch = summary.match(projectTypeRegex);
    if (projectTypeMatch) {
      extractedData["Project Type"] = projectTypeMatch[1].trim();
    }

    // Property Size extraction
    const propertySizeRegex = /(?:property size|square footage|space|home size)[:\s]*([\d,]+\s*(?:sq\s*ft|square\s*feet|sqft|sf)?)/i;
    const propertySizeMatch = summary.match(propertySizeRegex);
    if (propertySizeMatch) {
      extractedData["Property Size"] = propertySizeMatch[1].trim();
    }

    // Timeline extraction
    const timelineRegex = /(?:timeline|timeframe|deadline|complete by|finish by|start|looking to start)[:\s]*([\w\s,]+?)(?:\.|,|\n|and)/i;
    const timelineMatch = summary.match(timelineRegex);
    if (timelineMatch) {
      extractedData.Timeline = timelineMatch[1].trim();
    }

    // Consultation Date extraction
    const consultationRegex = /(?:consultation|meeting|appointment|call)[:\s]*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)[\w\s,]+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?)/i;
    const consultationMatch = summary.match(consultationRegex);
    if (consultationMatch) {
      extractedData["Consultation Date"] = consultationMatch[1].trim();
    }

    // Qualification extraction (looking for phrases indicating qualification)
    if (summary.match(/(?:qualified|good fit|potential client|strong candidate|high potential|ready to move forward|serious about|committed to|promising lead)/i)) {
      extractedData.Qualification = "Qualified";
    } else if (summary.match(/(?:not qualified|not a fit|not ready|not interested|just browsing|not serious|not committed|time waster|not a good fit)/i)) {
      extractedData.Qualification = "Not Qualified";
    } else if (summary.match(/(?:maybe|potential|possibly|follow up|needs more information|considering|thinking about|on the fence|undecided)/i)) {
      extractedData.Qualification = "Follow Up";
    }

    // Use AI to further extract and validate information
    // This approach uses the same model to extract structured data from the summary
    const extractedInfo = await extractInfoWithAI(summary);
    
    // Merge AI extracted data with regex matches, prioritizing AI results
    return { ...extractedData, ...extractedInfo };
  } catch (error) {
    console.error(`Error parsing summary: ${error.message}`);
    return {};
  }
}

/**
 * Use AI to extract structured information from summary
 * @param {string} summary - Generated summary from AI
 * @returns {Promise<Object>} - Extracted information
 */
async function extractInfoWithAI(summary) {
  try {
    // Initialize the Gemini model
    const geminiApiKey = GEMINI_API_KEY;
    const googleAI = new GoogleGenerativeAI(geminiApiKey);

    const geminiConfig = {
      temperature: 0.2, // Lower temperature for more predictable/factual responses
      topP: 0.8,
      maxOutputTokens: 2048,
    };

    const geminiModel = googleAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: geminiConfig,
    });

    // Define the prompt with the system instruction and summary
    const prompt = [
      {
        role: "user",
        parts: [{ text: `Extract the following fields from this interior design consultation summary into JSON format:
        - assignee: The person who should handle this client (if mentioned)
        - Qualification: Client qualification status (Qualified, Not Qualified, or Follow Up)
        - Budget: The client's budget (in dollars)
        - Location: Where the client is located
        - Project Type: Type of interior design project
        - Property Size: Size of the property (in square feet)
        - Timeline: When the client wants the project completed
        - Consultation Date: When the client prefers to have a consultation
        
        Format your response as a valid JSON object with these exact field names. If a field isn't mentioned, set it to null.
        
        Here's the summary:
        ${summary}` }],
      }
    ];

    // Generate content based on the prompt
    const result = await geminiModel.generateContent({ contents: prompt });
    const response = await result.response;
    const responseText = response.text();
    
    // Extract JSON from the response
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```|(\{[\s\S]*\})/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[2];
      return JSON.parse(jsonStr);
    }
    
    // If no JSON block found, try to parse the entire response
    try {
      return JSON.parse(responseText);
    } catch (e) {
      console.log("Failed to parse AI response as JSON:", e.message);
      return {};
    }
  } catch (error) {
    console.error(`Error using AI to extract info: ${error.message}`);
    return {};
  }
}

/**
 * Update specific fields in a lead record based on call summary
 * @param {string} leadId - ID of the lead to update
 * @param {Object} extractedData - Object containing extracted fields
 * @returns {Promise<boolean>} Success status
 */
async function updateLeadFields(leadId, extractedData) {
  try {
    if (!leadId) {
      console.error('Missing required leadId parameter');
      return false;
    }
    
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${LEADS_TABLE_ID}/${leadId}`;
    
    // Filter out null values to only update fields that have data
    let fields = {};
    for (let [key, value] of Object.entries(extractedData)) {
      if (value != null) {
        if (key === "Property Size" || key === "Budget") {
          value = String(value);
        }
        fields[key] = value;
      }
    }
    
    if (Object.keys(fields).length === 0) {
      console.log(`No fields to update for lead ${leadId}`);
      return false;
    }
    
    const data = { fields };
    
    const response = await axios.patch(url, data, { headers: airtableHeaders });
    
    console.log(`Successfully updated lead ${leadId} with extracted field data`);
    return response.status === 200;
  } catch (error) {
    console.error(`Error updating lead fields for ${leadId}: ${error.message}`);
    console.log(error);
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

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
    
    const callId = webhookData.message?.call?.id;
    const status = webhookData.message?.status || "In-progress";
    // console.log("status: "+status);
    const leadId = webhookData.message?.call?.metadata?.lead_id;
    // console.log("leadId: "+leadId);
    const messages = webhookData.message?.artifact?.messagesOpenAIFormatted || "";
    const filteredMessages = messages.filter(msg => msg.role !== "system");
    const transcript = filteredMessages.map(msg => `${msg.role}: ${msg.content}`).join("\n");
    // console.log("transcript: "+transcript);

    if (!leadId) {
      console.error(`Missing lead_id in webhook metadata for call ${callId}`);
      return;
    }

    // Create call record
    // const callRecordData = {
    //   callproviderID: callId,
    //   phonenumberID: webhookData.message.phoneNumber.id,
    //   customernumber: webhookData.message.call.customer.number,
    //   type: "outbound",
    //   started: String(webhookData.message.timestamp),
    //   ended: String(webhookData.message?.artifact?.messages[0]?.time),
    //   milliseconds: webhookData.message?.artifact?.messages[0]?.secondsFromStart,
    //   cost: 0.01,
    //   ended_reason: status,
    //   transcript: transcript
    // };
    
    // await createCallRecord(callRecordData);
    // console.log(status);
    // Update lead status based on call outcome
    if (status === "ended") {
      console.log("CONFIRM");
      const updatedCallData = {
        callproviderID: callId,
        phonenumberID: webhookData.message.phoneNumber.id,
        customernumber: webhookData.message.call.customer.number,
        ended: String(webhookData.message?.artifact?.messages[0]?.time),
        milliseconds: webhookData.message?.artifact?.messages[0]?.secondsFromStart,
        cost: 0.01,
        ended_reason: status,
        transcript: transcript
      };
      await updateCallRecord(callId, updatedCallData);

      // Generate summary from transcript
      const summary = await generateCallSummary(transcript);
      
      // Update lead status with summary
      await updateLeadStatus(leadId, "Called", null, summary);
      
      // NEW: Extract fields from summary and update lead
      const extractedData = await parseCallSummary(summary);
      console.log("Extracted data:", JSON.stringify(extractedData, null, 2));
      
      // Update lead fields with extracted data
      await updateLeadFields(leadId, extractedData);
    } else if (status === "no-answer") {
      
      await updateCallRecord(callId, {
        ended_reason: status,
        ended: new Date().toISOString()
      });

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
    } else if(status !== "In-progress"){
      // Handle other call statuses
      console.log("HERE");
      // await updateLeadStatus(leadId, "Failed", null, `Call failed: ${status}`);
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

// Express app setup
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    const webhookData = req.body;
    
    // Immediately respond to webhook
    res.status(200).send('Webhook received');
    
    // Process the webhook data asynchronously
    console.log("Webhook received");
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
  updateCallRecord,
  initiateCall,
  processCallWebhook,
  getLeadInfo,
  generateCallSummary,
  parseCallSummary,
  extractInfoWithAI,
  updateLeadFields
};