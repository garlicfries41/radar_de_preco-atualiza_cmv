import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { ProductionSchedule } from '../../hooks/useProduction';

function UnscheduledCard({ entry }: { entry: ProductionSchedule }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: entry.id,
        data: { entry },
    });
    const label = entry.production_processes?.name ?? entry.custom_item_name ?? '—';
    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
            {...listeners}
            {...attributes}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing shadow-sm mb-2"
        >
            <p className="text-xs font-semibold text-gray-800 truncate">{label}</p>
            <p className="text-[10px] text-gray-400">{entry.duration_minutes}min · {entry.planned_date}</p>
        </div>
    );
}

interface UnscheduledQueueProps {
    entries: ProductionSchedule[];
}

export function UnscheduledQueue({ entries }: UnscheduledQueueProps) {
    const { setNodeRef, isOver } = useDroppable({ id: 'unscheduled' });

    return (
        <div className="w-44 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col sticky left-0 z-20">
            <div className="px-3 py-2 border-b border-gray-200 bg-white sticky top-0 z-20">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Não agendado</p>
                <p className="text-[10px] text-gray-400">{entries.length} item(s)</p>
            </div>
            <div
                ref={setNodeRef}
                className={`flex-1 overflow-y-auto p-2 ${isOver ? 'bg-yellow-50' : ''}`}
            >
                {entries.length === 0 && (
                    <p className="text-[10px] text-gray-400 text-center mt-4">Nenhum item</p>
                )}
                {entries.map(e => <UnscheduledCard key={e.id} entry={e} />)}
            </div>
        </div>
    );
}
