const { GoogleGenerativeAI } = require('@google/generative-ai');

// Use Gemini via Google AI Studio API (also works with Vertex AI)
let genAI;
try {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
} catch (e) {
  console.warn('Gemini AI init warning:', e.message);
}

const SYSTEM_PROMPT = `You are LifeSaver AI, a proactive productivity companion. You help users plan, prioritize, and complete tasks before deadlines are missed.

Your personality:
- Warm, direct, and action-oriented
- You analyze urgency AND importance, not just due dates
- You suggest concrete next steps, not vague advice
- You celebrate wins and provide gentle accountability

You have these capabilities:
1. PRIORITIZE tasks using the Eisenhower Matrix (urgent/important)
2. SCHEDULE work blocks based on available time and task complexity  
3. BREAK DOWN large tasks into actionable subtasks
4. DETECT conflicts in scheduling and suggest solutions
5. ANALYZE productivity patterns and give personalized recommendations
6. SET smart reminders based on context (time needed, complexity, user's history)

When analyzing tasks, consider:
- Time required vs. time available
- Dependencies between tasks
- User's energy patterns (morning person vs. night owl)
- Past completion patterns
- Buffer time for unexpected delays

Always respond with structured JSON when asked for data, or conversational text for chat.`;

async function chatWithAgent(messages, userContext = {}) {
  if (!genAI) {
    return simulatedAgentResponse(messages[messages.length - 1]?.content, userContext);
  }
  
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-pro',
      systemInstruction: SYSTEM_PROMPT,
    });
    
    const contextPrefix = userContext.tasks ? 
      `\n\n[USER CONTEXT]\nCurrent tasks: ${JSON.stringify(userContext.tasks?.slice(0, 10))}\nToday: ${new Date().toISOString()}\nUser patterns: ${JSON.stringify(userContext.patterns || {})}\n\n` : '';
    
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    
    const chat = model.startChat({ history });
    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(contextPrefix + lastMessage.content);
    return result.response.text();
  } catch (err) {
    console.error('Gemini error:', err);
    return simulatedAgentResponse(messages[messages.length - 1]?.content, userContext);
  }
}

async function prioritizeTasks(tasks) {
  if (!genAI) return tasks;
  
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Analyze these tasks and return a JSON array with prioritization scores.
Tasks: ${JSON.stringify(tasks)}
Today: ${new Date().toISOString()}

For each task, add:
- priority_score: 1-100 (higher = more urgent)
- quadrant: "do-now" | "schedule" | "delegate" | "eliminate"
- suggested_time_block: estimated minutes to complete
- suggested_start: ISO datetime recommendation
- reasoning: one sentence why

Return ONLY valid JSON array, no markdown.`;
    
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  } catch (err) {
    console.error('Prioritization error:', err);
    return tasks;
  }
}

async function generateSchedule(tasks, preferences = {}) {
  if (!genAI) return [];
  
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Create an optimal daily schedule for these tasks.
Tasks: ${JSON.stringify(tasks)}
User preferences: ${JSON.stringify(preferences)}
Today: ${new Date().toISOString()}

Return JSON array of time blocks:
[{ "task_id": "...", "start_time": "HH:MM", "end_time": "HH:MM", "type": "focus|break|admin", "notes": "..." }]
No markdown, just JSON.`;
    
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  } catch (err) {
    console.error('Schedule generation error:', err);
    return [];
  }
}

async function analyzeProductivity(taskHistory, habitHistory) {
  if (!genAI) return { insights: [], score: 75 };
  
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Analyze this user's productivity data and provide insights.
Task history (last 30 days): ${JSON.stringify(taskHistory?.slice(0, 50))}
Habit history: ${JSON.stringify(habitHistory?.slice(0, 30))}

Return JSON:
{
  "score": 0-100,
  "trend": "improving|declining|stable",
  "insights": ["...", "..."],
  "recommendations": ["...", "..."],
  "best_time_of_day": "morning|afternoon|evening",
  "completion_rate": 0-100,
  "avg_delay_hours": number
}
No markdown.`;
    
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  } catch (err) {
    console.error('Analytics error:', err);
    return { score: 75, trend: 'stable', insights: ['Keep it up!'], recommendations: ['Set clearer deadlines'] };
  }
}

async function generateProactiveNudge(task, urgency) {
  if (!genAI) return `Reminder: "${task.title}" is due soon!`;
  
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Write a motivating, personalized nudge for this task.
Task: ${JSON.stringify(task)}
Urgency level: ${urgency} (critical|high|medium)
Due in: ${task.timeUntilDue}

Write ONE short, warm message (max 2 sentences). No generic phrases. Be specific to the task.`;
    
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    return `Heads up: "${task.title}" needs your attention soon!`;
  }
}

function simulatedAgentResponse(message, context) {
  const lower = (message || '').toLowerCase();
  if (lower.includes('priorit')) {
    return "I've analyzed your tasks using the Eisenhower Matrix. Your top priority right now is the task closest to its deadline with highest impact. I'd suggest starting with that in the next hour while your energy is fresh.";
  }
  if (lower.includes('schedule') || lower.includes('plan')) {
    return "Based on your task list, here's my recommendation: tackle your most complex task in the morning (90-min deep work block), handle emails and quick tasks after lunch, and save creative work for late afternoon. Want me to create a full time-block schedule?";
  }
  if (lower.includes('motivat') || lower.includes('help')) {
    return "You've got this! Breaking your task into smaller chunks makes it feel less overwhelming. What's the very first small step you could take in the next 10 minutes?";
  }
  return "I'm here to help you stay on top of your commitments! Tell me about your tasks or ask me to prioritize, schedule, or analyze your productivity patterns.";
}

module.exports = { chatWithAgent, prioritizeTasks, generateSchedule, analyzeProductivity, generateProactiveNudge };
