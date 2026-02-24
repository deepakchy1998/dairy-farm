/**
 * WhatsApp Cloud API Integration
 * Uses Meta's free Cloud API (1000 conversations/month free)
 * 
 * Required env vars:
 *   WHATSAPP_TOKEN       - Permanent access token from Meta Developer dashboard
 *   WHATSAPP_PHONE_ID    - Phone number ID from WhatsApp Business settings
 * 
 * If env vars are not set, all functions silently skip (no errors).
 */

const WHATSAPP_API = 'https://graph.facebook.com/v21.0';

function isConfigured() {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
}

/**
 * Send a plain text WhatsApp message
 * @param {string} phone - Phone number with country code (e.g., "919876543210")
 * @param {string} text - Message text
 * @returns {boolean} success
 */
export async function sendWhatsAppMessage(phone, text) {
  if (!isConfigured()) return false;
  if (!phone) return false;

  // Clean phone number — remove +, spaces, dashes
  const cleanPhone = phone.replace(/[\s\-\+]/g, '');
  
  // Ensure it starts with country code (default to 91 for India)
  const finalPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;

  try {
    const res = await fetch(`${WHATSAPP_API}/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: finalPhone,
        type: 'text',
        text: { body: text },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('WhatsApp send failed:', res.status, err.error?.message || JSON.stringify(err));
      return false;
    }

    console.log(`✅ WhatsApp message sent to ${finalPhone}`);
    return true;
  } catch (err) {
    console.error('WhatsApp send error:', err.message);
    return false;
  }
}

/**
 * Send a critical alert to a user's WhatsApp
 * @param {string} phone - User phone number
 * @param {string} title - Alert title
 * @param {string} message - Alert body
 */
export async function sendWhatsAppAlert(phone, title, message) {
  const text = `🐄 *DairyPro Alert*\n\n*${title}*\n${message}\n\n_Open app to take action_`;
  return sendWhatsAppMessage(phone, text);
}

/**
 * Send daily farm summary to WhatsApp
 * @param {string} phone - User phone number  
 * @param {string} summary - Pre-formatted summary text
 */
export async function sendWhatsAppSummary(phone, summary) {
  const text = `🐄 *DairyPro*\n\n${summary}\n\n_Your daily farm report • DairyPro_`;
  return sendWhatsAppMessage(phone, text);
}

export default { sendWhatsAppMessage, sendWhatsAppAlert, sendWhatsAppSummary, isConfigured };
