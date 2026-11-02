import type {
  ClientDetailDto,
  ExceptionDto,
  MappingsDto,
  OverviewDto,
  RunDto,
} from "@seattrue/api/contract";
import { apiErrorMessage, getApiClient } from "./api";

export type { ClientDetailDto, ExceptionDto, MappingsDto, OverviewDto, RunDto };
export type ExceptionStatus = ExceptionDto["status"];

export async function getOverview(): Promise<OverviewDto> {
  const api = await getApiClient();
  const { data, error } = await api.recon.overview.get();
  if (error)
    throw new Error(apiErrorMessage(error, "Could not load overview."));
  if (!data) throw new Error("Overview response was empty.");
  return data;
}

export async function getClientDetail(id: string): Promise<ClientDetailDto> {
  const api = await getApiClient();
  const { data, error } = await api.recon.clients({ id }).get();
  if (error) throw new Error(apiErrorMessage(error, "Could not load client."));
  if (!data) throw new Error("Client response was empty.");
  return data;
}

export async function listExceptions(): Promise<ExceptionDto[]> {
  const api = await getApiClient();
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
  const api = await getApiClient();
  const { data, error } = await api.recon.exceptions({ id }).patch({ status });
  if (error)
    throw new Error(apiErrorMessage(error, "Could not update exception."));
  if (!data) throw new Error("Update response was empty.");
  return data;
}

export async function getMappings(): Promise<MappingsDto> {
  const api = await getApiClient();
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
  const api = await getApiClient();
  const { error } = await api.recon.mappings.put(input);
  if (error) throw new Error(apiErrorMessage(error, "Could not save mapping."));
}

export async function uploadRun(input: {
  fileName: string;
  csv: string;
}): Promise<RunDto> {
  const api = await getApiClient();
  const { data, error } = await api.recon.runs.post(input);
  if (error)
    throw new Error(apiErrorMessage(error, "Could not read that file."));
  if (!data) throw new Error("Upload response was empty.");
  return data;
}

export async function loadDemo(): Promise<RunDto> {
  const api = await getApiClient();
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
  const api = await getApiClient();
  const { error } = await api.waitlist.post(input);
  if (error)
    throw new Error(apiErrorMessage(error, "Could not join the waitlist."));
}
