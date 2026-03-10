const START_HOUR = 5;
const END_HOUR = 19;
const PIXELS_PER_MINUTE = 1.5;

export function TimeAxis() {
    const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
    return (
        <div className="w-12 flex-shrink-0 border-r border-gray-200 bg-white relative sticky z-10" style={{ left: '176px', marginTop: '49px', minHeight: `${(END_HOUR - START_HOUR) * 60 * PIXELS_PER_MINUTE}px` }}>
            {hours.map(h => (
                <div
                    key={h}
                    className="absolute w-full text-right pr-2"
                    style={{ top: `${(h - START_HOUR) * 60 * PIXELS_PER_MINUTE}px` }}
                >
                    <span className="text-[10px] text-gray-400 leading-none">
                        {String(h).padStart(2, '0')}h
                    </span>
                </div>
            ))}
        </div>
    );
}
