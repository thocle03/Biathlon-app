import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Race as RaceType, type Competitor } from '../db/db';
import { Play, Flag, ArrowLeft, RotateCcw } from 'lucide-react';
import clsx from 'clsx';

// Format helper: ms -> MM:SS.t
const formatTime = (ms: number) => {
    if (ms < 0) return "00:00.0";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${tenths}`;
};

export const Race = () => {
    const { id } = useParams();
    const raceId = Number(id);
    const navigate = useNavigate();

    // Fetch data
    const mainRace = useLiveQuery(() => db.races.get(raceId), [raceId]);
    const opponentRace = useLiveQuery(
        () => mainRace?.opponentId ? db.races.where('competitorId').equals(mainRace.opponentId).and(r => r.eventId === mainRace.eventId).first() : undefined,
        [mainRace]
    );

    const competitors = useLiveQuery(() => db.competitors.toArray());

    const c1 = competitors?.find(c => c.id === mainRace?.competitorId);
    const c2 = competitors?.find(c => c.id === opponentRace?.competitorId);

    // Global refresh trigger for timers
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 100); // 10Hz update
        return () => clearInterval(interval);
    }, []);

    const handleSplit = async (race: RaceType, currentPhase: string) => {
        const currentTime = Date.now();
        const splits = { ...race.splits };
        const updates: Partial<RaceType> = {};

        switch (currentPhase) {
            case 'start':
                splits.start = currentTime;
                // If it's a duel, also start the opponent's timer
                if (opponentRace && !opponentRace.splits.start) {
                    const opponentSplits = { ...opponentRace.splits, start: currentTime };
                    await db.races.update(opponentRace.id!, { splits: opponentSplits });
                }
                break;
            case 'lap1':
                splits.lap1 = currentTime; // Fin Tour 1 / Entrée Tir 1
                break;
            case 'shoot1':
                splits.shoot1 = currentTime; // Sortie Tir 1
                break;
            case 'lap2':
                splits.lap2 = currentTime; // Fin Tour 2 / Entrée Tir 2
                break;
            case 'shoot2':
                splits.shoot2 = currentTime; // Sortie Tir 2
                break;
            case 'finish':
                splits.finish = currentTime;
                updates.totalTime = splits.finish - (splits.start || 0);
                break;
        }

        updates.splits = splits;
        await db.races.update(race.id!, updates);
    };

    const handleShooting = async (race: RaceType, hits: number, round: 1 | 2) => {
        const updates: Partial<RaceType> = {};
        const errors = 5 - hits;

        if (round === 1) {
            updates.shooting1 = { errors };
        } else {
            updates.shooting2 = { errors };
        }

        updates.penaltyCount = (race.penaltyCount || 0) - ((round === 1 ? race.shooting1?.errors || 0 : race.shooting2?.errors || 0)) + errors;
        await db.races.update(race.id!, updates);
    };

    const resetRace = async (race: RaceType) => {
        if (!confirm("Réinitialiser le chrono de ce concurrent ?")) return;
        await db.races.update(race.id!, {
            splits: {},
            totalTime: undefined,
            shooting1: { errors: 0 },
            shooting2: { errors: 0 },
            penaltyCount: 0
        });
    };

    if (!mainRace || !c1) return <div className="p-8">Chargement...</div>;

    return (
        <div className="space-y-6">
            <div className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-md p-4 rounded-b-2xl border-b border-white/10 shadow-2xl flex items-center justify-between">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="text-xl font-bold text-slate-400">Chronométrage Course</div>
                <div className="w-10"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Racer 1 */}
                <RacerColumn
                    racer={mainRace}
                    competitor={c1}
                    now={now}
                    onSplit={(phase) => handleSplit(mainRace, phase)}
                    onShooting={(hits, round) => handleShooting(mainRace, hits, round)}
                    onReset={() => resetRace(mainRace)}
                />

                {/* Racer 2 */}
                {c2 && opponentRace && (
                    <RacerColumn
                        racer={opponentRace}
                        competitor={c2}
                        now={now}
                        onSplit={(phase) => handleSplit(opponentRace, phase)}
                        onShooting={(hits, round) => handleShooting(opponentRace, hits, round)}
                        onReset={() => resetRace(opponentRace)}
                    />
                )}
            </div>
        </div>
    );
};

const RacerColumn = ({ racer, competitor, now, onSplit, onShooting, onReset }: {
    racer: RaceType;
    competitor: Competitor;
    now: number;
    onSplit: (phase: string) => void;
    onShooting: (hits: number, round: 1 | 2) => void;
    onReset: () => void;
}) => {
    // Determine Phase based on existing splits
    let phase = 'start';
    let timerValue = 0;

    if (racer.splits.start) {
        phase = 'lap1';
        timerValue = now - racer.splits.start;
    }
    if (racer.splits.lap1) {
        phase = 'shoot1';
    }
    if (racer.splits.shoot1) {
        phase = 'lap2';
    }
    if (racer.splits.lap2) {
        phase = 'shoot2';
    }
    if (racer.splits.shoot2) {
        phase = 'finish';
    }
    if (racer.splits.finish) {
        phase = 'done';
        timerValue = racer.splits.finish - (racer.splits.start || 0);
    }

    // Hits count
    const hits1 = 5 - (racer.shooting1?.errors || 0);
    const hits2 = 5 - (racer.shooting2?.errors || 0);

    return (
        <div className="glass-panel p-6 rounded-3xl border-t-4 border-t-blue-500 flex flex-col space-y-6 relative overflow-visible">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-3xl font-bold">{competitor.name}</h2>
                    <div className="text-6xl font-black font-mono mt-2 tabular-nums">
                        {formatTime(timerValue)}
                    </div>
                </div>
                {racer.splits.start && (
                    <button onClick={onReset} className="p-2 text-slate-500 hover:text-red-500">
                        <RotateCcw className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Split Button */}
            {phase !== 'done' && (
                <button
                    onClick={() => onSplit(phase)}
                    className={clsx(
                        "w-full py-8 rounded-2xl text-white shadow-xl transition-all active:scale-95 group relative overflow-hidden",
                        phase === 'start' ? "bg-emerald-500 hover:bg-emerald-400" :
                            phase === 'finish' ? "bg-amber-500 hover:bg-amber-400" :
                                "bg-blue-600 hover:bg-blue-500"
                    )}
                >
                    <span className="text-3xl font-bold flex items-center justify-center gap-3 relative z-10">
                        {phase === 'start' && <Play className="w-8 h-8" />}
                        {phase === 'finish' && <Flag className="w-8 h-8" />}
                        {getButtonLabel(phase)}
                    </span>
                </button>
            )}

            {/* Shooting Inputs - Always Visible */}
            <div className="grid grid-cols-1 gap-4">
                <div className="bg-white/5 p-4 rounded-xl">
                    <div className="text-sm text-slate-400 mb-2 flex justify-between">
                        <span>Tir 1 (Couché)</span>
                        <span className={clsx("font-bold", hits1 === 5 ? "text-emerald-400" : "text-white")}>{hits1}/5</span>
                    </div>
                    <div className="flex justify-between gap-1">
                        {[0, 1, 2, 3, 4, 5].map(h => (
                            <button
                                key={h}
                                onClick={() => onShooting(h, 1)}
                                className={clsx(
                                    "flex-1 aspect-square rounded-lg font-bold transition-all",
                                    hits1 === h ? "bg-emerald-500 text-slate-900 scale-110 shadow-lg shadow-emerald-500/20" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                                )}
                            >
                                {h}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-white/5 p-4 rounded-xl">
                    <div className="text-sm text-slate-400 mb-2 flex justify-between">
                        <span>Tir 2 (Debout)</span>
                        <span className={clsx("font-bold", hits2 === 5 ? "text-emerald-400" : "text-white")}>{hits2}/5</span>
                    </div>
                    <div className="flex justify-between gap-1">
                        {[0, 1, 2, 3, 4, 5].map(h => (
                            <button
                                key={h}
                                onClick={() => onShooting(h, 2)}
                                className={clsx(
                                    "flex-1 aspect-square rounded-lg font-bold transition-all",
                                    hits2 === h ? "bg-blue-500 text-white scale-110 shadow-lg shadow-blue-500/20" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                                )}
                            >
                                {h}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Split List */}
            <div className="space-y-1 text-sm font-mono text-slate-400 border-t border-white/5 pt-4">
                {racer.splits.lap1 && <div className="flex justify-between"><span>Tour 1</span> <span className="text-white">{formatTime(racer.splits.lap1 - (racer.splits.start || 0))}</span></div>}
                {racer.splits.shoot1 && <div className="flex justify-between"><span>Tir 1 (Sortie)</span> <span className="text-white">{formatTime(racer.splits.shoot1 - (racer.splits.start || 0))}</span></div>}
                {racer.splits.lap2 && <div className="flex justify-between"><span>Tour 2</span> <span className="text-white">{formatTime(racer.splits.lap2 - (racer.splits.start || 0))}</span></div>}
                {racer.splits.shoot2 && <div className="flex justify-between"><span>Tir 2 (Sortie)</span> <span className="text-white">{formatTime(racer.splits.shoot2 - (racer.splits.start || 0))}</span></div>}
                {racer.splits.finish && <div className="flex justify-between text-emerald-400 font-bold"><span>Total</span> <span>{formatTime(racer.splits.finish - (racer.splits.start || 0))}</span></div>}
            </div>
        </div>
    );
};

const getButtonLabel = (phase: string) => {
    switch (phase) {
        case 'start': return 'DÉPART';
        case 'lap1': return 'ARRIVÉE TOUR 1';
        case 'shoot1': return 'SORTIE TIR 1';
        case 'lap2': return 'ARRIVÉE TOUR 2';
        case 'shoot2': return 'SORTIE TIR 2';
        case 'finish': return 'ARRIVÉE';
        case 'done': return 'TERMINE';
        default: return phase;
    }
};
