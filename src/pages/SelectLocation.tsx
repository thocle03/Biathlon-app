
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Mountain, Home, Globe } from 'lucide-react';
import { useLocation, type LocationType } from '../context/LocationContext';
import clsx from 'clsx';

export const SelectLocation = () => {
    const navigate = useNavigate();
    const { setLocation, location: currentLocation } = useLocation();

    const locations: { id: LocationType; label: string; icon: React.ElementType; color: string }[] = [
        { id: 'Feucherolles', label: 'Feucherolles', icon: MapPin, color: 'from-blue-500 to-cyan-400' },
        { id: 'Meribel', label: 'Meribel', icon: Mountain, color: 'from-purple-500 to-pink-400' },
        { id: 'Le Home', label: 'Le Home', icon: Home, color: 'from-emerald-500 to-green-400' },
        { id: 'Autres', label: 'Autres', icon: Globe, color: 'from-orange-500 to-yellow-400' },
    ];

    const handleSelect = (loc: LocationType) => {
        setLocation(loc);
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-8 bg-[url('/biathlon_bg.png')] bg-cover bg-center">
            <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm" />

            <div className="relative z-10 w-full max-w-4xl">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 mb-4">
                        Sélection du Parcours
                    </h1>
                    <p className="text-slate-400 text-lg">
                        Choisissez le lieu de compétition pour accéder aux données correspondantes
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {locations.map((loc) => {
                        const Icon = loc.icon;
                        const isSelected = currentLocation === loc.id;

                        return (
                            <button
                                key={loc.id}
                                onClick={() => handleSelect(loc.id)}
                                className={clsx(
                                    "group relative p-8 rounded-3xl border transition-all duration-300 transform hover:scale-[1.02] text-left",
                                    isSelected
                                        ? "bg-slate-800/80 border-blue-500/50 shadow-xl shadow-blue-500/10"
                                        : "bg-slate-800/40 border-white/5 hover:bg-slate-800/60 hover:border-white/10"
                                )}
                            >
                                <div className={clsx(
                                    "w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300",
                                    "bg-gradient-to-br shadow-lg",
                                    loc.color,
                                    isSelected ? "opacity-100" : "opacity-80 group-hover:opacity-100"
                                )}>
                                    <Icon className="w-8 h-8 text-white" />
                                </div>

                                <h3 className="text-2xl font-bold mb-2 group-hover:text-white transition-colors">
                                    {loc.label}
                                </h3>

                                <div className={clsx(
                                    "absolute top-8 right-8 w-4 h-4 rounded-full border-2 transition-all",
                                    isSelected
                                        ? "bg-green-500 border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                                        : "border-slate-600 group-hover:border-slate-400"
                                )} />
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
