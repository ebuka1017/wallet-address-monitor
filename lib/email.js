import axios from 'axios';
import getConfig from 'next/config';

const { serverRuntimeConfig } = getConfig();

/**
 * Send email alert about suspicious transaction
 * @param {Object} details - Transaction details
 * @returns {Promise<boolean>} Success status
 */
export async function sendEmail(details) {
  try {
    const mailersendUrl = 'https://api.mailersend.com/v1/email';
    
    const headers = {
      'Authorization': `Bearer ${serverRuntimeConfig.MAILERSEND_API_KEY}`,
      'Content-Type': 'application/json'
    };
    
    const emailData = {
      from: {
        email: `noreply@${serverRuntimeConfig.MAILERSEND_DOMAIN}`
      },
      to: [
        {
          email: serverRuntimeConfig.RECEIVER_EMAIL
        }
      ],
      subject: 'Suspicious Transaction Detected',
      text: `
        Fund Destination: ${details.destination}
        Destination Address: ${details.to_address}
        Token Amount: ${details.amount}
        Token Name: ${details.token_name}
        Tx Hash: ${details.blockchain}:${details.tx_hash}#${details.block_number}
      `
    };
    
    const response = await axios.post(mailersendUrl, emailData, { headers });
    
    if (response.status === 202) {
      console.log('Email sent successfully');
      return true;
    } else {
      console.error(`Failed to send email: ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}