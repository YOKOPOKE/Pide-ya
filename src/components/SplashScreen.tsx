"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSplash } from "@/context/SplashContext";

export default function SplashScreen() {
    const [isVisible, setIsVisible] = useState(true);
    const { setComplete } = useSplash();

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(() => setComplete(true), 1200);
        }, 3800);

        return () => clearTimeout(timer);
    }, [setComplete]);

    const containerVariants: any = {
        exit: {
            scale: 2,
            opacity: 0,
            transition: {
                duration: 1,
                ease: [0.7, 0, 0.3, 1],
            }
        }
    };

    const orbitVariants: any = {
        animate: (i: number) => ({
            rotate: 360,
            transition: {
                duration: 10 + i * 5,
                repeat: Infinity,
                ease: "linear"
            }
        })
    };

    const logoVariants: any = {
        initial: { scale: 0.1, opacity: 0, rotate: -180 },
        animate: {
            scale: 1,
            opacity: 1,
            rotate: 0,
            transition: {
                duration: 2,
                ease: [0.34, 1.56, 0.64, 1]
            }
        }
    };

    return (
        <AnimatePresence mode="wait">
            {isVisible && (
                <motion.div
                    key="splash-screen"
                    variants={containerVariants}
                    initial="initial"
                    exit="exit"
                    className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#000000] overflow-hidden select-none"
                    style={{ willChange: "transform, opacity" }}
                >
                    {/* Deep Space Atmosphere */}
                    <div className="absolute inset-0 z-0">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-neutral-900 via-black to-black opacity-60" />

                        {/* Orbital Rings */}
                        {[1, 2, 3].map((i) => (
                            <motion.div
                                key={i}
                                custom={i}
                                variants={orbitVariants}
                                animate="animate"
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border border-white/[0.03] rounded-full"
                                style={{
                                    width: `${25 * i}vw`,
                                    height: `${25 * i}vw`,
                                }}
                            >
                                <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${i === 2 ? 'bg-yoko-primary' : 'bg-white/10'} blur-[1px]`} />
                            </motion.div>
                        ))}
                    </div>

                    <div className="relative z-10 flex flex-col items-center">
                        {/* Central Luminous Core */}
                        <div className="relative mb-20">
                            <motion.div
                                animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.5, 0.2] }}
                                transition={{ duration: 3, repeat: Infinity }}
                                className="absolute inset-0 bg-yoko-primary/40 blur-[100px] rounded-full"
                            />

                            {/* Premium Metallic Logo */}
                            <motion.div
                                variants={logoVariants}
                                initial="initial"
                                animate="animate"
                                className="relative w-36 h-36 flex items-center justify-center"
                            >
                                <div className="absolute inset-0 bg-gradient-to-tr from-yoko-primary via-[#ff4d6d] to-yoko-accent rounded-[3rem] shadow-[0_0_100px_-10px_rgba(255,77,109,0.5)] border border-white/20 transform rotate-45 rotate-x-12 rotate-y-12 shadow-2xl overflow-hidden">
                                    {/* Liquid Metal Sweep */}
                                    <motion.div
                                        animate={{
                                            left: ["-100%", "200%"],
                                            top: ["200%", "-100%"]
                                        }}
                                        transition={{ duration: 4, repeat: Infinity, ease: [0.445, 0.05, 0.55, 0.95] }}
                                        className="absolute inset-0 w-full h-[500%] bg-gradient-to-b from-transparent via-white/50 to-transparent -rotate-[60deg] blur-xl opacity-70"
                                    />
                                </div>

                                <span className="relative z-10 text-white font-serif font-black text-8xl drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)]">
                                    Y
                                </span>
                            </motion.div>
                        </div>

                        {/* Kinetic Typography Reveal */}
                        <div className="flex flex-col items-center gap-8">
                            <div className="flex gap-4">
                                {["YOKO", "POKE"].map((word, wordIdx) => (
                                    <div key={wordIdx} className="overflow-hidden">
                                        <motion.div
                                            initial={{ y: "150%" }}
                                            animate={{ y: 0 }}
                                            transition={{ delay: 1.5 + wordIdx * 0.2, duration: 1.2, ease: [0.19, 1, 0.22, 1] }}
                                            className="text-7xl md:text-9xl font-serif font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/30 uppercase leading-none tracking-tight"
                                        >
                                            {word}
                                        </motion.div>
                                    </div>
                                ))}
                            </div>

                            <div className="relative overflow-hidden">
                                <motion.div
                                    initial={{ opacity: 0, letterSpacing: "2em", filter: "blur(10px)" }}
                                    animate={{ opacity: 1, letterSpacing: "1em", filter: "blur(0px)" }}
                                    transition={{ delay: 2.5, duration: 1.5, ease: "easeOut" }}
                                    className="text-yoko-accent font-bold text-[13px] uppercase whitespace-nowrap"
                                >
                                    Freshness Redefined
                                </motion.div>
                                <motion.div
                                    initial={{ scaleX: 0 }}
                                    animate={{ scaleX: 1 }}
                                    transition={{ delay: 2.8, duration: 1 }}
                                    className="h-[1px] w-full bg-gradient-to-r from-transparent via-yoko-accent/50 to-transparent mt-4"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Minimalist Data HUD */}
                    <div className="absolute top-12 left-12 flex flex-col gap-1 opacity-20 hidden md:flex">
                        <div className="h-1 w-12 bg-white/40" />
                        <span className="text-[9px] font-mono text-white tracking-widest uppercase">System.Ready</span>
                    </div>

                    <div className="absolute bottom-12 right-12 flex flex-col items-end gap-1 opacity-20 hidden md:flex">
                        <span className="text-[9px] font-mono text-white tracking-widest uppercase">Quality.Verified</span>
                        <div className="h-1 w-12 bg-yoko-primary" />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
