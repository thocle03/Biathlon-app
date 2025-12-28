import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Play, Square, Flag, CheckCircle, Timer } from 'lucide-react';
import toast from 'react-hot-toast';
// @ts-ignore
import confetti from 'canvas-confetti';

export const RelayRace = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const eventId = Number(id);

    const event = useLiveQuery(() => db.events.get(eventId), [eventId]);
    const allRaces = useLiveQuery(() => db.races.where('eventId').equals(eventId).toArray(), [eventId]);
    const competitors = useLiveQuery(() => db.competitors.toArray());

    const [timer, setTimer] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);

    // Filter by team
    const team1Races = allRaces?.filter(r => r.teamId === 1).sort((a, b) => a.passageNumber! - b.passageNumber!) || [];
    const team2Races = allRaces?.filter(r => r.teamId === 2).sort((a, b) => a.passageNumber! - b.passageNumber!) || [];

    // Current indices (which leg is running)
    // 0 = first runner, 1 = second runner...
    // If indices >= length, team finished.
    const [team1Index, setTeam1Index] = useState(0);
    const [team2Index, setTeam2Index] = useState(0);

    // Initial state loading
    useEffect(() => {
        if (team1Races.length > 0) {
            const lastDoneIndex = team1Races.findIndex(r => !r.totalTime);
            setTeam1Index(lastDoneIndex === -1 ? team1Races.length : lastDoneIndex);
        }
        if (team2Races.length > 0) {
            const lastDoneIndex = team2Races.findIndex(r => !r.totalTime);
            setTeam2Index(lastDoneIndex === -1 ? team2Races.length : lastDoneIndex);
        }
    }, [allRaces]);

    // Timer Logic
    useEffect(() => {
        let interval: any;
        if (isRunning) {
            interval = setInterval(() => {
                setTimer(Date.now() - (startTime || Date.now()));
            }, 100);
        }
        return () => clearInterval(interval);
    }, [isRunning, startTime]);

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const tenths = Math.floor((ms % 1000) / 100);
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`;
    };

    const handleStart = () => {
        setStartTime(Date.now());
        setIsRunning(true);
    };

    const getName = (id: number) => competitors?.find(c => c.id === id)?.name || 'Inconnu';

    const handleRecordSplit = async (teamId: 1 | 2, action: 'lap1' | 'shoot1' | 'finish', value?: number) => {
        if (!startTime) return;

        const races = teamId === 1 ? team1Races : team2Races;
        const index = teamId === 1 ? team1Index : team2Index;

        if (index >= races.length) return; // Finished

        const currentRace = races[index];
        const currentTime = Date.now() - startTime;
        const updates: any = { splits: { ...currentRace.splits } };

        if (action === 'lap1') {
            updates.splits.lap1 = currentTime;
            await db.races.update(currentRace.id!, updates);
            toast.success(`Fin Tour 1 (Team ${teamId})`);
        } else if (action === 'shoot1') {
            updates.splits.shoot1 = currentTime;
            updates.shooting1 = { errors: value || 0 }; // Record errors
            updates.penaltyCount = (updates.penaltyCount || 0) + (value || 0);
            await db.races.update(currentRace.id!, updates);
            toast.success(`Tir ${value} fautes (Team ${teamId})`);
        } else if (action === 'finish') {
            updates.splits.finish = currentTime;
            updates.totalTime = currentTime;
            await db.races.update(currentRace.id!, updates);

            if (teamId === 1) setTeam1Index(i => i + 1);
            else setTeam2Index(i => i + 1);

            const isLast = index === races.length - 1;
            if (isLast) {
                toast.success(`TEAM ${teamId} TERMINE !!`, { icon: '🏆' });
            } else {
                toast.success(`Passage de relais (Team ${teamId})`);
            }
        }
    };

    // Determine Winner
    const team1CachedTime = team1Races[team1Races.length - 1]?.totalTime;
    const team2CachedTime = team2Races[team2Races.length - 1]?.totalTime;
    const winner = team1CachedTime && team2CachedTime
        ? (team1CachedTime < team2CachedTime ? 1 : 2)
        : (team1CachedTime ? 1 : (team2CachedTime ? 2 : null));

    useEffect(() => {
        if (winner && team1CachedTime && team2CachedTime) {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
            setIsRunning(false);
        }
    }, [team1CachedTime, team2CachedTime]);

    if (!event || !team1Races.length) return <div>Chargement...</div>;

    const renderTeamRow = (teamId: 1 | 2, races: any[], currentIndex: number) => {
        const isFinished = currentIndex >= races.length;
        const currentRace = !isFinished ? races[currentIndex] : null;

        return (
            <div className={`w-full glass-panel p-6 rounded-xl border-l-8 ${teamId === 1 ? 'border-blue-500 bg-slate-800/80' : 'border-emerald-500 bg-slate-800/80'} shadow-xl`}>
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    {/* Left: Team Info & Current Runner */}
                    <div className="flex items-center gap-6 min-w-[200px]">
                        <div className={`p-4 rounded-xl ${teamId === 1 ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                            <Flag className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-1">Équipe {teamId}</h2>
                            {isFinished ? (
                                <span className="text-green-400 font-bold flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4" /> Terminé
                                </span>
                            ) : (
                                <div className="animate-in fade-in">
                                    <span className="text-slate-400 text-xs uppercase font-bold tracking-wider">En piste</span>
                                    <div className="text-xl font-bold text-white">{getName(currentRace.competitorId)}</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Middle: Controls */}
                    <div className="flex-1 w-full md:w-auto flex justify-center">
                        {!isFinished && currentRace ? (
                            <div className="w-full max-w-lg">
                                {!currentRace.splits.lap1 ? (
                                    <button
                                        onClick={() => handleRecordSplit(teamId, 'lap1')}
                                        disabled={!isRunning}
                                        className="w-full py-6 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-xl shadow-lg transition-transform active:scale-95"
                                    >
                                        FIN DU TOUR
                                    </button>
                                ) : !currentRace.splits.shoot1 ? (
                                    <div className="bg-slate-700/50 p-4 rounded-xl border border-white/10">
                                        <div className="text-center mb-2 text-sm text-slate-400 uppercase font-bold tracking-wider">Score du Tir (Fautes)</div>
                                        <div className="flex gap-2 justify-center">
                                            {[0, 1, 2, 3, 4, 5].map((misses) => (
                                                <button
                                                    key={misses}
                                                    onClick={() => handleRecordSplit(teamId, 'shoot1', misses)}
                                                    className={`w-12 h-12 rounded-lg font-bold text-lg transition-all ${misses === 0 ? 'bg-green-500 hover:bg-green-400' :
                                                            misses < 3 ? 'bg-yellow-500 hover:bg-yellow-400 text-black' :
                                                                'bg-red-500 hover:bg-red-400'
                                                        } text-white shadow-lg transform hover:scale-110`}
                                                >
                                                    {misses}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleRecordSplit(teamId, 'finish')}
                                        className="w-full py-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xl shadow-lg transition-transform active:scale-95 animate-pulse"
                                    >
                                        {currentIndex === races.length - 1 ? 'ARRIVÉE FINALE 🏁' : 'PASSAGE DE RELAIS ➔'}
                                    </button>
                                )}
                            </div>
                        ) : isFinished ? (
                            <div className="text-4xl font-mono font-bold text-white">
                                {formatTime(races[races.length - 1].totalTime || 0)}
                            </div>
                        ) : (
                            <div className="text-slate-500 italic">En attente...</div>
                        )}
                    </div>

                    {/* Right: History Miniatures */}
                    <div className="flex gap-2 overflow-x-auto max-w-md pb-2">
                        {races.map((r, idx) => (
                            <div
                                key={r.id}
                                className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center font-bold text-sm border ${idx === currentIndex ? 'bg-white text-slate-900 border-white ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900' :
                                        idx < currentIndex ? 'bg-slate-700 text-slate-400 border-slate-600' :
                                            'bg-slate-800/50 text-slate-600 border-slate-700/50'
                                    }`}
                                title={getName(r.competitorId)}
                            >
                                {idx + 1}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-4 pb-20 bg-[url('/biathlon_bg.png')] bg-cover bg-fixed">
            <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm fixed" />

            <div className="relative z-10 max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors backdrop-blur-md">
                            <Flag className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-white drop-shadow-md">{event.name}</h1>
                            <span className="text-slate-400 text-sm font-medium">Relais • {competitors?.length} concurrents</span>
                        </div>
                    </div>

                    {/* Global Timer */}
                    <div className="bg-slate-800/80 backdrop-blur-md px-8 py-4 rounded-2xl border border-white/10 flex items-center gap-6 shadow-2xl">
                        <Timer className="w-8 h-8 text-blue-400" />
                        <span className="text-5xl font-mono font-black tracking-widest min-w-[220px] text-center bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                            {formatTime(timer)}
                        </span>
                        {!isRunning ? (
                            <button
                                onClick={handleStart}
                                className="w-14 h-14 bg-green-500 hover:bg-green-400 rounded-full flex items-center justify-center transition-all shadow-lg shadow-green-500/30 hover:scale-105"
                            >
                                <Play className="w-6 h-6 fill-current ml-1" />
                            </button>
                        ) : (
                            <button
                                onClick={() => setIsRunning(false)}
                                className="w-14 h-14 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center transition-all shadow-lg shadow-red-500/30 hover:scale-105"
                            >
                                <Square className="w-5 h-5 fill-current" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Rows */}
                <div className="space-y-6">
                    {renderTeamRow(1, team1Races, team1Index)}
                    {renderTeamRow(2, team2Races, team2Index)}
                </div>
            </div>
        </div>
    );
};
