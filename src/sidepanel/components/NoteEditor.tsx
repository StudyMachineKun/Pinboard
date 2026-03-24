import { useState, useRef, useEffect } from 'react';

interface NoteEditorProps {
  value?: string;
  onSave: (note: string) => void;
}

export function NoteEditor({ value, onSave }: NoteEditorProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(value ?? '');
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const save = () => {
    setEditing(false);
    if (text !== (value ?? '')) onSave(text);
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-left w-full text-xs italic text-gray-400 hover:text-gray-600 truncate"
      >
        {value || 'Add a note -- why did you save this?'}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') { setText(value ?? ''); setEditing(false); }
      }}
      placeholder="Add a note -- why did you save this?"
      className="w-full text-xs px-2 py-1 border border-gray-200 rounded focus:border-[#6C5CE7] focus:ring-1 focus:ring-[#6C5CE7]/20 outline-none"
    />
  );
}
