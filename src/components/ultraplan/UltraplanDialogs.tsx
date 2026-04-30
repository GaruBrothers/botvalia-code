import { randomUUID } from 'crypto';
import * as React from 'react';
import { Box, Text } from '../../ink.js';
import type { AppState } from '../../state/AppStateStore.js';
import { useSetAppState } from '../../state/AppState.js';
import type { Message } from '../../types/message.js';
import { createAssistantMessage, createSystemMessage } from '../../utils/messages.js';
import { archiveRemoteSession } from '../../utils/teleport.js';
import { updateTaskState } from '../../utils/task/framework.js';
import type { RemoteAgentTaskState } from '../../tasks/RemoteAgentTask/RemoteAgentTask.js';
import { Select } from '../CustomSelect/select.js';
import { PermissionDialog } from '../permissions/PermissionDialog.js';
import { logForDebugging } from '../../utils/debug.js';

type UltraplanChoice = 'continue-here' | 'new-session' | 'dismiss';
type LaunchChoice = 'launch' | 'cancel';

type UltraplanChoiceDialogProps = {
  plan: string;
  sessionId: string;
  taskId: string;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  readFileState: unknown;
  getAppState: () => AppState;
  setConversationId: React.Dispatch<React.SetStateAction<string>>;
};

type UltraplanLaunchDialogProps = {
  onChoice: (
    choice: LaunchChoice,
    opts?: {
      disconnectedBridge?: boolean;
    },
  ) => void;
};

const PLAN_PREVIEW_MAX_LINES = 16;

function previewPlan(plan: string): string {
  const lines = plan.trim().split(/\r?\n/);
  if (lines.length <= PLAN_PREVIEW_MAX_LINES) return lines.join('\n');
  return `${lines.slice(0, PLAN_PREVIEW_MAX_LINES).join('\n')}\n\n…`;
}

function finalizeUltraplanChoice(
  taskId: string,
  sessionId: string,
  setAppState: ReturnType<typeof useSetAppState>,
): void {
  updateTaskState<RemoteAgentTaskState>(taskId, setAppState, task =>
    task.status !== 'running'
      ? task
      : {
          ...task,
          status: 'completed',
          endTime: Date.now(),
        },
  );
  setAppState(prev => ({
    ...prev,
    ultraplanPendingChoice:
      prev.ultraplanPendingChoice?.taskId === taskId
        ? undefined
        : prev.ultraplanPendingChoice,
    ultraplanSessionUrl: undefined,
  }));
  void archiveRemoteSession(sessionId).catch(error => {
    logForDebugging(`ultraplan archive failed after choice: ${String(error)}`);
  });
}

function buildImportedPlanMessages(plan: string): Message[] {
  return [
    createSystemMessage(
      'Ultraplan approved plan imported from BotValia Code on the web.',
      'info',
    ),
    createAssistantMessage({
      content: `Approved ultraplan plan:\n\n${plan}`,
    }),
  ];
}

export function UltraplanChoiceDialog({
  plan,
  sessionId,
  taskId,
  setMessages,
  readFileState: _readFileState,
  getAppState: _getAppState,
  setConversationId,
}: UltraplanChoiceDialogProps): React.ReactNode {
  const setAppState = useSetAppState();
  const planPreview = React.useMemo(() => previewPlan(plan), [plan]);

  function handleChoice(choice: UltraplanChoice): void {
    switch (choice) {
      case 'continue-here':
        setMessages(prev => [...prev, ...buildImportedPlanMessages(plan)]);
        finalizeUltraplanChoice(taskId, sessionId, setAppState);
        return;
      case 'new-session':
        setConversationId(randomUUID());
        setMessages(buildImportedPlanMessages(plan));
        finalizeUltraplanChoice(taskId, sessionId, setAppState);
        return;
      case 'dismiss':
        setMessages(prev => [
          ...prev,
          createSystemMessage(
            'Ultraplan plan dismissed. You can relaunch it later with /ultraplan.',
            'info',
          ),
        ]);
        finalizeUltraplanChoice(taskId, sessionId, setAppState);
        return;
    }
  }

  return (
    <PermissionDialog title="Ultraplan Plan Ready">
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Box marginBottom={1}>
          <Text dimColor>
            A remote planning session finished and sent back an approved plan.
          </Text>
        </Box>
        <Box marginBottom={1} flexDirection="column">
          <Text bold>Preview</Text>
          <Text>{planPreview}</Text>
        </Box>
        <Box>
          <Select
            options={[
              {
                label: 'Continue in this session',
                value: 'continue-here',
                description: 'Append the approved plan to the current transcript.',
              },
              {
                label: 'Start a fresh session',
                value: 'new-session',
                description: 'Reset the transcript and carry the plan into a new conversation.',
              },
              {
                label: 'Dismiss',
                value: 'dismiss',
                description: 'Close the remote session without importing the plan.',
              },
            ]}
            onChange={value => handleChoice(value)}
            onCancel={() => handleChoice('dismiss')}
            layout="compact-vertical"
          />
        </Box>
      </Box>
    </PermissionDialog>
  );
}

export function UltraplanLaunchDialog({
  onChoice,
}: UltraplanLaunchDialogProps): React.ReactNode {
  return (
    <PermissionDialog title="Launch Ultraplan">
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Box marginBottom={1}>
          <Text dimColor>
            This opens a remote BotValia Code on the web planning session and
            returns the approved plan here when it is ready.
          </Text>
        </Box>
        <Box>
          <Select
            options={[
              {
                label: 'Launch remote planning session',
                value: 'launch',
                description: 'Start the remote planning flow now.',
              },
              {
                label: 'Cancel',
                value: 'cancel',
                description: 'Keep working locally for now.',
              },
            ]}
            onChange={value => onChoice(value)}
            onCancel={() => onChoice('cancel')}
            layout="compact-vertical"
          />
        </Box>
      </Box>
    </PermissionDialog>
  );
}
