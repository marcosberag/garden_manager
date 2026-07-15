import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER;

const client = twilio(accountSid, authToken);

async function check() {
  try {
    // Get last 5 messages from Twilio to see their status and errors
    const messages = await client.messages.list({ limit: 10 });
    for (const msg of messages) {
      console.log(`[${msg.dateCreated}] To: ${msg.to}, Status: ${msg.status}, ErrorCode: ${msg.errorCode}`);
    }
  } catch (e) {
    console.error(e);
  }
}
check();
