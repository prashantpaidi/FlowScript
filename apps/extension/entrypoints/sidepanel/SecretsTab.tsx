import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Key, Eye, EyeOff, ShieldCheck } from 'lucide-react';

export function SecretsTab() {
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  useEffect(() => {
    storage.getItem<Record<string, string>>('local:local:secrets')
      .then((res) => {
        if (res) {
          setSecrets(res);
        } else {
          // Seed with the test key as requested for Level 2 verification
          const initialSecrets = { TEST_KEY: 'SuperSecret123' };
          setSecrets(initialSecrets);
          storage.setItem('local:local:secrets', initialSecrets)
            .catch((err) => console.error('Failed to initialize local secrets:', err));
        }
      })
      .catch((err) => console.error('Failed to get local secrets:', err));
  }, []);

  const addSecret = () => {
    if (!newKey.trim() || !newValue.trim()) return;
    const updated = { ...secrets, [newKey.trim()]: newValue.trim() };
    setSecrets(updated);
    storage.setItem('local:local:secrets', updated)
      .catch((err) => console.error('Failed to add secret:', err));
    setNewKey('');
    setNewValue('');
  };

  const deleteSecret = (key: string) => {
    const updated = { ...secrets };
    delete updated[key];
    setSecrets(updated);
    storage.setItem('local:local:secrets', updated)
      .catch((err) => console.error('Failed to delete secret:', err));
  };

  const toggleVisibility = (key: string) => {
    setShowValues(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="mb-2">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <ShieldCheck className="text-indigo-600" size={20} />
          Secrets Store
        </h2>
        <p className="text-xs text-gray-500">
          Manage sensitive keys for your workflows. These are stored locally in your browser.
        </p>
      </div>

      {/* Add Secret Form */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Key Name</label>
            <input
              type="text"
              placeholder="e.g. OPENAI_API_KEY"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Value</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
            />
          </div>
        </div>
        <button
          onClick={addSecret}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2"
        >
          <Plus size={14} /> Add Secret
        </button>
      </div>

      {/* Secrets List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {Object.keys(secrets).length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-gray-100 rounded-xl">
            <Key size={32} className="mx-auto text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">No secrets stored yet.</p>
          </div>
        ) : (
          Object.entries(secrets).map(([key, value]) => (
            <div key={key} className="bg-white p-3 rounded-lg border border-gray-200 flex items-center justify-between group hover:border-indigo-200 transition-colors">
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-bold text-gray-700 truncate">{key}</span>
                <span className="text-[10px] font-mono text-gray-400 truncate">
                  {showValues[key] ? value : '••••••••••••••••'}
                </span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => toggleVisibility(key)}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                  title={showValues[key] ? "Hide" : "Show"}
                >
                  {showValues[key] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button 
                  onClick={() => deleteSecret(key)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
