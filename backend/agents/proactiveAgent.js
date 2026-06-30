const { db } = require('../services/firebase');
const { generateProactiveNudge, prioritizeTasks } = require('../services/gemini');

class ProactiveAgent {
  constructor(io) {
    this.io = io;
  }

  async sweep() {
    try {
      const usersSnap = await db.collection('users').get();
      if (usersSnap.empty) return;

      for (const userDoc of usersSnap.docs) {
        await this.processUser(userDoc.id, userDoc.data());
      }
    } catch (err) {
      console.error('Sweep error:', err);
    }
  }

  async processUser(userId, userData) {
    try {
      const tasksSnap = await db.collection('users').doc(userId).collection('tasks')
        .where('status', '!=', 'completed').get();

      if (tasksSnap.empty) return;

      const now = new Date();
      const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const nudges = [];

      for (const task of tasks) {
        if (!task.dueDate) continue;
        const due = new Date(task.dueDate);
        const hoursUntilDue = (due - now) / (1000 * 60 * 60);

        let urgency = null;
        if (hoursUntilDue < 0) urgency = 'overdue';
        else if (hoursUntilDue < 2) urgency = 'critical';
        else if (hoursUntilDue < 6) urgency = 'high';
        else if (hoursUntilDue < 24) urgency = 'medium';

        if (urgency && !this.wasRecentlyNudged(task, urgency)) {
          const timeUntilDue = hoursUntilDue < 0 
            ? `${Math.abs(Math.round(hoursUntilDue))} hours overdue`
            : `${Math.round(hoursUntilDue)} hours`;
          
          const message = await generateProactiveNudge({ ...task, timeUntilDue }, urgency);
          nudges.push({ taskId: task.id, urgency, message, task });

          // Record nudge sent
          await db.collection('users').doc(userId).collection('tasks').doc(task.id)
            .update({ 
              lastNudge: { urgency, sentAt: now.toISOString() },
              lastUpdated: now.toISOString()
            });
        }
      }

      if (nudges.length > 0) {
        // Send via Socket.IO for real-time notification
        this.io.to(`user-${userId}`).emit('proactive-nudge', { nudges, timestamp: now.toISOString() });

        // Store nudge history in Firestore
        await db.collection('users').doc(userId).collection('nudgeHistory').add({
          nudges,
          timestamp: now.toISOString(),
          processedTasks: tasks.length
        });
      }

      // Auto-reprioritize if tasks have changed recently
      const recentChange = tasks.some(t => {
        const updated = t.lastUpdated ? new Date(t.lastUpdated) : null;
        return updated && (now - updated) < 30 * 60 * 1000;
      });

      if (recentChange && tasks.length > 1) {
        try {
          const prioritized = await prioritizeTasks(tasks);
          this.io.to(`user-${userId}`).emit('tasks-reprioritized', { tasks: prioritized });
        } catch (e) {
          // Non-critical, swallow
        }
      }
    } catch (err) {
      console.error(`Error processing user ${userId}:`, err);
    }
  }

  wasRecentlyNudged(task, currentUrgency) {
    if (!task.lastNudge) return false;
    const lastNudge = new Date(task.lastNudge.sentAt);
    const minutesSince = (new Date() - lastNudge) / (1000 * 60);
    
    // Don't nudge more than once per: critical=30min, high=60min, medium=3hr, overdue=2hr
    const cooldowns = { critical: 30, high: 60, medium: 180, overdue: 120 };
    return minutesSince < (cooldowns[currentUrgency] || 60);
  }
}

module.exports = { ProactiveAgent };
