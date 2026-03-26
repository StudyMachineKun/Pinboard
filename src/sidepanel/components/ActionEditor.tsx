import { useState, useRef, useEffect } from 'react';
import type { Action } from '../../storage/models';

interface ActionEditorProps {
  action?: Action;
  onSave: (action: Action | undefined) => void;
  onToggle: (completed: boolean) => void;
}

export function ActionEditor({ action, onSave, onToggle }: ActionEditorProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(action?.text ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(action?.text ?? '');
  }, [action?.text]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const save = () => {
    setEditing(false);
    const trimmed = text.trim();
    if (trimmed) {
      onSave({ text: trimmed, completed: action?.completed ?? false });
    } else if (action) {
      onSave(undefined);
    }
  };

  if (action && !editing) {
    return (
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={action.completed}
          onChange={(e) => onToggle(e.target.checked)}
          className="rounded accent-[#6C5CE7]"
        />
        <span
          onClick={() => setEditing(true)}
          className={`cursor-pointer ${action.completed ? 'line-through text-gray-400' : 'text-gray-600 hover:text-gray-800'}`}
        >
          {action.text}
        </span>
      </label>
    );
  }

  if (!editing && !action) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-left w-full text-xs italic text-gray-400 hover:text-gray-600"
      >
        Add an action -- what's your next step?
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400 text-xs">&#9744;</span>
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') { setText(action?.text ?? ''); setEditing(false); }
        }}
        placeholder="What's your next step?"
        className="flex-1 text-xs px-2 py-1 border border-gray-200 rounded focus:border-[#6C5CE7] focus:ring-1 focus:ring-[#6C5CE7]/20 outline-none"
      />
    </div>
  );
}
