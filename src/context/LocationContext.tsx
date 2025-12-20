import React, { createContext, useContext, useState } from 'react';

export type LocationType = 'Feucherolles' | 'Meribel' | 'Le Home' | 'Autres';

interface LocationContextType {
    location: LocationType;
    setLocation: (loc: LocationType) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider = ({ children }: { children: React.ReactNode }) => {
    const [location, setLocationState] = useState<LocationType>(() => {
        const saved = localStorage.getItem('biathlon_location');
        return (saved as LocationType) || 'Feucherolles';
    });

    const setLocation = (loc: LocationType) => {
        setLocationState(loc);
        localStorage.setItem('biathlon_location', loc);
    };

    return (
        <LocationContext.Provider value={{ location, setLocation }}>
            {children}
        </LocationContext.Provider>
    );
};

export const useLocation = () => {
    const context = useContext(LocationContext);
    if (!context) {
        throw new Error('useLocation must be used within a LocationProvider');
    }
    return context;
};
