import type {
  AgreementDto,
  AgreementLineInput,
  BillingImportDto,
  ClientDetailDto,
  CommentDto,
  ExceptionDto,
  MappingsDto,
  OverviewDto,
  RunDto,
} from "@seattrue/api/contract";
import { apiErrorMessage, getApiClient } from "./api";

export type {
  AgreementDto,
  AgreementLineInput,
  BillingImportDto,
  ClientDetailDto,
  CommentDto,
  ExceptionDto,
  MappingsDto,
  OverviewDto,
  RunDto,
};
export type ExceptionStatus = ExceptionDto["status"];

export async function getOverview(): Promise<OverviewDto> {
  const api = getApiClient();
  const { data, error } = await api.recon.overview.get();
  if (error)
    throw new Error(apiErrorMessage(error, "Could not load overview."));
  if (!data) throw new Error("Overview response was empty.");
  return data;
}

export async function getClientDetail(id: string): Promise<ClientDetailDto> {
  const api = getApiClient();
  const { data, error } = await api.recon.clients({ id }).get();
  if (error) throw new Error(apiErrorMessage(error, "Could not load client."));
  if (!data) throw new Error("Client response was empty.");
  return data;
}

export async function listExceptions(): Promise<ExceptionDto[]> {
  const api = getApiClient();
  const { data, error } = await api.recon.exceptions.get();
  if (error)
    throw new Error(apiErrorMessage(error, "Could not load exceptions."));
  if (!data) throw new Error("Exceptions response was empty.");
  return data.exceptions;
}

export async function setExceptionStatus(
  id: string,
  status: ExceptionStatus,
): Promise<ExceptionDto> {
  const api = getApiClient();
  const { data, error } = await api.recon.exceptions({ id }).patch({ status });
  if (error)
    throw new Error(apiErrorMessage(error, "Could not update exception."));
  if (!data) throw new Error("Update response was empty.");
  return data;
}

export async function getMappings(): Promise<MappingsDto> {
  const api = getApiClient();
  const { data, error } = await api.recon.mappings.get();
  if (error)
    throw new Error(apiErrorMessage(error, "Could not load mappings."));
  if (!data) throw new Error("Mappings response was empty.");
  return data;
}

export async function saveMapping(input: {
  customerKey: string;
  clientId: string;
}): Promise<void> {
  const api = getApiClient();
  const { error } = await api.recon.mappings.put(input);
  if (error) throw new Error(apiErrorMessage(error, "Could not save mapping."));
}

export async function uploadRun(input: {
  fileName: string;
  csv: string;
}): Promise<RunDto> {
  const api = getApiClient();
  const { data, error } = await api.recon.runs.post(input);
  if (error)
    throw new Error(apiErrorMessage(error, "Could not read that file."));
  if (!data) throw new Error("Upload response was empty.");
  return data;
}

export async function uploadBilling(input: {
  fileName: string;
  csv: string;
}): Promise<BillingImportDto> {
  const api = getApiClient();
  const { data, error } = await api.recon.billing.post(input);
  if (error)
    throw new Error(apiErrorMessage(error, "Could not read that file."));
  if (!data) throw new Error("Upload response was empty.");
  return data;
}

export async function saveAgreementLines(input: {
  id: string;
  lines: AgreementLineInput[];
}): Promise<AgreementDto[]> {
  const api = getApiClient();
  const { data, error } = await api.recon
    .clients({ id: input.id })
    .agreements.put({ lines: input.lines });
  if (error)
    throw new Error(apiErrorMessage(error, "Could not save billed lines."));
  if (!data) throw new Error("Save response was empty.");
  return data.agreements;
}

export async function mapBillingClient(input: {
  clientName: string;
  clientId: string;
}): Promise<void> {
  const api = getApiClient();
  const { error } = await api.recon.billing.mappings.put(input);
  if (error) throw new Error(apiErrorMessage(error, "Could not save mapping."));
}

export async function createClient(input: { name: string; markupPct: number }) {
  const api = getApiClient();
  const { data, error } = await api.recon.clients.post(input);
  if (error) throw new Error(apiErrorMessage(error, "Could not add client."));
  if (!data) throw new Error("Client response was empty.");
  return data;
}

export async function loadDemo(): Promise<RunDto> {
  const api = getApiClient();
  const { data, error } = await api.recon.demo.post();
  if (error)
    throw new Error(apiErrorMessage(error, "Could not load demo data."));
  if (!data) throw new Error("Demo response was empty.");
  return data;
}

export async function joinWaitlist(input: {
  email: string;
  company?: string;
  seats?: number;
}): Promise<void> {
  const api = getApiClient();
  const { error } = await api.waitlist.post(input);
  if (error)
    throw new Error(apiErrorMessage(error, "Could not join the waitlist."));
}

export async function setClientMarkup(input: {
  id: string;
  markupPct: number;
}) {
  const api = getApiClient();
  const { data, error } = await api.recon
    .clients({ id: input.id })
    .patch({ markupPct: input.markupPct });
  if (error) throw new Error(apiErrorMessage(error, "Could not save markup."));
  if (!data) throw new Error("Client response was empty.");
  return data;
}

export async function setExceptionFlag(input: {
  id: string;
  flagged: boolean;
}) {
  const api = getApiClient();
  const { data, error } = await api.recon
    .exceptions({ id: input.id })
    .flag.put({ flagged: input.flagged });
  if (error) throw new Error(apiErrorMessage(error, "Could not flag."));
  if (!data) throw new Error("Flag response was empty.");
  return data;
}

export async function listComments(id: string): Promise<CommentDto[]> {
  const api = getApiClient();
  const { data, error } = await api.recon.exceptions({ id }).comments.get();
  if (error)
    throw new Error(apiErrorMessage(error, "Could not load comments."));
  if (!data) throw new Error("Comments response was empty.");
  return data.comments;
}

export async function addComment(input: { id: string; body: string }) {
  const api = getApiClient();
  const { data, error } = await api.recon
    .exceptions({ id: input.id })
    .comments.post({ body: input.body });
  if (error) throw new Error(apiErrorMessage(error, "Could not comment."));
  return data;
}

export async function setClientArchived(input: {
  id: string;
  archived: boolean;
}) {
  const api = getApiClient();
  const { data, error } = await api.recon
    .clients({ id: input.id })
    .patch({ archived: input.archived });
  if (error)
    throw new Error(apiErrorMessage(error, "Could not update client."));
  if (!data) throw new Error("Client response was empty.");
  return data;
}
