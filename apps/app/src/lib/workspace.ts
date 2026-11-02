import type {
  AuditDto,
  InvitationDto,
  MemberDto,
} from "@seattrue/api/contract";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiErrorMessage, getApiClient } from "./api";

export type { AuditDto, InvitationDto, MemberDto };
export type InvitableRole = "admin" | "tech";

async function getWorkspace() {
  const api = getApiClient();
  const { data, error } = await api.workspace.get();
  if (error)
    throw new Error(apiErrorMessage(error, "Could not load workspace."));
  if (!data) throw new Error("Workspace response was empty.");
  return data;
}

export type WorkspaceView = Awaited<ReturnType<typeof getWorkspace>>;

export const workspaceKeys = {
  all: ["workspace"] as const,
  current: () => ["workspace", "current"] as const,
  members: () => ["workspace", "members"] as const,
  audit: () => ["workspace", "audit"] as const,
};

export const workspaceQueryOptions = queryOptions({
  queryKey: workspaceKeys.current(),
  queryFn: getWorkspace,
});

/**
 * UI gating only: hides controls the member's role can't use. The API checks
 * every request with the organization plugin's hasPermission regardless.
 */
export function useCan() {
  const workspace = useQuery(workspaceQueryOptions);
  const permissions = (workspace.data?.permissions ?? {}) as Record<
    string,
    readonly string[] | undefined
  >;
  return (resource: string, action: string) =>
    permissions[resource]?.includes(action) ?? false;
}

async function listMembers() {
  const api = getApiClient();
  const { data, error } = await api.members.get();
  if (error) throw new Error(apiErrorMessage(error, "Could not load members."));
  if (!data) throw new Error("Members response was empty.");
  return data;
}

export const membersQueryOptions = queryOptions({
  queryKey: workspaceKeys.members(),
  queryFn: listMembers,
});

async function listAudit(): Promise<AuditDto[]> {
  const api = getApiClient();
  const { data, error } = await api.audit.get();
  if (error)
    throw new Error(apiErrorMessage(error, "Could not load the audit log."));
  if (!data) throw new Error("Audit response was empty.");
  return data.entries;
}

export const auditQueryOptions = queryOptions({
  queryKey: workspaceKeys.audit(),
  queryFn: listAudit,
});

function useWorkspaceMutation<Input>(run: (input: Input) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all }),
  });
}

export function useInvite() {
  return useWorkspaceMutation(
    async (input: { email: string; role: InvitableRole }) => {
      const api = getApiClient();
      const { data, error } = await api.members.invitations.post(input);
      if (error)
        throw new Error(apiErrorMessage(error, "Could not send the invite."));
      return data;
    },
  );
}

export function useCancelInvite() {
  return useWorkspaceMutation(async (id: string) => {
    const api = getApiClient();
    const { error } = await api.members.invitations({ id }).delete();
    if (error)
      throw new Error(apiErrorMessage(error, "Could not cancel the invite."));
  });
}

export function useChangeRole() {
  return useWorkspaceMutation(
    async (input: { id: string; role: InvitableRole }) => {
      const api = getApiClient();
      const { error } = await api
        .members({ id: input.id })
        .patch({ role: input.role });
      if (error)
        throw new Error(apiErrorMessage(error, "Could not change the role."));
    },
  );
}

export function useRemoveMember() {
  return useWorkspaceMutation(async (id: string) => {
    const api = getApiClient();
    const { error } = await api.members({ id }).delete();
    if (error)
      throw new Error(apiErrorMessage(error, "Could not remove the member."));
  });
}

/** Switching workspace changes every screen's data, so drop all caches. */
export function useSwitchWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (organizationId: string) => {
      const api = getApiClient();
      const { error } = await api.workspace.active.put({ organizationId });
      if (error)
        throw new Error(apiErrorMessage(error, "Could not switch workspace."));
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export async function getInvitation(id: string) {
  const api = getApiClient();
  const { data, error } = await api.invitations({ id }).get();
  if (error)
    throw new Error(
      apiErrorMessage(error, "This invitation is invalid or has expired."),
    );
  if (!data) throw new Error("Invitation response was empty.");
  return data;
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const api = getApiClient();
      const { error } = await api.invitations({ id }).accept.post();
      if (error)
        throw new Error(
          apiErrorMessage(error, "Could not accept the invitation."),
        );
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
