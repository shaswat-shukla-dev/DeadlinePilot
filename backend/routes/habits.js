const express = require('express');
const router = express.Router();
const { db } = require('../services/firebase');

const userHabits = (userId) => db.collection('users').doc(userId).collection('habits');

router.get('/:userId', async (req, res) => {
  try {
    const snap = await userHabits(req.params.userId).get();
    res.json({ habits: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { title, frequency, targetTime, category, icon } = req.body;
    const habit = {
      title, frequency: frequency || 'daily',
      targetTime: targetTime || null, category: category || 'health',
      icon: icon || '⭐', streak: 0, longestStreak: 0,
      completedDates: [], createdAt: new Date().toISOString(),
    };
    const ref = await userHabits(userId).add(habit);
    res.status(201).json({ habit: { id: ref.id, ...habit } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:userId/:habitId/check', async (req, res) => {
  try {
    const { userId, habitId } = req.params;
    const today = new Date().toISOString().split('T')[0];
    const snap = await userHabits(userId).doc(habitId).get();
    const habit = snap.data();
    const completed = habit.completedDates || [];
    
    if (completed.includes(today)) {
      return res.json({ message: 'Already checked in today', habit: { id: habitId, ...habit } });
    }
    
    completed.push(today);
    completed.sort();
    
    // Calculate streak
    let streak = 1;
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (completed.includes(yesterday)) {
      streak = (habit.streak || 0) + 1;
    }
    
    const longestStreak = Math.max(habit.longestStreak || 0, streak);
    await userHabits(userId).doc(habitId).update({ completedDates: completed, streak, longestStreak });
    res.json({ habit: { id: habitId, ...habit, completedDates: completed, streak, longestStreak } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:userId/:habitId', async (req, res) => {
  try {
    await userHabits(req.params.userId).doc(req.params.habitId).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
