import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { FilterItem } from './types';
import { FilterCard } from './FilterCard';
import * as Dialog from '@radix-ui/react-dialog';
import Button from '~/components/ui/Button';
import { motion } from 'framer-motion';
import { dialogBackdropVariants, dialogVariants } from '~/components/ui/Dialog';
import { classNames } from '~/utils/classNames';
import TextBox from '~/components/ui/TextBox';
import FilterEditor from './FilterEditor';
import { toast } from 'react-toastify';
import { importModuleFromString, middlewareSchema } from '~/lib/hooks/useFilters';

interface FilterListProps {
  listItems: FilterItem[];
  onFilterOrderChange?: (items: FilterItem[]) => void;
  onFilterUpdate?: (item: FilterItem) => void;
  onFilterDelete?: (id: number) => void;
  onFilterCreate?: (item: FilterItem) => void;
}

const initialCode = `
/**
 * The 'filter' function acts as a middleware processor in a chain of operations,
 * taking a request object and optionally returning a response. If a response is returned,
 * it short-circuits the chain. If no response is returned (undefined), the chain continues.
 *
 * @param {Object} filterReqObj - The request object containing various internal API interfaces
 * @param {Object} filterReqObj.webcontainer - WebContainer instance for file system operations
 * @param {Object} filterReqObj.files - Access to the file system and file operations
 * @param {string} filterReqObj.systemPrompt - The current system prompt being used
 * @param {Object} filterReqObj.workbenchStore - Access to the workbench state and operations
 * @param {Object} filterReqObj.llmClient - Interface for making direct LLM calls
 * 
 * @returns {Object|undefined} Response object or undefined
 * @returns {string} [response.respond] - If present, short-circuits the chain and uses this as direct response
 *                                       If not present (undefined returned), continues to next middleware
 * 
 * @example
 * // Example 1: Pass through to next middleware
 * export function filter(filterReqObj) {
 *     return undefined; // or just return;
 * }
 * 
 * @example
 * // Example 2: Modify request and continue
 * export function filter(filterReqObj) {
 *     filterReqObj.systemPrompt += "\\nAdditional context";
 *     return undefined; // continue to next middleware
 * }
 * 
 * @example
 * // Example 3: Short circuit with direct response
 * export function filter(filterReqObj) {
 *     if (someCondition) {
 *         return {
 *             respond: "Direct response without continuing chain"
 *         };
 *     }
 *     return undefined; // continue if condition not met
 * }
 * 
 * @example
 * // Example 4: Make direct LLM call and short circuit
 * export function filter(filterReqObj) {
 *     const response = await filterReqObj.llmClient.call("Custom prompt");
 *     return {
 *         respond: response
 *     };
 * }
 */
export async function filter(filterReqObj) {
    return; // Continue to next middleware
}
`;

