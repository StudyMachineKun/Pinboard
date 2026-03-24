import { useState, useRef, useCallback, useEffect } from 'react';
import { Document, type DocumentData } from 'flexsearch';
import { db } from '../../storage/db';
import type { SavedItem } from '../../storage/models';

function toDocumentData(item: SavedItem): DocumentData {
  return {
    id: item.id,
    contentPlain: item.contentPlain,
    note: item.note ?? '',
    'action.text': item.action?.text ?? '',
    tags: item.tags.join(' '),
  };
}

export function useSearch() {
  const indexRef = useRef(
    new Document({
      document: {
        id: 'id',
        index: ['contentPlain', 'note', 'action.text', 'tags'],
      },
      tokenize: 'forward',
    })
  );

  const [results, setResults] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  const buildIndex = useCallback(async () => {
    const items = await db.savedItems.toArray();
    for (const item of items) {
      indexRef.current.add(item.id, toDocumentData(item));
    }
  }, []);

  useEffect(() => {
    buildIndex();
  }, [buildIndex]);

  const search = useCallback((q: string) => {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const searchResults = indexRef.current.search(q, { limit: 50 });
    const ids = new Set<string>();
    for (const result of searchResults) {
      for (const id of result.result) {
        ids.add(String(id));
      }
    }
    setResults([...ids]);
  }, []);

  const addToIndex = useCallback((item: SavedItem) => {
    indexRef.current.add(item.id, toDocumentData(item));
  }, []);

  const updateInIndex = useCallback((item: SavedItem) => {
    indexRef.current.update(item.id, toDocumentData(item));
  }, []);

  const removeFromIndex = useCallback((id: string) => {
    indexRef.current.remove(id);
  }, []);

  return { results, query, search, addToIndex, updateInIndex, removeFromIndex };
}
