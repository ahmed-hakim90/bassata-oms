import { asJson, getDb, throwDbError } from "@/lib/repositories/client";
import { mapImportJob } from "@/lib/repositories/mappers";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type { TablesInsert } from "@/lib/supabase/database.types";
import type { ImportJob } from "@/lib/types";

function toImportPatch(patch: Partial<ImportJob>): Partial<TablesInsert<"import_jobs">> {
  const { result, ...rest } = patch;
  return {
    ...rest,
    ...(result !== undefined ? { result: asJson(result) } : {}),
  };
}

export async function listImportJobs(): Promise<ImportJob[]> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("import_jobs")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throwDbError(error, "listImportJobs");
  return (data ?? []).map(mapImportJob);
}

export async function createImportJob(
  input: Omit<ImportJob, "id" | "created_at" | "org_id">
): Promise<ImportJob> {
  const db = await getDb();
  const orgId = await getOrgId();
  const { data, error } = await db
    .from("import_jobs")
    .insert({ org_id: orgId, ...input, result: asJson(input.result) })
    .select()
    .single();
  if (error || !data) throwDbError(error, "createImportJob");
  return mapImportJob(data);
}

export async function updateImportJob(
  id: string,
  patch: Partial<ImportJob>
): Promise<ImportJob | null> {
  const db = await getDb();
  const { data, error } = await db
    .from("import_jobs")
    .update(toImportPatch(patch))
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "updateImportJob");
  return data ? mapImportJob(data) : null;
}
