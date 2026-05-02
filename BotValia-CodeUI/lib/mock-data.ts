import { Session, GlobalRuntimeState } from './types';

export const mockGlobalState: GlobalRuntimeState = {
  isReady: true,
  isSocketConnected: true,
  autoRefresh: true,
  connectionState: 'connected',
};

export const mockSessions: Session[] = [
  {
    id: 'sess_01H1X1B8',
    shortId: '01H1X',
    projectName: 'DataAnalyzer',
    title: 'Analyze Q2 Trends',
    workspaceName: 'LocalWorkspace',
    status: 'idle',
    model: 'gemini-3.1-pro',
    startedAt: '2026-05-01T11:30:00Z',
    updatedAt: '2026-05-01T13:29:00Z',
    archived: false,
    messages: [
      {
        id: 'msg_1',
        role: 'user',
        content: 'Please load the CSV and summarize the top 3 trends. Also write a small python snippet to plot it.',
        timestamp: '2026-05-01T13:15:00Z',
      },
      {
        id: 'msg_2',
        role: 'system',
        content: '<internal_thinking>Loading pandas...</internal_thinking>',
        timestamp: '2026-05-01T13:16:00Z',
        isHiddenInternally: true,
      },
      {
        id: 'msg_3',
        role: 'assistant',
        content: 'I have analyzed the CSV. The top 3 trends are:\n1. **Mobile usage increased** by 20%\n2. Weekend engagement dropped\n3. New feature adoption is steady\n\nHere is a data summary table:\n\n| Metric | Q1 | Q2 |\n|---|---|---|\n| Mobile | 50% | 70% |\n| Desktop | 50% | 30% |\n\nAnd here is the requested code snippet with some refactoring:\n```diff\n--- a/utils.py\n+++ b/utils.py\n@@ -1,3 +1,5 @@\n-def plot_trends(df):\n-    df.plot(kind="bar", x="Quarter")\n-    plt.show()\n+def plot_trends(df, title="Trends"):\n+    # Use improved styling\n+    fig, ax = plt.subplots(figsize=(10, 6))\n+    df.plot(kind="bar", x="Quarter", ax=ax, title=title)\n+    plt.tight_layout()\n+    plt.show()\n```\nIt now handles figure sizes properly!',
        timestamp: '2026-05-01T13:20:00Z',
      },
    ],
    swarm: {
      activeTeam: 'Data Team',
      teammates: [
        { id: 'agent_1', name: 'Analyzer', role: 'Data Scientist', status: 'idle', avatarColor: '#3b82f6' },
        { id: 'agent_2', name: 'Scraper', role: 'Data Engineer', status: 'idle', avatarColor: '#10b981' },
      ],
      tasks: [
        { id: 'task_1', description: 'Parse CSV', status: 'completed', assigneeId: 'agent_2' },
        { id: 'task_2', description: 'Extract trends', status: 'completed', assigneeId: 'agent_1' },
      ],
      internalChat: [
        { id: 'ic_1', fromId: 'agent_1', fromName: 'Analyzer', toId: 'agent_2', content: 'Did you finish cleaning the nulls?', timestamp: '2026-05-01T13:16:10Z' },
        { id: 'ic_2', fromId: 'agent_2', fromName: 'Scraper', toId: 'agent_1', content: 'Yes, CSV is ready in memory. Proceeding to hand off.', timestamp: '2026-05-01T13:16:15Z' }
      ],
      threads: [],
      waitingEdges: [],
    },
    events: [
      { id: 'ev_1', timestamp: '2026-05-01T13:15:00Z', type: 'info', message: 'Session started.' },
      { id: 'ev_2', timestamp: '2026-05-01T13:16:00Z', type: 'info', message: 'Tool pandas_read invoked.' },
      { id: 'ev_3', timestamp: '2026-05-01T13:20:00Z', type: 'info', message: 'Reply sent to user.' },
    ],
    messageCount: 3,
    taskCount: 2,
  },
  {
    id: 'sess_01H1X5C9',
    shortId: '01H1Y',
    projectName: 'WebE2E',
    title: 'Login Flow Tests',
    workspaceName: 'LocalWorkspace',
    status: 'running',
    model: 'gemini-3.1-pro',
    startedAt: '2026-05-01T13:00:00Z',
    updatedAt: '2026-05-01T13:29:55Z',
    archived: false,
    messages: [
      {
        id: 'msg_4',
        role: 'user',
        content: 'Write an e2e test for the login flow.',
        timestamp: '2026-05-01T13:00:00Z',
      },
      {
        id: 'msg_5',
        role: 'assistant',
        content: 'Sure, I am writing the playwright test...',
        timestamp: '2026-05-01T13:01:00Z',
      },
      {
        id: 'msg_6',
        role: 'system',
        content: '<command>npx playwright test</command>',
        timestamp: '2026-05-01T13:29:00Z',
        isHiddenInternally: true,
      },
    ],
    swarm: {
      activeTeam: 'QA Automation',
      teammates: [
        { id: 'agent_qa_1', name: 'Tester', role: 'SDET', status: 'working', avatarColor: '#8b5cf6', currentTask: 'Running playwright' },
        { id: 'agent_qa_2', name: 'Writer', role: 'Test Author', status: 'idle', avatarColor: '#f59e0b' },
      ],
      tasks: [
        { id: 'task_qa_1', description: 'Write spec', status: 'completed', assigneeId: 'agent_qa_2' },
        { id: 'task_qa_2', description: 'Execute e2e test', status: 'active', assigneeId: 'agent_qa_1' },
        { id: 'task_qa_3', description: 'Validate log outputs', status: 'pending', assigneeId: 'agent_qa_1' },
        { id: 'task_qa_4', description: 'Cleanup test environment', status: 'pending' },
        { id: 'task_qa_5', description: 'Update documentation with test results', status: 'pending' },
      ],
      internalChat: [
        { id: 'ic_3', fromId: 'agent_qa_2', fromName: 'Writer', content: 'Spec is ready, handing over.', timestamp: '2026-05-01T13:28:00Z' },
        { id: 'ic_4', fromId: 'agent_qa_1', fromName: 'Tester', content: 'Running headless now.', timestamp: '2026-05-01T13:29:00Z' }
      ],
      threads: [],
      waitingEdges: [],
    },
    events: [
      { id: 'ev_4', timestamp: '2026-05-01T13:00:00Z', type: 'info', message: 'Session started.' },
      { id: 'ev_5', timestamp: '2026-05-01T13:29:00Z', type: 'info', message: 'Running playwright.' },
    ],
    messageCount: 3,
    taskCount: 5,
  },
  {
    id: 'sess_01H1Z9D1',
    shortId: '01H1Z',
    projectName: 'WebE2E',
    title: 'Dashboard Feedback',
    workspaceName: 'RemoteDev',
    status: 'waiting',
    model: 'gemini-3.1-flash',
    startedAt: '2026-05-01T13:25:00Z',
    updatedAt: '2026-05-01T13:29:00Z',
    archived: false,
    messages: [
      {
        id: 'msg_7',
        role: 'user',
        content: 'Check out the new design and give me feedback.',
        timestamp: '2026-05-01T13:25:00Z',
      },
      {
        id: 'msg_8',
        role: 'assistant',
        content: 'I need to see the screen. Could you provide a screenshot?',
        timestamp: '2026-05-01T13:26:00Z',
      },
    ],
    swarm: {
      activeTeam: 'Design Team',
      teammates: [
        { id: 'agent_3', name: 'Reviewer', role: 'Design Critic', status: 'idle', avatarColor: '#ec4899' },
      ],
      tasks: [
        { id: 'task_3', description: 'Analyze layout', status: 'pending', assigneeId: 'agent_3' },
      ],
      internalChat: [],
      waitingOn: 'User input (Screenshot)',
      threads: [],
      waitingEdges: [],
    },
    events: [
      { id: 'ev_6', timestamp: '2026-05-01T13:25:00Z', type: 'info', message: 'Session started.' },
      { id: 'ev_7', timestamp: '2026-05-01T13:26:00Z', type: 'warn', message: 'Waiting for user artifact' },
    ],
    messageCount: 2,
    taskCount: 1,
  },
];
