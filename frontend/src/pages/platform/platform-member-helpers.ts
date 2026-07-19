import type {
	EnterprisePlatformMember,
	EnterprisePlatformMembersResponse,
	EnterprisePlatformMemberUpsertRequest,
} from '@/api';
import type { MemberFormState } from './platform-defaults';

export type MemberStatusToggleAction =
	| {
			kind: 'activate';
			userId: string;
			patch: Pick<EnterprisePlatformMemberUpsertRequest, 'status'>;
	  }
	| {
			kind: 'deactivate';
			userId: string;
	  };

export type MemberEditActionHandlers = {
	setMemberForm: (form: MemberFormState) => void;
};

export type MemberLoadActionHandlers = {
	setLoading: (loading: boolean) => void;
	clearError: () => void;
	loadMembers: () =>
		| EnterprisePlatformMembersResponse
		| Promise<EnterprisePlatformMembersResponse>;
	setMembers: (members: EnterprisePlatformMembersResponse) => void;
	setError: (message: string) => void;
};

export type MemberSaveActionHandlers = {
	setSavingMember: (saving: boolean) => void;
	clearError: () => void;
	handleValidationError: () => void;
	createMember: (
		payload: EnterprisePlatformMemberUpsertRequest,
	) => void | Promise<void>;
	resetForm: () => void;
	refreshDependentViews: () => void | Promise<void>;
	handleError: (error: unknown) => void;
};

export type MemberStatusToggleActionHandlers = {
	setUpdatingMember: (userId: string | null) => void;
	clearError: () => void;
	activateMember: (
		userId: string,
		patch: Pick<EnterprisePlatformMemberUpsertRequest, 'status'>,
	) => void | Promise<void>;
	deactivateMember: (userId: string) => void | Promise<void>;
	refreshDependentViews: () => void | Promise<void>;
	handleError: (error: unknown) => void;
};

export type PlatformMemberHandlerValues = {
	memberForm: MemberFormState;
	text: {
		loadError: string;
		userRequired: string;
		saveError: string;
	};
};

export type PlatformMemberHandlerActions = {
	setLoading: (loading: boolean) => void;
	clearLoadError: () => void;
	loadMembers: () =>
		| EnterprisePlatformMembersResponse
		| Promise<EnterprisePlatformMembersResponse>;
	setMembers: (members: EnterprisePlatformMembersResponse) => void;
	setLoadError: (message: string) => void;
	setMemberForm: (form: MemberFormState) => void;
	setSavingMember: (saving: boolean) => void;
	clearError: () => void;
	setError: (message: string) => void;
	createMember: (
		payload: EnterprisePlatformMemberUpsertRequest,
	) => void | Promise<void>;
	resetForm: () => void;
	refreshDependentViews: () => void | Promise<void>;
	setUpdatingMember: (userId: string | null) => void;
	activateMember: (
		userId: string,
		patch: Pick<EnterprisePlatformMemberUpsertRequest, 'status'>,
	) => void | Promise<void>;
	deactivateMember: (userId: string) => void | Promise<void>;
};

export function memberUserIdFromForm(form: MemberFormState): string {
	return form.user_id.trim();
}

export function memberCreatePayloadFromForm(
	form: MemberFormState,
	userId: string,
): EnterprisePlatformMemberUpsertRequest {
	return {
		user_id: userId,
		tenant: form.tenant.trim() || 'default',
		display_name: form.display_name.trim() || userId,
		role: form.role.trim() || 'Member',
		status: form.status,
	};
}

export function memberFormFromMember(
	member: EnterprisePlatformMember,
): MemberFormState {
	return {
		user_id: member.user_id,
		tenant: member.tenant || 'acme',
		display_name: member.display_name || member.user_id,
		role: member.role || '',
		status: member.status === 'inactive' ? 'inactive' : 'active',
	};
}

export function runMemberEditAction(
	member: EnterprisePlatformMember,
	handlers: MemberEditActionHandlers,
) {
	handlers.setMemberForm(memberFormFromMember(member));
}

