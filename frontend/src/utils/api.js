const BASE_URL = process.env.REACT_APP_API_URL || '';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'API error');
  }
  return res.json();
}

// Tasks
export const getTasks = (userId) => apiFetch(`/tasks/${userId}`);
export const createTask = (userId, task) => apiFetch(`/tasks/${userId}`, { method: 'POST', body: task });
export const updateTask = (userId, taskId, updates) => apiFetch(`/tasks/${userId}/${taskId}`, { method: 'PATCH', body: updates });
export const deleteTask = (userId, taskId) => apiFetch(`/tasks/${userId}/${taskId}`, { method: 'DELETE' });
export const addSubtask = (userId, taskId, title) => apiFetch(`/tasks/${userId}/${taskId}/subtasks`, { method: 'POST', body: { title } });
export const aiPrioritize = (userId) => apiFetch(`/tasks/${userId}/ai/prioritize`, { method: 'POST' });
export const aiSchedule = (userId, preferences) => apiFetch(`/tasks/${userId}/ai/schedule`, { method: 'POST', body: { preferences } });

// Agent chat
export const chatWithAgent = (userId, messages, includeContext = true) =>
  apiFetch(`/agent/chat/${userId}`, { method: 'POST', body: { messages, includeContext } });

// Calendar
export const getCalendarAuthUrl = (userId) => apiFetch(`/calendar/auth-url?userId=${userId}`);
export const getCalendarEvents = (userId) => apiFetch(`/calendar/events/${userId}`);
export const addCalendarEvent = (userId, event) => apiFetch(`/calendar/events/${userId}`, { method: 'POST', body: event });

// Habits
export const getHabits = (userId) => apiFetch(`/habits/${userId}`);
export const createHabit = (userId, habit) => apiFetch(`/habits/${userId}`, { method: 'POST', body: habit });
export const checkHabit = (userId, habitId) => apiFetch(`/habits/${userId}/${habitId}/check`, { method: 'POST' });
export const deleteHabit = (userId, habitId) => apiFetch(`/habits/${userId}/${habitId}`, { method: 'DELETE' });

// Insights
export const getInsights = (userId) => apiFetch(`/insights/${userId}`);
export const savePreferences = (userId, prefs) => apiFetch(`/insights/${userId}/preferences`, { method: 'POST', body: prefs });
