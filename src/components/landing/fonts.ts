import { Archivo, Permanent_Marker } from "next/font/google";

/** The landing page's display face: sturdy, slightly wide, like the printing on a planner board. */
export const display = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-display", display: "swap" });

/** Dry-erase marker, for the notes written on the board. */
export const marker = Permanent_Marker({ subsets: ["latin"], weight: "400", variable: "--font-marker", display: "swap" });
