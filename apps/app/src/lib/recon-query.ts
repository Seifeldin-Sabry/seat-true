import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  addComment,
  type ExceptionStatus,
  getClientDetail,
  getMappings,
  getOverview,
  listComments,
  listExceptions,
  loadDemo,
  saveMapping,
  setClientArchived,
  setClientMarkup,
  setExceptionFlag,
  setExceptionStatus,
  uploadRun,
} from "./recon-api";

export const reconKeys = {
  all: ["recon"] as const,
  overview: () => ["recon", "overview"] as const,
  exceptions: () => ["recon", "exceptions"] as const,
  mappings: () => ["recon", "mappings"] as const,
  client: (id: string) => ["recon", "client", id] as const,
  comments: (id: string) => ["recon", "comments", id] as const,
};

export function commentsQueryOptions(id: string) {
  return queryOptions({
    queryKey: reconKeys.comments(id),
    queryFn: () => listComments(id),
  });
}

export const overviewQueryOptions = queryOptions({
  queryKey: reconKeys.overview(),
  queryFn: getOverview,
});

export const exceptionsQueryOptions = queryOptions({
  queryKey: reconKeys.exceptions(),
  queryFn: listExceptions,
});

export const mappingsQueryOptions = queryOptions({
  queryKey: reconKeys.mappings(),
  queryFn: getMappings,
});

export function clientQueryOptions(id: string) {
  return queryOptions({
    queryKey: reconKeys.client(id),
    queryFn: () => getClientDetail(id),
  });
}

/** Every recon write can move totals on every screen, so refresh them all. */
function invalidateRecon(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: reconKeys.all });
}

export function useUploadRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadRun,
    onSuccess: () => invalidateRecon(queryClient),
  });
}

export function useLoadDemo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: loadDemo,
    onSuccess: () => invalidateRecon(queryClient),
  });
}

export function useSetExceptionStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ExceptionStatus }) =>
      setExceptionStatus(id, status),
    onSuccess: () => invalidateRecon(queryClient),
  });
}

export function useSaveMapping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveMapping,
    onSuccess: () => invalidateRecon(queryClient),
  });
}

export function useSetClientArchived() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setClientArchived,
    onSuccess: () => invalidateRecon(queryClient),
  });
}

export function useSetClientMarkup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setClientMarkup,
    onSuccess: () => invalidateRecon(queryClient),
  });
}

export function useSetExceptionFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setExceptionFlag,
    onSuccess: () => invalidateRecon(queryClient),
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addComment,
    onSuccess: () => invalidateRecon(queryClient),
  });
}
