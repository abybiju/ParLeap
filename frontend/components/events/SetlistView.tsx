'use client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SetlistItemCard } from './SetlistItemCard';
import type { SetlistItem } from '@/lib/types/setlist';

interface SetlistViewProps {
  eventId: string;
  setlistItems: SetlistItem[];
  onRemove: (item: SetlistItem) => void;
  onReorder: (orderedIds: string[]) => void;
  /** When true (default), show card wrapper and heading. When false, only the list (for embedding in SetlistBuilder). */
  showHeader?: boolean;
}

function SortableSetlistItem({
  item,
  onRemove,
}: {
  item: SetlistItem;
  onRemove: (item: SetlistItem) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <SetlistItemCard
        item={item}
        onRemove={onRemove}
        isDragging={isDragging}
        dragListeners={listeners}
        dragAttributes={attributes}
      />
    </div>
  );
}

export function SetlistView({
  eventId: _eventId,
  setlistItems,
  onRemove,
  onReorder,
  showHeader = true,
}: SetlistViewProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = setlistItems.findIndex((item) => item.id === active.id);
    const newIndex = setlistItems.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reordered = arrayMove(setlistItems, oldIndex, newIndex);
    onReorder(reordered.map((item) => item.id));
  };

  const listContent =
    setlistItems.length === 0 ? (
      <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-slate-900/40 py-16 text-center">
        <p className="text-sm text-slate-400">No items in setlist yet.</p>
        <p className="text-xs mt-1 text-slate-500">
          {showHeader ? 'Switch to Content Library to add items.' : 'Add items from the library.'}
        </p>
      </div>
    ) : (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={setlistItems.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {setlistItems.map((item) => (
              <SortableSetlistItem key={item.id} item={item} onRemove={onRemove} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    );

  if (!showHeader) {
    return listContent;
  }

  return (
    <div className="glass-card rounded-2xl p-6 shadow-xl shadow-slate-900/40">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-white">Setlist</h2>
        <p className="text-sm text-slate-300">
          Drag items to reorder. Switch to Content Library to add songs, Bible, media, or announcements.
        </p>
      </div>
      {listContent}
    </div>
  );
}
