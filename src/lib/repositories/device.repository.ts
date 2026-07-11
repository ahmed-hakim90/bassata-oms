import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { getDb, throwDbError } from "@/lib/repositories/client";
import type { DeviceRow } from "@/lib/supabase/database.types";

export type Device = DeviceRow;

function randomDeviceKey(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export async function hashSecret(value: string): Promise<string> {
  return bcrypt.hash(value, 10);
}

export async function listDevices(storeId?: string): Promise<Device[]> {
  const db = await getDb();
  let q = db.from("devices").select("*").order("name");
  if (storeId) q = q.eq("store_id", storeId);
  const { data, error } = await q;
  if (error) throwDbError(error, "listDevices");
  return (data ?? []) as Device[];
}

export async function getDevice(id: string): Promise<Device | null> {
  const db = await getDb();
  const { data, error } = await db.from("devices").select("*").eq("id", id).maybeSingle();
  if (error) throwDbError(error, "getDevice");
  return (data as Device | null) ?? null;
}

export async function createDevice(input: {
  storeId: string;
  name: string;
}): Promise<{ device: Device; deviceKey: string }> {
  const db = await getDb();
  const deviceKey = randomDeviceKey();
  const device_key_hash = await hashSecret(deviceKey);
  const { data, error } = await db
    .from("devices")
    .insert({
      store_id: input.storeId,
      name: input.name,
      device_key_hash,
      is_active: true,
    })
    .select()
    .single();
  if (error || !data) throwDbError(error, "createDevice");
  return { device: data as Device, deviceKey };
}

export async function updateDevice(input: {
  id: string;
  storeId?: string;
  name?: string;
  isActive?: boolean;
}): Promise<Device | null> {
  const db = await getDb();
  const { data, error } = await db
    .from("devices")
    .update({
      ...(input.storeId !== undefined ? { store_id: input.storeId } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    })
    .eq("id", input.id)
    .select()
    .maybeSingle();
  if (error) throwDbError(error, "updateDevice");
  return (data as Device | null) ?? null;
}

export async function deleteDevice(id: string): Promise<Device | null> {
  const db = await getDb();
  const { data, error } = await db.from("devices").delete().eq("id", id).select().maybeSingle();
  if (error) throwDbError(error, "deleteDevice");
  return (data as Device | null) ?? null;
}

export async function touchDeviceSeen(deviceId: string): Promise<void> {
  const db = await getDb();
  const { error } = await db.rpc("touch_device_seen", { p_device_id: deviceId });
  if (error) throwDbError(error, "touchDeviceSeen");
}

export async function createPairingCode(deviceId: string): Promise<string> {
  const db = await getDb();
  const { data, error } = await db.rpc("create_device_pairing_code", {
    p_device_id: deviceId,
  });
  if (error) throwDbError(error, "createPairingCode");
  return data as string;
}

export async function consumePairingCode(
  code: string
): Promise<{ deviceId: string; storeId: string }> {
  const db = await getDb();
  const { data, error } = await db.rpc("consume_device_pairing_code", { p_code: code });
  if (error) throwDbError(error, "consumePairingCode");
  const row = (data as { device_id: string; store_id: string }[] | null)?.[0];
  if (!row) throw new Error("Invalid or expired pairing code");
  return { deviceId: row.device_id, storeId: row.store_id };
}

export async function cashierCanUseDevice(
  userId: string,
  storeId: string,
  deviceId: string
): Promise<boolean> {
  const db = await getDb();
  const { data, error } = await db.rpc("cashier_can_use_device", {
    p_user_id: userId,
    p_store_id: storeId,
    p_device_id: deviceId,
  });
  if (error) throwDbError(error, "cashierCanUseDevice");
  return Boolean(data);
}

export async function getUserDeviceIds(userId: string): Promise<string[]> {
  const map = await getDeviceIdsForUsers([userId]);
  return map.get(userId) ?? [];
}

export async function getDeviceIdsForUsers(
  userIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (userIds.length === 0) return map;
  for (const id of userIds) map.set(id, []);
  const db = await getDb();
  const { data, error } = await db
    .from("user_device_access")
    .select("user_id, device_id")
    .in("user_id", userIds)
    .eq("is_active", true);
  if (error) throwDbError(error, "getDeviceIdsForUsers");
  for (const row of data ?? []) {
    const list = map.get(row.user_id) ?? [];
    list.push(row.device_id);
    map.set(row.user_id, list);
  }
  return map;
}

export async function setUserDeviceAccess(userId: string, deviceIds: string[]): Promise<void> {
  const db = await getDb();
  await db.from("user_device_access").delete().eq("user_id", userId);
  if (deviceIds.length > 0) {
    const { error } = await db.from("user_device_access").insert(
      deviceIds.map((device_id) => ({
        user_id: userId,
        device_id,
        is_active: true,
      }))
    );
    if (error) throwDbError(error, "setUserDeviceAccess");
  }
}

export async function listDevicesForStores(storeIds: string[]): Promise<Device[]> {
  if (storeIds.length === 0) return [];
  const db = await getDb();
  const { data, error } = await db
    .from("devices")
    .select("*")
    .in("store_id", storeIds)
    .eq("is_active", true)
    .order("name");
  if (error) throwDbError(error, "listDevicesForStores");
  return (data ?? []) as Device[];
}
