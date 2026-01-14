"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type SplashContextType = {
    isComplete: boolean;
    setComplete: (value: boolean) => void;
};

const SplashContext = createContext<SplashContextType | undefined>(undefined);

export function SplashProvider({ children }: { children: React.ReactNode }) {
    const [isComplete, setIsComplete] = useState(false);

    return (
        <SplashContext.Provider value={{ isComplete, setComplete: setIsComplete }}>
            {children}
        </SplashContext.Provider>
    );
}

export function useSplash() {
    const context = useContext(SplashContext);
    if (context === undefined) {
        throw new Error("useSplash must be used within a SplashProvider");
    }
    return context;
}
