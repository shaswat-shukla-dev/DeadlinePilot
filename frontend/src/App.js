import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { formatDistanceToNow, format, isToday, isPast, parseISO } from 'date-fns';
import * as api from './utils/api';
import './styles/main.css';

const USER_ID = 'demo-user-' + (localStorage.getItem('lsl-uid') || (() => {
  const id = Math.random().toString(36).substr(2, 8);
  localStorage.setItem('lsl-uid', id);
  return id;
})());

const PRIORITY_COLORS = {
  critical: { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', dot: '#ef4444' },
  high:     { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412', dot: '#f97316' },
  medium:   { bg: '#fffbeb', border: '#fde68a', text: '#92400e', dot: '#f59e0b' },
  low:      { bg: '#f0fdf4', border: '#bbf7d0', text: '#14532d', dot: '#22c55e' },
};

const QUADRANT_LABELS = {
  'do-now':    { label: 'Do Now', color: '#ef4444', bg: '#fef2f2' },
  'schedule':  { label: 'Schedule', color: '#3b82f6', bg: '#eff6ff' },
  'delegate':  { label: 'Delegate', color: '#a855f7', bg: '#faf5ff' },
  'eliminate': { label: 'Reconsider', color: '#6b7280', bg: '#f9fafb' },
};

const CATEGORY_ICONS = {
  work: '💼', study: '📚', health: '❤️', finance: '💰',
  personal: '⭐', general: '📋', interview: '🎯', meeting: '🤝',
};

export default function App() {
  const [view, setView] = useState('dashboard');
  const [tasks, setTasks] = useState([]);
  const [habits, setHabits] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [insights, setInsights] = useState(null);
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: "Hi! I'm your LifeSaver AI. I can help you prioritize tasks, plan your day, and keep you on track. What's on your plate today?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [nudges, setNudges] = useState([]);
  const [loading, setLoading] = useState({});
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [agentThinking, setAgentThinking] = useState(false);
  const [schedule, setSchedule] = useState([]);
  const chatEndRef = useRef(null);
  const socketRef = useRef(null);

  // Socket.IO setup
  useEffect(() => {
    const SOCKET_URL = process.env.REACT_APP_API_URL || window.location.origin;
    socketRef.current = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current.emit('join-user', USER_ID);
    
    socketRef.current.on('proactive-nudge', ({ nudges: incoming }) => {
      setNudges(prev => [...incoming.map(n => ({ ...n, id: Date.now() + Math.random(), timestamp: new Date() })), ...prev].slice(0, 5));
    });
    socketRef.current.on('tasks-reprioritized', ({ tasks: updated }) => {
      setTasks(prev => prev.map(t => {
        const u = updated.find(ut => ut.id === t.id);
        return u ? { ...t, ...u } : t;
      }));
    });
    socketRef.current.on('task-created', (task) => setTasks(prev => [task, ...prev]));
    socketRef.current.on('task-updated', (task) => setTasks(prev => prev.map(t => t.id === task.id ? task : t)));
    socketRef.current.on('task-deleted', ({ id }) => setTasks(prev => prev.filter(t => t.id !== id)));

    return () => socketRef.current?.disconnect();
  }, []);

  // Load data
  useEffect(() => {
    loadTasks();
    loadHabits();
    loadCalendar();
    loadInsights();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const loadTasks = async () => {
    setLoading(l => ({ ...l, tasks: true }));
    try {
      const { tasks } = await api.getTasks(USER_ID);
      setTasks(tasks || []);
    } catch (e) { console.error(e); }
    finally { setLoading(l => ({ ...l, tasks: false })); }
  };

  const loadHabits = async () => {
    try {
      const { habits } = await api.getHabits(USER_ID);
      setHabits(habits || []);
    } catch (e) { console.error(e); }
  };

  const loadCalendar = async () => {
    try {
      const { events } = await api.getCalendarEvents(USER_ID);
      setCalendarEvents(events || []);
    } catch (e) { console.error(e); }
  };

  const loadInsights = async () => {
    try {
      const { insights } = await api.getInsights(USER_ID);
      setInsights(insights);
    } catch (e) { console.error(e); }
  };

  const handleCreateTask = async (taskData) => {
    try {
      await api.createTask(USER_ID, taskData);
      setShowAddTask(false);
      loadTasks();
    } catch (e) { console.error(e); }
  };

  const handleToggleTask = async (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await api.updateTask(USER_ID, task.id, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    } catch (e) { console.error(e); }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await api.deleteTask(USER_ID, taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      if (selectedTask?.id === taskId) setSelectedTask(null);
    } catch (e) { console.error(e); }
  };

  const handleAIPrioritize = async () => {
    setLoading(l => ({ ...l, prioritize: true }));
    try {
      const { tasks: prioritized } = await api.aiPrioritize(USER_ID);
      setTasks(prev => prev.map(t => {
        const p = prioritized.find(pt => pt.id === t.id);
        return p ? { ...t, ...p } : t;
      }));
    } catch (e) { console.error(e); }
    finally { setLoading(l => ({ ...l, prioritize: false })); }
  };

  const handleGenerateSchedule = async () => {
    setLoading(l => ({ ...l, schedule: true }));
    try {
      const { schedule: sched } = await api.aiSchedule(USER_ID);
      setSchedule(sched || []);
      setView('schedule');
    } catch (e) { console.error(e); }
    finally { setLoading(l => ({ ...l, schedule: false })); }
  };

  const handleChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = { role: 'user', content: chatInput };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput('');
    setAgentThinking(true);
    try {
      const { response } = await api.chatWithAgent(USER_ID, newMessages, true);
      setChatMessages([...newMessages, { role: 'assistant', content: response }]);
    } catch (e) {
      setChatMessages([...newMessages, { role: 'assistant', content: 'Sorry, I had trouble connecting. Try again!' }]);
    }
    setAgentThinking(false);
  };

  const handleCheckHabit = async (habitId) => {
    try {
      const { habit } = await api.checkHabit(USER_ID, habitId);
      setHabits(prev => prev.map(h => h.id === habitId ? habit : h));
    } catch (e) { console.error(e); }
  };

  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const urgentTasks = pendingTasks.filter(t => {
    if (!t.dueDate) return false;
    const h = (new Date(t.dueDate) - new Date()) / 3600000;
    return h < 24 && h > 0;
  });
  const overdueTasks = pendingTasks.filter(t => t.dueDate && isPast(parseISO(t.dueDate)));

  return (
    <div className="app">
      {/* Nudge Toasts */}
      <div className="nudge-container">
        {nudges.map(n => (
          <div key={n.id} className={`nudge nudge-${n.urgency}`}>
            <span className="nudge-icon">{n.urgency === 'critical' ? '🚨' : n.urgency === 'high' ? '⚡' : '💡'}</span>
            <div>
              <strong>{n.task?.title}</strong>
              <p>{n.message}</p>
            </div>
            <button onClick={() => setNudges(prev => prev.filter(x => x.id !== n.id))}>×</button>
          </div>
        ))}
      </div>

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">⚡</div>
          <div>
            <div className="brand-name">LifeSaver</div>
            <div className="brand-sub">AI Productivity</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {[
            { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
            { id: 'tasks', icon: '✅', label: 'Tasks' },
            { id: 'schedule', icon: '📅', label: 'Schedule' },
            { id: 'habits', icon: '🔥', label: 'Habits' },
            { id: 'calendar', icon: '🗓️', label: 'Calendar' },
            { id: 'insights', icon: '📊', label: 'Insights' },
            { id: 'agent', icon: '🤖', label: 'AI Agent' },
          ].map(item => (
            <button key={item.id} className={`nav-item ${view === item.id ? 'active' : ''}`} onClick={() => setView(item.id)}>
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === 'tasks' && overdueTasks.length > 0 && (
                <span className="nav-badge">{overdueTasks.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-stats">
          <div className="stat-row">
            <span>Tasks pending</span>
            <strong>{pendingTasks.length}</strong>
          </div>
          <div className="stat-row">
            <span>Overdue</span>
            <strong style={{ color: '#ef4444' }}>{overdueTasks.length}</strong>
          </div>
          <div className="stat-row">
            <span>Done today</span>
            <strong style={{ color: '#22c55e' }}>
              {completedTasks.filter(t => t.completedAt && isToday(parseISO(t.completedAt))).length}
            </strong>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {view === 'dashboard' && (
          <DashboardView
            tasks={pendingTasks} urgentTasks={urgentTasks} overdueTasks={overdueTasks}
            completedTasks={completedTasks} habits={habits} calendarEvents={calendarEvents}
            insights={insights} loading={loading}
            onAddTask={() => setShowAddTask(true)}
            onPrioritize={handleAIPrioritize}
            onSchedule={handleGenerateSchedule}
            onTaskClick={setSelectedTask}
            onToggleTask={handleToggleTask}
          />
        )}
        {view === 'tasks' && (
          <TasksView
            tasks={tasks} loading={loading}
            onAdd={() => setShowAddTask(true)}
            onToggle={handleToggleTask}
            onDelete={handleDeleteTask}
            onSelect={setSelectedTask}
            onPrioritize={handleAIPrioritize}
          />
        )}
        {view === 'schedule' && (
          <ScheduleView
            schedule={schedule} tasks={pendingTasks}
            onGenerate={handleGenerateSchedule} loading={loading}
          />
        )}
        {view === 'habits' && (
          <HabitsView
            habits={habits} onAdd={() => setShowAddHabit(true)}
            onCheck={handleCheckHabit} onDelete={async (id) => {
              await api.deleteHabit(USER_ID, id);
              setHabits(prev => prev.filter(h => h.id !== id));
            }}
          />
        )}
        {view === 'calendar' && (
          <CalendarView events={calendarEvents} userId={USER_ID} />
        )}
        {view === 'insights' && (
          <InsightsView insights={insights} tasks={tasks} habits={habits} onRefresh={loadInsights} />
        )}
        {view === 'agent' && (
          <AgentView
            messages={chatMessages} input={chatInput} thinking={agentThinking}
            onInputChange={setChatInput} onSend={handleChat} chatEndRef={chatEndRef}
            quickActions={[
              'Prioritize my tasks for today',
              'What should I work on right now?',
              'Help me plan the next 3 hours',
              'Which tasks are most at risk?',
              'Give me a productivity boost tip',
            ]}
          />
        )}
      </main>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={async (updates) => {
            await api.updateTask(USER_ID, selectedTask.id, updates);
            setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, ...updates } : t));
            setSelectedTask(prev => ({ ...prev, ...updates }));
          }}
          onAddSubtask={async (title) => {
            const { subtask } = await api.addSubtask(USER_ID, selectedTask.id, title);
            const updatedTask = { ...selectedTask, subtasks: [...(selectedTask.subtasks || []), subtask] };
            setSelectedTask(updatedTask);
            setTasks(prev => prev.map(t => t.id === selectedTask.id ? updatedTask : t));
          }}
          onDelete={() => { handleDeleteTask(selectedTask.id); setSelectedTask(null); }}
        />
      )}

      {/* Add Task Modal */}
      {showAddTask && (
        <AddTaskModal onClose={() => setShowAddTask(false)} onSubmit={handleCreateTask} />
      )}

      {/* Add Habit Modal */}
      {showAddHabit && (
        <AddHabitModal
          onClose={() => setShowAddHabit(false)}
          onSubmit={async (data) => {
            const { habit } = await api.createHabit(USER_ID, data);
            setHabits(prev => [...prev, habit]);
            setShowAddHabit(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Dashboard View ────────────────────────────────────────────────
function DashboardView({ tasks, urgentTasks, overdueTasks, completedTasks, habits, calendarEvents, insights, loading, onAddTask, onPrioritize, onSchedule, onTaskClick, onToggleTask }) {
  const allTasksCount = tasks.length + completedTasks.length;
  const completionRate = allTasksCount > 0 ? Math.round((completedTasks.length / allTasksCount) * 100) : 0;
  const todayHabits = habits.filter(h => h.completedDates?.includes(new Date().toISOString().split('T')[0]));

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <h1 className="view-title">Good {getGreeting()}, Champion 👋</h1>
          <p className="view-subtitle">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <button className="btn-primary" onClick={onAddTask}>+ Add Task</button>
      </div>

      {/* Overdue Alert */}
      {overdueTasks.length > 0 && (
        <div className="alert-banner">
          <span>🚨</span>
          <div>
            <strong>{overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}</strong>
            <p>These need immediate attention: {overdueTasks.map(t => t.title).join(', ')}</p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="stats-grid">
        <StatCard icon="📋" label="Pending tasks" value={tasks.length} color="#3b82f6" />
        <StatCard icon="⚡" label="Due in 24h" value={urgentTasks.length} color="#f97316" />
        <StatCard icon="✅" label="Completion rate" value={`${completionRate}%`} color="#22c55e" />
        <StatCard icon="🔥" label="Habits today" value={`${todayHabits.length}/${habits.length}`} color="#a855f7" />
      </div>

      {/* AI Actions */}
      <div className="ai-actions">
        <button className="ai-btn" onClick={onPrioritize} disabled={loading.prioritize}>
          {loading.prioritize ? <Spinner /> : '🧠'} AI Prioritize
        </button>
        <button className="ai-btn" onClick={onSchedule} disabled={loading.schedule}>
          {loading.schedule ? <Spinner /> : '📅'} Generate Schedule
        </button>
      </div>

      <div className="dashboard-grid">
        {/* Urgent Tasks */}
        <div className="card">
          <div className="card-header">
            <h3>⚡ Up Next</h3>
            <span className="badge badge-orange">{urgentTasks.length} urgent</span>
          </div>
          {tasks.slice(0, 5).map(task => (
            <TaskRow key={task.id} task={task} onToggle={onToggleTask} onClick={() => onTaskClick(task)} compact />
          ))}
          {tasks.length === 0 && <EmptyState icon="🎉" text="All clear! Add a task to get started." />}
        </div>

        {/* Calendar Preview */}
        <div className="card">
          <div className="card-header">
            <h3>🗓️ Today's Events</h3>
          </div>
          {calendarEvents.filter(e => e.start && isToday(parseISO(e.start))).slice(0, 4).map(event => (
            <div key={event.id} className="calendar-event-row">
              <div className="event-time">{event.start ? format(parseISO(event.start), 'h:mm a') : 'All day'}</div>
              <div className="event-title">{event.title}</div>
            </div>
          ))}
          {calendarEvents.length === 0 && <EmptyState icon="📅" text="Connect Google Calendar to see events." />}
        </div>

        {/* Habits Today */}
        <div className="card">
          <div className="card-header">
            <h3>🔥 Today's Habits</h3>
            <span className="badge badge-purple">{todayHabits.length}/{habits.length}</span>
          </div>
          {habits.slice(0, 5).map(habit => {
            const done = habit.completedDates?.includes(new Date().toISOString().split('T')[0]);
            return (
              <div key={habit.id} className={`habit-row ${done ? 'done' : ''}`}>
                <span>{habit.icon || '⭐'} {habit.title}</span>
                <div className="habit-right">
                  <span className="streak">🔥 {habit.streak || 0}</span>
                  <span className={`habit-check ${done ? 'checked' : ''}`}>{done ? '✓' : '○'}</span>
                </div>
              </div>
            );
          })}
          {habits.length === 0 && <EmptyState icon="🌱" text="No habits yet. Add some to track." />}
        </div>

        {/* Productivity Score */}
        {insights && (
          <div className="card">
            <div className="card-header"><h3>📊 Productivity Score</h3></div>
            <div className="score-display">
              <div className="score-ring">
                <svg viewBox="0 0 80 80" className="ring-svg">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#3b82f6" strokeWidth="8"
                    strokeDasharray={`${(insights.score / 100) * 213.6} 213.6`}
                    strokeLinecap="round" transform="rotate(-90 40 40)" />
                </svg>
                <div className="score-number">{insights.score}</div>
              </div>
              <div className="score-info">
                <div className={`trend-badge trend-${insights.trend}`}>{
                  insights.trend === 'improving' ? '↑ Improving' : insights.trend === 'declining' ? '↓ Declining' : '→ Stable'
                }</div>
                {insights.insights?.slice(0, 2).map((ins, i) => (
                  <p key={i} className="insight-text">• {ins}</p>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tasks View ───────────────────────────────────────────────────
function TasksView({ tasks, loading, onAdd, onToggle, onDelete, onSelect, onPrioritize }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('priority');

  const filtered = tasks.filter(t => {
    if (filter === 'pending' && t.status === 'completed') return false;
    if (filter === 'completed' && t.status !== 'completed') return false;
    if (filter === 'overdue' && (!t.dueDate || !isPast(parseISO(t.dueDate)) || t.status === 'completed')) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'priority') return (b.priority_score || 0) - (a.priority_score || 0);
    if (sortBy === 'due') {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    }
    if (sortBy === 'created') return new Date(b.createdAt) - new Date(a.createdAt);
    return 0;
  });

  return (
    <div className="view">
      <div className="view-header">
        <div><h1 className="view-title">Tasks</h1><p className="view-subtitle">{tasks.filter(t => t.status !== 'completed').length} pending</p></div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={onPrioritize} disabled={loading.prioritize}>
            {loading.prioritize ? <Spinner /> : '🧠 AI Prioritize'}
          </button>
          <button className="btn-primary" onClick={onAdd}>+ Add Task</button>
        </div>
      </div>

      <div className="task-controls">
        <input className="search-input" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="filter-tabs">
          {['all','pending','completed','overdue'].map(f => (
            <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="priority">By AI Priority</option>
          <option value="due">By Due Date</option>
          <option value="created">By Created</option>
        </select>
      </div>

      <div className="tasks-list">
        {filtered.map(task => (
          <TaskRow key={task.id} task={task} onToggle={onToggle} onClick={() => onSelect(task)} onDelete={onDelete} showQuadrant />
        ))}
        {filtered.length === 0 && <EmptyState icon="✅" text="No tasks here. Add one to get started!" />}
      </div>
    </div>
  );
}

// ─── Schedule View ────────────────────────────────────────────────
function ScheduleView({ schedule, tasks, onGenerate, loading }) {
  const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7am-9pm

  return (
    <div className="view">
      <div className="view-header">
        <div><h1 className="view-title">Today's Schedule</h1><p className="view-subtitle">AI-optimized time blocks</p></div>
        <button className="btn-primary" onClick={onGenerate} disabled={loading.schedule}>
          {loading.schedule ? <Spinner /> : '✨ Generate Schedule'}
        </button>
      </div>

      {schedule.length > 0 ? (
        <div className="schedule-timeline">
          {hours.map(hour => {
            const block = schedule.find(s => {
              const startH = parseInt(s.start_time?.split(':')[0] || '0');
              return startH === hour;
            });
            return (
              <div key={hour} className="timeline-row">
                <div className="timeline-time">{hour > 12 ? `${hour - 12}pm` : hour === 12 ? '12pm' : `${hour}am`}</div>
                <div className="timeline-content">
                  {block ? (
                    <div className={`time-block type-${block.type}`}>
                      <span className="block-icon">{block.type === 'break' ? '☕' : block.type === 'admin' ? '📧' : '🎯'}</span>
                      <div>
                        <strong>{tasks.find(t => t.id === block.task_id)?.title || block.type}</strong>
                        {block.notes && <p>{block.notes}</p>}
                      </div>
                      <span className="block-time">{block.start_time} – {block.end_time}</span>
                    </div>
                  ) : (
                    <div className="timeline-empty" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-schedule">
          <div className="empty-schedule-icon">📅</div>
          <h2>No schedule yet</h2>
          <p>Let AI analyze your tasks and build an optimized time-block schedule for today.</p>
          <button className="btn-primary large" onClick={onGenerate} disabled={loading.schedule}>
            {loading.schedule ? 'Building schedule...' : '✨ Generate My Schedule'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Habits View ──────────────────────────────────────────────────
function HabitsView({ habits, onAdd, onCheck, onDelete }) {
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="view">
      <div className="view-header">
        <div><h1 className="view-title">Habit Tracker</h1><p className="view-subtitle">Build consistency, one day at a time</p></div>
        <button className="btn-primary" onClick={onAdd}>+ Add Habit</button>
      </div>

      <div className="habits-grid">
        {habits.map(habit => {
          const done = habit.completedDates?.includes(today);
          const last7 = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
            return habit.completedDates?.includes(d);
          }).reverse();

          return (
            <div key={habit.id} className={`habit-card ${done ? 'habit-done' : ''}`}>
              <div className="habit-card-header">
                <span className="habit-icon">{habit.icon || '⭐'}</span>
                <div>
                  <h3>{habit.title}</h3>
                  <span className="habit-category">{habit.category}</span>
                </div>
                <button className="icon-btn danger" onClick={() => onDelete(habit.id)}>×</button>
              </div>
              <div className="habit-streak">
                <span className="streak-fire">🔥 {habit.streak || 0} day streak</span>
                <span className="best-streak">Best: {habit.longestStreak || 0}</span>
              </div>
              <div className="habit-week">
                {last7.map((done, i) => (
                  <div key={i} className={`day-dot ${done ? 'filled' : ''}`} title={['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]} />
                ))}
              </div>
              <button className={`habit-check-btn ${done ? 'checked' : ''}`} onClick={() => !done && onCheck(habit.id)}>
                {done ? '✓ Done today!' : 'Mark complete'}
              </button>
            </div>
          );
        })}
        {habits.length === 0 && (
          <div className="empty-full">
            <EmptyState icon="🌱" text="No habits tracked yet. Add one to build better routines." />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Calendar View ────────────────────────────────────────────────
function CalendarView({ events, userId }) {
  const [connecting, setConnecting] = useState(false);

  const connectCalendar = async () => {
    setConnecting(true);
    try {
      const { url } = await api.getCalendarAuthUrl(userId);
      window.location.href = url;
    } catch (e) {
      console.error(e);
      setConnecting(false);
    }
  };

  return (
    <div className="view">
      <div className="view-header">
        <div><h1 className="view-title">Calendar</h1><p className="view-subtitle">Upcoming events & deadlines</p></div>
        <button className="btn-google" onClick={connectCalendar} disabled={connecting}>
          <span>G</span> {connecting ? 'Connecting...' : 'Connect Google Calendar'}
        </button>
      </div>

      {events.length > 0 ? (
        <div className="events-list">
          {events.map(event => (
            <div key={event.id} className="event-card">
              <div className="event-date-col">
                <div className="event-month">{event.start ? format(parseISO(event.start), 'MMM') : ''}</div>
                <div className="event-day">{event.start ? format(parseISO(event.start), 'd') : ''}</div>
              </div>
              <div className="event-details">
                <h3>{event.title}</h3>
                <p>{event.start ? format(parseISO(event.start), 'h:mm a') : 'All day'}
                  {event.location ? ` · ${event.location}` : ''}</p>
              </div>
              <div className={`event-status ${isToday(parseISO(event.start || '')) ? 'today' : ''}`}>
                {isToday(parseISO(event.start || '')) ? 'Today' : formatDistanceToNow(parseISO(event.start || ''), { addSuffix: true })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="calendar-empty">
          <div className="empty-icon">🗓️</div>
          <h2>No calendar connected</h2>
          <p>Connect your Google Calendar to see upcoming events and get smart reminders based on your schedule.</p>
          <button className="btn-google large" onClick={connectCalendar}>
            <span>G</span> Connect Google Calendar
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Insights View ────────────────────────────────────────────────
function InsightsView({ insights, tasks, habits, onRefresh }) {
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
  const quadrantCounts = tasks.reduce((acc, t) => {
    if (t.quadrant) acc[t.quadrant] = (acc[t.quadrant] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="view">
      <div className="view-header">
        <div><h1 className="view-title">Insights</h1><p className="view-subtitle">AI-powered productivity analysis</p></div>
        <button className="btn-secondary" onClick={onRefresh}>↻ Refresh</button>
      </div>

      <div className="insights-grid">
        {/* Score */}
        <div className="card insights-score-card">
          <h3>Productivity Score</h3>
          <div className="big-score">
            <div className="score-circle">
              <span>{insights?.score ?? '—'}</span>
            </div>
            {insights?.trend && (
              <div className={`trend-pill trend-${insights.trend}`}>
                {insights.trend === 'improving' ? '↑ Improving' : insights.trend === 'declining' ? '↓ Needs attention' : '→ Stable'}
              </div>
            )}
          </div>
        </div>

        {/* Task Stats */}
        <div className="card">
          <h3>Task Statistics</h3>
          <div className="stats-list">
            <div className="stat-item"><span>Total tasks</span><strong>{tasks.length}</strong></div>
            <div className="stat-item"><span>Completed</span><strong style={{color:'#22c55e'}}>{completedTasks.length}</strong></div>
            <div className="stat-item"><span>Completion rate</span><strong>{completionRate}%</strong></div>
            <div className="stat-item"><span>Avg habit streak</span><strong>{habits.length > 0 ? Math.round(habits.reduce((s, h) => s + (h.streak || 0), 0) / habits.length) : 0} days</strong></div>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${completionRate}%` }} />
          </div>
        </div>

        {/* Eisenhower Matrix */}
        <div className="card">
          <h3>Eisenhower Matrix</h3>
          <div className="matrix-grid">
            {Object.entries(QUADRANT_LABELS).map(([key, q]) => (
              <div key={key} className="matrix-cell" style={{ background: q.bg, borderColor: q.color + '40' }}>
                <div className="matrix-label" style={{ color: q.color }}>{q.label}</div>
                <div className="matrix-count" style={{ color: q.color }}>{quadrantCounts[key] || 0}</div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Insights */}
        {insights && (
          <div className="card insights-recommendations">
            <h3>🤖 AI Recommendations</h3>
            {(insights.recommendations || insights.insights || []).map((rec, i) => (
              <div key={i} className="recommendation-item">
                <span className="rec-num">{i + 1}</span>
                <p>{rec}</p>
              </div>
            ))}
            {insights.best_time_of_day && (
              <div className="best-time-badge">
                ⏰ You're most productive in the <strong>{insights.best_time_of_day}</strong>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Agent Chat View ──────────────────────────────────────────────
function AgentView({ messages, input, thinking, onInputChange, onSend, chatEndRef, quickActions }) {
  return (
    <div className="view agent-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">AI Agent</h1>
          <p className="view-subtitle">Powered by Google Gemini</p>
        </div>
        <div className="agent-status">
          <span className="status-dot active" />
          <span>Active</span>
        </div>
      </div>

      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`chat-message ${msg.role}`}>
              {msg.role === 'assistant' && <div className="agent-avatar">⚡</div>}
              <div className="message-bubble">
                <p>{msg.content}</p>
              </div>
            </div>
          ))}
          {thinking && (
            <div className="chat-message assistant">
              <div className="agent-avatar">⚡</div>
              <div className="message-bubble thinking">
                <span /><span /><span />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="quick-actions">
          {quickActions.map((qa, i) => (
            <button key={i} className="quick-action-btn" onClick={() => { onInputChange(qa); }}>
              {qa}
            </button>
          ))}
        </div>

        <div className="chat-input-row">
          <textarea
            className="chat-textarea"
            placeholder="Ask me anything about your tasks, schedule, or productivity..."
            value={input}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            rows={2}
          />
          <button className="send-btn" onClick={onSend} disabled={!input.trim() || thinking}>
            {thinking ? <Spinner /> : '→'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Task Row Component ───────────────────────────────────────────
function TaskRow({ task, onToggle, onClick, onDelete, compact, showQuadrant }) {
  const isOverdue = task.dueDate && isPast(parseISO(task.dueDate)) && task.status !== 'completed';
  const pri = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;

  return (
    <div className={`task-row ${task.status === 'completed' ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`} onClick={() => onClick && onClick(task)}>
      <button className={`task-check ${task.status === 'completed' ? 'checked' : ''}`} 
        onClick={e => { e.stopPropagation(); onToggle(task); }}>
        {task.status === 'completed' ? '✓' : ''}
      </button>
      <div className="task-info">
        <div className="task-title-row">
          <span className="task-title">{task.title}</span>
          {task.category && <span className="task-category-icon">{CATEGORY_ICONS[task.category] || '📋'}</span>}
        </div>
        {!compact && task.description && <p className="task-desc">{task.description}</p>}
        <div className="task-meta">
          {task.dueDate && (
            <span className={`task-due ${isOverdue ? 'overdue-text' : ''}`}>
              {isOverdue ? '🔴 Overdue: ' : '📅 '}
              {formatDistanceToNow(parseISO(task.dueDate), { addSuffix: true })}
            </span>
          )}
          {task.estimatedMinutes && <span className="task-time">⏱ {task.estimatedMinutes}m</span>}
        </div>
      </div>
      <div className="task-right">
        {showQuadrant && task.quadrant && (
          <span className="quadrant-badge" style={{
            background: QUADRANT_LABELS[task.quadrant]?.bg,
            color: QUADRANT_LABELS[task.quadrant]?.color,
          }}>{QUADRANT_LABELS[task.quadrant]?.label}</span>
        )}
        <span className="priority-dot" style={{ background: pri.dot }} />
        {onDelete && (
          <button className="icon-btn danger" onClick={e => { e.stopPropagation(); onDelete(task.id); }}>×</button>
        )}
      </div>
    </div>
  );
}

// ─── Task Detail Modal ────────────────────────────────────────────
function TaskDetailModal({ task, onClose, onUpdate, onAddSubtask, onDelete }) {
  const [newSubtask, setNewSubtask] = useState('');
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDesc, setEditDesc] = useState(task.description || '');

  const handleSave = () => {
    onUpdate({ title: editTitle, description: editDesc });
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    onAddSubtask(newSubtask.trim());
    setNewSubtask('');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <input className="modal-title-input" value={editTitle} onChange={e => setEditTitle(e.target.value)} onBlur={handleSave} />
          <div className="modal-actions">
            <button className="btn-secondary small" onClick={handleSave}>Save</button>
            <button className="btn-danger small" onClick={onDelete}>Delete</button>
            <button className="icon-btn" onClick={onClose}>×</button>
          </div>
        </div>

        {task.reasoning && (
          <div className="ai-reasoning">
            <span>🧠 AI Analysis:</span> {task.reasoning}
          </div>
        )}

        <div className="modal-grid">
          <div className="modal-field">
            <label>Status</label>
            <select value={task.status} onChange={e => onUpdate({ status: e.target.value })}>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="modal-field">
            <label>Priority</label>
            <select value={task.priority} onChange={e => onUpdate({ priority: e.target.value })}>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="modal-field">
            <label>Due Date</label>
            <input type="datetime-local" value={task.dueDate ? task.dueDate.slice(0, 16) : ''} 
              onChange={e => onUpdate({ dueDate: e.target.value + ':00Z' })} />
          </div>
          <div className="modal-field">
            <label>Estimated (min)</label>
            <input type="number" value={task.estimatedMinutes || 30}
              onChange={e => onUpdate({ estimatedMinutes: parseInt(e.target.value) })} />
          </div>
        </div>

        <div className="modal-field full">
          <label>Description</label>
          <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} onBlur={handleSave} rows={3} />
        </div>

        {/* Subtasks */}
        <div className="subtasks-section">
          <h4>Subtasks {task.subtasks?.length > 0 ? `(${task.subtasks.filter(s => s.completed).length}/${task.subtasks.length})` : ''}</h4>
          {(task.subtasks || []).map(sub => (
            <div key={sub.id} className={`subtask-row ${sub.completed ? 'completed' : ''}`}>
              <input type="checkbox" checked={sub.completed} onChange={() => {
                const updated = task.subtasks.map(s => s.id === sub.id ? { ...s, completed: !s.completed } : s);
                onUpdate({ subtasks: updated });
              }} />
              <span>{sub.title}</span>
            </div>
          ))}
          <div className="add-subtask-row">
            <input placeholder="Add a subtask..." value={newSubtask}
              onChange={e => setNewSubtask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddSubtask()} />
            <button className="btn-primary small" onClick={handleAddSubtask}>+</button>
          </div>
        </div>

        {task.quadrant && (
          <div className="modal-quadrant" style={{ background: QUADRANT_LABELS[task.quadrant]?.bg }}>
            <span style={{ color: QUADRANT_LABELS[task.quadrant]?.color }}>
              Matrix: {QUADRANT_LABELS[task.quadrant]?.label}
            </span>
            {task.priority_score && <span>AI Score: {task.priority_score}/100</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add Task Modal ───────────────────────────────────────────────
function AddTaskModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({ title: '', description: '', dueDate: '', priority: 'medium', category: 'general', estimatedMinutes: 30 });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Task</h2>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>
        <div className="add-form">
          <input className="form-input" placeholder="Task title *" value={form.title} onChange={e => set('title', e.target.value)} autoFocus />
          <textarea className="form-textarea" placeholder="Description (optional)" value={form.description} onChange={e => set('description', e.target.value)} rows={2} />
          <div className="form-row">
            <div className="form-field">
              <label>Due date & time</label>
              <input type="datetime-local" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Estimated time</label>
              <input type="number" placeholder="30" value={form.estimatedMinutes} onChange={e => set('estimatedMinutes', parseInt(e.target.value))} min={5} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option value="critical">🔴 Critical</option>
                <option value="high">🟠 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
            <div className="form-field">
              <label>Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}>
                {Object.entries(CATEGORY_ICONS).map(([k, v]) => <option key={k} value={k}>{v} {k.charAt(0).toUpperCase() + k.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={() => form.title.trim() && onSubmit({ ...form, dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null })}>
              Add Task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add Habit Modal ──────────────────────────────────────────────
function AddHabitModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({ title: '', category: 'health', frequency: 'daily', icon: '⭐' });
  const icons = ['⭐', '🏋️', '📚', '💧', '🧘', '🍎', '✍️', '🎯', '💤', '🚶'];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Habit</h2>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>
        <div className="add-form">
          <input className="form-input" placeholder="Habit name *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
          <div className="icon-picker">
            {icons.map(icon => (
              <button key={icon} className={`icon-option ${form.icon === icon ? 'selected' : ''}`} onClick={() => setForm(f => ({ ...f, icon }))}>
                {icon}
              </button>
            ))}
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="health">Health</option>
                <option value="work">Work</option>
                <option value="learning">Learning</option>
                <option value="personal">Personal</option>
              </select>
            </div>
            <div className="form-field">
              <label>Frequency</label>
              <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={() => form.title.trim() && onSubmit(form)}>Add Habit</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Small Components ─────────────────────────────────────────────
function StatCard({ icon, label, value, color }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: color + '20', color }}>{icon}</div>
      <div><div className="stat-value" style={{ color }}>{value}</div><div className="stat-label">{label}</div></div>
    </div>
  );
}

function EmptyState({ icon, text }) {
  return <div className="empty-state"><span>{icon}</span><p>{text}</p></div>;
}

function Spinner() {
  return <span className="spinner" />;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
