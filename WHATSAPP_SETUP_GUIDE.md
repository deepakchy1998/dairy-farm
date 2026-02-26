# 📱 WhatsApp Business API Setup Guide

This guide will help you set up automated WhatsApp notifications for DairyPro. Takes **~15 minutes** and is completely **optional** — DairyPro works perfectly without WhatsApp integration.

**What DairyPro sends via WhatsApp:**
- 🩺 **Vaccination alerts** — Overdue and upcoming vaccination reminders
- 🥛 **Delivery reminders** — Milk delivery schedules and payment dues  
- 💳 **Subscription expiry** — Payment reminders and plan renewal alerts
- 📊 **Daily farm summary** — Complete farm status delivered at 9 PM daily

---

## ✨ What You'll Get

- ✅ Critical farm alerts delivered directly to users' WhatsApp
- ✅ Automated daily farm summaries at 9 PM
- ✅ **Free tier:** 1,000 conversations/month (sufficient for most farms)
- ✅ Messages arrive in users' regular WhatsApp app
- ✅ Professional business messaging experience

---

## Step 1: Create Meta Developer Account (3 min)

1. Navigate to **https://developers.facebook.com**
2. Click **"Get Started"** in the top right corner
3. Log in with your **Facebook account** (create one if needed)
4. Accept the developer terms and complete the registration process
5. Your Meta Developer account is now active ✅

---

## Step 2: Create a Meta Business App (3 min)

1. Go to **https://developers.facebook.com/apps**
2. Click **"Create App"**
3. Select **"Other"** → click **Next**
4. Choose **"Business"** as the app type → click **Next**
5. Enter app details:
   - **App name:** `DairyPro Notifications` (or your preferred name)
   - **Contact email:** Your business email address
6. Click **"Create App"**
7. Your app dashboard is now ready ✅

---

## Step 3: Add WhatsApp Business API (2 min)

1. On your app dashboard, scroll to **"Add products to your app"**
2. Locate **"WhatsApp"** product and click **"Set up"**
3. You may be prompted to create/select a Meta Business Account — click **"Continue"**
4. You'll be redirected to the WhatsApp **"API Setup"** page
5. WhatsApp Business API is now added to your app ✅

---

## Step 4: Collect Your API Credentials (2 min)

On the **API Setup** page, locate these critical values:

### 📋 Phone Number ID
- In the **"From"** section, you'll see a test phone number provided by Meta
- Below the phone number, find the **Phone number ID** — copy this value
- This becomes your `WHATSAPP_PHONE_ID` environment variable

