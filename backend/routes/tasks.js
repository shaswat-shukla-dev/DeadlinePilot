const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../services/firebase');
const { prioritizeTasks, generateSchedule } = require('../services/gemini');

// Helper: get user's tasks collection
const userTasks = (userId) => db.collection('users').doc(userId).collection('tasks');

// GET all tasks
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const snap = await userTasks(userId).get();
    const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Sort by priority_score desc, then due date
    tasks.sort((a, b) => {
      if (a.priority_score && b.priority_score) return b.priority_score - a.priority_score;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
    
    res.json({ tasks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create task
router.post('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { title, description, dueDate, priority, category, estimatedMinutes, tags } = req.body;
    
    if (!title) return res.status(400).json({ error: 'Title is required' });
    
    const task = {
      title: title.trim(),
      description: description || '',
      dueDate: dueDate || null,
      priority: priority || 'medium',
      category: category || 'general',
      estimatedMinutes: estimatedMinutes || 30,
      tags: tags || [],
      status: 'pending',
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      subtasks: [],
      completedAt: null,
      priority_score: null,
      quadrant: null,
    };
    
    const ref = await userTasks(userId).add(task);
    const created = { id: ref.id, ...task };
    
    // Async: trigger re-prioritization
    prioritizeTasks([created]).then(prioritized => {
      if (prioritized[0]) {
        userTasks(userId).doc(ref.id).update({
          priority_score: prioritized[0].priority_score,
          quadrant: prioritized[0].quadrant,
          reasoning: prioritized[0].reasoning,
          suggested_time_block: prioritized[0].suggested_time_block,
        }).catch(console.error);
      }
    }).catch(console.error);
    
    // Emit to user's socket room
    if (req.io) req.io.to(`user-${userId}`).emit('task-created', created);
    
    res.status(201).json({ task: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update task
router.patch('/:userId/:taskId', async (req, res) => {
  try {
    const { userId, taskId } = req.params;
    const updates = { ...req.body, lastUpdated: new Date().toISOString() };
    
    if (updates.status === 'completed') {
      updates.completedAt = new Date().toISOString();
    }
    
    await userTasks(userId).doc(taskId).update(updates);
    const snap = await userTasks(userId).doc(taskId).get();
    const task = { id: snap.id, ...snap.data() };
    
    if (req.io) req.io.to(`user-${userId}`).emit('task-updated', task);
    
    res.json({ task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE task
router.delete('/:userId/:taskId', async (req, res) => {
  try {
    const { userId, taskId } = req.params;
    await userTasks(userId).doc(taskId).delete();
    if (req.io) req.io.to(`user-${userId}`).emit('task-deleted', { id: taskId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add subtask
router.post('/:userId/:taskId/subtasks', async (req, res) => {
  try {
    const { userId, taskId } = req.params;
    const { title } = req.body;
    
    const snap = await userTasks(userId).doc(taskId).get();
    const task = snap.data();
    const subtasks = task.subtasks || [];
    const newSubtask = { id: uuidv4(), title, completed: false, createdAt: new Date().toISOString() };
    
    subtasks.push(newSubtask);
    await userTasks(userId).doc(taskId).update({ subtasks, lastUpdated: new Date().toISOString() });
    
    res.json({ subtask: newSubtask });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST prioritize all tasks with AI
router.post('/:userId/ai/prioritize', async (req, res) => {
  try {
    const { userId } = req.params;
    const snap = await userTasks(userId).where('status', '!=', 'completed').get();
    const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const prioritized = await prioritizeTasks(tasks);
    
    // Update each task in Firestore
    const batch = [];
    for (const pt of prioritized) {
      if (pt.id) {
        batch.push(
          userTasks(userId).doc(pt.id).update({
            priority_score: pt.priority_score,
            quadrant: pt.quadrant,
            reasoning: pt.reasoning,
            suggested_time_block: pt.suggested_time_block,
            lastUpdated: new Date().toISOString(),
          })
        );
      }
    }
    await Promise.all(batch);
    
    if (req.io) req.io.to(`user-${userId}`).emit('tasks-reprioritized', { tasks: prioritized });
    
    res.json({ tasks: prioritized });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST generate AI schedule
router.post('/:userId/ai/schedule', async (req, res) => {
  try {
    const { userId } = req.params;
    const { preferences } = req.body;
    
    const snap = await userTasks(userId).where('status', '!=', 'completed').get();
    const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const schedule = await generateSchedule(tasks, preferences);
    res.json({ schedule });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
