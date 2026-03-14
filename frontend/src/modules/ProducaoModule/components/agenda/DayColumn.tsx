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
    onBreakLink?: (entry: ProductionSchedule) => void;
}

function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return (h - START_HOUR) * 60 + m;
}

interface OverlapInfo {
    entryId: string;
    colIndex: number;
    totalCols: number;
}

function computeOverlapLayout(entries: ProductionSchedule[]): Map<string, OverlapInfo> {
    const scheduled = entries
        .filter(e => e.start_time)
        .map(e => ({
            id: e.id,
            start: timeToMinutes(e.start_time!),
            end: timeToMinutes(e.start_time!) + e.duration_minutes,
        }))
        .sort((a, b) => a.start - b.start || a.end - b.end);

    const result = new Map<string, OverlapInfo>();
    if (scheduled.length === 0) return result;

    const groups: typeof scheduled[] = [];
    let currentGroup = [scheduled[0]];

    for (let i = 1; i < scheduled.length; i++) {
        const groupEnd = Math.max(...currentGroup.map(e => e.end));
        if (scheduled[i].start < groupEnd) {
            currentGroup.push(scheduled[i]);
        } else {
            groups.push(currentGroup);
            currentGroup = [scheduled[i]];
        }
    }
    groups.push(currentGroup);

    for (const group of groups) {
        const totalCols = group.length;
        group.forEach((entry, colIndex) => {
            result.set(entry.id, { entryId: entry.id, colIndex, totalCols });
        });
    }

    return result;
}

export function DayColumn({ day, entries, onEdit, onDelete, onBreakLink }: DayColumnProps) {
    const dayKey = format(day, 'yyyy-MM-dd');
    const { setNodeRef, isOver } = useDroppable({ id: dayKey, data: { date: dayKey } });

    const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

    return (
        <div className="flex flex-col flex-1 min-w-[120px] shrink-0">
            {/* Cabeçalho do dia */}
            <div className="text-center py-2 border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
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
                {(() => {
                    const overlapMap = computeOverlapLayout(entries);
                    return entries.filter(e => e.start_time).map(entry => {
                        const topPx = timeToMinutes(entry.start_time!) * PIXELS_PER_MINUTE;
                        const overlap = overlapMap.get(entry.id);
                        const left = overlap ? `${(overlap.colIndex / overlap.totalCols) * 100}%` : '0';
                        const width = overlap ? `${(1 / overlap.totalCols) * 100}%` : '100%';
                        return (
                            <div key={entry.id} style={{
                                position: 'absolute',
                                top: `${topPx}px`,
                                left,
                                width,
                                paddingRight: overlap && overlap.totalCols > 1 ? '2px' : '0',
                            }}>
                                <TimeSlot
                                    entry={entry}
                                    pixelsPerMinute={PIXELS_PER_MINUTE}
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                    onBreakLink={onBreakLink}
                                />
                            </div>
                        );
                    });
                })()}
            </div>
        </div>
    );
}
