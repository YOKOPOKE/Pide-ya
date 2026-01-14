"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSplash } from "@/context/SplashContext";

export default function SplashScreen() {
    const [isVisible, setIsVisible] = useState(true);
    const [particles, setParticles] = useState<any[]>([]);
    const { setComplete } = useSplash();

    useEffect(() => {
        // Generate random particles only on client-side to prevent hydration mismatch
        const newParticles = [...Array(15)].map((_, i) => ({
            id: i,
            initial: {
                x: Math.random() * 100 - 50 + "vw",
                y: Math.random() * 100 - 50 + "vh",
                opacity: 0
            },
            animate: {
                x: [null, Math.random() * 15 - 7 + "vw", Math.random() * 15 - 7 + "vw"],
                y: [null, Math.random() * 15 - 7 + "vh", Math.random() * 15 - 7 + "vh"],
                opacity: [0, 0.5, 0]
            },
            transition: {
                duration: 4 + Math.random() * 6,
                repeat: Infinity,
                ease: "easeInOut"
            }
        }));
        setParticles(newParticles);

        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(() => setComplete(true), 1200);
        }, 4500);

        return () => clearTimeout(timer);
    }, [setComplete]);

    const containerVariants: any = {
        exit: {
            opacity: 0,
            scale: 1.05,
            transition: { duration: 0.8, ease: "easeInOut" }
        }
    };

    const logoVariants: any = {
        initial: { scale: 0.5, opacity: 0, rotate: -180 },
        animate: {
            scale: 1,
            opacity: 1,
            rotate: 0,
            transition: {
                type: "spring",
                stiffness: 80,
                damping: 20,
                delay: 0.3
            }
        }
    };

    const tagline = "UN SABOR DIFERENTE";

    return (
        <AnimatePresence mode="wait">
            {isVisible && (
                <motion.div
                    key="splash-screen"
                    variants={containerVariants}
                    initial="initial"
                    exit="exit"
                    className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#010303] overflow-hidden select-none"
                    style={{ willChange: "opacity, transform" }}
                >
                    {/* Prismatic Background Layer with Shimmer */}
                    <div className="absolute inset-0 z-0">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#0a1a1a] via-black to-black opacity-90" />

                        {/* Interactive Constellation - Hydration Fixed */}
                        {particles.map((p) => (
                            <motion.div
                                key={p.id}
                                initial={p.initial}
                                animate={p.animate}
                                transition={p.transition}
                                className="absolute w-[2px] h-[2px] bg-yoko-primary rounded-full"
                                style={{ willChange: "transform, opacity" }}
                            />
                        ))}

                        {/* Pulsing Light Flares - Optimized (Opacity only) */}
                        <motion.div
                            animate={{ opacity: [0.1, 0.2, 0.1] }}
                            transition={{ duration: 5, repeat: Infinity }}
                            className="absolute top-1/4 -left-1/4 w-[80vw] h-[80vw] bg-yoko-primary/10 rounded-full blur-[100px]"
                            style={{ willChange: "opacity" }}
                        />
                        <motion.div
                            animate={{ opacity: [0.05, 0.15, 0.05] }}
                            transition={{ duration: 7, repeat: Infinity, delay: 1 }}
                            className="absolute -bottom-1/4 -right-1/4 w-[70vw] h-[70vw] bg-yoko-accent/10 rounded-full blur-[100px]"
                            style={{ willChange: "opacity" }}
                        />
                    </div>

                    <div className="relative z-10 flex flex-col items-center">
                        {/* Heavy Atmosphere Entrance Flash */}
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1.2, opacity: [0, 0.5, 0] }}
                            transition={{ duration: 1, times: [0, 0.5, 1] }}
                            className="absolute inset-0 bg-white blur-[80px] z-20 pointer-events-none"
                        />

                        {/* Iconic Logo Reveal - Responsive Size */}
                        <div className="relative mb-12 md:mb-24 group">
                            <motion.div
                                animate={{ opacity: [0.3, 0.5, 0.3] }}
                                transition={{ duration: 4, repeat: Infinity }}
                                className="absolute inset-0 bg-yoko-primary/40 blur-[80px] rounded-full"
                            />

                            <motion.div
                                variants={logoVariants}
                                initial="initial"
                                animate="animate"
                                className="relative w-28 h-28 md:w-40 md:h-40 flex items-center justify-center cursor-default"
                                style={{ willChange: "transform, opacity" }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-yoko-primary via-rose-600 to-yoko-accent rounded-[2.5rem] md:rounded-[3.2rem] transform rotate-45 border border-white/40 shadow-[0_0_60px_-10px_rgba(255,50,100,0.4)] overflow-hidden scale-90 group-hover:scale-100 transition-transform duration-700">
                                    <motion.div
                                        animate={{ x: ["-250%", "250%"] }}
                                        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                                        className="absolute inset-0 w-full h-[500%] bg-gradient-to-r from-transparent via-white/40 to-transparent -rotate-45"
                                        style={{ willChange: "transform" }}
                                    />
                                </div>
                                <span className="relative z-10 text-white font-serif font-black text-6xl md:text-9xl select-none drop-shadow-2xl">Y</span>
                            </motion.div>
                        </div>

                        {/* Kinetic Main Title - Responsive Stack */}
                        <div className="flex flex-col items-center gap-8 md:gap-12">
                            <div className="flex flex-col md:flex-row gap-2 md:gap-8 overflow-hidden py-4 md:py-6 px-4 md:px-10 relative items-center">
                                {["YOKO", "POKE"].map((word, wordIdx) => (
                                    <div key={wordIdx} className="relative group overflow-hidden">
                                        <motion.h1
                                            initial={{ y: "120%" }}
                                            animate={{ y: 0 }}
                                            transition={{ delay: 0.5 + wordIdx * 0.2, duration: 1, ease: [0.23, 1, 0.32, 1] }}
                                            className="text-7xl md:text-[11rem] font-serif font-black text-white tracking-tighter leading-none"
                                            style={{ willChange: "transform" }}
                                        >
                                            {word}
                                        </motion.h1>
                                        <motion.div
                                            initial={{ scaleX: 0 }}
                                            animate={{ scaleX: 1 }}
                                            transition={{ delay: 1.2 + wordIdx * 0.2, duration: 1, ease: "circOut" }}
                                            className="absolute bottom-1 md:bottom-2 left-0 w-full h-[4px] md:h-[6px] bg-gradient-to-r from-yoko-primary via-white to-yoko-accent shadow-[0_0_20px_rgba(255,255,255,0.4)]"
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Ultra-Premium Secondary Text Reveal - Responsive Sizing */}
                            <div className="relative pt-6 md:pt-10 min-h-[40px] flex items-center justify-center">
                                {/* The 'Drawing Orb' */}
                                <motion.div
                                    initial={{ left: "0%", opacity: 0, scale: 0 }}
                                    animate={{
                                        left: ["0%", "100%"],
                                        opacity: [0, 1, 1, 0],
                                        scale: [0, 1, 1, 0]
                                    }}
                                    transition={{ delay: 1.5, duration: tagline.length * 0.08, ease: "linear" }}
                                    className="absolute -top-2 h-3 w-3 md:h-4 md:w-4 bg-white rounded-full blur-[4px] z-30"
                                    style={{ willChange: "left, opacity, transform" }}
                                />

                                <div className="flex px-4 md:px-12 items-center justify-center text-center">
                                    {tagline.split("").map((char, i) => (
                                        <motion.span
                                            key={i}
                                            initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                            animate={{
                                                opacity: 1,
                                                scale: 1,
                                                y: 0
                                            }}
                                            transition={{
                                                delay: 1.5 + i * 0.08,
                                                duration: 0.6,
                                                ease: "backOut"
                                            }}
                                            className="text-yoko-accent font-black text-[12px] md:text-[18px] tracking-[0.4em] md:tracking-[0.8em] inline-block whitespace-pre"
                                            style={{ willChange: "opacity, transform" }}
                                        >
                                            {char}
                                        </motion.span>
                                    ))}
                                </div>

                                {/* Light Streak Background */}
                                <motion.div
                                    initial={{ scaleX: 0, opacity: 0 }}
                                    animate={{ scaleX: 1, opacity: 0.6 }}
                                    transition={{ delay: 1.5, duration: 1.5, ease: "circOut" }}
                                    className="absolute -bottom-4 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-yoko-accent/50 to-transparent"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Industrial Quality HUD - Fixed bottom - Responsive */}
                    <div className="absolute bottom-8 md:bottom-16 left-1/2 -translate-x-1/2 w-48 md:w-64 flex flex-col items-center gap-4 md:gap-6">
                        <div className="w-full h-[1px] bg-white/5 relative overflow-hidden">
                            <motion.div
                                initial={{ left: "-100%" }}
                                animate={{ left: "100%" }}
                                transition={{ duration: 4, ease: "linear" }}
                                className="absolute top-0 bottom-0 w-full bg-gradient-to-r from-transparent via-yoko-primary to-transparent"
                            />
                        </div>
                        <div className="flex gap-6 md:gap-12 items-center opacity-30">
                            <span className="text-[6px] md:text-[8px] font-mono text-white tracking-[0.3em] md:tracking-[0.5em] uppercase">Auth: 0928</span>
                            <motion.span
                                animate={{ opacity: [0.2, 0.5, 0.2] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="text-[7px] md:text-[9px] font-mono text-white tracking-[0.4em] md:tracking-[0.6em] uppercase whitespace-nowrap"
                            >
                                Loading Experience
                            </motion.span>
                            <span className="text-[6px] md:text-[8px] font-mono text-white tracking-[0.3em] md:tracking-[0.5em] uppercase">V: 2.4.1</span>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
