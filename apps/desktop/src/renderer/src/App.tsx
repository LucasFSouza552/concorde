import { HashRouter } from "react-router-dom";

import { ActiveCallProvider } from "../contexts/ActiveCallProvider";
import { AuthProvider } from "../contexts/AuthContext";
import { CallInviteProvider } from "../contexts/CallInviteProvider";
import { SettingsProvider } from "../contexts/SettingsProvider";
import { UserSocketProvider } from "../contexts/UserSocketProvider";

import AppRouter from "../routes/AppRouter";

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <SettingsProvider>
          <UserSocketProvider>
            <ActiveCallProvider>
              <CallInviteProvider>
                <AppRouter />
              </CallInviteProvider>
            </ActiveCallProvider>
          </UserSocketProvider>
        </SettingsProvider>
      </AuthProvider>
    </HashRouter>
  );
}