// This Node.js script demonstrates how to setup Twilio for testing
// Save as twilio-test.js and run with Node.js

const { Twilio } = require('twilio');
require('dotenv').config();

// Configuration (store these in a .env file)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const TEST_PHONE_NUMBER = process.env.TEST_PHONE_NUMBER; // Your phone for testing

// Initialize Twilio client
const client = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Function to make a test call
async function makeTestCall() {
  try {
    // Create a test call
    const call = await client.calls.create({
      url: 'http://demo.twilio.com/docs/voice.xml', // A Twilio demo TwiML
      to: TEST_PHONE_NUMBER,
      from: TWILIO_PHONE_NUMBER
    });
    
    console.log('Test call initiated!');
    console.log('Call SID:', call.sid);
    
    return call;
  } catch (error) {
    console.error('Error making test call:', error);
    throw error;
  }
}

// Function to create a Twilio webhook for n8n integration
async function setupTwilioWebhook(webhookUrl) {
  try {
    // Get the Twilio phone number
    const incomingPhoneNumbers = await client.incomingPhoneNumbers.list({
      phoneNumber: TWILIO_PHONE_NUMBER
    });
    
    if (incomingPhoneNumbers.length === 0) {
      throw new Error(`No phone number found matching ${TWILIO_PHONE_NUMBER}`);
    }
    
    // Update the voice URL
    const phoneNumber = await client.incomingPhoneNumbers(incomingPhoneNumbers[0].sid)
      .update({
        voiceUrl: webhookUrl
      });
    
    console.log('Webhook URL updated successfully!');
    console.log('Phone number SID:', phoneNumber.sid);
    
    return phoneNumber;
  } catch (error) {
    console.error('Error setting up webhook:', error);
    throw error;
  }
}

// Run the test call function
if (require.main === module) {
  console.log('Testing Twilio integration...');
  makeTestCall()
    .then(result => console.log('Test call completed successfully!'))
    .catch(err => console.error('Test call failed:', err));
  
  // Uncomment to configure webhook
  // const webhookUrl = 'https://your-n8n-instance.example.com/webhook/call-results';
  // setupTwilioWebhook(webhookUrl)
  //   .then(result => console.log('Webhook setup completed!'))
  //   .catch(err => console.error('Webhook setup failed:', err));
}

module.exports = {
  makeTestCall,
  setupTwilioWebhook
};