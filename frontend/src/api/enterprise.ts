import { client } from './client';

export type EnterpriseRecord = Record<string, unknown>;

type Items<T = EnterpriseRecord> = { items: T[] };

const idempotency = () => ({ 'Idempotency-Key': crypto.randomUUID() });

export const enterpriseApi = {
	users: () => client.get<Items>('/api/platform/users'),
	createUser: (body: EnterpriseRecord) => client.post<EnterpriseRecord>('/api/platform/users', body),
	setUserPassword: (id: string, password: string) => client.put<void>(`/api/platform/users/${encodeURIComponent(id)}/password`, { password }),
	deactivateUser: (id: string) => client.post<EnterpriseRecord>(`/api/platform/users/${encodeURIComponent(id)}/deactivate`),
	organizations: () => client.get<EnterpriseRecord>('/api/platform/organizations'),
	createOrganization: (name: string) => client.post<EnterpriseRecord>('/api/platform/organizations', { name }),
	units: () => client.get<Items>('/api/platform/organization-units'),
	createUnit: (body: EnterpriseRecord) => client.post<EnterpriseRecord>('/api/platform/organization-units', body),
	memberships: () => client.get<Items>('/api/platform/memberships'),
	assignUnit: (membershipId: string, body: EnterpriseRecord) => client.post<EnterpriseRecord>(`/api/platform/memberships/${encodeURIComponent(membershipId)}/organization-assignments`, body),
	setManager: (membershipId: string, managerMembershipId: string) => client.put<EnterpriseRecord>(`/api/platform/memberships/${encodeURIComponent(membershipId)}/manager`, { manager_membership_id: managerMembershipId }),
	identityMutations: () => client.get<Items>('/api/platform/identity/mutations'),

	roles: () => client.get<Items>('/api/platform/roles'),
	createRole: (body: EnterpriseRecord) => client.post<EnterpriseRecord>('/api/platform/roles', body),
	roleBindings: () => client.get<Items>('/api/platform/role-bindings'),
	createRoleBinding: (body: EnterpriseRecord) => client.post<EnterpriseRecord>('/api/platform/role-bindings', body),
	authorizationDecisions: () => client.get<Items>('/api/platform/authorization-decisions'),

	leaveRequests: () => client.get<Items>('/api/platform/leave-requests'),
	createLeaveRequest: (body: EnterpriseRecord) => client.post<EnterpriseRecord>('/api/platform/leave-requests', body),
	approvalCases: () => client.get<Items>('/api/platform/approval-cases'),
	decideApproval: (id: string, decision: 'approve' | 'reject', comment: string) => client.post<EnterpriseRecord>(`/api/platform/approval-cases/${encodeURIComponent(id)}/${decision}`, { comment: comment || null }, undefined, { headers: idempotency() }),
	resumeRun: (id: string) => client.post<EnterpriseRecord>(`/api/platform/runs/${encodeURIComponent(id)}/resume`, {}, undefined, { headers: idempotency() }),
	runEvents: (id: string) => client.get<EnterpriseRecord>(`/api/platform/runs/${encodeURIComponent(id)}/events`),
	leaveAudit: () => client.get<Items>('/api/platform/leave-audit-events'),

	reports: () => client.get<Items>('/api/platform/reports'),
	queryReport: (code: string, parameters: EnterpriseRecord) => client.post<EnterpriseRecord>(`/api/platform/reports/${encodeURIComponent(code)}/query`, { parameters }),
	exportReport: (code: string, parameters: EnterpriseRecord) => client.post<EnterpriseRecord>(`/api/platform/reports/${encodeURIComponent(code)}/export`, { parameters }, undefined, { headers: idempotency() }),
	reportQueries: () => client.get<Items>('/api/platform/report-queries'),
	reportExports: () => client.get<Items>('/api/platform/report-exports'),
	reportAudit: () => client.get<Items>('/api/platform/report-audit-events'),
};
