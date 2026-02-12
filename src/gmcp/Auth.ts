import { GMCPPackage } from "./package";
import { preferencesStore } from "../PreferencesStore";

/**
 * GMCP Authentication handler
 * Implements username/password auto-login per GMCP Authentication standard
 * Uses preferences store for credential management
 */
export class GMCPAutoLogin extends GMCPPackage {
    public packageName: string = "Auth";

    /**
     * Attempt auto-login if credentials are stored and enabled
     * Sends Char.Login with username/password per GMCP standard
     */
    sendLogin(): void {
        const auth = preferencesStore.getState().auth;

        if (!auth.autoLoginEnabled) {
            console.log("[Auth] Auto-login disabled");
            return;
        }

        if (!auth.username || !auth.password) {
            console.log("[Auth] Auto-login credentials incomplete");
            return;
        }

        console.log(`[Auth] Auto-login as: ${auth.username}`);

        // Send Char.Login per GMCP standard
        this.client.sendGmcp(
            "Char.Login",
            JSON.stringify({
                name: auth.username,
                password: auth.password
            })
        );
    }
}
