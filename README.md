# Interior Design Voice AI Agent

A multi-agent voice system for Interia, a North Indian interior design firm, that manages incoming leads and automates client communication. This system processes leads from website forms, qualifies potential clients, and handles client communications efficiently.

## Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Airtable Setup](#airtable-setup)
- [Vapi AI Setup](#vapi-ai-setup)
- [Usage](#usage)
- [Webhook Endpoint](#webhook-endpoint)
- [Main Functions](#main-functions)
- [How It Works](#how-it-works)
- [Error Handling](#error-handling)
- [Voice Agent Script](#voice-agent-script)
- [Challenges Faced](#challenges-faced)

## Overview

This project implements an automated voice agent system that:
- Retrieves new lead data from Airtable
- Processes lead information
- Initiates outbound calls using the Vapi AI voice assistant
- Updates lead status in Airtable after interactions
- Generates summaries of calls and extracts useful information

## Architecture

The system follows this workflow:
1. Retrieves leads with "TBC" (To Be Called) status from Airtable
2. Initiates calls through Vapi AI
3. Updates lead status to "In-Progress"
4. Processes call results when completed
5. Generates AI summaries of conversations
6. Updates Airtable with qualification data and call records

## Prerequisites

- Node.js (v14+)
- npm or yarn
- Airtable account with appropriate base setup
- Vapi AI account with a configured voice assistant
- Google Gemini API key for AI summaries
- Twilio account (for test phone numbers)
- n8n for workflow automation
- ngrok for exposing local server to the internet

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd interior-design-voice-agent
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up your environment variables:
   - Create a `.env` file in the root directory
   - Add the following variables:
   ```
   VAPI_API_KEY=your_vapi_api_key
   AIRTABLE_API_KEY=your_airtable_api_key
   AIRTABLE_BASE_ID=your_airtable_base_id
   AIRTABLE_LEADS_TABLE=your_leads_table_id
   AIRTABLE_CALL_RECORDS_TABLE=your_call_records_table_id
   VAPI_ASSISTANT_ID=your_vapi_assistant_id
   WEBHOOK_URL=your_webhook_url
   GEMINI_API_KEY=your_gemini_api_key
   ```

## Airtable Setup

Create two tables in your Airtable base:

### Leads Table
- id
- First Name
- Last Name
- Mobile
- Email
- Status (TBC/In-Progress/Called/Failed)
- Attempt (count of call attempts)
- Date Time
- Summary
- Assignee
- Budget
- Location
- Project Type
- Property Size
- Timeline
- Consultation Date
- Qualification

### Call Records Table
- id
- callproviderID
- phonenumberID
- customernumber
- type
- started
- ended
- milliseconds
- cost
- ended_reason
- transcript
- Lead (linked to Leads table)

## Vapi AI Setup

1. Create a voice assistant in Vapi
2. Configure the assistant with the prompt from the technical assessment
3. Set up webhook callbacks to your application's webhook endpoint

## Usage

### Running the Server

Start the Express server to receive webhook callbacks:

```
npm run server
```

or

```
node server.js --server
```

The server will run on port 3000 by default, or you can specify a different port in the `.env` file.

### Processing Leads

Run the lead processing job manually:

```
node server.js
```

For production use, you can set up a cron job to run this script at regular intervals.

## Webhook Endpoint

The application exposes a webhook endpoint at `/webhook` that receives callbacks from Vapi when calls are completed. This endpoint processes the call results and updates the lead status in Airtable.

## Main Functions

- `getTbcLeads()`: Fetches leads with 'TBC' status from Airtable
- `updateLeadStatus()`: Updates the status of a lead in Airtable
- `initiateCall()`: Initiates a call using Vapi AI
- `processCallWebhook()`: Processes webhook data from completed calls
- `generateCallSummary()`: Generates a summary of the call transcript using AI
- `parseCallSummary()`: Extracts structured data from the summary
- `updateLeadFields()`: Updates specific fields in a lead record

## How It Works

The Interior Design Voice AI Agent operates through a series of integrated steps:

1. **Lead Retrieval**: The system periodically checks Airtable for leads marked with "TBC" (To Be Called) status.

2. **Automated Calling**: For each lead, the system:
   - Extracts contact information from Airtable
   - Initiates an outbound call using Vapi AI
   - Updates the lead status to "In-Progress"
   - Creates an initial call record in Airtable

3. **Voice Conversation**: The Vapi AI assistant follows a structured conversation script to:
   - Introduce itself as a representative of Interia
   - Gather key qualification information (budget, location, timeline, etc.)
   - Answer basic questions about Interia's services
   - Determine if the lead is qualified
   - Schedule next steps based on qualification status

4. **Call Processing**: When a call ends, the system:
   - Receives a webhook notification from Vapi
   - Updates the call record with duration, outcome, and transcript
   - Processes the call result to determine next steps

5. **AI Analysis**: For completed calls, the system:
   - Uses Google Gemini AI to generate a comprehensive summary of the conversation
   - Extracts structured data points (budget, location, project scope, etc.)
   - Updates the lead record with this information

6. **Follow-up Management**: Based on call outcomes, the system:
   - Marks qualified leads for designer follow-up
   - Schedules retries for unanswered calls (up to 2 attempts)
   - Marks unreachable or unqualified leads accordingly

7. **n8n Workflow Integration**: The entire process is orchestrated through n8n workflows that:
   - Trigger at scheduled intervals
   - Handle the flow between different system components
   - Manage error cases and retries
   - Update records in Airtable

## Error Handling

The application includes comprehensive error handling for:
- Failed API calls
- Missing environment variables
- Invalid lead data
- Call failures
- Webhook processing errors

## Voice Agent Script

The voice agent follows a structured conversation flow:

1. Introduction and purpose of call
2. Need discovery and information gathering
3. Qualification assessment
4. Next steps based on qualification
5. Professional closing

Key qualification questions:
- Budget exploration
- Location assessment
- Timeline expectations
- Project scope
- Property size

## Challenges Faced

During the development of this project, several challenges were encountered:

1. **API Key Management and Integration**: 
   - Obtaining and securely managing multiple API keys (VAPI_API_KEY, AIRTABLE_API_KEY, GEMINI_API_KEY)
   - Setting up proper authentication for each service
   - Ensuring secure storage of keys in environment variables
   - Configuring proper access permissions for each service

2. **Finding Free/Trial Versions**:
   - Identifying available free tiers for each required service
   - Working within the limitations of free versions
   - Setting up developer accounts with sufficient trial credits
   - Managing usage to avoid exceeding free tier limits

3. **AI Service Selection**:
   - Initially planned to use OpenAI for call summary generation
   - Switched to Google AI Studio (Gemini) for better pricing and performance
   - Adapting the code to work with Gemini's API structure
   - Optimizing prompts for better summary extraction

4. **n8n Workflow Development**:
   - Creating an efficient workflow model in n8n
   - Testing and debugging the flow for different scenarios
   - Handling asynchronous operations within the workflow
   - Ensuring proper error handling between workflow steps
   - Managing workflow execution timing and triggers

5. **Local Development Exposure**:
   - Setting up ngrok to expose the local webhook server to the internet
   - Managing dynamic ngrok URLs for webhook endpoints
   - Handling webhook security concerns
   - Ensuring reliable delivery of webhook events to the local development environment
