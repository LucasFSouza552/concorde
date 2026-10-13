import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

export type ToastType = "error" | "success" | "info";

export interface ToastItem {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextData {
    toasts: ToastItem[];
    push: (message: string, type?: ToastType) => void;
    dismiss: (id: number) => void;
}

const AUTO_DISMISS_MS = 4000;
const MAX_TOASTS = 3;

const ToastContext = createContext<ToastContextData | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const nextId = useRef(1);

    const dismiss = useCallback((id: number) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const push = useCallback((message: string, type: ToastType = "info") => {
        const id = nextId.current++;
        setToasts((current) => [...current.slice(-(MAX_TOASTS - 1)), { id, message, type }]);
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    }, [dismiss]);

    return (
        <ToastContext.Provider value={{ toasts, push, dismiss }}>
            {children}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);

    if (!context) {
        throw new Error("useToast must be used inside a ToastProvider");
    }

    return context;
}