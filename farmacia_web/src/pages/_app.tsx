import '../styles/globals.css'; // Usa puntos si el @ te da problemas
import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
    return <Component {...pageProps} />;
}