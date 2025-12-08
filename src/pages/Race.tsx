import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Race as RaceType, type Competitor } from '../db/db';
import { Play, Pause, Square, Timer, Target, Flag, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

// Format helper: ms -> MM:SS.t
const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${tenths}`;
};

type RaceState = 'idle' | 'running' | 'paused' | 'finished';
type RacerPhase = 'start' | 'lap1' | 'shoot1' | 'penalty1' | 'lap2' | 'shoot2' | 'penalty2' | 'lap3' | 'finish';

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

    // Timer State
    const [status, setStatus] = useState<RaceState>('idle');
    const [time, setTime] = useState(0);
    const timerRef = useRef<number | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const accumulatedTimeRef = useRef(0);

    // Racer Local State (to avoid hammering DB with every ms, we just push splits to DB)
    const [racer1Phase, setRacer1Phase] = useState<RacerPhase>('start');
    const [racer2Phase, setRacer2Phase] = useState<RacerPhase>('start');

    // Names resolution
    const c1 = competitors?.find(c => c.id === mainRace?.competitorId);
    const c2 = competitors?.find(c => c.id === opponentRace?.competitorId);

    useEffect(() => {
        // Load existing splits state if race resumed (ToDo: sophisticated resume logic)
        // For now, assuming fresh start for prototype
    }, [mainRace]);

    const toggleTimer = () => {
        if (status === 'idle' || status === 'paused') {
            setStatus('running');
            startTimeRef.current = Date.now();
            timerRef.current = window.setInterval(() => {
                const now = Date.now();
                const delta = now - (startTimeRef.current || now);
                setTime(accumulatedTimeRef.current + delta);
            }, 100);
        } else if (status === 'running') {
            setStatus('paused');
            if (timerRef.current) clearInterval(timerRef.current);
            accumulatedTimeRef.current = time;
        }
    };

    const stopRace = () => {
        if (confirm("Arrêter la course ?")) {
            setStatus('finished');
            if (timerRef.current) clearInterval(timerRef.current);
            // Final save if needed
        }
    };

    const handleSplit = async (racerIdx: 1 | 2, currentPhase: RacerPhase) => {
        if (status !== 'running') {
            toast.error("Démarrez le chronomètre d'abord");
            return;
        }

        const race = racerIdx === 1 ? mainRace : opponentRace;
        if (!race) return;

        const currentTime = time; // Capture time

        // Logic for next phase
        let nextPhase: RacerPhase = currentPhase;

        const updates: Partial<RaceType> = {};
        const splits = { ...race.splits };

        switch (currentPhase) {
            case 'start':
                nextPhase = 'lap1';
                break;
            case 'lap1':
                nextPhase = 'shoot1';
                splits.lap1 = currentTime;
                break;
            case 'shoot1':
                // Handled by Shooting Input, but if manual click:
                nextPhase = 'lap2'; // Assume 0 errors or manual penalty handling logic
                // In this UI we might require shooting input first
                break;
            case 'penalty1':
                nextPhase = 'lap2';
                break;
            case 'lap2':
                nextPhase = 'shoot2';
                splits.lap2 = currentTime;
                break;
            case 'shoot2':
                nextPhase = 'lap3';
                break;
            case 'penalty2':
                nextPhase = 'lap3';
                break;
            case 'lap3':
                nextPhase = 'finish';
                splits.finish = currentTime;
                updates.totalTime = currentTime;
                break;
        }

        updates.splits = splits;

        await db.races.update(race.id!, updates);
        if (racerIdx === 1) setRacer1Phase(nextPhase);
        else setRacer2Phase(nextPhase);
    };

    const handleShooting = async (racerIdx: 1 | 2, errors: number, round: 1 | 2) => {
        if (status !== 'running') return;

        const race = racerIdx === 1 ? mainRace : opponentRace;
        if (!race) return;

        const currentTime = time;
        const splits = { ...race.splits };
        const updates: Partial<RaceType> = {};

        if (round === 1) {
            splits.shoot1 = currentTime;
            updates.shooting1 = { errors };
        } else {
            splits.shoot2 = currentTime;
            updates.shooting2 = { errors };
        }

        updates.splits = splits;
        updates.penaltyCount = (race.penaltyCount || 0) + errors;

        await db.races.update(race.id!, updates);

        // If errors > 0, go to penalty phase? User said: "si il y a des erreurs a la fin des tours de pénalités"
        // Meaning if errors, we expect a split AFTER penalty loop.
        // If 0 errors, we go straight to next lap.

        let nextPhase: RacerPhase = round === 1 ? 'lap2' : 'lap3';
        if (errors > 0) {
            nextPhase = round === 1 ? 'penalty1' : 'penalty2';
        }

        if (racerIdx === 1) setRacer1Phase(nextPhase);
        else setRacer2Phase(nextPhase);
    };

    if (!mainRace || !c1) return <div className="p-8">Chargement...</div>;

    return (
        <div className="space-y-6">
            {/* Header / Global Timer */}
            <div className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-md p-4 rounded-b-2xl border-b border-white/10 shadow-2xl flex items-center justify-between">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>

                <div className="flex flex-col items-center">
                    <div className="text-6xl font-black font-mono tracking-wider tabular-nums bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
                        {formatTime(time)}
                    </div>
                    <div className="flex gap-4 mt-2">
                        <button
                            onClick={toggleTimer}
                            className={clsx(
                                "p-3 rounded-full transition-all shadow-lg",
                                status === 'running' ? "bg-amber-500 hover:bg-amber-400" : "bg-emerald-500 hover:bg-emerald-400"
                            )}
                        >
                            {status === 'running' ? <Pause className="w-6 h-6 fill-current text-slate-900" /> : <Play className="w-6 h-6 fill-current text-slate-900" />}
                        </button>
                        <button
                            onClick={stopRace}
                            className="p-3 bg-red-600 hover:bg-red-500 rounded-full transition-all shadow-lg"
                        >
                            <Square className="w-6 h-6 fill-current text-white" />
                        </button>
                    </div>
                </div>
                <div className="w-10"></div> {/* Spacer */}
            </div>

            {/* Racers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Racer 1 */}
                <RacerColumn
                    competitor={c1}
                    phase={racer1Phase}
                    onSplit={() => handleSplit(1, racer1Phase)}
                    onShooting={(errors, round) => handleShooting(1, errors, round)}
                    lastSplit={mainRace.splits}
                />

                {/* Racer 2 (if exists) */}
                {c2 && opponentRace && (
                    <RacerColumn
                        competitor={c2}
                        phase={racer2Phase}
                        onSplit={() => handleSplit(2, racer2Phase)}
                        onShooting={(errors, round) => handleShooting(2, errors, round)}
                        lastSplit={opponentRace.splits}
                    />
                )}
            </div>
        </div>
    );
};



const RacerColumn = ({ competitor, phase, onSplit, onShooting, lastSplit }: {
    competitor: Competitor;
    phase: RacerPhase;
    onSplit: () => void;
    onShooting: (errors: number, round: 1 | 2) => void;
    lastSplit: any; // Using any for splits object simplification or define type
}) => {
    const isShooting = phase === 'shoot1' || phase === 'shoot2';

    return (
        <div className="glass-panel p-6 rounded-3xl border-t-4 border-t-blue-500 flex flex-col items-center text-center space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Flag className="w-32 h-32" />
            </div>

            <h2 className="text-3xl font-bold relative z-10">{competitor.name}</h2>

            <div className="flex items-center gap-2 text-blue-300 font-medium text-lg bg-blue-900/20 px-4 py-1 rounded-full border border-blue-500/30">
                <PhaseIcon phase={phase} />
                <span>{getPhaseLabel(phase)}</span>
            </div>

            <div className="flex-1 w-full flex flex-col justify-center min-h-[200px]">
                {isShooting ? (
                    <div className="space-y-4 animate-in zoom-in duration-300">
                        <p className="text-slate-400">Résultat du tir</p>
                        <div className="grid grid-cols-6 gap-2">
                            {[0, 1, 2, 3, 4, 5].map(score => (
                                <button
                                    key={score}
                                    onClick={() => onShooting(score, phase === 'shoot1' ? 1 : 2)}
                                    className="aspect-square rounded-xl bg-slate-800 border border-white/10 hover:bg-white hover:text-slate-900 text-xl font-bold transition-all"
                                >
                                    {score}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : phase === 'finish' ? (
                    <div className="text-emerald-400 font-bold text-2xl animate-in bounce-in">
                        Terminé !
                    </div>
                ) : (
                    <button
                        onClick={onSplit}
                        className="w-full py-8 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 hover:from-blue-500 hover:to-blue-300 text-white shadow-xl shadow-blue-900/20 transition-all active:scale-95 group"
                    >
                        <span className="text-2xl font-bold flex items-center justify-center gap-3">
                            <Timer className="w-8 h-8 group-hover:rotate-12 transition-transform" />
                            TOP {getButtonLabel(phase)}
                        </span>
                    </button>
                )}
            </div>

            {/* Splits Data */}
            <div className="w-full text-sm text-slate-400 space-y-2 border-t border-white/5 pt-4">
                {lastSplit.lap1 && <div className="flex justify-between"><span>Tour 1</span> <span className="text-white font-mono">{formatTime(lastSplit.lap1)}</span></div>}
                {lastSplit.shoot1 && <div className="flex justify-between"><span>Tir 1</span> <span className="text-white font-mono">{formatTime(lastSplit.shoot1)}</span></div>}
                {lastSplit.lap2 && <div className="flex justify-between"><span>Tour 2</span> <span className="text-white font-mono">{formatTime(lastSplit.lap2)}</span></div>}
                {lastSplit.shoot2 && <div className="flex justify-between"><span>Tir 2</span> <span className="text-white font-mono">{formatTime(lastSplit.shoot2)}</span></div>}
                {lastSplit.finish && <div className="flex justify-between text-emerald-400 font-bold"><span>Total</span> <span className="font-mono">{formatTime(lastSplit.finish)}</span></div>}
            </div>
        </div>
    );
};

const PhaseIcon = ({ phase }: { phase: string }) => {
    switch (phase) {
        case 'shoot1': case 'shoot2': return <Target className="w-5 h-5" />;
        case 'finish': return <Flag className="w-5 h-5" />;
        default: return <Timer className="w-5 h-5" />;
    }
};

const getPhaseLabel = (phase: string) => {
    switch (phase) {
        case 'start': return 'Au départ';
        case 'lap1': return 'Tour 1';
        case 'shoot1': return 'Tir Couché (1)';
        case 'penalty1': return 'Tour Pénalité';
        case 'lap2': return 'Tour 2';
        case 'shoot2': return 'Tir Debout (2)';
        case 'penalty2': return 'Tour Pénalité';
        case 'lap3': return 'Tour 3 (Final)';
        case 'finish': return 'Arrivée';
        default: return phase;
    }
};

const getButtonLabel = (phase: string) => {
    switch (phase) {
        case 'start': return 'DÉPART';
        case 'lap1': return 'FIN TOUR 1';
        case 'penalty1': return 'FIN PÉNALITÉ';
        case 'lap2': return 'FIN TOUR 2';
        case 'penalty2': return 'FIN PÉNALITÉ';
        case 'lap3': return 'ARRIVÉE';
        default: return 'SPLIT';
    }
};
