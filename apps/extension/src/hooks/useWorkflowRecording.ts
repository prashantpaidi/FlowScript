import { useState, useCallback, useEffect } from 'react';
import { automationBridge } from '../services/AutomationBridge';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { safeParseUrl } from '@flowscript/utils';

export function useWorkflowRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const linearNodes = useWorkflowStore((s) => s.linearNodes);
  const appendNode = useWorkflowStore((s) => s.appendNode);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);

  const appendInteractionNode = useCallback((interaction: any) => {
    const currentNodes = useWorkflowStore.getState().linearNodes;
    const lastNode = currentNodes[currentNodes.length - 1];
    const subtype = interaction.eventType === 'type' ? 'type' : (interaction.eventType === 'keypress' ? 'pressKey' : 'click');

    // --- Smart Cleanup ---
    if (lastNode && lastNode.type === 'actionNode') {
      const timeDiff = interaction.timestamp - ((lastNode.data as any).timestamp || 0);

      // 1. Deduplicate identical clicks within 1s
      if (lastNode.data.selector === interaction.selector &&
        lastNode.data.subtype === subtype &&
        timeDiff < 1000) {
        return;
      }

      // 2. Handle Label -> Input redundancy
      const selector = (lastNode.data as any)?.selector;
      if (typeof selector === 'string' && selector.toLowerCase().includes('label') &&
        (interaction.selector?.toLowerCase().includes('input') || interaction.selector?.toLowerCase().includes('select')) &&
        timeDiff < 500) {

        updateNodeData(lastNode.id, {
          subtype,
          selector: interaction.selector,
          text: interaction.value || '',
          timestamp: interaction.timestamp,
          coordinates: interaction.coordinates,
          keyData: interaction.keyData
        });
        return;
      }
    }

    const newNodeId = crypto.randomUUID();
    const newNode: any = {
      id: newNodeId,
      type: 'actionNode',
      subtype,
      data: {
        subtype,
        selector: interaction.selector,
        text: interaction.value || '',
        timestamp: interaction.timestamp,
        coordinates: interaction.coordinates,
        keyData: interaction.keyData,
      },
    };

    appendNode(newNode);
  }, [appendNode, updateNodeData]);

  const appendNavigationNode = useCallback((url: string) => {
    const newNodeId = crypto.randomUUID();
    const parsedUrl = safeParseUrl(url);
    const path = parsedUrl ? parsedUrl.pathname : url;

    const newNode: any = {
      id: newNodeId,
      type: 'actionNode',
      subtype: 'wait',
      data: {
        subtype: 'wait',
        delay: 2000,
        description: `Wait for load: ${path}`,
      },
    };

    appendNode(newNode);
  }, [appendNode]);

  const toggleRecording = useCallback(async (forceState?: boolean) => {
    const nextState = forceState !== undefined ? forceState : !isRecording;

    if (nextState) {
      try {
        const [tab] = await automationBridge.queryTabs({ active: true, currentWindow: true });
        if (!tab?.id) return;

        await automationBridge.startRecording(tab.id);
        setIsRecording(true);
        setIsPaused(false);
      } catch (err) {
        console.error('[useWorkflowRecording] Failed to start recording:', err);
      }
    } else {
      try {
        await automationBridge.stopRecording();
        setIsRecording(false);
        setIsPaused(false);
      } catch (err) {
        console.error('[useWorkflowRecording] Failed to stop recording:', err);
      }
    }
  }, [isRecording]);

  useEffect(() => {
    if (isRecording) {
      automationBridge.updateRecordingStatus(linearNodes.length, isPaused).catch((err) => {
        console.warn('[useWorkflowRecording] Failed to update recording status:', err);
      });
    }
  }, [linearNodes.length, isPaused, isRecording]);

  useEffect(() => {
    const cleanup = automationBridge.onMessage((message: any) => {
      if (!isRecording) return;

      if (message.type === 'USER_INTERACTION_EVENT') {
        if (!isPaused) {
          appendInteractionNode(message);
        }
      } else if (message.type === 'NAVIGATION_EVENT') {
        if (!isPaused) {
          appendNavigationNode(message.url);
        }
      } else if (message.type === 'HUD_CONTROL') {
        if (message.action === 'pause') setIsPaused(true);
        else if (message.action === 'resume') setIsPaused(false);
        else if (message.action === 'stop') toggleRecording(false);
      }
    });
    return cleanup;
  }, [isRecording, isPaused, appendInteractionNode, appendNavigationNode, toggleRecording]);

  return {
    isRecording,
    isPaused,
    toggleRecording,
  };
}
