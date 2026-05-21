import { useState, useEffect } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Play, 
  Clock, 
  Trash2, 
  FileText
} from 'lucide-react';

interface LogEntry {
  timestamp: number;
  message: string;
  isError?: boolean;
}

interface IterationGroup {
  name: string;
  status: 'success' | 'failure' | 'running';
  logs: LogEntry[];
}

interface WorkflowRunLog {
  id: string;
  workflowId: string;
  workflowName: string;
  timestamp: number;
  status: 'success' | 'failure' | 'running' | 'stopped';
  iterations: IterationGroup[];
}

export function LogsTab() {
  const [runs, setRuns] = useState<WorkflowRunLog[]>([]);
  const [expandedRuns, setExpandedRuns] = useState<Record<string, boolean>>({});
  const [expandedIterations, setExpandedIterations] = useState<Record<string, boolean>>({});

  useEffect(() => {
    storage.getItem<WorkflowRunLog[]>('local:workflowRunLogs')
      .then((res) => {
        if (res) {
          setRuns(res);
          // Expand the first run automatically if it is running or if there's only one
          if (res.length > 0) {
            setExpandedRuns({ [res[0].id]: true });
            if (res[0].iterations.length > 0) {
              const firstIterKey = `${res[0].id}-${res[0].iterations[0].name}`;
              setExpandedIterations({ [firstIterKey]: true });
            }
          }
        }
      })
      .catch((err) => console.error('Failed to load workflow run logs:', err));

    const unwatch = storage.watch<WorkflowRunLog[]>('local:workflowRunLogs', (newVal) => {
      if (newVal) {
        setRuns(newVal);
      }
    });

    return () => {
      unwatch();
    };
  }, []);

  const clearLogs = () => {
    storage.setItem('local:workflowRunLogs', []).catch((err) => console.error('Failed to clear workflowRunLogs:', err));
    storage.setItem('local:logs', []).catch((err) => console.error('Failed to clear logs:', err));
  };

  const toggleRun = (runId: string) => {
    setExpandedRuns((prev) => ({ ...prev, [runId]: !prev[runId] }));
  };

  const toggleIteration = (key: string) => {
    setExpandedIterations((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getRunStatusIcon = (status: WorkflowRunLog['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failure':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'stopped':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'running':
        return (
          <div className="relative flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <Play className="relative inline-flex rounded-full h-3.5 w-3.5 text-blue-500 fill-blue-500 m-auto" />
          </div>
        );
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getIterationStatusIcon = (status: IterationGroup['status']) => {
    switch (status) {
      case 'success':
        return <div className="w-2 h-2 rounded-full bg-green-500" />;
      case 'failure':
        return <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />;
      case 'running':
        return <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />;
      default:
        return <div className="w-2 h-2 rounded-full bg-gray-400" />;
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Header */}
      <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-700 tracking-wide uppercase flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-500" />
          Activity Logs
        </h2>
        {runs.length > 0 && (
          <button
            onClick={clearLogs}
            className="text-[10px] font-bold text-gray-500 hover:text-red-600 transition-colors uppercase tracking-wider bg-gray-100 hover:bg-red-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1 border border-gray-200 hover:border-red-100 shadow-sm cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear All
          </button>
        )}
      </div>

      {/* Runs Log List */}
      {runs.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-gray-200 border-dashed text-center flex-1 flex flex-col justify-center items-center">
          <FileText className="w-8 h-8 text-gray-300 stroke-1 mb-2" />
          <p className="text-sm text-gray-500 font-medium">No workflow runs yet.</p>
          <p className="text-xs text-gray-400 mt-1 max-w-[200px]">Run a workflow to view execution step details and iteration progress here.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
          {runs.map((run) => {
            const isRunExpanded = !!expandedRuns[run.id];
            return (
              <div key={run.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-300">
                {/* Run Header */}
                <div
                  onClick={() => toggleRun(run.id)}
                  className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 select-none border-b border-gray-100"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {getRunStatusIcon(run.status)}
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-gray-800 truncate">{run.workflowName}</span>
                      <span className="text-[10px] text-gray-400 font-medium mt-0.5">
                        {new Date(run.timestamp).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="text-gray-400">
                    {isRunExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </div>

                {/* Run Content (Iterations) */}
                {isRunExpanded && (
                  <div className="bg-gray-50/50 p-2.5 space-y-2 border-t border-gray-50">
                    {run.iterations.map((iter) => {
                      const iterKey = `${run.id}-${iter.name}`;
                      const isIterExpanded = !!expandedIterations[iterKey];
                      const isError = iter.status === 'failure';
                      return (
                        <div
                          key={iter.name}
                          className={`rounded-lg border bg-white overflow-hidden transition-all ${
                            isError ? 'border-red-100 shadow-sm shadow-red-50/50' : 'border-gray-100'
                          }`}
                        >
                          {/* Iteration Header */}
                          <div
                            onClick={() => toggleIteration(iterKey)}
                            className={`p-2.5 flex items-center justify-between cursor-pointer select-none transition-colors ${
                              isError ? 'hover:bg-red-50/20 bg-red-50/5' : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {getIterationStatusIcon(iter.status)}
                              <span className={`text-[11px] font-bold ${isError ? 'text-red-700' : 'text-gray-700'}`}>
                                {iter.name}
                              </span>
                            </div>
                            <div className={isError ? 'text-red-400' : 'text-gray-400'}>
                              {isIterExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </div>
                          </div>

                          {/* Iteration Logs */}
                          {isIterExpanded && (
                            <div className="px-3 pb-3 pt-1 border-t border-gray-50 divide-y divide-gray-50 bg-white">
                              {iter.logs.map((log, lIdx) => (
                                <div key={lIdx} className="py-2 text-[11px] leading-relaxed flex items-start gap-2.5 animate-in fade-in duration-200">
                                  <span className="text-[9px] text-gray-400 font-mono mt-0.5 flex-shrink-0">
                                    {new Date(log.timestamp).toLocaleTimeString(undefined, {
                                      hour12: false,
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit'
                                    })}
                                  </span>
                                  <span className={`${log.isError ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                                    {log.message}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
