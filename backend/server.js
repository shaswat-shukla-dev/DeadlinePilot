require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const cron = require('node-cron');

const tasksRouter = require('./routes/tasks');
const agentRouter = require('./routes/agent');
const calendarRouter = require('./routes/calendar');
const habitsRouter = require('./routes/habits');
const insightsRouter = require('./routes/insights');
const { ProactiveAgent } = require('./agents/proactiveAgent');
const { db } = require('./services/firebase');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// Attach socket.io to requests
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use('/api/tasks', tasksRouter);
app.use('/api/agent', agentRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/habits', habitsRouter);
app.use('/api/insights', insightsRouter);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Socket.IO for real-time agent nudges
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('join-user', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined room`);
  });
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// Proactive Agent: runs every 15 minutes to check deadlines & send nudges
cron.schedule('*/15 * * * *', async () => {
  console.log('Running proactive agent sweep...');
  try {
    const agent = new ProactiveAgent(io);
    await agent.sweep();
  } catch (err) {
    console.error('Proactive agent error:', err);
  }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Last-Minute Life Saver backend running on port ${PORT}`);
});

module.exports = { app, io };
