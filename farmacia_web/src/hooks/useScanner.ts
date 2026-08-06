import { useEffect } from 'react';

export const useScanner = (onScan: (code: string) => void) => {
    useEffect(() => {
        let buffer = "";

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                if (buffer.length > 3) {
                    onScan(buffer);
                    buffer = "";
                }
            } else {
                // Evitamos que teclas de control entren al buffer
                if (e.key.length === 1) {
                    buffer += e.key;
                }
            }

            // Limpiar buffer si el usuario tarda mucho (no es un escáner)
            setTimeout(() => { buffer = ""; }, 200);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onScan]);
};