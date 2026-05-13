import React from 'react';

export function NodePalette() {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const nodeTypes = [
    { type: 'triggerNode', label: 'Trigger', icon: '⚡', color: 'border-amber-400 bg-amber-50' },
    { type: 'actionNode', label: 'Action', icon: '⚙️', color: 'border-indigo-400 bg-indigo-50' },
    { type: 'scrapeNode', label: 'Scrape', icon: '🔍', color: 'border-purple-400 bg-purple-50' },
    { type: 'conditionalNode', label: 'If/Else', icon: '🔀', color: 'border-purple-400 bg-purple-50' },
    { type: 'saveDataNode', label: 'Save', icon: '💾', color: 'border-blue-400 bg-blue-50' },
    { type: 'outputNode', label: 'Output', icon: '⛳', color: 'border-emerald-400 bg-emerald-50' },
  ];

  return (
    <aside className="w-16 flex flex-col items-center py-4 bg-white border-r border-gray-200 gap-4 flex-shrink-0">
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-2">Build</div>

      {nodeTypes.map((node) => (
        <div
          key={node.type}
          className={`w-12 h-12 flex flex-col items-center justify-center rounded-lg border-2 ${node.color} cursor-grab active:cursor-grabbing hover:scale-105 transition-transform shadow-sm`}
          onDragStart={(event) => onDragStart(event, node.type)}
          draggable
          title={node.label}
        >
          <span className="text-xl">{node.icon}</span>
          <span className="text-[8px] font-bold text-gray-500">{node.label}</span>
        </div>
      ))}
    </aside>
  );
}
