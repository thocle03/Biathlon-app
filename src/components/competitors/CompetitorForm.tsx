import React, { useState } from 'react';
import { db } from '../../db/db';
import toast from 'react-hot-toast';

interface CompetitorFormProps {
    onSuccess: () => void;
    onCancel: () => void;
}

export const CompetitorForm: React.FC<CompetitorFormProps> = ({ onSuccess, onCancel }) => {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        try {
            await db.competitors.add({
                name: name.trim(),
                totalRaces: 0,
                podiums: 0,
            });
            toast.success('Concurrent ajouté !');
            setName('');
            onSuccess();
        } catch (error) {
            console.error(error);
            toast.error("Erreur lors de l'ajout");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-400 mb-1">
                    Nom du concurrent
                </label>
                <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="ex: Martin Fourcade"
                    autoFocus
                />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                    Annuler
                </button>
                <button
                    type="submit"
                    disabled={loading || !name.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                >
                    {loading ? 'Ajout...' : 'Ajouter'}
                </button>
            </div>
        </form>
    );
};
