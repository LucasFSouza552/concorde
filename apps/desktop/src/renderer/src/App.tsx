import { HashRouter } from "react-router-dom";

import DiscordRegistrationModal from "../components/DiscordOAuth/DiscordRegistrationModal";
import DiscordSensitiveModal from "../components/DiscordOAuth/DiscordSensitiveModal";
import ToastViewport from "../components/Toast/ToastViewport";
import UpdateBanner from "../components/UpdateBanner/UpdateBanner";
import NotificationsBridge from "../components/Notifications/NotificationsBridge";
import VersionGuard from "../components/VersionGuard/VersionGuard";
// Providers
import { ActiveCallProvider } from "../contexts/ActiveCallProvider";
import { AuthProvider } from "../contexts/AuthContext";
import { CallInviteProvider } from "../contexts/CallInviteProvider";
import { DiscordOAuthProvider } from "../contexts/DiscordOAuthContext";
import { ProfileProvider } from "../contexts/ProfileProvider";
import { SettingsProvider } from "../contexts/SettingsProvider";
import { ToastProvider } from "../contexts/ToastProvider";
import { UserSocketProvider } from "../contexts/UserSocketProvider";

import AppRouter from "../routes/AppRouter";

export default function App() {
  return (
    <ToastProvider>
      <VersionGuard />
      <HashRouter>
        <AuthProvider>
          <DiscordOAuthProvider>
            <SettingsProvider>
              <UserSocketProvider>
                <ProfileProvider>
                  <ActiveCallProvider>
                    <CallInviteProvider>
                      <AppRouter />
                      <DiscordRegistrationModal />
                      <DiscordSensitiveModal />
                      <UpdateBanner />
                      <ToastViewport />
                      <NotificationsBridge />
                    </CallInviteProvider>
                  </ActiveCallProvider>
                </ProfileProvider>
              </UserSocketProvider>
            </SettingsProvider>
          </DiscordOAuthProvider>
        </AuthProvider>
      </HashRouter>
    </ToastProvider>
  );
}