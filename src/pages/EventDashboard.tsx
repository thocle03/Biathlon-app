import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ArrowLeft, Play, Flag, Edit, Trash2, Save, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../components/ui/Modal';
import { useState } from 'react';

export const EventDashboard = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const eventId = Number(id);

    const event = useLiveQuery(() => db.events.get(eventId), [eventId]);
    const races = useLiveQuery(() =>
        db.races.where('eventId').equals(eventId).toArray()
        , [eventId]);

    const competitors = useLiveQuery(() => db.competitors.toArray());

    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editLevel, setEditLevel] = useState(1);

    // Add Duel State
    const [isAddDuelOpen, setIsAddDuelOpen] = useState(false);
    const [newDuelP1, setNewDuelP1] = useState<number | ''>('');
    const [newDuelP2, setNewDuelP2] = useState<number | ''>('');

    if (!event) return null;

    const isMassStart = event.type === 'pursuit' || event.type === 'relay';

    const startEditing = () => {
        setEditName(event.name);
        setEditDate(new Date(event.date).toISOString().split('T')[0]);
        setEditLevel(event.level);
        setIsEditing(true);
    };

    const saveDetails = async () => {
        if (!editName.trim()) {
            toast.error("Le nom ne peut pas être vide");
            return;
        }
        await db.events.update(eventId, {
            name: editName,
            date: new Date(editDate),
            level: editLevel
        });
        setIsEditing(false);
        toast.success("Modifications enregistrées");
    };

    const handleAddDuel = async () => {
        if (!newDuelP1) {
            toast.error("Sélectionnez au moins un concurrent");
            return;
        }

        const race1 = {
            eventId: eventId,
            competitorId: Number(newDuelP1),
            opponentId: newDuelP2 ? Number(newDuelP2) : undefined,
            mode: event.type,
            splits: {},
            shooting1: { errors: 0 },
            shooting2: { errors: 0 },
            penaltyCount: 0,
        };

        if (newDuelP2) {
            const race2 = {
                eventId: eventId,
                competitorId: Number(newDuelP2),
                opponentId: Number(newDuelP1),
                mode: event.type,
                splits: {},
                shooting1: { errors: 0 },
                shooting2: { errors: 0 },
                penaltyCount: 0,
            };
            await db.transaction('rw', db.races, async () => {
                await db.races.add(race1);
                await db.races.add(race2);
            });
        } else {
            await db.races.add(race1);
        }

        toast.success("Ajouté !");
        setIsAddDuelOpen(false);
        setNewDuelP1('');
        setNewDuelP2('');
    };

    const handleDeleteEvent = async () => {
        if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet événement ?")) {
            return;
        }

        try {
            await db.transaction('rw', db.events, db.races, async () => {
                await db.races.where('eventId').equals(eventId).delete();
                await db.events.delete(eventId);
            });

            toast.success("Événement supprimé");
            navigate('/events');
        } catch (error) {
            console.error(error);
            toast.error("Erreur lors de la suppression");
        }
    };

    // Group races into Duels (Only relevant for Sprint/Individual or display purposes)
    const processDuels = () => {
        const processedIds = new Set<number>();
        const d = [];
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
                d.push(duel);
            }
        }
        return d;
    };

    const duels = processDuels();

    const handleDeleteDuel = async (duel: any) => {
        if (!window.confirm("Supprimer ?")) return;
        try {
            await db.transaction('rw', db.races, async () => {
                await db.races.delete(duel.race1.id!);
                if (duel.race2) await db.races.delete(duel.race2.id!);
            });
            toast.success("Supprimé");
        } catch (error) {
            toast.error("Erreur suppression");
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(`/events/${event.type || 'sprint'}`)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        {isEditing ? (
                            <div className="space-y-2">
                                <input value={editName} onChange={e => setEditName(e.target.value)} className="text-3xl font-bold bg-slate-800 border border-white/10 rounded px-2 py-1 w-full" />
                                <div className="flex items-center gap-2">
                                    <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="bg-slate-800 border border-white/10 rounded px-2 py-1 text-sm text-slate-300" />
                                    <select
                                        value={editLevel}
                                        onChange={e => setEditLevel(Number(e.target.value))}
                                        className="bg-slate-800 border border-white/10 rounded px-2 py-1 text-sm text-slate-300"
                                    >
                                        <option value={0}>Niveau 0</option>
                                        <option value={1}>Niveau 1</option>
                                        <option value={2}>Niveau 2</option>
                                        <option value={3}>Niveau 3</option>
                                        <option value={4}>Niveau 4</option>
                                        <option value={5}>Niveau 5</option>
                                    </select>
                                    <button onClick={saveDetails} className="p-1 bg-green-500/20 text-green-500 rounded hover:bg-green-500 hover:text-white transition-colors"><Save className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <h1 className="text-3xl font-bold flex items-center gap-3">
                                    {event.name}
                                    <button onClick={startEditing} className="p-1 text-slate-500 hover:text-white transition-colors"><Edit className="w-5 h-5" /></button>
                                </h1>
                                <div className="flex items-center gap-3 text-slate-400 mt-1">
                                    <span className="capitalize">{event.type || 'Sprint'}</span>
                                    <span>•</span>
                                    <span>Niveau {event.level}</span>
                                    <span>•</span>
                                    <span>{new Date(event.date).toLocaleDateString()}</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex gap-2">
                    {isMassStart && event.type !== 'relay' && (
                        <button
                            onClick={() => navigate(`/race-mass/${eventId}`)}
                            className="bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2 transition-all"
                        >
                            <Play className="w-5 h-5" />
                            INTERFACE COURSE
                        </button>
                    )}
                    <button onClick={handleDeleteEvent} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all">
                        <Trash2 className="w-6 h-6" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Duel/Participant List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">{isMassStart ? 'Participants' : 'Duels'}</h2>

                        {event.type === 'relay' ? (
                            <button
                                onClick={() => setIsAddDuelOpen(true)} // Can reuse for "Set Result" if we rename/adapt state
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-lg transition-all text-sm font-bold"
                            >
                                <Edit className="w-4 h-4" />
                                SAISIE RÉSULTAT RAPIDE
                            </button>
                        ) : (
                            <button
                                onClick={() => setIsAddDuelOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg transition-all text-sm font-medium"
                            >
                                <Plus className="w-4 h-4" />
                                {isMassStart ? 'Ajouter Participant' : 'Ajouter Duel'}
                            </button>
                        )}
                    </div>

                    {event.type === 'relay' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Static display of teams for Relay - logic is simpler here as we just want to launch the race */}
                            {[1, 2].map(teamId => {
                                const teamRaces = races?.filter(r => r.teamId === teamId).sort((a, b) => (a.passageNumber || 0) - (b.passageNumber || 0));
                                if (!teamRaces?.length) return null;

                                return (
                                    <div key={teamId} className={`glass-panel p-6 rounded-2xl border-t-4 ${teamId === 1 ? 'border-blue-500' : 'border-emerald-500'}`}>
                                        <h3 className="text-xl font-bold mb-4">Équipe {teamId}</h3>
                                        <div className="space-y-2">
                                            {teamRaces.map((r, idx) => {
                                                const c = competitors?.find(c => c.id === r.competitorId);
                                                return (
                                                    <div key={r.id} className="flex items-center gap-2 text-slate-300">
                                                        <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                                                        <span>{c?.name}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}

                            <div className="md:col-span-2 mt-4">
                                <button
                                    onClick={() => navigate(`/race-relay/${eventId}`)}
                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xl shadow-lg flex items-center justify-center gap-3 transition-transform hover:scale-[1.02]"
                                >
                                    <Play className="w-6 h-6 fill-current" />
                                    LANCER LE RELAIS
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {duels.map((duel, idx) => (
                                <div key={idx} className="glass-panel p-6 rounded-2xl flex items-center justify-between group relative">
                                    <button
                                        onClick={() => handleDeleteDuel(duel)}
                                        className="absolute top-2 right-2 p-1 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>

                                    <div className="flex-1 flex items-center justify-between gap-8">
                                        <div className="flex-1 text-right font-semibold text-lg">{duel.r1Name}</div>
                                        {!isMassStart && (
                                            <>
                                                <div className="px-3 py-1 bg-white/5 rounded text-xs font-bold text-slate-500 uppercase">VS</div>
                                                <div className="flex-1 text-left font-semibold text-lg text-slate-300">{duel.r2Name}</div>
                                            </>
                                        )}
                                        {isMassStart && <div className="flex-1"></div>}
                                    </div>

                                    {!isMassStart && (
                                        <div className="flex flex-col gap-2">
                                            <button
                                                onClick={() => navigate(`/race/${duel.race1.id}`)}
                                                className="flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium shadow-lg shadow-blue-900/20 transition-all hover:scale-105"
                                            >
                                                <Play className="w-4 h-4 fill-current" />
                                                Lancer
                                            </button>
                                            <div className="flex gap-1 justify-center">
                                                <button onClick={() => navigate(`/race/manual/${duel.race1.id}`)} className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-xs rounded-lg font-medium transition-all hover:text-white">
                                                    <Edit className="w-3 h-3" /> {duel.r1Name?.split(' ')[0]}
                                                </button>
                                                {duel.race2 && (
                                                    <button onClick={() => navigate(`/race/manual/${duel.race2!.id}`)} className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-xs rounded-lg font-medium transition-all hover:text-white">
                                                        <Edit className="w-3 h-3" /> {duel.r2Name?.split(' ')[0]}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right: Leaderboard & Analysis (Compatible for all modes) */}
                <div className="space-y-6">
                    {/* Leaderboard */}
                    <div className="glass-panel p-6 rounded-2xl border-t-4 border-t-yellow-500">
                        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                            <Flag className="w-5 h-5 text-yellow-500" />
                            Classement
                        </h2>

                        <div className="space-y-3">
                            {event.type === 'relay' ? (
                                <>
                                    {[1, 2].map(teamId => {
                                        // Determine status based on ANY race in the team having rank set
                                        const teamRaces = races?.filter(r => r.teamId === teamId) || [];
                                        if (!teamRaces.length) return null;

                                        const isWinner = teamRaces.some(r => r.rank === 1);
                                        const isLoser = teamRaces.some(r => r.rank === 2);

                                        if (!isWinner && !isLoser) return null; // No result yet

                                        let points = 0;
                                        if (event.level === 10) points = isWinner ? 10 : 4;
                                        else if (event.level === 11) points = isWinner ? 5 : 2;
                                        else if (event.level === 12) points = isWinner ? 3 : 1;
                                        else points = isWinner ? 10 : 0; // Default

                                        return (
                                            <div key={teamId} className={`p-4 rounded-xl border-l-4 ${isWinner ? 'bg-yellow-500/10 border-yellow-500' : 'bg-slate-800 border-slate-600'}`}>
                                                <div className="flex items-center justify-between mb-3">
                                                    <h3 className={`font-bold text-lg flex items-center gap-2 ${isWinner ? 'text-yellow-400' : 'text-slate-400'}`}>
                                                        {isWinner ? <Flag className="w-5 h-5 fill-current" /> : null}
                                                        {isWinner ? 'VICTOIRE ÉQUIPE ' + teamId : 'ÉQUIPE ' + teamId}
                                                    </h3>
                                                    <span className="font-bold text-white bg-white/10 px-2 py-1 rounded">
                                                        +{points} pts
                                                    </span>
                                                </div>
                                                <div className="space-y-1 pl-4 border-l border-white/10">
                                                    {teamRaces.map(r => (
                                                        <div key={r.id} className="text-sm text-slate-300">
                                                            {competitors?.find(c => c.id === r.competitorId)?.name}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {!races?.some(r => r.rank) && (
                                        <div className="text-center py-8 text-slate-500 text-sm italic">
                                            En attente de résultats...
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
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
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Duel Modal */}
            <Modal isOpen={isAddDuelOpen} onClose={() => setIsAddDuelOpen(false)} title={isMassStart ? "Ajouter Concurrent" : "Ajouter un Duel"}>
                {event.type === 'relay' ? (
                    <div className="space-y-4 text-center">
                        <h3 className="text-lg font-bold mb-4">Qui a gagné le relais ?</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={async () => {
                                    await db.transaction('rw', db.races, async () => {
                                        const team1Races = races?.filter(r => r.teamId === 1) || [];
                                        const team2Races = races?.filter(r => r.teamId === 2) || [];

                                        // Set Team 1 as Winner (Rank 1)
                                        for (const r of team1Races) {
                                            await db.races.update(r.id!, {
                                                rank: 1,
                                                totalTime: r.totalTime || 1, // Ensure it's marked as done
                                                splits: { ...r.splits, finish: Date.now() } // Mark finished
                                            });
                                        }
                                        // Set Team 2 as Loser (Rank 2)
                                        for (const r of team2Races) {
                                            await db.races.update(r.id!, {
                                                rank: 2,
                                                totalTime: r.totalTime || 1,
                                                splits: { ...r.splits, finish: Date.now() }
                                            });
                                        }
                                    });
                                    toast.success("Victoire Équipe 1 enregistrée 🏆");
                                    setIsAddDuelOpen(false);
                                }}
                                className="p-6 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-xl shadow-lg transition-transform hover:scale-105"
                            >
                                ÉQUIPE 1
                            </button>

                            <button
                                onClick={async () => {
                                    await db.transaction('rw', db.races, async () => {
                                        const team1Races = races?.filter(r => r.teamId === 1) || [];
                                        const team2Races = races?.filter(r => r.teamId === 2) || [];

                                        // Set Team 2 as Winner (Rank 1)
                                        for (const r of team2Races) {
                                            await db.races.update(r.id!, {
                                                rank: 1,
                                                totalTime: r.totalTime || 1, // Ensure it's marked as done
                                                splits: { ...r.splits, finish: Date.now() } // Mark finished
                                            });
                                        }
                                        // Set Team 1 as Loser (Rank 2)
                                        for (const r of team1Races) {
                                            await db.races.update(r.id!, {
                                                rank: 2,
                                                totalTime: r.totalTime || 1,
                                                splits: { ...r.splits, finish: Date.now() }
                                            });
                                        }
                                    });
                                    toast.success("Victoire Équipe 2 enregistrée 🏆");
                                    setIsAddDuelOpen(false);
                                }}
                                className="p-6 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-xl shadow-lg transition-transform hover:scale-105"
                            >
                                ÉQUIPE 2
                            </button>
                        </div>
                        <p className="text-slate-400 text-sm mt-4">
                            Note : Cela attribuera automatiquement la victoire et les points à tous les membres de l'équipe gagnante.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Concurrent 1</label>
                            <select
                                value={newDuelP1}
                                onChange={e => setNewDuelP1(Number(e.target.value))}
                                className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white font-medium focus:outline-none focus:border-blue-500"
                            >
                                <option value="">Sélectionner...</option>
                                {competitors?.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {!isMassStart && (
                            <>
                                <div className="flex items-center justify-center text-slate-500 font-bold text-sm uppercase">VS</div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Concurrent 2 (Optionnel)</label>
                                    <select
                                        value={newDuelP2}
                                        onChange={e => setNewDuelP2(Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white font-medium focus:outline-none focus:border-blue-500"
                                    >
                                        <option value="">Solo</option>
                                        {competitors?.filter(c => c.id !== newDuelP1).map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        )}

                        <button
                            onClick={handleAddDuel}
                            disabled={!newDuelP1}
                            className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20"
                        >
                            {isMassStart ? 'Ajouter' : 'Créer le duel'}
                        </button>
                    </div>
                )}
            </Modal>
        </div>
    );
};
