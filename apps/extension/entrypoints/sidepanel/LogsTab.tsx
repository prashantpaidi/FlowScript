import { useState, useEffect } from 'react';

interface LogEntry {
  timestamp: number;
  message: string;
}

export function LogsTab() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    storage.getItem<LogEntry[]>('local:logs').then((res) => {
      if (res) setLogs(res);
    });

    const unwatchLogs = storage.watch<LogEntry[]>('local:logs', (newVal) => {
      if (newVal) setLogs(newVal);
    });

    return () => {
      unwatchLogs();
    };
  }, []);

  const clearLogs = () => {
    storage.setItem('local:logs', []);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 tracking-wide uppercase">Activity Logs</h2>
        {logs.length > 0 && (
          <button onClick={clearLogs} className="text-xs font-medium text-gray-500 hover:text-red-600 transition-colors uppercase tracking-wider bg-gray-100 hover:bg-red-50 px-2 py-1 rounded">
            Clear
          </button>
        )}
      </div>

      {logs.length === 0 ? (
        <div className="bg-white p-6 rounded-xl border border-gray-200 border-dashed text-center flex-1">
          <p className="text-sm text-gray-500 italic mt-4">No activity yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex-1 overflow-y-auto custom-scrollbar p-1">
          <div className="divide-y divide-gray-100">
            {logs.map((log, idx) => (
              <div key={idx} className="p-3 hover:bg-gray-50 transition-colors text-xs flex flex-col gap-1">
                <div className="text-gray-400 font-mono text-[10px] uppercase tracking-wider">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <div className="text-gray-700 font-medium leading-relaxed">{log.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