const FilterList = ({
  listItems,
  onFilterOrderChange,
  onFilterUpdate,
  onFilterDelete,
  onFilterCreate,
}: FilterListProps) => {
  const [items, setItems] = useState<FilterItem[]>(listItems);
  const [isCreating, setIsCreating] = useState(false);
  const [draggedItem, setDraggedItem] = useState<FilterItem | null>(null);
  const [editingItem, setEditingItem] = useState<FilterItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editContent, setEditContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragStart = (e: any, item: FilterItem) => {
    setDraggedItem(item);
    e.target.classList.add('bg-blue-100');
  };

  const handleDragEnter = (e: React.DragEvent, targetItem: FilterItem) => {
    e.preventDefault();

    if (!draggedItem || targetItem.id === draggedItem.id) {
      return;
    }

    setItems((prevItems) => {
      const newItems = [...prevItems];
      const draggedIndex = newItems.findIndex((item) => item.id === draggedItem.id);
      const targetIndex = newItems.findIndex((item) => item.id === targetItem.id);

      const [draggedItemContent] = newItems.splice(draggedIndex, 1);
      newItems.splice(targetIndex, 0, draggedItemContent);

      return newItems;
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('bg-blue-100');
    setDraggedItem(null);
    onFilterOrderChange?.(items);
  };

  const handleEdit = (item: FilterItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditContent(item.content);
  };

  const handleSaveEdit = async () => {
    if (editName.length === 0) {
      toast.error('Please enter a name for the filter');
      return;
    }

    if (editContent.length === 0) {
      toast.error('Please enter a content for the filter');
      return;
    }

    try {
      const { module: filterModule, cleanup } = await importModuleFromString(editContent);
      const module = middlewareSchema.parse(filterModule);
      const inputs = module.inputs;

      if (isCreating) {
        const newId = Math.max(...items.map((item) => item.id), 0) + 1;
        const newItem: FilterItem = { id: newId, inputs, name: editName, content: editContent, order: items.length };
        onFilterCreate?.(newItem);
        setItems((prevItems) => [...prevItems, newItem]);
      } else if (editingItem) {
        const updatedItem = { ...editingItem, name: editName, content: editContent, inputs };
        onFilterUpdate?.(updatedItem);
        setItems((prevItems) => prevItems.map((item) => (item.id === editingItem.id ? updatedItem : item)));
      }

      cleanup();
    } catch (err: any) {
      toast.error('Please enter a valid content for the filter', err.message);
      return;
    }

    handleCloseDialog();
  };

  const handleCloseDialog = () => {
    setEditingItem(null);
    setIsCreating(false);
    setEditName('');
    setEditContent('');
  };

  const handleDelete = (id: number) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== id));
    onFilterDelete?.(id);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditName('');
    setEditContent(initialCode);
  };

  const handleEditInput = (id: number, inputs: FilterItem['inputs']) => {
    const fountItem = items.find((item) => item.id === id);

    if (!fountItem) {
      return;
    }

    const newItem = { ...fountItem, inputs: [...(inputs || [])] };
    setItems((prevItems) => prevItems.map((item) => (item.id === newItem.id ? newItem : item)));
    onFilterUpdate?.(newItem);
  };
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedData = JSON.parse(content) as FilterItem;

        // Validate the imported data structure
        const isValid = [importedData].every(
          (item) =>
            typeof item.id === 'number' &&
            typeof item.name === 'string' &&
            typeof item.content === 'string' &&
            (!item.inputs ||
              item.inputs.every(
                (input) =>
                  typeof input.name === 'string' &&
                  (input.type === 'text' || input.type === 'number') &&
                  (!input.value || typeof input.value === 'string' || typeof input.value === 'number'),
              )),
        );

        if (!isValid) {
          throw new Error('Invalid file format');
        }

        // Generate new IDs to avoid conflicts
        const maxId = Math.max(...items.map((item) => item.id), 0);
        const newItem = {
          ...importedData,
          id: maxId + 1,
        };

        onFilterCreate?.(newItem);
        setItems((prev) => [...prev, newItem]);
        toast.success(`Imported ${newItem.name} filters successfully.`);
      } catch (error: any) {
        toast.error('Please ensure the JSON file has the correct format.', error.message);
      }
    };
    reader.readAsText(file);

    // Reset the input
    event.target.value = '';
  };

  const onContentChange = useCallback(
    (code: string) => {
      setEditContent(code);
    },
    [setEditContent],
  );
  useEffect(() => {
    setItems(listItems);
  }, [listItems]);

  function handleActivationChange(id: number, enabled: boolean): void {
    const item = items.find((item) => item.id === id);

    if (!item) {
      return;
    }

    const newItem = { ...item };
    newItem.enabled = enabled;
    onFilterUpdate?.(newItem);
    setItems((prev) => {
      return prev.map((item) => {
        if (item.id === id) {
          return newItem;
        }

        return item;
      });
    });
  }

  return (
    <div className="w-full mx-auto p-4">
      <div className="mb-4 flex gap-2">
        {/* add import button */}
        <Button onClick={handleImportClick} className="w-full flex items-center justify-center gap-2">
          <div className="w-4 h-4 mr-2 i-ph:upload-simple " />
          Import
        </Button>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" />
        <Button onClick={handleCreate} className="w-full flex items-center justify-center gap-2">
          <div className="w-4 h-4 mr-2 i-ph:plus-circle-thin" />
          New Filter
        </Button>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <FilterCard
            key={item.id}
            item={item}
            onDragStart={handleDragStart}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isDragging={draggedItem?.id === item.id}
            onUpdateInputs={handleEditInput}
            onActivationChange={handleActivationChange}
          />
        ))}
      </ul>

      <Dialog.Root open={editingItem !== null || isCreating} onOpenChange={() => handleCloseDialog()}>
        <Dialog.Portal>
          <Dialog.Overlay
            asChild
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCloseDialog();
            }}
          >
            <motion.div
              className="bg-black/50 fixed inset-0 z-max backdrop-blur-sm"
              initial="closed"
              animate="open"
              exit="closed"
              variants={dialogBackdropVariants}
            />
          </Dialog.Overlay>
          <Dialog.Content asChild>
            <motion.div
              className={classNames(
                'fixed top-[50%] left-[50%] z-max h-[85vh] w-[90vw] max-w-[900px] translate-x-[-50%] translate-y-[-50%]',
                'border border-bolt-elements-borderColor rounded-lg shadow-lg focus:outline-none overflow-hidden',
                'bg-bolt-elements-background-depth-1 p-4',
              )}
              initial="closed"
              animate="open"
              exit="closed"
              variants={dialogVariants}
            >
              <div className="flex flex-col h-full">
                <Dialog.Title className="flex-shrink-0 text-lg font-semibold text-bolt-elements-textPrimary mb-2">
                  <div className="flex items-center gap-2 justify-center">
                    {isCreating ? 'Create Filter' : 'Edit Filter'}
                  </div>
                </Dialog.Title>
                <Dialog.Description className="text-bolt-elements-textSecondary"></Dialog.Description>

                <div className="flex flex-col flex-1 gap-4 py-4 ">
                  <TextBox
                    placeholder="Filter Name"
                    id="name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full"
                  />

                  {/* <div className="grid gap-2">
                  <TextArea
                    placeholder="Filter Content"
                    id="content"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={4}
                    className="w-full"
                  />
                </div> */}
                  <div className="flex-1 relative">
                    <FilterEditor initialCode={editContent} onChange={onContentChange} />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button onClick={handleCloseDialog}>Cancel</Button>
                  <Button onClick={handleSaveEdit}>{isCreating ? 'Create' : 'Save changes'}</Button>
                </div>
              </div>
            </motion.div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
};

export default FilterList;
