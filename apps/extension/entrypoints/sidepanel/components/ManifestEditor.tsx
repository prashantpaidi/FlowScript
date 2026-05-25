import React from 'react';
// Code Editor Imports
import Editor from 'react-simple-code-editor';
// @ts-ignore
import prism from 'prismjs';
import 'prismjs/components/prism-json';
import 'prismjs/themes/prism-tomorrow.css';
import { useManifestValidator } from '../../../src/hooks/useManifestValidator';

interface ManifestEditorProps {
  jsonCode: string;
  onValueChange: (code: string) => void;
}

export function ManifestEditor({ jsonCode, onValueChange }: ManifestEditorProps) {
  const { validationError, validate } = useManifestValidator();

  React.useEffect(() => {
    validate(jsonCode);
  }, [jsonCode, validate]);

  return (
    <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden font-mono text-sm relative">
      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        <Editor
          value={jsonCode}
          onValueChange={onValueChange}
          highlight={(code: string) => prism.highlight(code, prism.languages.json, 'json')}
          padding={10}
          style={{
            fontFamily: '"Fira code", "Fira Mono", monospace',
            fontSize: 12,
            backgroundColor: 'transparent',
            color: '#e2e8f0',
            minHeight: '100%',
          }}
          textareaClassName="outline-none"
        />
      </div>
      {validationError && (
        <div className="absolute bottom-4 left-4 right-4 bg-red-900/90 backdrop-blur text-red-100 p-3 rounded-lg border border-red-500/50 text-xs shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <span className="text-lg">⚠️</span>
          {validationError}
        </div>
      )}
    </div>
  );
}
