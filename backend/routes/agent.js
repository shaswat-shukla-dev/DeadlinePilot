const express = require('express');
const router = express.Router();
const { db } = require('../services/firebase');
const { chatWithAgent, analyzeProductivity } = require('../services/gemini');

// POST chat with AI agent
router.post('/chat/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { messages, includeContext } = req.body;
    
    let userContext = {};
    if (includeContext) {
      // Fetch tasks for context
      const tasksSnap = await db.collection('users').doc(userId).collection('tasks')
        .where('status', '!=', 'completed').get();
      userContext.tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Fetch user patterns
      const userSnap = await db.collection('users').doc(userId).get();
      if (userSnap.exists) userContext.patterns = userSnap.data().patterns || {};
    }
    
    const response = await chatWithAgent(messages, userContext);
    
    // Save chat history
    await db.collection('users').doc(userId).collection('chatHistory').add({
      messages,
      response,
      timestamp: new Date().toISOString()
    });
    
    res.json({ response });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST voice transcription (Google Speech-to-Text would go here)
router.post('/voice/:userId', async (req, res) => {
  try {
    // Placeholder: In production, integrate Google Cloud Speech-to-Text
    // const { audioData } = req.body;
    // const client = new speech.SpeechClient();
    // const [response] = await client.recognize({ audio: { content: audioData }, config: {...} });
    res.json({ transcript: 'Voice input would be processed by Google Cloud Speech-to-Text' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET productivity analysis
router.get('/insights/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const tasksSnap = await db.collection('users').doc(userId).collection('tasks').get();
    const habitsSnap = await db.collection('users').doc(userId).collection('habits').get();
    
    const taskHistory = tasksSnap.docs.map(d => d.data());
    const habitHistory = habitsSnap.docs.map(d => d.data());
    
    const insights = await analyzeProductivity(taskHistory, habitHistory);
    res.json({ insights });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
