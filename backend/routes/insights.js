const express = require('express');
const router = express.Router();
const { db } = require('../services/firebase');
const { analyzeProductivity } = require('../services/gemini');

router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const [tasksSnap, habitsSnap] = await Promise.all([
      db.collection('users').doc(userId).collection('tasks').get(),
      db.collection('users').doc(userId).collection('habits').get(),
    ]);
    const taskHistory = tasksSnap.docs.map(d => d.data());
    const habitHistory = habitsSnap.docs.map(d => d.data());
    const insights = await analyzeProductivity(taskHistory, habitHistory);
    res.json({ insights });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST user preferences/patterns
router.post('/:userId/preferences', async (req, res) => {
  try {
    const { userId } = req.params;
    const prefs = req.body;
    await db.collection('users').doc(userId).set({ preferences: prefs, updatedAt: new Date().toISOString() }, { merge: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
