#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const defaultBaseUrl = 'http://127.0.0.1:5173';
const baseUrl = (process.env.PLATFORM_UI_BASE_URL || defaultBaseUrl).replace(/\/$/, '');
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appSourcePath = path.resolve(scriptDir, '../src/App.tsx');

const requiredPlatformRoutes = [
	'/platform',
	'/platform/agents',
	'/platform/tools',
	'/platform/connectors',
	'/platform/workflows',
	'/platform/approvals',
	'/platform/runs',
	'/platform/tenants',
	'/platform/memory',
	'/platform/settings',
];

const assetPattern = /<(?:script|link)\b[^>]+(?:src|href)="([^"]+)"/g;
const platformRoutePattern = /path:\s*['"](?<route>\/platform(?:\/[a-z0-9-]+)?)['"]/g;

async function readPlatformRoutesFromApp() {
	const source = await readFile(appSourcePath, 'utf8');
	return [...new Set([...source.matchAll(platformRoutePattern)].map((match) => match.groups.route))];
}

function assertRouteCoverage(appRoutes) {
	const appRouteSet = new Set(appRoutes);
	const missingRequired = requiredPlatformRoutes.filter((route) => !appRouteSet.has(route));

	if (missingRequired.length > 0) {
		throw new Error(
			`Platform route coverage is missing required App.tsx routes: ${missingRequired.join(', ')}`,
		);
	}
}

async function fetchText(pathname) {
	const response = await fetch(`${baseUrl}${pathname}`, {
		headers: { accept: 'text/html,application/xhtml+xml' },
	});
	const text = await response.text();
	return { response, text };
}

function assertHtmlRoute(pathname, response, text) {
	if (!response.ok) {
		throw new Error(`${pathname} returned HTTP ${response.status}`);
	}
	if (!text.includes('<div id="root">')) {
		throw new Error(`${pathname} did not return the Vite app shell`);
	}
	if (!text.includes('/src/') && !text.includes('/assets/')) {
		throw new Error(`${pathname} did not include a dev or production asset reference`);
	}
}

async function assertAsset(assetPath) {
	const response = await fetch(`${baseUrl}${assetPath}`);
	if (!response.ok) {
		throw new Error(`${assetPath} returned HTTP ${response.status}`);
	}
}

async function main() {
	const routes = await readPlatformRoutesFromApp();
	assertRouteCoverage(routes);

	const firstRoute = await fetchText(routes[0]);
	assertHtmlRoute(routes[0], firstRoute.response, firstRoute.text);

	const assets = [...firstRoute.text.matchAll(assetPattern)]
		.map((match) => match[1])
		.filter((assetPath) => assetPath.startsWith('/src/') || assetPath.startsWith('/assets/'));

	if (assets.length === 0) {
		throw new Error('No Vite app assets were discovered from /platform');
	}

	for (const assetPath of assets) {
		await assertAsset(assetPath);
	}

	for (const route of routes.slice(1)) {
		const { response, text } = await fetchText(route);
		assertHtmlRoute(route, response, text);
	}

	console.log(`Verified ${routes.length} platform routes against ${baseUrl}`);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
