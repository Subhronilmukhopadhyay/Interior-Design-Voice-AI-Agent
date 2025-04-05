// create_test_leads.js
require('dotenv').config();
const axios = require('axios');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const LEADS_TABLE_ID = process.env.AIRTABLE_LEADS_TABLE;

const airtableHeaders = {
  'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json'
};

async function createTestLeads() {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${LEADS_TABLE_ID}`;
  
  // Sample test data - adjust as needed
  const testLeads = [
    {
      fields: {
        "First Name": "John",
        "Last Name": "Smith",
        "Mobile": "+919876543210", // Replace with a valid number
        "Email": "john@example.com",
        "Status": "TBC",
        "Attempt": 0,
        "Date Time": new Date().toISOString()
      }
    },
    {
      fields: {
        "First Name": "Maya",
        "Last Name": "Patel",
        "Mobile": "+919876543211", // Replace with a valid number
        "Email": "maya@example.com",
        "Status": "TBC",
        "Attempt": 0,
        "Date Time": new Date().toISOString()
      }
    },
    {
      fields: {
        "First Name": "Arjun",
        "Last Name": "Sharma",
        "Mobile": "+919876543212", // Replace with a valid number
        "Email": "arjun@example.com",
        "Status": "TBC",
        "Attempt": 0,
        "Date Time": new Date().toISOString()
      }
    }
  ];
  
  try {
    const response = await axios.post(url, { records: testLeads }, { headers: airtableHeaders });
    console.log('Successfully created test leads:');
    console.log(response.data.records.map(record => record.id));
  } catch (error) {
    console.error('Error creating test leads:', error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data));
    }
  }
}

createTestLeads().catch(console.error);