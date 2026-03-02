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

export const IndividualRace = () => {
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
                if (opponentRace && !opponentRace.splits.start) {
                    const opponentSplits = { ...opponentRace.splits, start: currentTime };
                    await db.races.update(opponentRace.id!, { splits: opponentSplits });
                }
                break;
            case 'lap1':
                splits.lap1 = currentTime;
                break;
            case 'shoot1':
                splits.shoot1 = currentTime;
                break;
            case 'lap2':
                splits.lap2 = currentTime;
                break;
            case 'shoot2':
                splits.shoot2 = currentTime;
                break;
            case 'lap3':
                splits.lap3 = currentTime;
                break;
            case 'shoot3':
                splits.shoot3 = currentTime;
                break;
            case 'lap4':
                splits.lap4 = currentTime;
                break;
            case 'shoot4':
                splits.shoot4 = currentTime;
                break;
            case 'finish':
                splits.finish = currentTime;
                const skiTime = splits.finish - (splits.start || 0);
                const totalErrors = (race.shooting1?.errors || 0) + (race.shooting2?.errors || 0) + (race.shooting3?.errors || 0) + (race.shooting4?.errors || 0);
                updates.totalTime = skiTime + (totalErrors * 15000); // 15s penalty per miss
                break;
        }

        updates.splits = splits;
        await db.races.update(race.id!, updates);
    };

    const handleShooting = async (race: RaceType, hits: number, round: 1 | 2 | 3 | 4) => {
        const updates: Partial<RaceType> = {};
        const errors = 5 - hits;

        if (round === 1) updates.shooting1 = { errors };
        else if (round === 2) updates.shooting2 = { errors };
        else if (round === 3) updates.shooting3 = { errors };
        else if (round === 4) updates.shooting4 = { errors };

        // Recalculate penalty count (not used for totalTime in Individual but kept for stats)
        const s1 = round === 1 ? errors : (race.shooting1?.errors || 0);
        const s2 = round === 2 ? errors : (race.shooting2?.errors || 0);
        const s3 = round === 3 ? errors : (race.shooting3?.errors || 0);
        const s4 = round === 4 ? errors : (race.shooting4?.errors || 0);

        updates.penaltyCount = s1 + s2 + s3 + s4;
        await db.races.update(race.id!, updates);
    };

    const resetRace = async (race: RaceType) => {
        if (!confirm("Réinitialiser le chrono de ce concurrent ?")) return;
        await db.races.update(race.id!, {
            splits: {},
            totalTime: undefined,
            shooting1: { errors: 0 },
            shooting2: { errors: 0 },
            shooting3: { errors: 0 },
            shooting4: { errors: 0 },
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
                <div className="text-xl font-bold text-slate-400">Individuel - Chronométrage</div>
                <div className="w-10"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <RacerColumn
                    racer={mainRace}
                    competitor={c1}
                    now={now}
                    onSplit={(phase) => handleSplit(mainRace, phase)}
                    onShooting={(hits, round) => handleShooting(mainRace, hits, round as any)}
                    onReset={() => resetRace(mainRace)}
                />

                {c2 && opponentRace && (
                    <RacerColumn
                        racer={opponentRace}
                        competitor={c2}
                        now={now}
                        onSplit={(phase) => handleSplit(opponentRace, phase)}
                        onShooting={(hits, round) => handleShooting(opponentRace, hits, round as any)}
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
    onShooting: (hits: number, round: number) => void;
    onReset: () => void;
}) => {
    // Determine Phase based on existing splits
    let phase = 'start';
    let timerValue = 0;

    if (racer.splits.start) { phase = 'lap1'; timerValue = now - racer.splits.start; }
    if (racer.splits.lap1) phase = 'shoot1';
    if (racer.splits.shoot1) phase = 'lap2';
    if (racer.splits.lap2) phase = 'shoot2';
    if (racer.splits.shoot2) phase = 'lap3';
    if (racer.splits.lap3) phase = 'shoot3';
    if (racer.splits.shoot3) phase = 'lap4';
    if (racer.splits.lap4) phase = 'shoot4';
    if (racer.splits.shoot4) phase = 'finish';

    if (racer.splits.finish) {
        phase = 'done';
        timerValue = racer.splits.finish - (racer.splits.start || 0);
    }

    const hits1 = 5 - (racer.shooting1?.errors || 0);
    const hits2 = 5 - (racer.shooting2?.errors || 0);
    const hits3 = 5 - (racer.shooting3?.errors || 0);
    const hits4 = 5 - (racer.shooting4?.errors || 0);

    return (
        <div className="glass-panel p-6 rounded-3xl border-t-4 border-t-indigo-500 flex flex-col space-y-6 relative overflow-visible">
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

            {phase !== 'done' && (
                <button
                    onClick={() => onSplit(phase)}
                    className={clsx(
                        "w-full py-8 rounded-2xl text-white shadow-xl transition-all active:scale-95 group relative overflow-hidden",
                        phase === 'start' ? "bg-emerald-500 hover:bg-emerald-400" :
                            phase === 'finish' ? "bg-amber-500 hover:bg-amber-400" :
                                "bg-indigo-600 hover:bg-indigo-500"
                    )}
                >
                    <span className="text-3xl font-bold flex items-center justify-center gap-3 relative z-10">
                        {phase === 'start' && <Play className="w-8 h-8" />}
                        {phase === 'finish' && <Flag className="w-8 h-8" />}
                        {getButtonLabel(phase)}
                    </span>
                </button>
            )}

            <div className="grid grid-cols-1 gap-4">
                <ShootingRow round={1} label="Tir 1 (Couché)" hits={hits1} onShooting={onShooting} color="emerald" />
                <ShootingRow round={2} label="Tir 2 (Couché)" hits={hits2} onShooting={onShooting} color="emerald" />
                <ShootingRow round={3} label="Tir 3 (Debout)" hits={hits3} onShooting={onShooting} color="blue" />
                <ShootingRow round={4} label="Tir 4 (Debout)" hits={hits4} onShooting={onShooting} color="blue" />
            </div>

            <div className="space-y-1 text-sm font-mono text-slate-400 border-t border-white/5 pt-4">
                {racer.splits.lap1 && <SplitRow label="Tour 1" time={racer.splits.lap1 - (racer.splits.start || 0)} />}
                {racer.splits.shoot1 && <SplitRow label="Tir 1 (Sortie)" time={racer.splits.shoot1 - (racer.splits.start || 0)} />}
                {racer.splits.lap2 && <SplitRow label="Tour 2" time={racer.splits.lap2 - (racer.splits.start || 0)} />}
                {racer.splits.shoot2 && <SplitRow label="Tir 2 (Sortie)" time={racer.splits.shoot2 - (racer.splits.start || 0)} />}
                {racer.splits.lap3 && <SplitRow label="Tour 3" time={racer.splits.lap3 - (racer.splits.start || 0)} />}
                {racer.splits.shoot3 && <SplitRow label="Tir 3 (Sortie)" time={racer.splits.shoot3 - (racer.splits.start || 0)} />}
                {racer.splits.lap4 && <SplitRow label="Tour 4" time={racer.splits.lap4 - (racer.splits.start || 0)} />}
                {racer.splits.shoot4 && <SplitRow label="Tir 4 (Sortie)" time={racer.splits.shoot4 - (racer.splits.start || 0)} />}
                {racer.splits.finish && (
                    <div className="flex justify-between text-emerald-400 font-bold">
                        <span>Total (+{(racer.penaltyCount || 0) * 15}s pénalité)</span>
                        <span>{formatTime(racer.totalTime || 0)}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

const ShootingRow = ({ round, label, hits, onShooting, color }: any) => (
    <div className="bg-white/5 p-4 rounded-xl">
        <div className="text-sm text-slate-400 mb-2 flex justify-between">
            <span>{label}</span>
            <span className={clsx("font-bold", hits === 5 ? "text-emerald-400" : "text-white")}>{hits}/5</span>
        </div>
        <div className="flex justify-between gap-1">
            {[0, 1, 2, 3, 4, 5].map(h => (
                <button
                    key={h}
                    onClick={() => onShooting(h, round)}
                    className={clsx(
                        "flex-1 aspect-square rounded-lg font-bold transition-all",
                        hits === h ?
                            (color === 'emerald' ? "bg-emerald-500 text-slate-900" : "bg-blue-500 text-white") + " scale-110 shadow-lg"
                            : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    )}
                >
                    {h}
                </button>
            ))}
        </div>
    </div>
);

const SplitRow = ({ label, time }: { label: string, time: number }) => (
    <div className="flex justify-between">
        <span>{label}</span>
        <span className="text-white">{formatTime(time)}</span>
    </div>
);

const getButtonLabel = (phase: string) => {
    switch (phase) {
        case 'start': return 'DÉPART';
        case 'lap1': return 'ARRIVÉE TOUR 1';
        case 'shoot1': return 'SORTIE TIR 1';
        case 'lap2': return 'ARRIVÉE TOUR 2';
        case 'shoot2': return 'SORTIE TIR 2';
        case 'lap3': return 'ARRIVÉE TOUR 3';
        case 'shoot3': return 'SORTIE TIR 3';
        case 'lap4': return 'ARRIVÉE TOUR 4';
        case 'shoot4': return 'SORTIE TIR 4';
        case 'finish': return 'ARRIVÉE';
        case 'done': return 'TERMINE';
        default: return phase;
    }
};
