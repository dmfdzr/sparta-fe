"use client"

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
    useEffect(() => {
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker
                .register("/sw.js", { scope: "/", updateViaCache: "none" })
                .then((registration) => {
                    console.log("SW registered:", registration.scope);
                })
                .catch((err) => {
                    console.error("SW registration failed:", err);
                });
        }
    }, []);

    return null;
}
