import { defineConfig } from "electron-vite";
import { resolve } from "node:path";

import react from "@vitejs/plugin-react";

export default defineConfig({
    main: {
        define: {
            __CONCORDE_APP_USER_MODEL_ID__: JSON.stringify(process.env.CONCORDE_APP_ID ?? "com.concorde.app"),
        },
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