export const Home = () => {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Bienvenue</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 rounded-2xl">
                    <h3 className="text-lg font-semibold mb-2">Concurrents</h3>
                    <p className="text-slate-400">Gérez votre base d'athlètes</p>
                </div>
                <div className="glass-panel p-6 rounded-2xl">
                    <h3 className="text-lg font-semibold mb-2">Nouvel Événement</h3>
                    <p className="text-slate-400">Lancez une compétition ou un duel</p>
                </div>
                <div className="glass-panel p-6 rounded-2xl">
                    <h3 className="text-lg font-semibold mb-2">Statistiques</h3>
                    <p className="text-slate-400">Analysez les performances</p>
                </div>
            </div>
        </div>
    );
};
