import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ArrowLeft, Trophy, Target, Timer, Medal } from 'lucide-react';

export const CompetitorProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const compId = Number(id);

    const competitor = useLiveQuery(() => db.competitors.get(compId), [compId]);
    const races = useLiveQuery(() =>
        db.races.where('competitorId').equals(compId).toArray()
        , [compId]);
    const events = useLiveQuery(() => db.events.toArray());

    if (!competitor) return null;

    // Calculate detailed stats
    const totalRaces = races?.length || 0;

    // Shooting stats
    let totalShots = 0;
    let totalHits = 0;
    races?.forEach(r => {
        if (r.shooting1) {
            totalShots += 5;
            totalHits += (5 - r.shooting1.errors);
        }
        if (r.shooting2) {
            totalShots += 5;
            totalHits += (5 - r.shooting2.errors);
        }
    });
    const shootingAccuracy = totalShots > 0 ? Math.round((totalHits / totalShots) * 100) : 0;

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/competitors')}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-3xl font-bold">{competitor.name}</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 mb-3">
                        <Medal className="w-6 h-6" />
                    </div>
                    <div className="text-3xl font-bold text-white">{totalRaces}</div>
                    <div className="text-sm text-slate-400">Courses</div>
                </div>

                <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                        <Target className="w-6 h-6" />
                    </div>
                    <div className="text-3xl font-bold text-white">{shootingAccuracy}%</div>
                    <div className="text-sm text-slate-400">Précision Tir</div>
                </div>

                <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-500 mb-3">
                        <Trophy className="w-6 h-6" />
                    </div>
                    <div className="text-3xl font-bold text-white">{competitor.podiums}</div>
                    <div className="text-sm text-slate-400">Podiums</div>
                </div>

                <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 mb-3">
                        <Timer className="w-6 h-6" />
                    </div>
                    <div className="text-3xl font-bold text-white">
                        {competitor.bestPosition ? `#${competitor.bestPosition}` : '-'}
                    </div>
                    <div className="text-sm text-slate-400">Meilleure Place</div>
                </div>
            </div>

            <div className="glass-panel rounded-2xl overflow-hidden">
                <h2 className="text-xl font-semibold p-6 border-b border-white/10">Historique des courses</h2>
                <table className="w-full text-left">
                    <thead className="bg-white/5 text-slate-400 font-medium">
                        <tr>
                            <th className="p-4">Date</th>
                            <th className="p-4">Événement</th>
                            <th className="p-4 text-center">Tirs</th>
                            <th className="p-4 text-right">Temps</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {races?.slice().reverse().map(race => {
                            const event = events?.find(e => e.id === race.eventId);
                            const errors = (race.shooting1?.errors || 0) + (race.shooting2?.errors || 0);
                            return (
                                <tr key={race.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 text-slate-400">{event ? new Date(event.date).toLocaleDateString() : '-'}</td>
                                    <td className="p-4 font-medium text-white">{event?.name || 'Inconnu'}</td>
                                    <td className="p-4 text-center">
                                        <span className={errors === 0 ? "text-emerald-400 font-bold" : "text-slate-300"}>
                                            {10 - errors}/10
                                        </span>
                                    </td>
                                    <td className="p-4 text-right font-mono">
                                        {race.totalTime ? new Date(race.totalTime).toISOString().slice(14, 21) : '-'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
