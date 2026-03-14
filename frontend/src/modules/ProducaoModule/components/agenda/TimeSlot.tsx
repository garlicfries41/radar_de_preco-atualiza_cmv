import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Link2, Link2Off } from 'lucide-react';
import type { ProductionSchedule } from '../../hooks/useProduction';

// Paleta de cores para diferenciar slots visualmente
const SLOT_COLORS = [
    { bg: 'bg-blue-100',    border: 'border-blue-300',    text: 'text-blue-800' },
    { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-800' },
    { bg: 'bg-amber-100',   border: 'border-amber-300',   text: 'text-amber-800' },
    { bg: 'bg-purple-100',  border: 'border-purple-300',  text: 'text-purple-800' },
    { bg: 'bg-rose-100',    border: 'border-rose-300',    text: 'text-rose-800' },
    { bg: 'bg-cyan-100',    border: 'border-cyan-300',    text: 'text-cyan-800' },
    { bg: 'bg-orange-100',  border: 'border-orange-300',  text: 'text-orange-800' },
    { bg: 'bg-indigo-100',  border: 'border-indigo-300',  text: 'text-indigo-800' },
];

function getColorIndex(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = ((hash << 5) - hash) + id.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash) % SLOT_COLORS.length;
}

function formatStartTime(time?: string): string {
    if (!time) return '';
    const [h, m] = time.split(':');
    return `${h}:${m}`;
}

export function getSlotColor(id: string) {
    return SLOT_COLORS[getColorIndex(id)];
}

interface TimeSlotProps {
    entry: ProductionSchedule;
    pixelsPerMinute: number;
    onEdit: (entry: ProductionSchedule) => void;
    onDelete: (entry: ProductionSchedule) => void;
    onBreakLink?: (entry: ProductionSchedule) => void;
}

export function TimeSlot({ entry, pixelsPerMinute, onEdit, onDelete, onBreakLink }: TimeSlotProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: entry.id,
        data: { entry },
    });

    const height = Math.max(entry.duration_minutes * pixelsPerMinute, 36);
    const label = entry.production_processes?.name ?? entry.custom_item_name ?? '—';
    const color = SLOT_COLORS[getColorIndex(entry.id)];

    const style = {
        transform: CSS.Translate.toString(transform),
        height: `${height}px`,
        opacity: isDragging ? 0.3 : 1,
        zIndex: isDragging ? 50 : 10,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`absolute left-1 right-1 ${color.bg} border ${color.border} rounded-md px-2 py-1 cursor-grab active:cursor-grabbing select-none overflow-hidden group flex flex-col`}
        >
            <div className="flex items-center gap-1 flex-1 min-h-0">
                {entry.start_time && (
                    <span className="text-[10px] font-mono text-gray-500 flex-shrink-0">
                        {formatStartTime(entry.start_time)}
                    </span>
                )}
                <p className={`text-xs font-semibold ${color.text} truncate`}>{label}</p>
                {entry.chain_group_id && (
                    <span className="text-blue-400/60 flex-shrink-0"><Link2 size={10} /></span>
                )}
            </div>
            <div className="flex items-center justify-between mt-auto">
                <p className="text-[10px] text-gray-500">{entry.duration_minutes}min</p>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {entry.chain_group_id && onBreakLink && (
                        <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); onBreakLink(entry); }}
                            className="text-[10px] bg-white border border-orange-200 rounded px-1 text-orange-400 hover:text-orange-600"
                            title="Quebrar link"
                        >
                            <Link2Off size={10} />
                        </button>
                    )}
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
        </div>
    );
}

/** Componente estático usado no DragOverlay (sem hooks de drag) */
export function TimeSlotOverlay({ entry, pixelsPerMinute }: { entry: ProductionSchedule; pixelsPerMinute: number }) {
    const height = Math.max(entry.duration_minutes * pixelsPerMinute, 36);
    const label = entry.production_processes?.name ?? entry.custom_item_name ?? '—';
    const color = SLOT_COLORS[getColorIndex(entry.id)];

    return (
        <div
            style={{ height: `${height}px`, width: '140px' }}
            className={`${color.bg} border-2 ${color.border} rounded-md px-2 py-1 shadow-lg select-none overflow-hidden flex flex-col opacity-90`}
        >
            <div className="flex items-center gap-1 flex-1 min-h-0">
                {entry.start_time && (
                    <span className="text-[10px] font-mono text-gray-500 flex-shrink-0">
                        {formatStartTime(entry.start_time)}
                    </span>
                )}
                <p className={`text-xs font-semibold ${color.text} truncate`}>{label}</p>
            </div>
            <p className="text-[10px] text-gray-500 mt-auto">{entry.duration_minutes}min</p>
        </div>
    );
}
