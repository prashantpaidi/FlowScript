import React, { useState, useEffect, useRef } from 'react';

interface HotkeyRecorderProps {
  value: string;
  onChange: (newValue: string) => void;
  placeholder?: string;
}

export function HotkeyRecorder({ value, onChange, placeholder = 'Press keys...' }: HotkeyRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [currentModifiers, setCurrentModifiers] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const modifiers = [];
      if (e.ctrlKey) modifiers.push('ctrl');
      if (e.altKey) modifiers.push('alt');
      if (e.shiftKey) modifiers.push('shift');
      if (e.metaKey) modifiers.push('meta');

      setCurrentModifiers(modifiers);

      const key = e.key.toLowerCase();
      
      // If it's just a modifier key, don't finish yet
      if (['control', 'alt', 'shift', 'meta', 'os', 'command'].includes(key)) {
        return;
      }

      // Format the key correctly
      let keyName = key;
      if (keyName === ' ') keyName = 'space';
      if (keyName === 'escape') {
        setIsRecording(false);
        return;
      }

      const finalHotkey = [...modifiers, keyName].join('+');
      onChange(finalHotkey);
      setIsRecording(false);
      setCurrentModifiers([]);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const modifiers = [];
      if (e.ctrlKey) modifiers.push('ctrl');
      if (e.altKey) modifiers.push('alt');
      if (e.shiftKey) modifiers.push('shift');
      if (e.metaKey) modifiers.push('meta');
      setCurrentModifiers(modifiers);
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsRecording(false);
        setCurrentModifiers([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('click', handleClickOutside);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('click', handleClickOutside);
    };
  }, [isRecording, onChange]);

  const displayValue = isRecording 
    ? (currentModifiers.length > 0 ? currentModifiers.join('+') + '+...' : 'Recording...') 
    : (value || placeholder);


  return (
    <div ref={containerRef} className="relative w-full">
      <button
        onClick={() => setIsRecording(!isRecording)}
        className={`w-full text-left p-2 border border-gray-200 rounded text-xs font-mono transition-all duration-200 ${
          isRecording 
            ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200' 
            : 'bg-gray-50 hover:border-amber-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className={!value && !isRecording ? 'text-gray-400' : 'text-gray-700'}>
            {displayValue}
          </span>
          {isRecording ? (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
          ) : (
            <span className="text-[10px] text-gray-400">Click to record</span>
          )}
        </div>
      </button>
      {isRecording && (
        <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-white border border-amber-200 rounded shadow-lg p-2 text-[10px] text-amber-700 animate-in fade-in slide-in-from-top-1">
          Press any key combination (e.g. Ctrl+Shift+P)
        </div>
      )}
    </div>
  );
}
