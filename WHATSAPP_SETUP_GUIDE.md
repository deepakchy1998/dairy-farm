# 📱 WhatsApp Notifications Setup Guide

This guide will help you set up free WhatsApp notifications for DairyPro. Takes **~15 minutes**. No cost.

---

## What You'll Get

- ✅ Critical alerts sent to users' WhatsApp (overdue vaccinations, deliveries, low milk, etc.)
- ✅ Daily 9 PM farm summary on WhatsApp
- ✅ Free — 1,000 conversations/month (enough for hundreds of users)
- ✅ Messages arrive on users' normal WhatsApp app

---

## Step 1: Create a Meta Developer Account (3 min)

1. Go to **https://developers.facebook.com**
2. Click **"Get Started"** (top right)
3. Log in with your **Facebook account** (create one if needed — you can use a dummy account)
4. Accept the terms and complete registration
5. You're now a Meta Developer ✅

---

## Step 2: Create a Meta App (3 min)

1. Go to **https://developers.facebook.com/apps**
2. Click **"Create App"**
3. Select **"Other"** → click Next
4. Select **"Business"** type → click Next
5. App name: **DairyPro** (or anything you like)
6. Contact email: your email
7. Click **"Create App"**

---

## Step 3: Add WhatsApp to Your App (2 min)

1. On your app dashboard, scroll down to **"Add products to your app"**
2. Find **"WhatsApp"** and click **"Set up"**
3. It will ask to create or select a Meta Business Account — click **"Continue"**
4. You're now on the WhatsApp **"API Setup"** page ✅

---

## Step 4: Get Your Credentials (2 min)

On the **API Setup** page, you'll see:

### 📋 Phone Number ID
- Under **"From"** section, you'll see a test phone number Meta gave you
- Below it is the **Phone number ID** — copy it
- This is your `WHATSAPP_PHONE_ID`

### 📋 Temporary Access Token
- You'll see a **"Temporary access token"** — copy it
- ⚠️ This expires in 24 hours! (We'll make it permanent in Step 6)
- For now, use this as your `WHATSAPP_TOKEN`

---

## Step 5: Add Environment Variables to Render (2 min)

1. Go to **https://dashboard.render.com**
2. Open your **DairyPro backend** service
3. Click **"Environment"** tab
4. Add these variables:

| Key | Value |
|-----|-------|
| `WHATSAPP_TOKEN` | The access token from Step 4 |
| `WHATSAPP_PHONE_ID` | The phone number ID from Step 4 |

5. Click **"Save Changes"** — Render will auto-redeploy

---

## Step 6: Make the Token Permanent (5 min)

The temporary token expires in 24 hours. Here's how to get a permanent one:

1. Go to **https://developers.facebook.com/apps** → your app
2. Click **"App settings"** → **"Basic"** in the left sidebar
3. Note your **App ID** and **App Secret** (click "Show" to reveal secret)
4. Go to **https://developers.facebook.com** → **Tools** → **"Graph API Explorer"**
5. Select your app from the dropdown (top right)
6. Click **"Generate Access Token"**
7. Select permissions: `whatsapp_business_messaging`, `whatsapp_business_management`
8. Click **"Generate"** and authorize

**To exchange for a permanent token:**

Open your browser and paste this URL (replace the values):

```
https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=YOUR_TEMPORARY_TOKEN
```

The response will contain a **long-lived token** (valid for 60 days). 

For a **truly permanent** token, create a System User:
1. Go to **https://business.facebook.com/settings/system-users**
2. Create a system user with **Admin** role
3. Click **"Generate Token"** for your app
4. Select `whatsapp_business_messaging` permission
5. This token **never expires** ✅

Update the `WHATSAPP_TOKEN` in Render with this permanent token.

---

## Step 7: Add Test Recipients (2 min)

With the free test number, you can only message numbers you've added:

1. On the **API Setup** page, under **"To"** section
2. Click **"Manage phone number list"**
3. Add phone numbers you want to test with
4. Each number will receive a verification code — enter it to confirm

> 💡 Once you go live (Step 8), you can message anyone without adding them first.

---

## Step 8: Go Live (Optional — when ready for production)

To message any user without adding them first:

1. Add a **real phone number** (your business number) instead of the test number
2. Verify it via SMS/call
3. Submit your app for **review** (Meta reviews it in 1-2 business days)
4. Once approved, you can message any WhatsApp user

> For testing with a few farmers, the test number (Steps 1-7) is enough.

---

## 🧪 Test It

1. Make sure your phone number is in your DairyPro profile (Settings → Profile → Phone)
2. Make sure you added that number as a test recipient (Step 7)
3. Open DairyPro — notifications will auto-generate
4. Critical alerts (overdue vaccinations, etc.) will be sent to your WhatsApp
5. After 9 PM IST, you'll receive the daily farm summary on WhatsApp

---

## ❓ Troubleshooting

| Problem | Solution |
|---------|----------|
| No WhatsApp messages | Check Render logs — look for "WhatsApp send failed" errors |
| "Token expired" error | Follow Step 6 to get a permanent token |
| Messages not delivered | Make sure the phone is added as test recipient (Step 7) |
| 401 Unauthorized | Your token is invalid — regenerate it |
| Phone format issues | Use format with country code: `919876543210` (no + or spaces) |

---

## 💰 Cost

- **Free tier:** 1,000 conversations/month
- **After that:** ~$0.005 per conversation (very cheap)
- For most dairy farms, free tier is more than enough

---

**That's it! Your farmers will now get WhatsApp alerts for critical farm events and a daily summary at 9 PM.** 🐄📱
