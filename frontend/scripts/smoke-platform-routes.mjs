#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const defaultBaseUrl = 'http://127.0.0.1:5173';
const baseUrl = (process.env.PLATFORM_UI_BASE_URL || defaultBaseUrl).replace(/\/$/, '');
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appSourcePath = path.resolve(scriptDir, '../src/App.tsx');
const platformPageSourcePath = path.resolve(scriptDir, '../src/pages/platform/index.tsx');
const workflowsPageSourcePath = path.resolve(
	scriptDir,
	'../src/pages/platform/components/WorkflowsViewPage.tsx',
);
const workflowRunnerPanelSourcePath = path.resolve(
	scriptDir,
	'../src/pages/platform/components/WorkflowRunnerPanel.tsx',
);
const localeSourcePaths = [
	path.resolve(scriptDir, '../src/i18n/locales/en.json'),
	path.resolve(scriptDir, '../src/i18n/locales/zh.json'),
];

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
const platformViewRoutePattern =
	/path:\s*['"](?<route>\/platform(?:\/[a-z0-9-]+)?)['"],\s*element:\s*<PlatformPage\s+view=['"](?<view>[a-z0-9-]+)['"]\s*\/>/g;

const routePageExpectations = [
	{
		route: '/platform/workflows',
		view: 'workflows',
		component: 'WorkflowsViewPage',
		componentSourcePath: workflowsPageSourcePath,
		requiredComponentSnippets: [
			'PlatformMetricsGrid',
			'WorkflowRunnerPanel',
			'platformWorkflowViewMetrics',
			"t('platform.workflowRunner.title')",
			"t('platform.workflowRunner.templates')",
			"t('platform.workflowRunner.history')",
		],
		requiredPanelSnippets: [
			'platformWorkflowRunnerDisplayState',
			'PlatformConfirmAction',
			"t('platform.workflowRunner.requestApproval')",
			"t('platform.workflowRunner.run')",
			"t('platform.workflowRunner.steps')",
			"t('platform.workflowRunner.summary')",
			"t('platform.workflowRunner.toolCalls')",
			"t('platform.workflowRunner.history')",
		],
		requiredLocaleKeys: [
			'platform.workflowRunner.title',
			'platform.workflowRunner.description',
			'platform.workflowRunner.templates',
			'platform.workflowRunner.enabled',
			'platform.workflowRunner.disabled',
			'platform.workflowRunner.steps',
			'platform.workflowRunner.history',
			'platform.workflowRunner.requestApproval',
			'platform.workflowRunner.run',
			'platform.workflowRunner.summary',
			'platform.workflowRunner.toolCalls',
		],
	},
];

async function readPlatformRoutesFromApp() {
	const source = await readFile(appSourcePath, 'utf8');
	return [...new Set([...source.matchAll(platformRoutePattern)].map((match) => match.groups.route))];
}

async function readPlatformViewRoutesFromApp() {
	const source = await readFile(appSourcePath, 'utf8');
	return new Map(
		[...source.matchAll(platformViewRoutePattern)].map((match) => [
			match.groups.route,
			match.groups.view,
		]),
	);
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

function assertSourceIncludes(source, sourceLabel, snippets) {
	const missing = snippets.filter((snippet) => !source.includes(snippet));

	if (missing.length > 0) {
		throw new Error(`${sourceLabel} is missing expected page snippets: ${missing.join(', ')}`);
	}
}

function getJsonPathValue(value, dottedPath) {
	return dottedPath.split('.').reduce((current, key) => {
		if (current && typeof current === 'object' && key in current) {
			return current[key];
		}
		return undefined;
	}, value);
}

async function assertLocaleKeys(expectation) {
	for (const localeSourcePath of localeSourcePaths) {
		const locale = JSON.parse(await readFile(localeSourcePath, 'utf8'));
		const missing = expectation.requiredLocaleKeys.filter(
			(key) => typeof getJsonPathValue(locale, key) !== 'string',
		);

		if (missing.length > 0) {
			throw new Error(
				`${path.basename(localeSourcePath)} is missing ${expectation.route} locale keys: ${missing.join(', ')}`,
			);
		}
	}
}

async function assertRoutePageExpectations() {
	const viewRoutes = await readPlatformViewRoutesFromApp();
	const platformPageSource = await readFile(platformPageSourcePath, 'utf8');
	const workflowRunnerPanelSource = await readFile(workflowRunnerPanelSourcePath, 'utf8');

	for (const expectation of routePageExpectations) {
		const actualView = viewRoutes.get(expectation.route);
		if (actualView !== expectation.view) {
			throw new Error(
				`${expectation.route} should render PlatformPage view="${expectation.view}", found ${actualView ?? 'none'}`,
			);
		}

		assertSourceIncludes(platformPageSource, 'platform page router', [
			`view === '${expectation.view}'`,
			`<${expectation.component}`,
		]);

		const componentSource = await readFile(expectation.componentSourcePath, 'utf8');
		assertSourceIncludes(
			componentSource,
			`${expectation.component} source`,
			expectation.requiredComponentSnippets,
		);
		assertSourceIncludes(
			workflowRunnerPanelSource,
			'WorkflowRunnerPanel source',
			expectation.requiredPanelSnippets,
		);
		await assertLocaleKeys(expectation);
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
	await assertRoutePageExpectations();

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

	console.log(
		`Verified ${routes.length} platform routes and ${routePageExpectations.length} page expectation set against ${baseUrl}`,
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