export async function runMemberLoadAction(
	loadErrorMessage: string,
	handlers: MemberLoadActionHandlers,
) {
	handlers.setLoading(true);
	handlers.clearError();
	try {
		const response = await handlers.loadMembers();
		handlers.setMembers(response);
	} catch (error) {
		handlers.setError(
			error instanceof Error ? error.message : loadErrorMessage,
		);
	} finally {
		handlers.setLoading(false);
	}
}

export async function runMemberSaveAction(
	form: MemberFormState,
	handlers: MemberSaveActionHandlers,
) {
	const userId = memberUserIdFromForm(form);
	if (!userId) {
		handlers.handleValidationError();
		return;
	}

	handlers.setSavingMember(true);
	handlers.clearError();
	try {
		await handlers.createMember(memberCreatePayloadFromForm(form, userId));
		handlers.resetForm();
		await handlers.refreshDependentViews();
	} catch (error) {
		handlers.handleError(error);
	} finally {
		handlers.setSavingMember(false);
	}
}

export function memberStatusToggleAction(
	member: EnterprisePlatformMember,
): MemberStatusToggleAction {
	if (member.status === 'inactive') {
		return {
			kind: 'activate',
			userId: member.user_id,
			patch: { status: 'active' },
		};
	}

	return {
		kind: 'deactivate',
		userId: member.user_id,
	};
}

export async function runMemberStatusToggleAction(
	action: MemberStatusToggleAction,
	handlers: MemberStatusToggleActionHandlers,
) {
	handlers.setUpdatingMember(action.userId);
	handlers.clearError();
	try {
		if (action.kind === 'activate') {
			await handlers.activateMember(action.userId, action.patch);
		} else {
			await handlers.deactivateMember(action.userId);
		}
		await handlers.refreshDependentViews();
	} catch (error) {
		handlers.handleError(error);
	} finally {
		handlers.setUpdatingMember(null);
	}
}

export async function runMemberStatusToggleRequestAction(
	member: EnterprisePlatformMember,
	handlers: MemberStatusToggleActionHandlers,
) {
	await runMemberStatusToggleAction(memberStatusToggleAction(member), handlers);
}

export function createPlatformMemberHandlers(
	values: PlatformMemberHandlerValues,
	actions: PlatformMemberHandlerActions,
) {
	async function refetchMembers() {
		await runMemberLoadAction(values.text.loadError, {
			setLoading: actions.setLoading,
			clearError: actions.clearLoadError,
			loadMembers: actions.loadMembers,
			setMembers: actions.setMembers,
			setError: actions.setLoadError,
		});
	}

	async function handleSaveMember() {
		await runMemberSaveAction(values.memberForm, {
			setSavingMember: actions.setSavingMember,
			clearError: actions.clearError,
			handleValidationError: () => actions.setError(values.text.userRequired),
			createMember: actions.createMember,
			resetForm: actions.resetForm,
			refreshDependentViews: actions.refreshDependentViews,
			handleError: (error) =>
				actions.setError(
					error instanceof Error ? error.message : values.text.saveError,
				),
		});
	}

	function handleEditMember(member: EnterprisePlatformMember) {
		runMemberEditAction(member, {
			setMemberForm: actions.setMemberForm,
		});
	}

	async function handleToggleMemberStatus(member: EnterprisePlatformMember) {
		await runMemberStatusToggleRequestAction(member, {
			setUpdatingMember: actions.setUpdatingMember,
			clearError: actions.clearError,
			activateMember: actions.activateMember,
			deactivateMember: actions.deactivateMember,
			refreshDependentViews: actions.refreshDependentViews,
			handleError: (error) =>
				actions.setError(
					error instanceof Error ? error.message : values.text.saveError,
				),
		});
	}

	return {
		refetchMembers,
		handleSaveMember,
		handleEditMember,
		handleToggleMemberStatus,
	};
}
