import { useDroppable } from '@dnd-kit/core';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TimeSlot } from './TimeSlot';
import type { ProductionSchedule } from '../../hooks/useProduction';

export const START_HOUR = 5;   // 05:00
export const END_HOUR = 19;    // 19:00
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
export const PIXELS_PER_MINUTE = 1.5; // 90px por hora
const TOTAL_HEIGHT = TOTAL_MINUTES * PIXELS_PER_MINUTE;

interface DayColumnProps {
    day: Date;
    entries: ProductionSchedule[];
    onEdit: (entry: ProductionSchedule) => void;
    onDelete: (entry: ProductionSchedule) => void;
}

function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return (h - START_HOUR) * 60 + m;
}

export function DayColumn({ day, entries, onEdit, onDelete }: DayColumnProps) {
    const dayKey = format(day, 'yyyy-MM-dd');
    const { setNodeRef, isOver } = useDroppable({ id: dayKey, data: { date: dayKey } });

    const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

    return (
        <div className="flex flex-col flex-1 min-w-[120px] shrink-0">
            {/* Cabeçalho do dia */}
            <div className="text-center py-2 border-b border-gray-200 bg-white sticky top-0 z-10">
                <p className="text-xs text-gray-500 uppercase">
                    {format(day, 'EEE', { locale: ptBR })}
                </p>
                <p className="text-sm font-semibold text-gray-900">{format(day, 'd')}</p>
            </div>

            {/* Grade de horários */}
            <div
                ref={setNodeRef}
                className={`relative border-r border-gray-100 ${isOver ? 'bg-primary/5' : 'bg-white'}`}
                style={{ height: `${TOTAL_HEIGHT}px`, minHeight: `${TOTAL_HEIGHT}px` }}
            >
                {/* Linhas guia por hora */}
                {hours.map(h => (
                    <div
                        key={h}
                        className="absolute w-full border-t border-gray-100"
                        style={{ top: `${(h - START_HOUR) * 60 * PIXELS_PER_MINUTE}px` }}
                    />
                ))}

                {/* Blocos de tarefas agendadas */}
                {entries.filter(e => e.start_time).map(entry => {
                    const topPx = timeToMinutes(entry.start_time!) * PIXELS_PER_MINUTE;
                    return (
                        <div key={entry.id} style={{ position: 'absolute', top: `${topPx}px`, left: 0, right: 0 }}>
                            <TimeSlot
                                entry={entry}
                                pixelsPerMinute={PIXELS_PER_MINUTE}
                                onEdit={onEdit}
                                onDelete={onDelete}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
