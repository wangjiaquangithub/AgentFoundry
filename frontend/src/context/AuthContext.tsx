import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ApiError, client } from '@/api/client';

export type AuthenticatedAccount = {
	user_id: string;
	tenant_id: string;
	membership_id: string;
	display_name: string;
	email: string;
	role: string;
	expires_at: string;
};

type LoginInput = {
	tenant_id: string;
	identifier: string;
	password: string;
};

type AuthContextValue = {
	account: AuthenticatedAccount | null;
	loading: boolean;
	login: (input: LoginInput) => Promise<void>;
	logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [account, setAccount] = useState<AuthenticatedAccount | null>(null);
	const [loading, setLoading] = useState(true);

	const restore = useCallback(async () => {
		try {
			setAccount(await client.get<AuthenticatedAccount>('/api/auth/me'));
		} catch (error) {
			if (!(error instanceof ApiError) || error.status !== 401) throw error;
			setAccount(null);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void restore().catch(() => {
			setAccount(null);
			setLoading(false);
		});
	}, [restore]);

	const login = useCallback(async (input: LoginInput) => {
		const identity = await client.post<AuthenticatedAccount>('/api/auth/login', input, undefined, { silent: true });
		setAccount(identity);
	}, []);

	const logout = useCallback(async () => {
		try {
			await client.post<void>('/api/auth/logout', undefined, undefined, { silent: true });
		} finally {
			setAccount(null);
		}
	}, []);

	const value = useMemo(() => ({ account, loading, login, logout }), [account, loading, login, logout]);
	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const value = useContext(AuthContext);
	if (!value) throw new Error('useAuth must be used within AuthProvider');
	return value;
}
