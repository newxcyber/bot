import { useState } from 'react';
import type { FilterItem } from './types';
import TextBox from '~/components/ui/TextBox';
import { toast } from 'react-toastify';
import { Switch } from '~/components/ui/Switch';

interface FilterCardProps {
  item: FilterItem;
  onDragStart: (e: React.DragEvent, item: FilterItem) => void;
  onDragEnter: (e: React.DragEvent, item: FilterItem) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onEdit: (item: FilterItem) => void;
  onDelete: (id: number) => void;
  isDragging: boolean;
  onUpdateInputs: (id: number, inputs: FilterItem['inputs']) => void;
  onActivationChange: (id: number, enabled: boolean) => void;
}

export const FilterCard: React.FC<FilterCardProps> = ({
  item,
  onDragStart,
  onDragEnter,
  onDragOver,
  onDragEnd,
  onEdit,
  onDelete,
  isDragging,
  onUpdateInputs,
  onActivationChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localInputs, setLocalInputs] = useState<FilterItem['inputs']>(
    item.inputs?.map((input) => ({
      ...input,
      value: input.value ?? (input.type === 'number' ? 0 : ''),
    })) || [],
  );

  const handleInputChange = (name: string, value: string | number) => {
    const newInputs = [...(localInputs || [])];
    const index = newInputs.findIndex((input) => input.name === name);
    newInputs[index] = {
      ...newInputs[index],
      value,
    };
    setLocalInputs(newInputs);
    onUpdateInputs(item.id, newInputs);
  };
  const handleExport = (item: FilterItem) => {
    try {
      // Create JSON blob
      const jsonString = JSON.stringify(item, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'filters.json';

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Filters have been exported successfully.');
    } catch (error: any) {
      toast.success('Failed to export filters. Please try again.', error.message);
    }
  };

  return (
    <li
      draggable
      onDragStart={(e) => onDragStart(e, item)}
      onDragEnter={(e) => onDragEnter(e, item)}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={`
        group
        p-4 
        bg-bolt-elements-background-depth-2
        rounded-lg 
        hover:bg-bolt-elements-background-depth-1
        transition-all 
        duration-200
        cursor-move
        text-bolt-elements-textPrimary
        border border-bolt-elements-borderColor
        ${isDragging ? 'opacity-0' : 'opacity-100'}
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.name}</span>
          {item.inputs && item.inputs.length > 0 && (
            <button onClick={() => setIsExpanded(!isExpanded)} className="p-1 bg-transparent text rounded">
              {isExpanded ? <div className="i-ph:caret-up text-lg" /> : <div className="i-ph:caret-down text-lg" />}
            </button>
          )}
        </div>
        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => handleExport(item)} className="p-1 hover:bg-gray-100 rounded">
            <div className="w-4 h-4 text-blue-500 i-ph:download-simple" />
          </button>
          <button onClick={() => onEdit(item)} className="p-1 hover:bg-gray-100 rounded">
            <div className="w-4 h-4 text-blue-500 i-ph:pencil-thin" />
          </button>
          <button onClick={() => onDelete(item.id)} className="p-1 hover:bg-gray-100 rounded">
            <div className="w-4 h-4 text-red-500 i-ph:trash-light" />
          </button>
          <Switch checked={item.enabled || false} onCheckedChange={(value) => onActivationChange(item.id, value)} />
        </div>
      </div>
      {isExpanded && item.inputs && (
        <div className="px-4 pb-4 pt-2 border-t mb-2 mt-2 border-bolt-elements-borderColor">
          <div className="space-y-3">
            {item.inputs?.map((input, _index) => (
              <div key={input.name} className="flex flex-col gap-1">
                {/* <span className="font-medium">{item.name}</span> */}
                <label htmlFor={`${item.id}-${input.name}`}>{input.label}</label>
                <TextBox
                  id={`${item.id}-${input.name}`}
                  type={input.type}
                  value={
                    localInputs?.find((item) => item.name === input.name)?.value ?? (input.type === 'number' ? 0 : '')
                  }
                  onChange={(e) =>
                    handleInputChange(input.name, input.type === 'number' ? Number(e.target.value) : e.target.value)
                  }
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </li>
  );
};
