import { useState, useEffect } from 'react';
import { LogsTab } from './LogsTab';
import { WorkflowsTab } from './WorkflowsTab';
import { Workflow } from '../../nodes/types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'workflows' | 'logs'>('workflows');

  useEffect(() => {
    // Seed local:workflows storage key on extension load
    storage.getItem<Workflow[]>('local:workflows').then((res) => {
      if (!res) {
        storage.setItem('local:workflows', []);
      }
    });
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans">
      <div className="p-4 pb-0 flex-shrink-0">
        <h1 className="text-2xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Flowscript
        </h1>
        
        <div className="flex space-x-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('workflows')}
            className={`px-1 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'workflows'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Workflows
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-1 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'logs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Logs
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-hidden relative">
        {activeTab === 'workflows' && <WorkflowsTab />}
        {activeTab === 'logs' && <LogsTab />}
      </div>
    </div>
  );
}
