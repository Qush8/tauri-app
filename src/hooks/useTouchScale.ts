import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";

export interface UseTouchScaleReturn {
  grams: number;
  kilograms: string;
  tare: () => void;
}

export function useTouchScale(): UseTouchScaleReturn {
  const [rawWeight, setRawWeight] = useState<number>(0);
  const [tareOffset, setTareOffset] = useState<number>(0);

  // Subscribe to native macOS pressure events via Tauri IPC
  useEffect(() => {
    const unlistenPromise = listen<number>("pressure-changed", (event) => {
      const pressure = event.payload;
      // Convert 0.0-1.0 pressure range to 0-400g scale
      setRawWeight(pressure * 400);
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // Set tare offset to current raw weight
  const tare = useCallback(() => {
    setTareOffset(rawWeight);
  }, [rawWeight]);

  // Calculate final weight (never below 0)
  const finalWeight = Math.max(0, rawWeight - tareOffset);
  const grams = Math.round(finalWeight);
  const kilograms = (grams / 1000).toFixed(3);

  return {
    grams,
    kilograms,
    tare,
  };
}
