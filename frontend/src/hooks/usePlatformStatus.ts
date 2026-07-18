import { useCallback, useEffect, useState } from 'react';

import { platformApi } from '@/api';
import type { EnterprisePlatformStatusResponse } from '@/api';

export function usePlatformStatus() {
	const [status, setStatus] = useState<EnterprisePlatformStatusResponse | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const refetch = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			setStatus(await platformApi.status());
		} catch (e) {
			setError(e as Error);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		refetch();
	}, [refetch]);

	return { status, loading, error, refetch };
}
