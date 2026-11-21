import { useContext } from "react";

import { DiscordOAuthContext } from "../contexts/discord-oauth-context";

export function useDiscordOAuth() {
    const context = useContext(DiscordOAuthContext);
    if (!context) throw new Error("useDiscordOAuth must be used inside a DiscordOAuthProvider");
    return context;
}
