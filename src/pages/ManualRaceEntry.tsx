import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ArrowLeft, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const parseTimeInput = (input: string): number | null => {
    if (!input) return null;
    try {
        const parts = input.split(':');
        let seconds = 0;
        if (parts.length === 2) {
            seconds += parseInt(parts[0]) * 60;
            seconds += parseFloat(parts[1]);
        } else if (parts.length === 1) {
            seconds += parseFloat(parts[0]);
        } else {
            return null;
        }
        return Math.round(seconds * 1000);
    } catch (e) {
        return null;
    }
};

const formatTimeInput = (ms: number | undefined) => {
    if (!ms && ms !== 0) return '';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`;
};

export const ManualRaceEntry = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const raceId = Number(id);

    const race = useLiveQuery(() => db.races.get(raceId), [raceId]);
    const competitor = useLiveQuery(() => race ? db.competitors.get(race.competitorId) : undefined, [race]);

    const [lap1, setLap1] = useState('');
    const [shoot1Time, setShoot1Time] = useState('');
    const [lap2, setLap2] = useState('');
    const [shoot2Time, setShoot2Time] = useState('');
    const [lap3, setLap3] = useState('');
    const [shoot3Time, setShoot3Time] = useState('');
    const [lap4, setLap4] = useState('');
    const [shoot4Time, setShoot4Time] = useState('');
    const [finish, setFinish] = useState('');

    const [shoot1Errors, setShoot1Errors] = useState(0);
    const [shoot2Errors, setShoot2Errors] = useState(0);
    const [shoot3Errors, setShoot3Errors] = useState(0);
    const [shoot4Errors, setShoot4Errors] = useState(0);

    const isIndividual = race?.mode === 'individual';

    useEffect(() => {
        if (race && race.splits) {
            const start = race.splits.start || 0;
            const getDuration = (val: number | undefined) => {
                if (!val) return undefined;
                if (start > 0 && val > start) return val - start;
                return val;
            };

            setLap1(formatTimeInput(getDuration(race.splits.lap1)));
            setShoot1Time(formatTimeInput(getDuration(race.splits.shoot1)));
            setLap2(formatTimeInput(getDuration(race.splits.lap2)));
            setShoot2Time(formatTimeInput(getDuration(race.splits.shoot2)));
            setLap3(formatTimeInput(getDuration(race.splits.lap3)));
            setShoot3Time(formatTimeInput(getDuration(race.splits.shoot3)));
            setLap4(formatTimeInput(getDuration(race.splits.lap4)));
            setShoot4Time(formatTimeInput(getDuration(race.splits.shoot4)));
            setFinish(formatTimeInput(getDuration(race.splits.finish)));
        }
        if (race?.shooting1) setShoot1Errors(race.shooting1.errors);
        if (race?.shooting2) setShoot2Errors(race.shooting2.errors);
        if (race?.shooting3) setShoot3Errors(race.shooting3.errors);
        if (race?.shooting4) setShoot4Errors(race.shooting4.errors);
    }, [race]);

    const handleSave = async () => {
        if (!race) return;

        const splits: any = { ...race.splits };
        const start = race.splits.start || 0;

        const toAbsolute = (duration: number | null) => {
            if (duration === null) return undefined;
            if (start > 0) return start + duration;
            return duration;
        };

        const l1 = parseTimeInput(lap1);
        const s1 = parseTimeInput(shoot1Time);
        const l2 = parseTimeInput(lap2);
        const s2 = parseTimeInput(shoot2Time);
        const l3 = parseTimeInput(lap3);
        const s3 = parseTimeInput(shoot3Time);
        const l4 = parseTimeInput(lap4);
        const s4 = parseTimeInput(shoot4Time);
        const fin = parseTimeInput(finish);

        if (l1 !== null) splits.lap1 = toAbsolute(l1);
        if (s1 !== null) splits.shoot1 = toAbsolute(s1);
        if (l2 !== null) splits.lap2 = toAbsolute(l2);
        if (s2 !== null) splits.shoot2 = toAbsolute(s2);
        if (l3 !== null) splits.lap3 = toAbsolute(l3);
        if (s3 !== null) splits.shoot3 = toAbsolute(s3);
        if (l4 !== null) splits.lap4 = toAbsolute(l4);
        if (s4 !== null) splits.shoot4 = toAbsolute(s4);
        if (fin !== null) splits.finish = toAbsolute(fin);

        const totalErrors = shoot1Errors + shoot2Errors + (isIndividual ? shoot3Errors + shoot4Errors : 0);
        let finalTime = fin !== null ? fin : race.totalTime;

        // Add Individual Penalty: 15s per miss
        if (isIndividual && fin !== null) {
            finalTime = fin + (totalErrors * 15000);
        }

        await db.races.update(raceId, {
            splits,
            shooting1: { errors: shoot1Errors },
            shooting2: { errors: shoot2Errors },
            shooting3: isIndividual ? { errors: shoot3Errors } : undefined,
            shooting4: isIndividual ? { errors: shoot4Errors } : undefined,
            totalTime: finalTime,
            penaltyCount: totalErrors,
        });

        toast.success("Enregistré !");
        navigate(-1);
    };

    if (!race || !competitor) return null;

    return (
        <div className="space-y-8 max-w-4xl mx-auto p-4">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-3xl font-bold">Saisie Manuelle</h1>
            </div>

            <div className="glass-panel p-6 rounded-2xl space-y-6">
                <div className="border-b border-white/10 pb-4">
                    <h2 className="text-xl font-bold">{competitor.name}</h2>
                    <p className="text-slate-400 text-sm capitalize">{race.mode} - MM:SS.t (Cumulés)</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <InputGroup label="Fin Tour 1" value={lap1} onChange={setLap1} />
                        <InputGroup label="Sortie Tir 1" value={shoot1Time} onChange={setShoot1Time} />
                        <InputGroup label="Fin Tour 2" value={lap2} onChange={setLap2} />
                        <InputGroup label="Sortie Tir 2" value={shoot2Time} onChange={setShoot2Time} />

                        {isIndividual && (
                            <>
                                <InputGroup label="Fin Tour 3" value={lap3} onChange={setLap3} />
                                <InputGroup label="Sortie Tir 3" value={shoot3Time} onChange={setShoot3Time} />
                                <InputGroup label="Fin Tour 4" value={lap4} onChange={setLap4} />
                                <InputGroup label="Sortie Tir 4" value={shoot4Time} onChange={setShoot4Time} />
                            </>
                        )}

                        <div className="pt-4 border-t border-white/10">
                            <InputGroup label="TEMPS FINAL" value={finish} onChange={setFinish} color="emerald" isFinal />
                        </div>
                    </div>

                    <div className="space-y-6">
                        <ShootingSelector label="Tir 1 (Couché)" value={shoot1Errors} onChange={setShoot1Errors} color="emerald" />
                        <ShootingSelector label={isIndividual ? "Tir 2 (Couché)" : "Tir 2 (Debout)"} value={shoot2Errors} onChange={setShoot2Errors} color={isIndividual ? "emerald" : "blue"} />

                        {isIndividual && (
                            <>
                                <ShootingSelector label="Tir 3 (Debout)" value={shoot3Errors} onChange={setShoot3Errors} color="blue" />
                                <ShootingSelector label="Tir 4 (Debout)" value={shoot4Errors} onChange={setShoot4Errors} color="blue" />
                            </>
                        )}

                        <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/20 text-amber-200 text-xs">
                            Note: En Individuel, ne PAS ajouter de temps de pénalité manuellement au chrono. Le système calculera les points doublés. En d'autres modes, inclure les pénalités.
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-white/10 flex justify-end">
                    <button onClick={handleSave} className="flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-lg shadow-lg hover:scale-105 transition-all">
                        <Save className="w-5 h-5" /> Enregistrer
                    </button>
                </div>
            </div>
        </div>
    );
};

const InputGroup = ({ label, value, onChange, color = 'blue', isFinal = false }: any) => (
    <div>
        <label className={clsx("block text-xs mb-1", isFinal ? "font-bold text-emerald-400" : "text-slate-500")}>{label}</label>
        <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="ex: 2:15.5"
            className={clsx(
                "w-full bg-slate-800/50 border rounded-lg px-4 py-2 font-mono transition-all focus:outline-none",
                isFinal ? "border-emerald-500/50 text-emerald-400 text-lg font-bold focus:border-emerald-400" : "border-white/10 focus:border-blue-500"
            )}
        />
    </div>
);

const ShootingSelector = ({ label, value, onChange, color }: any) => (
    <div className="bg-slate-800/30 p-4 rounded-xl">
        <label className="block text-sm font-medium mb-3">{label} - Fautes</label>
        <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4, 5].map(v => (
                <button
                    key={v}
                    onClick={() => onChange(v)}
                    className={clsx(
                        "flex-1 h-10 rounded-lg font-bold transition-all",
                        value === v ?
                            (color === 'emerald' ? 'bg-emerald-500' : 'bg-blue-500') + ' text-white scale-110 shadow-lg'
                            : 'bg-slate-700 hover:bg-slate-600 text-slate-400'
                    )}
                >
                    {v}
                </button>
            ))}
        </div>
    </div>
);
