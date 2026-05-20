import React, { useState, KeyboardEvent } from 'react';
import { X, Plus } from 'lucide-react';

interface KeywordPillInputProps {
  value: string[];
  onChange: (newValue: string[]) => void;
  placeholder?: string;
  variant?: 'positive' | 'negative';
}

export function KeywordPillInput({
  value = [],
  onChange,
  placeholder = "Add keyword...",
  variant = 'positive'
}: KeywordPillInputProps) {
  const [inputValue, setInputValue] = useState('');

  const addKeyword = (keyword: string) => {
    const trimmed = keyword.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInputValue('');
  };

  const removeKeyword = (keyword: string) => {
    onChange(value.filter((k) => k !== keyword));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKeyword(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeKeyword(value[value.length - 1]);
    }
  };

  const colors = variant === 'positive' 
    ? 'bg-blue-100 text-blue-700 border-blue-200' 
    : 'bg-red-100 text-red-700 border-red-200';

  const inputColors = variant === 'positive'
    ? 'focus-within:ring-blue-500/20'
    : 'focus-within:ring-red-500/20';

  return (
    <div className={`flex flex-wrap items-center gap-1.5 p-1.5 bg-gray-50 border border-gray-200 rounded-lg min-h-[36px] transition-all ${inputColors}`}>
      {value.map((keyword) => (
        <span
          key={keyword}
          className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md border ${colors} animate-in fade-in zoom-in duration-200`}
        >
          {keyword}
          <button
            onClick={() => removeKeyword(keyword)}
            className="hover:bg-black/5 rounded-full p-0.5 transition-colors"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        type="text"
        className="flex-1 min-w-[60px] bg-transparent border-none outline-none text-[10px] font-medium placeholder-gray-400 py-0.5"
        placeholder={value.length === 0 ? placeholder : ""}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addKeyword(inputValue)}
      />
    </div>
  );
}
