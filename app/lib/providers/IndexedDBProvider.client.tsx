import React, { createContext, useContext, useEffect, useState } from 'react';
import { type IndexedDBContextType } from './types';
import { openDatabase } from '~/lib/persistence';

const IndexedDbContext = createContext<IndexedDBContextType | null>(null);

interface IndexedDBProviderProps {
  children: React.ReactNode;
  databaseName?: string;
  version?: number;
}

export const IndexedDbProvider = ({
  children,
  databaseName = 'YourDatabaseName',
  version = 1,
}: IndexedDBProviderProps) => {
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initDb = async () => {
      try {
        const newDb = await openDatabase(databaseName, version);

        if (!mounted) {
          return;
        }

        if (!newDb) {
          setError('Error opening IndexedDB');
        } else {
          setDb(newDb);
        }
      } catch (err) {
        if (!mounted) {
          return;
        }

        setError(err instanceof Error ? err.message : 'Error opening IndexedDB');
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    // Only initialize IndexedDB in browser environment
    if (typeof window !== 'undefined') {
      initDb();
    }

    return () => {
      mounted = false;

      if (db) {
        db.close();
      }
    };
  }, [databaseName, version]);

  return <IndexedDbContext.Provider value={{ db, isLoading, error }}>{children}</IndexedDbContext.Provider>;
};

// Custom hook to use the IndexedDB context
export function useIndexedDB(): IndexedDBContextType {
  const context = useContext(IndexedDbContext);

  if (context === null) {
    throw new Error('useIndexedDB must be used within an IndexedDBProvider');
  }

  return context;
}
