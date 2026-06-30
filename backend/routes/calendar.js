const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const { db } = require('../services/firebase');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8080/api/calendar/callback'
);

// GET Google OAuth URL
router.get('/auth-url', (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
  ];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: req.query.userId,
  });
  res.json({ url });
});

// GET OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state: userId } = req.query;
    const { tokens } = await oauth2Client.getToken(code);
    
    // Store tokens in Firestore
    await db.collection('users').doc(userId).update({
      googleCalendarTokens: tokens,
      calendarConnected: true,
    });
    
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?calendar=connected`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET upcoming events
router.get('/events/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const userSnap = await db.collection('users').doc(userId).get();
    const userData = userSnap.exists ? userSnap.data() : {};
    
    if (!userData.googleCalendarTokens) {
      return res.json({ events: [], connected: false });
    }
    
    oauth2Client.setCredentials(userData.googleCalendarTokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      maxResults: 20,
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    const events = (response.data.items || []).map(e => ({
      id: e.id,
      title: e.summary,
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      location: e.location,
      description: e.description,
      isAllDay: !e.start?.dateTime,
    }));
    
    res.json({ events, connected: true });
  } catch (err) {
    console.error('Calendar error:', err);
    res.json({ events: [], connected: false, error: err.message });
  }
});

// POST add event to Google Calendar
router.post('/events/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { title, start, end, description } = req.body;
    
    const userSnap = await db.collection('users').doc(userId).get();
    const userData = userSnap.exists ? userSnap.data() : {};
    
    if (!userData.googleCalendarTokens) {
      return res.status(401).json({ error: 'Google Calendar not connected' });
    }
    
    oauth2Client.setCredentials(userData.googleCalendarTokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const event = await calendar.events.insert({
      calendarId: 'primary',
      resource: {
        summary: title,
        description,
        start: { dateTime: start },
        end: { dateTime: end },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 30 },
            { method: 'email', minutes: 60 },
          ],
        },
      },
    });
    
    res.json({ event: event.data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
