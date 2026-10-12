import { Route, Routes } from 'react-router-dom';

import { CallBanner } from '../components/CallBanner/CallBanner';
import TitleBar from '../components/TitleBar';
import AuthPage from '../pages/AuthPage';
import HomePage from '../pages/HomePage';
import { useAuth } from '../contexts/AuthContext';

import styles from '../styles/globals.module.css';
import "../styles/variables.css";

export default function AppRouter() {
    const { user } = useAuth();

    return (
        <div className={styles.app}>
            <TitleBar />
            <Routes>
                <Route path="/" element={user ? <HomePage /> : <AuthPage />} />
                <Route path="*" element={<AuthPage />} />
            </Routes>
            <CallBanner />
        </div>
    );
}