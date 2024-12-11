import { useCallback, useEffect, useState } from 'react';
import { useIndexedDB } from '~/lib/providers/IndexedDBProvider.client';
import type { FilterItem } from '~/components/settings/filters/types';
import type { FileMap } from '~/lib/stores/files';
import type { Message } from 'ai';
import { z } from 'zod';
export interface FilterRequestObject {
  files: FileMap;
  messages: Message[];
  systemPrompt: string;
  inputs: Record<string, number | string>;
}

export const middlewareSchema = z.object({
  inputs: z
    .array(
      z.object({
        name: z.string(),
        label: z.string(),
        type: z.enum(['number', 'text']),
        value: z.union([z.string(), z.number()]).optional(),
      }),
    )
    .optional(),
  filter: z
    .function()
    .args(z.any()) // accepts an arbitrary number of arguments
    .returns(
      z
        .promise(
          z.object({
            response: z.string().optional(),
          }),
        )
        .optional(),
    ),
});

export type IMiddleware = z.infer<typeof middlewareSchema>;

/*
 * export interface IMiddleware {
 *   inputs?:{
 *     name:string,
 *     type:'number'
 *   }[]
 *   filter: (reqbj: any) => Promise<{ response?: string } | undefined>;
 * }
 */

const getAllFilters = async (db: IDBDatabase) => {
  return new Promise<FilterItem[]>((resolve, reject) => {
    const transaction = db.transaction('filters', 'readonly');
    const store = transaction.objectStore('filters');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as FilterItem[]);
    request.onerror = () => reject(request.error);
  });
};

const addFilterToDB = async (db: IDBDatabase, filter: FilterItem) => {
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('filters', 'readwrite');
    const store = transaction.objectStore('filters');
    const request = store.put({
      ...filter,
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const updateOrderInDB = async (db: IDBDatabase, items: FilterItem[]) => {
  const oldItems: FilterItem[] = await getAllFilters(db);
  const idsInOrder = items.map((item) => item.id);
  await Promise.all(
    idsInOrder.map(async (id, index) => {
      const item = oldItems.find((item) => item.id === id);

      if (item) {
        item.order = index;
        await addFilterToDB(db, item);
      }
    }),
  );
};

const deleteFilterFromDB = async (db: IDBDatabase, filterId: number) => {
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('filters', 'readwrite');
    const store = transaction.objectStore('filters');
    const request = store.delete(filterId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const importModuleFromString = async (stringOfCode: string) => {
  // Create a Blob from the module code
  const blob = new Blob([stringOfCode], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);

  // Dynamically import the module
  const module: IMiddleware = await import(blobUrl);

  return {
    module,
    cleanup: () => {
      URL.revokeObjectURL(blobUrl);
    },
  };
};

export function useFilters() {
  const { db, error: dbError } = useIndexedDB();
  const [filters, setFilters] = useState<FilterItem[]>([]);
  const [error, setError] = useState<string>();
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    if (!db && dbError) {
      setError(dbError);
      setIsReady(false);

      return;
    }

    if (!db) {
      return;
    } //wait for the db to initialize

    setIsReady(true);
    getAllFilters(db).then((newFilters) => {
      newFilters.sort((a, b) => a.order - b.order);
      setFilters(newFilters);
    });
  }, [db, dbError]);

  const addFilter = useCallback(
    async (filter: FilterItem) => {
      if (!isReady) {
        return;
      }

      if (!db) {
        return;
      }

      await addFilterToDB(db, { ...filter, order: filters.length });

      const newFilters = await getAllFilters(db);
      newFilters.sort((a, b) => a.order - b.order);
      setFilters(newFilters);
    },
    [db, isReady, filters],
  );

  const editFilter = useCallback(
    async (filter: FilterItem) => {
      if (!isReady) {
        return;
      }

      if (!db) {
        return;
      }

      await addFilterToDB(db, { ...filter });

      const newFilters = await getAllFilters(db);
      newFilters.sort((a, b) => a.order - b.order);
      setFilters(newFilters);
    },
    [db, isReady, filters],
  );

  const deleteFilter = useCallback(
    async (filterId: number) => {
      if (!isReady) {
        return;
      }

      if (!db) {
        return;
      }

      await deleteFilterFromDB(db, filterId);

      const newFilters = await getAllFilters(db);
      newFilters.sort((a, b) => a.order - b.order);
      setFilters(newFilters);
    },
    [db, isReady],
  );
  const updateOrder = useCallback(
    async (items: FilterItem[]) => {
      if (!isReady) {
        return;
      }

      if (!db) {
        return;
      }

      await updateOrderInDB(db, items);

      const newFilters = await getAllFilters(db);
      newFilters.sort((a, b) => a.order - b.order);
      setFilters(newFilters);
    },
    [db, isReady],
  );

  const executeFilterChain = useCallback(
    async (reqbj: FilterRequestObject) => {
      const enabledFilters = filters.filter((x) => x.enabled);

      for (let i = 0; i < enabledFilters.length; i++) {
        const filter = filters[i];
        const { module, cleanup } = await importModuleFromString(filter.content);

        // prepare and parse user filter configuration inputs
        const inputs: Record<string, string | number> = {};
        (filter.inputs || []).forEach((input) => {
          if (!input.value) {
            return;
          }

          const type = input.type;
          let value = input.value;

          if (type == 'number') {
            try {
              value = parseFloat(`${input.value || '0'}`);
            } catch (error: any) {
              console.warn('Failed to parse filter input', input, error.message);
            }
          }

          inputs[input.name] = value;
        });
        reqbj.inputs = inputs;

        const resp = await module.filter(reqbj);

        if (resp?.response) {
          cleanup();
          return resp;
        }

        cleanup();
      }

      return {};
    },
    [filters],
  );

  return { isReady, error, filters, addFilter, editFilter, deleteFilter, updateOrder, executeFilterChain };
}
