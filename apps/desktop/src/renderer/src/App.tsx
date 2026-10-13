import { HashRouter } from "react-router-dom";

import ToastViewport from "../components/Toast/ToastViewport";
import UpdateBanner from "../components/UpdateBanner/UpdateBanner";
// Providers
import { ActiveCallProvider } from "../contexts/ActiveCallProvider";
import { AuthProvider } from "../contexts/AuthContext";
import { CallInviteProvider } from "../contexts/CallInviteProvider";
import { SettingsProvider } from "../contexts/SettingsProvider";
import { ToastProvider } from "../contexts/ToastProvider";
import { UserSocketProvider } from "../contexts/UserSocketProvider";

import AppRouter from "../routes/AppRouter";

export default function App() {
  return (
    <ToastProvider>
      <HashRouter>
        <AuthProvider>
          <SettingsProvider>
            <UserSocketProvider>
              <ActiveCallProvider>
                <CallInviteProvider>
                  <AppRouter />
                  <UpdateBanner />
                  <ToastViewport />
                </CallInviteProvider>
              </ActiveCallProvider>
            </UserSocketProvider>
          </SettingsProvider>
        </AuthProvider>
      </HashRouter>
    </ToastProvider>
  );
}