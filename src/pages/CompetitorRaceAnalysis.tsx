import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ArrowLeft, Timer, Snowflake, Target } from 'lucide-react';
import clsx from 'clsx';

export const CompetitorRaceAnalysis = () => {
    const { id, raceId } = useParams();
    const navigate = useNavigate();
    const compId = Number(id);
    const rId = Number(raceId);

    const competitor = useLiveQuery(() => db.competitors.get(compId), [compId]);
    const race = useLiveQuery(() => db.races.get(rId), [rId]);
    const event = useLiveQuery(() => race ? db.events.get(race.eventId) : undefined, [race]);

    if (!competitor || !race || !event) return null;

    // Helper to format time
    const formatTime = (ms: number) => {
        if (!ms && ms !== 0) return '-';
        return new Date(ms).toISOString().slice(14, 21);
    };

    const s = race.splits || {};
    const isIndividual = event.type === 'individual';

    const lap1Time = s.lap1 ? (s.start ? s.lap1 - s.start : s.lap1) : null;
    const lap2Time = (s.lap2 !== undefined && s.shoot1 !== undefined) ? s.lap2 - s.shoot1 : null;
    const lap3Time = (isIndividual)
        ? (s.lap3 !== undefined && s.shoot2 !== undefined ? s.lap3 - s.shoot2 : null)
        : (s.finish !== undefined && s.shoot2 !== undefined ? s.finish - s.shoot2 : null);

    const lap4Time = isIndividual && s.lap4 !== undefined && s.shoot3 !== undefined ? s.lap4 - s.shoot3 : null;
    const lap5Time = isIndividual && s.finish !== undefined && s.shoot4 !== undefined ? s.finish - s.shoot4 : null;

    const shoot1Time = (s.shoot1 !== undefined && s.lap1 !== undefined) ? s.shoot1 - s.lap1 : null;
    const shoot2Time = (s.shoot2 !== undefined && s.lap2 !== undefined) ? s.shoot2 - s.lap2 : null;
    const shoot3Time = isIndividual && s.shoot3 !== undefined && s.lap3 !== undefined ? s.shoot3 - s.lap3 : null;
    const shoot4Time = isIndividual && s.shoot4 !== undefined && s.lap4 !== undefined ? s.shoot4 - s.lap4 : null;

    const totalSkiTime = (lap1Time || 0) + (lap2Time || 0) + (lap3Time || 0) + (lap4Time || 0) + (lap5Time || 0);
    const totalShootTime = (shoot1Time || 0) + (shoot2Time || 0) + (shoot3Time || 0) + (shoot4Time || 0);

    return (
        <div className="space-y-8 max-w-4xl mx-auto p-4">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold">{competitor.name}</h1>
                    <p className="text-slate-400">Analyse détaillée - {event.name} ({new Date(event.date).toLocaleDateString()})</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center text-center bg-gradient-to-br from-cyan-900/30 to-blue-900/10 border-t-4 border-t-cyan-400">
                    <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3">
                        <Snowflake className="w-6 h-6" />
                    </div>
                    <div className="text-3xl font-bold text-white font-mono">
                        {formatTime(totalSkiTime)}
                    </div>
                    <div className="text-sm text-slate-400">Temps Total Ski</div>
                </div>

                <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center text-center border-t-4 border-t-emerald-400">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                        <Target className="w-6 h-6" />
                    </div>
                    <div className="text-3xl font-bold text-white font-mono">
                        {formatTime(totalShootTime)}
                    </div>
                    <div className="text-sm text-slate-400">Temps Total Pas de Tir</div>
                </div>
                {/* Total Time */}
                <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center text-center border-t-4 border-t-purple-400">
                    <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 mb-3">
                        <Timer className="w-6 h-6" />
                    </div>
                    <div className="text-3xl font-bold text-white font-mono">
                        {formatTime(race.totalTime || 0)}
                    </div>
                    <div className="text-sm text-slate-400">
                        {isIndividual ? (
                            <>Temps Final (dont {formatTime((race.penaltyCount || 0) * 15000)} pénalité)</>
                        ) : (
                            <>Temps Final</>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Timer className="w-5 h-5 text-slate-400" />
                    Détail par Tour
                </h2>

                <LapRow index={1} time={lap1Time} />
                <ShootRow label="Tir 1 (Couché)" time={shoot1Time} errors={race.shooting1?.errors} color="emerald" />

                <LapRow index={2} time={lap2Time} />
                <ShootRow label={isIndividual ? "Tir 2 (Couché)" : "Tir 2 (Debout)"} time={shoot2Time} errors={race.shooting2?.errors} color={isIndividual ? "emerald" : "blue"} />

                <LapRow index={3} time={lap3Time} />

                {isIndividual && (
                    <>
                        <ShootRow label="Tir 3 (Debout)" time={shoot3Time} errors={race.shooting3?.errors} color="blue" />
                        <LapRow index={4} time={lap4Time} />
                        <ShootRow label="Tir 4 (Debout)" time={shoot4Time} errors={race.shooting4?.errors} color="blue" />
                        <LapRow index={5} time={lap5Time} />
                    </>
                )}
            </div>
        </div>
    );
};

const LapRow = ({ index, time }: { index: number, time: number | null }) => (
    <div className="glass-panel p-6 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-sm">{index}</div>
            <div className="font-semibold text-lg">Tour {index}</div>
        </div>
        <div className="font-mono text-2xl font-bold text-cyan-400">
            {time !== null ? new Date(time).toISOString().slice(14, 21) : '-'}
        </div>
    </div>
);

const ShootRow = ({ label, time, errors, color }: any) => (
    <div className="flex justify-center">
        <div className={clsx(
            "glass-panel px-8 py-3 rounded-xl flex items-center gap-6 border bg-opacity-10",
            color === 'emerald' ? "border-emerald-500/30 bg-emerald-900/20" : "border-blue-500/30 bg-blue-900/20"
        )}>
            <div className={clsx("text-sm font-medium uppercase tracking-wider", color === 'emerald' ? "text-emerald-400" : "text-blue-400")}>{label}</div>
            <div className="font-mono text-xl font-bold text-white mx-4">
                {time !== null ? new Date(time).toISOString().slice(14, 21) : '-'}
            </div>
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className={`w-3 h-3 rounded-full ${i <= (5 - (errors || 0)) ? (color === 'emerald' ? 'bg-emerald-500' : 'bg-blue-500') : 'bg-red-500'}`} />
                ))}
            </div>
        </div>
    </div>
);
