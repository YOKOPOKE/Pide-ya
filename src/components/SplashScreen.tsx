"use client";

import { useEffect, useState } from "react";
import { useSplash } from "@/context/SplashContext";

export default function SplashScreen() {
    const [mount, setMount] = useState(true);
    const { setComplete } = useSplash();

    useEffect(() => {
        // Total animation time matches CSS (approx 2.5s)
        const timer = setTimeout(() => {
            setMount(false);
            setTimeout(() => setComplete(true), 500); // Wait for fade out
        }, 3500);

        return () => clearTimeout(timer);
    }, [setComplete]);

    if (!mount) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white overflow-hidden animate-fade-out-splash">
            <style jsx>{`
                @keyframes dropIn {
                    0% { transform: translateY(-50vh) rotate(45deg); opacity: 0; }
                    60% { transform: translateY(0) rotate(0deg); opacity: 1; }
                    80% { transform: translateY(-10px); }
                    100% { transform: translateY(0); }
                }
                @keyframes fillBowl {
                    0% { transform: scaleY(0); }
                    100% { transform: scaleY(1); }
                }
                @keyframes floatUp {
                    0% { transform: translateY(20px); opacity: 0; }
                    100% { transform: translateY(0); opacity: 1; }
                }
                .bowl-shadow {
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
                }
                .ingredient {
                    animation: dropIn 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                    opacity: 0;
                }
            `}</style>

            {/* Main Container */}
            <div className="relative flex flex-col items-center justify-center scale-75 md:scale-100">

                {/* 1. The Bowl - Dark borders for contrast on white */}
                <div className="relative w-48 h-24 border-b-4 border-l-4 border-r-4 border-gray-900 rounded-b-full bowl-shadow mb-8 overflow-hidden bg-gray-50">
                    {/* Fill Level Animation */}
                    <div
                        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-yoko-primary/90 to-yoko-primary/30 h-full origin-bottom"
                        style={{ animation: 'fillBowl 2s ease-out 0.5s forwards', transform: 'scaleY(0)' }}
                    />
                </div>

                {/* 2. Ingredients Dropping In */}
                <div className="absolute top-[-40px] w-full flex justify-center space-x-4">
                    {/* Rice */}
                    <span className="text-3xl ingredient" style={{ animationDelay: '0.2s' }}>🍚</span>
                    {/* Fish */}
                    <span className="text-3xl ingredient" style={{ animationDelay: '0.6s' }}>🐟</span>
                    {/* Avocado */}
                    <span className="text-3xl ingredient" style={{ animationDelay: '1.0s' }}>🥑</span>
                </div>

                {/* 3. Text Reveal */}
                <div className="text-center mt-4">
                    <h1
                        className="text-5xl md:text-7xl font-bold text-gray-900 tracking-tighter"
                        style={{ animation: 'floatUp 0.8s ease-out 1.5s forwards', opacity: 0 }}
                    >
                        YOKO
                        <span className="text-yoko-primary ml-4">POKE</span>
                    </h1>
                    <p
                        className="text-gray-500 text-sm md:text-base tracking-[0.5em] mt-2 uppercase"
                        style={{ animation: 'floatUp 0.8s ease-out 1.8s forwards', opacity: 0 }}
                    >
                        Premium Bowls
                    </p>
                </div>

                {/* Loading Bar */}
                <div className="w-32 h-1 bg-gray-200 rounded-full mt-12 overflow-hidden">
                    <div
                        className="h-full bg-yoko-primary rounded-full"
                        style={{ animation: 'fillBowl 3s linear forwards', transformOrigin: 'left', transform: 'scaleX(0)' }}
                    />
                </div>
            </div>
        </div>
    );
}
