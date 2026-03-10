import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { ProductionSchedule } from '../../hooks/useProduction';

interface TimeSlotProps {
    entry: ProductionSchedule;
    pixelsPerMinute: number;
    onEdit: (entry: ProductionSchedule) => void;
    onDelete: (entry: ProductionSchedule) => void;
}

export function TimeSlot({ entry, pixelsPerMinute, onEdit, onDelete }: TimeSlotProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: entry.id,
        data: { entry },
    });

    const height = Math.max(entry.duration_minutes * pixelsPerMinute, 24);
    const label = entry.production_processes?.name ?? entry.custom_item_name ?? '—';

    const style = {
        transform: CSS.Translate.toString(transform),
        height: `${height}px`,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : 10,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className="absolute left-1 right-1 bg-primary/10 border border-primary/30 rounded-md px-2 py-1 cursor-grab active:cursor-grabbing select-none overflow-hidden group"
        >
            <p className="text-xs font-semibold text-primary truncate">{label}</p>
            <p className="text-[10px] text-gray-500">{entry.duration_minutes}min</p>
            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onEdit(entry); }}
                    className="text-[10px] bg-white border border-gray-200 rounded px-1 text-gray-600 hover:text-primary"
                >
                    ✏
                </button>
                <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onDelete(entry); }}
                    className="text-[10px] bg-white border border-red-200 rounded px-1 text-red-400 hover:text-red-600"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}
