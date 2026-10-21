import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';

import BootScreen from '../components/BootScreen/BootScreen';
import OfflineScreen from '../components/BootScreen/OfflineScreen';
import { CallBanner } from '../components/CallBanner/CallBanner';
import TitleBar from '../components/TitleBar';
import AuthPage from '../pages/AuthPage';
import HomePage from '../pages/HomePage';
import { useAuth } from '../contexts/AuthContext';

import styles from '../styles/globals.module.css';
import "../styles/variables.css";

export default function AppRouter() {
    const { user, serverStatus } = useAuth();

    useEffect(() => {
        document.getElementById("pre-titlebar")?.remove();
    }, []);

    return (
        <div className={styles.app}>
            <TitleBar />
            {serverStatus === "booting" ? (
                <BootScreen />
            ) : serverStatus === "offline" ? (
                <OfflineScreen />
            ) : (
                <Routes>
                    <Route path="/" element={user ? <HomePage /> : <AuthPage />} />
                    <Route path="*" element={<AuthPage />} />
                </Routes>
            )}
            <CallBanner />
        </div>
    );
}