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
const toolsPageSourcePath = path.resolve(
	scriptDir,
	'../src/pages/platform/components/ToolsViewPage.tsx',
);
const toolRunnerPanelSourcePath = path.resolve(
	scriptDir,
	'../src/pages/platform/components/ToolRunnerPanel.tsx',
);
const agentsPageSourcePath = path.resolve(
	scriptDir,
	'../src/pages/platform/components/AgentsViewPage.tsx',
);
const approvalsPageSourcePath = path.resolve(
	scriptDir,
	'../src/pages/platform/components/ApprovalsViewPage.tsx',
);
const approvalsPanelSourcePath = path.resolve(
	scriptDir,
	'../src/pages/platform/components/ApprovalsPanel.tsx',
);
const runsPageSourcePath = path.resolve(
	scriptDir,
	'../src/pages/platform/components/RunsViewPage.tsx',
);
const memoryPageSourcePath = path.resolve(
	scriptDir,
	'../src/pages/platform/components/MemoryViewPage.tsx',
);
const settingsPageSourcePath = path.resolve(
	scriptDir,
	'../src/pages/platform/components/SettingsViewPage.tsx',
);
const configManagementPanelSourcePath = path.resolve(
	scriptDir,
	'../src/pages/platform/components/ConfigManagementPanel.tsx',
);
const tenantsPageSourcePath = path.resolve(
	scriptDir,
	'../src/pages/platform/components/TenantsViewPage.tsx',
);
const connectorsSectionSourcePath = path.resolve(
	scriptDir,
	'../src/pages/platform/components/DashboardConnectorsSection.tsx',
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
		panelSourcePath: workflowRunnerPanelSourcePath,
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
	{
		route: '/platform/tools',
		view: 'tools',
		component: 'ToolsViewPage',
		componentSourcePath: toolsPageSourcePath,
		panelSourcePath: toolRunnerPanelSourcePath,
		requiredComponentSnippets: [
			'PlatformMetricsGrid',
			'ToolCatalogPanel',
			'ToolRunnerPanel',
			"t('platform.toolCatalog.title')",
			"t('platform.toolCatalog.description')",
			"t('platform.toolRunner.openRunner')",
		],
		requiredPanelSnippets: [
			"t('platform.toolRunner.title')",
			"t('platform.toolRunner.selectTool')",
			"t('platform.toolRunner.run')",
			"t('platform.toolRunner.requestApproval')",
			"t('platform.toolRunner.result')",
			"t('platform.toolRunner.error')",
		],
		requiredLocaleKeys: [
			'platform.toolCatalog.title',
			'platform.toolCatalog.description',
			'platform.toolRunner.title',
			'platform.toolRunner.description',
			'platform.toolRunner.selectTool',
			'platform.toolRunner.run',
			'platform.toolRunner.requestApproval',
						'platform.toolRunner.result',
			'platform.toolRunner.error',
		],
	},
	{
		route: '/platform/agents',
		view: 'agents',
		component: 'AgentsViewPage',
		componentSourcePath: agentsPageSourcePath,
		requiredComponentSnippets: [
			'PlatformPageShell',
			'PlatformPageHeader',
		],
		requiredLocaleKeys: [
			'platform.agentManagement.description',
			'platform.agentManagement.title',
		],
	},
	{
		route: '/platform/approvals',
		view: 'approvals',
		component: 'ApprovalsViewPage',
		componentSourcePath: approvalsPageSourcePath,
		panelSourcePath: approvalsPanelSourcePath,
		requiredComponentSnippets: [
			'PlatformMetricsGrid',
			'ApprovalsPanel',
			"t('platform.approvals.title')",
			"t('platform.approvals.description')",
		],
		requiredPanelSnippets: [
			"t('platform.approvals.agent')",
			"t('platform.approvals.approve')",
			"t('platform.approvals.reject')",
		],
		requiredLocaleKeys: [
			'platform.approvals.title',
			'platform.approvals.description',
			'platform.approvals.pending',
			'platform.approvals.approve',
			'platform.approvals.reject',
		],
	},
	{
		route: '/platform/runs',
		view: 'runs',
		component: 'RunsViewPage',
		componentSourcePath: runsPageSourcePath,
		requiredComponentSnippets: [
			'PlatformDetailDrawer',
			"t('platform.monitoring.description')",
			"t('platform.monitoring.actions')",
		],
		requiredLocaleKeys: [
			'platform.monitoring.description',
			'platform.monitoring.actions',
			'platform.monitoring.agent',
		],
	},
	{
		route: '/platform/memory',
		view: 'memory',
		component: 'MemoryViewPage',
		componentSourcePath: memoryPageSourcePath,
		requiredComponentSnippets: [
			'PlatformMetricsGrid',
			'PlatformPageShell',
			"t('platform.memoryOps.description')",
		],
		requiredLocaleKeys: [
			'platform.memoryOps.description',
			'platform.memoryOps.eyebrow',
		],
	},
	{
		route: '/platform/settings',
		view: 'settings',
		component: 'SettingsViewPage',
		componentSourcePath: settingsPageSourcePath,
		panelSourcePath: configManagementPanelSourcePath,
		requiredComponentSnippets: [
			'PlatformConnectionCard',
			'ConfigManagementPanel',
			"t('platform.settings.description')",
		],
		requiredPanelSnippets: [
			"t('platform.configManagement.title')",
			"t('platform.configManagement.description')",
		],
		requiredLocaleKeys: [
			'platform.settings.description',
			'platform.configManagement.title',
			'platform.configManagement.description',
		],
	},
	{
		route: '/platform/tenants',
		view: 'tenants',
		component: 'TenantsViewPage',
		componentSourcePath: tenantsPageSourcePath,
		requiredComponentSnippets: [
			'PlatformMetricsGrid',
			'PlatformPageShell',
			'PlatformNotice',
		],
		requiredLocaleKeys: [],
	},
	{
		route: '/platform/connectors',
		view: 'connectors',
		component: 'DashboardConnectorsSection',
		componentSourcePath: connectorsSectionSourcePath,
		requiredComponentSnippets: [
			'PlatformPageShell',
			'PlatformMetricsGrid',
			"t('platform.connectors.description')",
		],
		requiredLocaleKeys: [
			'platform.connectors.description',
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
		if (expectation.panelSourcePath && expectation.requiredPanelSnippets?.length) {
			const panelSource = await readFile(expectation.panelSourcePath, 'utf8');
			assertSourceIncludes(
				panelSource,
				`${path.basename(expectation.panelSourcePath)} source`,
				expectation.requiredPanelSnippets,
			);
		}
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
