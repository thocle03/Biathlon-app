import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ArrowLeft, Play, Flag, Timer } from 'lucide-react';

export const EventDashboard = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const eventId = Number(id);

    const event = useLiveQuery(() => db.events.get(eventId), [eventId]);
    const races = useLiveQuery(() =>
        db.races.where('eventId').equals(eventId).toArray()
        , [eventId]);

    const competitors = useLiveQuery(() => db.competitors.toArray());

    if (!event) return null;

    // Group races into Duels
    const processedIds = new Set<number>();
    const duels = [];

    if (races && competitors) {
        const compMap = new Map(competitors.map(c => [c.id!, c]));

        for (const race of races) {
            if (processedIds.has(race.id!)) continue;

            const duel = {
                race1: race,
                r1Name: compMap.get(race.competitorId)?.name,
                race2: race.opponentId ? races.find(r => r.id !== race.id && r.competitorId === race.opponentId) : null,
                r2Name: race.opponentId ? compMap.get(race.opponentId)?.name : 'Solo',
            };

            processedIds.add(race.id!);
            if (duel.race2) processedIds.add(duel.race2.id!);

            duels.push(duel);
        }
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/events')}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold">{event.name}</h1>
                    <div className="flex items-center gap-3 text-slate-400 mt-1">
                        <span>Niveau {event.level}</span>
                        <span>•</span>
                        <span>{new Date(event.date).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Duel List */}
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-xl font-semibold">Duels</h2>
                    <div className="grid gap-4">
                        {duels.map((duel, idx) => (
                            <div
                                key={idx}
                                className="glass-panel p-6 rounded-2xl flex items-center justify-between group"
                            >
                                <div className="flex-1 flex items-center justify-between gap-8">
                                    <div className="flex-1 text-right font-semibold text-lg">
                                        {duel.r1Name}
                                    </div>
                                    <div className="px-3 py-1 bg-white/5 rounded text-xs font-bold text-slate-500 uppercase">
                                        VS
                                    </div>
                                    <div className="flex-1 text-left font-semibold text-lg text-slate-300">
                                        {duel.r2Name}
                                    </div>
                                </div>

                                <div className="ml-8 border-l border-white/10 pl-8">
                                    <button
                                        onClick={() => navigate(`/race/${duel.race1.id}`)}
                                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium shadow-lg shadow-blue-900/20 transition-all hover:scale-105"
                                    >
                                        <Play className="w-4 h-4 fill-current" />
                                        Lancer
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Leaderboard & Analysis */}
                <div className="space-y-6">
                    {/* Leaderboard */}
                    <div className="glass-panel p-6 rounded-2xl border-t-4 border-t-yellow-500">
                        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                            <Flag className="w-5 h-5 text-yellow-500" />
                            Classement
                        </h2>

                        <div className="space-y-3">
                            {races?.filter(r => r.totalTime).sort((a, b) => (a.totalTime || 0) - (b.totalTime || 0)).map((race, idx) => {
                                const competitor = competitors?.find(c => c.id === race.competitorId);
                                return (
                                    <div key={race.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="font-bold text-slate-400 w-6">#{idx + 1}</div>
                                            <div className="font-medium text-white">{competitor?.name}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-mono font-bold text-emerald-400">
                                                {new Date(race.totalTime || 0).toISOString().slice(14, 21)}
                                            </div>
                                            <div className="text-xs text-slate-500 flex gap-1 justify-end">
                                                <span>{(race.shooting1?.errors || 0) + (race.shooting2?.errors || 0)} fautes</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {races?.filter(r => r.totalTime).length === 0 && (
                                <div className="text-center py-8 text-slate-500 text-sm italic">
                                    En attente de résultats...
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Detailed Analysis */}
                    <div className="glass-panel p-6 rounded-2xl border-t-4 border-t-emerald-500">
                        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                            <Timer className="w-5 h-5 text-emerald-500" />
                            Analyses
                        </h2>

                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Top Temps de Ski</h3>
                            {races?.filter(r => r.totalTime && r.splits.lap1 && r.splits.shoot1 && r.splits.lap2 && r.splits.shoot2).map(r => {
                                // Calculate Ski Time = (Total) - (Shoot1 - Lap1) - (Shoot2 - Lap2)
                                const shoot1Time = (r.splits.shoot1 || 0) - (r.splits.lap1 || 0);
                                const shoot2Time = (r.splits.shoot2 || 0) - (r.splits.lap2 || 0);
                                const skiTime = (r.totalTime || 0) - shoot1Time - shoot2Time;
                                return { ...r, skiTime };
                            }).sort((a, b) => a.skiTime - b.skiTime).slice(0, 5).map((r, idx) => {
                                const competitor = competitors?.find(c => c.id === r.competitorId);
                                return (
                                    <div key={r.id} className="flex justify-between text-sm">
                                        <div className="flex gap-2">
                                            <span className="font-mono text-slate-500">#{idx + 1}</span>
                                            <span>{competitor?.name}</span>
                                        </div>
                                        <span className="font-mono text-emerald-400">{new Date(r.skiTime).toISOString().slice(14, 21)}</span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="space-y-4 mt-6 pt-6 border-t border-white/5">
                            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Top Temps de Tir</h3>
                            {races?.filter(r => r.totalTime && r.splits.shoot1 && r.splits.lap1 && r.splits.shoot2 && r.splits.lap2).map(r => {
                                const shootTime = ((r.splits.shoot1 || 0) - (r.splits.lap1 || 0)) + ((r.splits.shoot2 || 0) - (r.splits.lap2 || 0));
                                return { ...r, shootTime };
                            }).sort((a, b) => a.shootTime - b.shootTime).slice(0, 5).map((r, idx) => {
                                const competitor = competitors?.find(c => c.id === r.competitorId);
                                return (
                                    <div key={r.id} className="flex justify-between text-sm">
                                        <div className="flex gap-2">
                                            <span className="font-mono text-slate-500">#{idx + 1}</span>
                                            <span>{competitor?.name}</span>
                                        </div>
                                        <span className="font-mono text-amber-400">{new Date(r.shootTime).toISOString().slice(14, 21)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
