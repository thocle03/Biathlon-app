import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Trophy, Star, Timer, Target, ArrowLeft, Snowflake } from 'lucide-react';
import { useLocation } from '../context/LocationContext';
import clsx from 'clsx';

export const IndividualStats = () => {
    const navigate = useNavigate();
    const { location } = useLocation();
    const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');

    const competitors = useLiveQuery(() => db.competitors.toArray());
    const events = useLiveQuery(() => db.events.where('location').equals(location).toArray(), [location]);
    const allRaces = useLiveQuery(() => db.races.toArray());

    if (!competitors || !events || !allRaces) return null;

    const typeEvents = events.filter(e => e.type === 'individual');
    const availableYears = Array.from(new Set(typeEvents.map(e => new Date(e.date).getFullYear()))).sort((a, b) => b - a);

    const filteredEvents = selectedYear === 'all'
        ? typeEvents
        : typeEvents.filter(e => new Date(e.date).getFullYear() === selectedYear);

    const filteredEventIds = filteredEvents.map(e => e.id);
    const individualRaces = allRaces.filter(r => filteredEventIds.includes(r.eventId) && r.totalTime);

    // Points system
    const POINTS_SYSTEM = {
        0: [5, 3, 1], // Level 0 - Only top 3
        1: [10, 7, 5, 3, 1], // Level 1
        2: [20, 14, 10, 6, 3], // Level 2
        3: [50, 35, 25, 15, 10], // Level 3
        4: [100, 80, 60, 40, 20, 16, 12, 8], // Level 4 - Top 8
        5: [200, 140, 100, 60, 40, 30, 20, 10, 5, 2] // Level 5 - Top 10
    };

    // Calculate aggregated stats per competitor
    const competitorStats = competitors.map(c => {
        const races = individualRaces.filter(r => r.competitorId === c.id);
        if (races.length === 0) return null;

        let totalPoints = 0;
        let wins = 0;
        let podiums = 0;
        let totalSkiTime = 0;
        let totalShootTime = 0;
        let totalLaps = 0;
        let bestLapTime = Infinity;
        let shootingStats = [0, 0, 0, 0]; // Hits for S1, S2, S3, S4

        races.forEach(r => {
            // Points (simplification)
            const event = events.find(e => e.id === r.eventId);
            if (event) {
                const eventRaces = individualRaces.filter(ir => ir.eventId === event.id).sort((a, b) => (a.totalTime || 0) - (b.totalTime || 0));
                const rank = eventRaces.findIndex(ir => ir.id === r.id) + 1;
                const scale = POINTS_SYSTEM[event.level as keyof typeof POINTS_SYSTEM] || [];
                totalPoints += Math.ceil((scale[rank - 1] || 0) * 1.5);
                if (rank === 1) wins++;
                if (rank <= 3) podiums++;
            }

            const s = r.splits;
            const trackLaps = [
                s.lap1 ? (s.start ? s.lap1 - s.start : s.lap1) : 0, // First Lap
                s.lap2 && s.shoot1 ? s.lap2 - s.shoot1 : 0,
                s.lap3 && s.shoot2 ? s.lap3 - s.shoot2 : 0,
                s.lap4 && s.shoot3 ? s.lap4 - s.shoot3 : 0,
                s.finish && s.shoot4 ? s.finish - s.shoot4 : 0
            ].filter(t => t > 0);

            totalSkiTime += trackLaps.reduce((sum, lap) => sum + lap, 0);
            totalLaps += trackLaps.length;

            trackLaps.forEach(l => { if (l < bestLapTime) bestLapTime = l; });

            const sh1 = s.shoot1 && s.lap1 ? s.shoot1 - s.lap1 : 0;
            const sh2 = s.shoot2 && s.lap2 ? s.shoot2 - s.lap2 : 0;
            const sh3 = s.shoot3 && s.lap3 ? s.shoot3 - s.lap3 : 0;
            const sh4 = s.shoot4 && s.lap4 ? s.shoot4 - s.lap4 : 0;
            totalShootTime += (sh1 + sh2 + sh3 + sh4);

            shootingStats[0] += 5 - (r.shooting1?.errors || 0);
            shootingStats[1] += 5 - (r.shooting2?.errors || 0);
            shootingStats[2] += 5 - (r.shooting3?.errors || 0);
            shootingStats[3] += 5 - (r.shooting4?.errors || 0);
        });

        const avgLapTime = totalLaps > 0 ? totalSkiTime / totalLaps : 0;
        const shootingAccuracy = (shootingStats.reduce((a, b) => a + b, 0) / (races.length * 20)) * 100;

        return {
            ...c,
            totalPoints,
            wins,
            podiums,
            racesCount: races.length,
            avgLapTime,
            bestLapTime: bestLapTime === Infinity ? 0 : bestLapTime,
            shootingAccuracy,
            shootingStats: shootingStats.map(s => (s / (races.length * 5)) * 100)
        };
    }).filter((c): c is NonNullable<typeof c> => c !== null).sort((a, b) => b.totalPoints - a.totalPoints);

    const formatTime = (ms: number) => {
        if (!ms) return '-';
        return new Date(ms).toISOString().slice(14, 21);
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/stats')} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 to-indigo-600">
                        Analyse Individuel {selectedYear !== 'all' && `- ${selectedYear}`}
                    </h1>
                </div>

                <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg">
                    <button onClick={() => setSelectedYear('all')} className={clsx("px-4 py-1.5 rounded-md text-sm font-medium transition-all", selectedYear === 'all' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white')}>Global</button>
                    {availableYears.map(year => (
                        <button key={year} onClick={() => setSelectedYear(year)} className={clsx("px-4 py-1.5 rounded-md text-sm font-medium transition-all", selectedYear === year ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white')}>{year}</button>
                    ))}
                </div>
            </div>

            {competitorStats.length === 0 ? (
                <div className="glass-panel p-12 rounded-2xl text-center">
                    <Trophy className="w-16 h-16 mx-auto text-slate-600 mb-4" />
                    <h3 className="text-xl font-semibold text-slate-400">Aucune donnée</h3>
                    <p className="text-slate-500">Créez des courses d'individuel pour voir les analyses</p>
                </div>
            ) : (
                <>
                    {/* Top Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <StatCard icon={<Trophy className="text-yellow-500" />} label="Plus de Victoires" value={[...competitorStats].sort((a, b) => b.wins - a.wins)[0].name} subValue={`${[...competitorStats].sort((a, b) => b.wins - a.wins)[0].wins} victoires`} />
                        <StatCard icon={<Target className="text-emerald-500" />} label="Meilleur Tireur" value={[...competitorStats].sort((a, b) => b.shootingAccuracy - a.shootingAccuracy)[0].name} subValue={`${[...competitorStats].sort((a, b) => b.shootingAccuracy - a.shootingAccuracy)[0].shootingAccuracy.toFixed(1)}%`} />
                        <StatCard icon={<Snowflake className="text-cyan-500" />} label="Plus Rapide (Lap)" value={[...competitorStats].sort((a, b) => (a.bestLapTime || Infinity) - (b.bestLapTime || Infinity))[0].name} subValue={formatTime([...competitorStats].sort((a, b) => (a.bestLapTime || Infinity) - (b.bestLapTime || Infinity))[0].bestLapTime)} />
                        <StatCard icon={<Timer className="text-purple-500" />} label="Régularité (Avg Lap)" value={[...competitorStats].sort((a, b) => (a.avgLapTime || Infinity) - (b.avgLapTime || Infinity))[0].name} subValue={formatTime([...competitorStats].sort((a, b) => (a.avgLapTime || Infinity) - (b.avgLapTime || Infinity))[0].avgLapTime)} />
                    </div>

                    <div className="glass-panel p-6 rounded-2xl border-t-4 border-t-indigo-500 overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b border-white/10">
                                <tr className="text-left text-slate-400 text-xs uppercase tracking-wider">
                                    <th className="pb-4 font-bold">Concurrent</th>
                                    <th className="pb-4 font-bold text-center">Courses</th>
                                    <th className="pb-4 font-bold text-center">Précision Globale</th>
                                    <th className="pb-4 font-bold text-center">Tir 1 / 2 / 3 / 4</th>
                                    <th className="pb-4 font-bold text-center">Meilleur Tour</th>
                                    <th className="pb-4 font-bold text-center">Tour Moyen</th>
                                    <th className="pb-4 font-bold text-right">Points</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {competitorStats.map((c, idx) => (
                                    <tr key={c.id} className="hover:bg-white/5 transition-colors cursor-pointer" onClick={() => navigate(`/competitors/${c.id}`)}>
                                        <td className="py-4 font-bold flex items-center gap-3">
                                            <span className="text-slate-500 text-sm">#{idx + 1}</span>
                                            {c.name}
                                        </td>
                                        <td className="py-4 text-center text-slate-400">{c.racesCount}</td>
                                        <td className="py-4 text-center">
                                            <div className="font-bold text-emerald-400">{c.shootingAccuracy.toFixed(1)}%</div>
                                        </td>
                                        <td className="py-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                {c.shootingStats.map((s, i) => (
                                                    <span key={i} className={clsx("text-xs font-mono px-1.5 py-0.5 rounded", s > 90 ? "bg-emerald-500/20 text-emerald-400" : s > 75 ? "bg-blue-500/20 text-blue-400" : "bg-white/5 text-slate-500")}>
                                                        {s.toFixed(0)}%
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="py-4 text-center font-mono text-cyan-400">{formatTime(c.bestLapTime)}</td>
                                        <td className="py-4 text-center font-mono text-slate-300">{formatTime(c.avgLapTime)}</td>
                                        <td className="py-4 text-right font-black text-xl text-yellow-500">{c.totalPoints}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
};

const StatCard = ({ icon, label, value, subValue }: any) => (
    <div className="glass-panel p-4 rounded-xl border border-white/5 flex items-center gap-4">
        <div className="p-3 bg-white/5 rounded-lg">{icon}</div>
        <div>
            <div className="text-xs text-slate-500 font-bold uppercase">{label}</div>
            <div className="font-bold text-white truncate max-w-[120px]">{value}</div>
            <div className="text-xs font-bold text-slate-400">{subValue}</div>
        </div>
    </div>
);