### 📋 Access Token  
- Look for the **"Temporary access token"** — copy this value
- ⚠️ **Important:** This token expires in 24 hours
- Use this as your initial `WHATSAPP_TOKEN` (we'll make it permanent in Step 6)

---

## Step 5: Configure Environment Variables (2 min)

### For Render Deployment:
1. Go to **https://dashboard.render.com**
2. Open your DairyPro backend service
3. Navigate to the **"Environment"** tab
4. Add these environment variables:

| Variable Name | Value |
|---------------|-------|
| `WHATSAPP_TOKEN` | Your access token from Step 4 |
| `WHATSAPP_PHONE_ID` | Your phone number ID from Step 4 |

5. Click **"Save Changes"** — Render will automatically redeploy your service

### For Local Development:
Add to your backend `.env` file:
```env
WHATSAPP_TOKEN=your_access_token_here
WHATSAPP_PHONE_ID=your_phone_number_id_here
```

---

## Step 6: Create a Permanent Access Token (5 min)

The temporary token expires in 24 hours. Here's how to get a never-expiring token:

### Method 1: System User Token (Recommended)
1. Go to **https://business.facebook.com/settings/system-users**
2. Click **"Add"** to create a new system user
3. Enter a name like `DairyPro WhatsApp Bot`
4. Assign **Admin** role
5. Click **"Create System User"**
6. Click **"Generate New Token"** for your DairyPro app
7. Select the `whatsapp_business_messaging` permission
8. Copy the generated token — **this token never expires** ✅
9. Update your `WHATSAPP_TOKEN` environment variable with this permanent token

### Method 2: Long-lived Token (60-day expiry)
1. Go to **https://developers.facebook.com/apps** → your app
2. Navigate to **App Settings** → **Basic**
3. Note your **App ID** and **App Secret** (click "Show")
4. Replace values in this URL and visit it:
```
https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=YOUR_TEMPORARY_TOKEN
```
5. The response contains a long-lived token (valid for 60 days)

---

## Step 7: Configure Test Recipients (2 min)

During development, you can only message pre-approved phone numbers:

1. On the **API Setup** page, find the **"To"** section  
2. Click **"Manage phone number list"**
3. Add phone numbers you want to test with (include country code, e.g., `919876543210`)
4. Each number will receive a verification code via WhatsApp
5. Enter the verification codes to confirm the numbers

> 💡 **Note:** Once your app is approved for production (Step 8), you can message any WhatsApp user without pre-approval.

---

## Step 8: Go Live for Production (Optional)

To message any user without adding them to a test list:

### Add Your Business Phone Number
1. In the **"From"** section, click **"Add phone number"**
2. Enter your actual business phone number
3. Complete SMS/voice verification
4. Select this number as your primary sending number

### Submit for App Review  
1. Go to **App Review** → **WhatsApp Business Management**
2. Request `whatsapp_business_messaging` permission
3. Provide business verification documents
4. Meta typically reviews and approves within 1-2 business days
5. Once approved, you can message any WhatsApp user globally

> **For Development:** The test setup (Steps 1-7) is sufficient for testing with a small group of users.

---

## 🧪 Testing Your Setup

1. **Ensure your phone number is in your DairyPro profile:**
   - Go to Settings → Profile → Phone Number
   - Use international format: `919876543210` (no + or spaces)

2. **Add your number as a test recipient** (if using test setup)

3. **Trigger test notifications:**
   - Create a vaccination due tomorrow
   - Add a milk delivery with pending dues
   - Wait until 9 PM for the daily summary

4. **Check Render logs** if messages don't arrive:
   - Look for "WhatsApp notification sent" or error messages
   - Verify your environment variables are correctly set

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| **No messages received** | Check Render logs for API errors. Verify phone number format and test recipient list |
| **"Invalid access token"** | Token expired — follow Step 6 to get a permanent token |
| **"Recipient not in allowed list"** | Add the phone number as a test recipient (Step 7) |
| **401 Unauthorized errors** | Regenerate your access token or check app permissions |
| **Message delivery failures** | Ensure phone numbers use international format without + or spaces |
| **Daily summary not sent** | Check server timezone settings and cron job configuration |
| **"Rate limit exceeded"** | You've exceeded Meta's free tier — consider upgrading or reducing frequency |

### Common Phone Number Formats:
- ✅ **Correct:** `919876543210` (country code + number)
- ❌ **Incorrect:** `+91 9876543210`, `9876543210`, `+919876543210`

---

## 💰 Pricing Information

- **Free Tier:** 1,000 conversations per month
- **Paid Tier:** ~$0.005 USD per conversation after free limit
- **Conversation Definition:** 24-hour message thread between business and user
- **Estimated Cost:** Most dairy farms stay within the free tier

---

## 🔒 Security Best Practices

- Store access tokens securely in environment variables only
- Never commit tokens to version control
- Use system user tokens for production (they don't expire)
- Regularly rotate tokens if using long-lived tokens
- Monitor usage to prevent unexpected charges
- Implement rate limiting in your application

---

## 📞 Support Resources

- **Meta Developer Docs:** https://developers.facebook.com/docs/whatsapp
- **WhatsApp Business API:** https://developers.facebook.com/docs/whatsapp/business-management-api
- **Business Manager Help:** https://business.facebook.com/help

---

**That's it!** Your dairy farm users will now receive important WhatsApp notifications and daily farm summaries. This integration is completely optional — DairyPro provides full functionality even without WhatsApp notifications. 🐄📱✨