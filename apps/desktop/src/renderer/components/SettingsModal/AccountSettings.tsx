import { useAuth } from "../../contexts/AuthContext"

export default function AccountSettings() {
    const { user, logout } = useAuth();
    return (<section>
        <h3>Conta</h3>
        <p>{user?.displayName}</p>
        <p>{user?.username}</p>
        <button type="button" onClick={logout}>
            Sair da conta
        </button>
    </section>)
}