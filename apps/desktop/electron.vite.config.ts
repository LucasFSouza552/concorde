import { defineConfig } from "electron-vite";
import { resolve } from "node:path";

import react from "@vitejs/plugin-react";

export default defineConfig({
    main: {
        build: {
            rollupOptions: {
                input: resolve(__dirname, "src/main/index.ts"),
                external: ["electron"],
            },
        },
    },
    preload: {
        build: {
            rollupOptions: {
                input: resolve(__dirname, "src/preload/index.ts"),
                external: ["electron"],
                output: {
                    format: "cjs",
                    entryFileNames: "index.js",
                },
            },
        },
    },

    renderer: {
        plugins: [react()],
    },
});