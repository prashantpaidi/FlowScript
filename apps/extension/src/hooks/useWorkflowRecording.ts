import { useState, useCallback, useEffect } from 'react';
import { type Node } from '@xyflow/react';
import { automationBridge } from '../services/AutomationBridge';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { safeParseUrl } from '@flowscript/utils';

export function useWorkflowRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const nodes = useWorkflowStore((s) => s.nodes);
  const addNode = useWorkflowStore((s) => s.addNode);
  const setEdges = useWorkflowStore((s) => s.setEdges);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const removeNode = useWorkflowStore((s) => s.removeNode);

  const appendInteractionNode = useCallback((interaction: any) => {
    const currentNodes = useWorkflowStore.getState().nodes;
    const lastNode = currentNodes[currentNodes.length - 1];

    // --- Smart Cleanup ---
    if (lastNode && lastNode.type === 'actionNode') {
      const timeDiff = interaction.timestamp - ((lastNode.data as any).timestamp || 0);

      // 1. Deduplicate identical clicks within 1s
      if (lastNode.data.selector === interaction.selector &&
        lastNode.data.subtype === (interaction.eventType === 'type' ? 'type' : (interaction.eventType === 'keypress' ? 'pressKey' : 'click')) &&
        timeDiff < 1000) {
        return;
      }

      // 2. Handle Label -> Input redundancy
      const selector = (lastNode.data as any)?.selector;
      if (typeof selector === 'string' && selector.toLowerCase().includes('label') &&
        (interaction.selector?.toLowerCase().includes('input') || interaction.selector?.toLowerCase().includes('select')) &&
        timeDiff < 500) {

        updateNodeData(lastNode.id, {
          subtype: interaction.eventType === 'type' ? 'type' : (interaction.eventType === 'keypress' ? 'pressKey' : 'click'),
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
    let position = { x: 100, y: 100 };
    if (lastNode) {
      position = {
        x: lastNode.position.x + 250,
        y: lastNode.position.y
      };
    }

    const newNode: Node = {
      id: newNodeId,
      type: 'actionNode',
      position,
      data: {
        subtype: interaction.eventType === 'type' ? 'type' : (interaction.eventType === 'keypress' ? 'pressKey' : 'click'),
        selector: interaction.selector,
        text: interaction.value || '',
        timestamp: interaction.timestamp,
        coordinates: interaction.coordinates,
        keyData: interaction.keyData,
      },
    };

    addNode(newNode);

    if (lastNode) {
      setEdges((eds) => [
        ...eds,
        {
          id: `e-${lastNode.id}-${newNodeId}`,
          source: lastNode.id,
          target: newNodeId,
        }
      ]);
    }
  }, [nodes, addNode, setEdges, updateNodeData]);

  const appendNavigationNode = useCallback((url: string) => {
    const currentNodes = useWorkflowStore.getState().nodes;
    const lastNode = currentNodes[currentNodes.length - 1];
    const newNodeId = crypto.randomUUID();

    let position = { x: 100, y: 100 };
    if (lastNode) {
      position = { x: lastNode.position.x + 250, y: lastNode.position.y };
    }

    const parsedUrl = safeParseUrl(url);
    const path = parsedUrl ? parsedUrl.pathname : url;

    const newNode: Node = {
      id: newNodeId,
      type: 'actionNode',
      position,
      data: {
        subtype: 'wait',
        delay: 2000,
        description: `Wait for load: ${path}`,
      },
    };

    addNode(newNode);

    if (lastNode) {
      setEdges((eds) => [
        ...eds,
        {
          id: `e-${lastNode.id}-${newNodeId}`,
          source: lastNode.id,
          target: newNodeId,
        }
      ]);
    }
  }, [nodes, addNode, setEdges]);

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
      automationBridge.updateRecordingStatus(nodes.length, isPaused).catch((err) => {
        console.warn('[useWorkflowRecording] Failed to update recording status:', err);
      });
    }
  }, [nodes.length, isPaused, isRecording]);

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
