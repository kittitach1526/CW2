"use server";

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:4000";

const ROOT_USERNAME = "root";
const ROOT_PASSWORD = "p@ssw0rd";

interface WelfareRequest {
  id: number;
  gangName?: string;
  gangAbbreviation?: string;
  gangAbbr?: string;
  requestName: string;
  discordId: string;
  welfareItem: string;
  requestType?: string;
  status: string;
  createdAt: string;
  approver?: string;
  details?: any;
  hasWelfare?: boolean;
  activeWelfareItems?: any[];
}

interface SystemLog {
  id: number;
  actor?: string;
  actorRole?: string;
  action: string;
  targetType?: string;
  targetId?: number;
  targetName?: string;
  details?: any;
  description?: string;
  createdAt: string;
}

type ApiPayload = Record<string, unknown>;

function formDataToObject(formData: FormData): ApiPayload {
  const obj: ApiPayload = {};
  formData.forEach((value, key) => {
    obj[key] = typeof value === "string" ? value : value.toString();
  });
  return obj;
}

function formatThaiDate(value: string | Date | null | undefined): string {
  if (!value) return "ไม่ระบุเวลา";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString("th-TH");
}

async function apiFetch(
  method: string,
  path: string,
  body?: ApiPayload
) {
  const url = `${API_BASE_URL}${path}`;
  const options: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    return data;
  } catch (error) {
    console.error("API Error:", error);
    return { success: false, message: "❌ ไม่สามารถเชื่อมต่อกับระบบหลังบ้านได้" };
  }
}

// ---------------------------------------------------------------------------
// Disband Requests
// ---------------------------------------------------------------------------
export async function requestDisbandGang(abbreviation: string, reason?: string, approver?: string) {
  if (!abbreviation) {
    return { success: false, message: "❌ ไม่พบข้อมูลชื่อย่อแก๊ง" };
  }
  return apiFetch("POST", "/api/gangs/disband", { abbreviation, reason, approver });
}

export async function getPendingDisbandRequests() {
  return apiFetch("GET", "/api/disband-requests");
}

export async function getDisbandRequestByGang(gangId: number) {
  return apiFetch("GET", `/api/gangs/${gangId}/disband-request`);
}

export async function approveDisbandRequest(id: number, reviewer: string) {
  return apiFetch("POST", `/api/disband-requests/${id}/approve`, { reviewer });
}

export async function rejectDisbandRequest(id: number, reviewer: string) {
  return apiFetch("POST", `/api/disband-requests/${id}/reject`, { reviewer });
}

// ---------------------------------------------------------------------------
// Pause Requests
// ---------------------------------------------------------------------------
export async function requestPauseGang(
  abbreviation: string,
  reason: string,
  approver: string,
  durationDays: number
) {
  if (!abbreviation) {
    return { success: false, message: "❌ ไม่พบข้อมูลชื่อย่อแก๊ง" };
  }
  return apiFetch("POST", "/api/gangs/pause", { abbreviation, reason, approver, durationDays });
}

export async function getPauseRequestByGang(gangId: number) {
  return apiFetch("GET", `/api/gangs/${gangId}/pause-request`);
}

export async function getPauseRequests() {
  return apiFetch("GET", "/api/pause-requests");
}

export async function approvePauseRequest(id: number, reviewer: string) {
  return apiFetch("POST", `/api/pause-requests/${id}/approve`, { reviewer });
}

export async function rejectPauseRequest(id: number, reviewer: string) {
  return apiFetch("POST", `/api/pause-requests/${id}/reject`, { reviewer });
}

export async function reportPauseRequest(id: number, reporter?: string, actorRole?: string) {
  const payload: ApiPayload = {};
  if (reporter) payload.reporter = reporter;
  if (actorRole) payload.actorRole = actorRole;
  return apiFetch("POST", `/api/pause-requests/${id}/report`, payload);
}

// ---------------------------------------------------------------------------
// Gang Registration / Login
// ---------------------------------------------------------------------------
export async function createRegistration(formData: FormData) {
  const payload = formDataToObject(formData);
  return apiFetch("POST", "/api/gangs/register", payload);
}

export async function loginGang(formData: FormData) {
  const payload = formDataToObject(formData);
  return apiFetch("POST", "/api/gangs/login", payload);
}

export async function getAllGangs() {
  return apiFetch("GET", "/api/gangs");
}

export async function updateGangStatus(
  id: number,
  status: "approved" | "disbanded" | "pending" | "รอยุบ" | "พัก",
  actor?: string,
  actorRole?: string
) {
  const payload: ApiPayload = { status };
  if (actor) payload.actor = actor;
  if (actorRole) payload.actorRole = actorRole;
  return apiFetch("PATCH", `/api/gangs/${id}/status`, payload);
}

// ---------------------------------------------------------------------------
// Gang Edit Requests
// ---------------------------------------------------------------------------
export async function createGangEditRequest(formData: FormData) {
  const payload = formDataToObject(formData);
  const gangId = Number(payload.id);
  if (!gangId) {
    return { success: false, message: "❌ ไม่พบรหัสแก๊ง" };
  }
  if (payload.password) {
    payload.newPassword = payload.password;
    delete payload.password;
  }
  return apiFetch("POST", `/api/gangs/${gangId}/edit-requests`, payload);
}

export async function getPendingGangEditRequests() {
  return apiFetch("GET", "/api/edit-requests/pending");
}

export async function getGangEditRequestByGang(gangId: number) {
  return apiFetch("GET", `/api/gangs/${gangId}/edit-requests`);
}

export async function approveGangEditRequest(id: number, reviewer: string) {
  return apiFetch("POST", `/api/edit-requests/${id}/approve`, { reviewer });
}

export async function rejectGangEditRequest(id: number, reviewer: string) {
  return apiFetch("POST", `/api/edit-requests/${id}/reject`, { reviewer });
}

// ---------------------------------------------------------------------------
// Council Names (used for dropdowns like uniform approver)
// ---------------------------------------------------------------------------
export async function getCouncilNames() {
  return apiFetch("GET", "/api/council/names");
}

// ---------------------------------------------------------------------------
// Uniform Files
// ---------------------------------------------------------------------------
export async function createUniformFile(data: FormData | Record<string, unknown>) {
  const payload = data instanceof FormData ? formDataToObject(data) : (data as ApiPayload);
  return apiFetch("POST", "/api/uniform-files", payload);
}

export async function getAllUniformFiles() {
  return apiFetch("GET", "/api/uniform-files");
}

export async function updateUniformFileLink(
  id: number,
  newFileUrl: string,
  reason: string,
  actor?: string,
  actorRole?: string
) {
  const payload: ApiPayload = { newFileUrl, reason };
  if (actor) payload.actor = actor;
  if (actorRole) payload.actorRole = actorRole;
  return apiFetch("PATCH", `/api/uniform-files/${id}/link`, payload);
}

export async function updateUniformStatus(
  id: number,
  status: "ลงแล้ว" | "ปฏิเสธ" | "รอลง",
  actor?: string,
  actorRole?: string
) {
  const payload: ApiPayload = { status };
  if (actor) payload.actor = actor;
  if (actorRole) payload.actorRole = actorRole;
  return apiFetch("PATCH", `/api/uniform-files/${id}/status`, payload);
}

// ---------------------------------------------------------------------------
// Welfare Requests
// ---------------------------------------------------------------------------
export async function createWelfareRequest(data: FormData | Record<string, unknown>) {
  const payload = data instanceof FormData ? formDataToObject(data) : (data as ApiPayload);
  return apiFetch("POST", "/api/welfare", payload);
}

export async function getWelfareRequestsByGang(gangAbbreviation: string) {
  const result = await apiFetch(
    "GET",
    `/api/welfare/gang/${encodeURIComponent(gangAbbreviation)}`
  );
  if (result.success && Array.isArray(result.requests)) {
    result.requests = result.requests.map((req: WelfareRequest) => ({
      ...req,
      createdAt: formatThaiDate(req.createdAt),
    }));
  }
  return result;
}

export async function getAllWelfareRequests() {
  const result = await apiFetch("GET", "/api/welfare");
  if (result.success && Array.isArray(result.requests)) {
    result.requests = result.requests.map((req: WelfareRequest) => ({
      ...req,
      createdAt: formatThaiDate(req.createdAt),
    }));
  }
  return result;
}

export async function updateWelfareStatus(
  id: number,
  status: string,
  actor?: string,
  actorRole?: string
) {
  const payload: ApiPayload = { status };
  if (actor) payload.actor = actor;
  if (actorRole) payload.actorRole = actorRole;
  return apiFetch("PATCH", `/api/welfare/${id}/status`, payload);
}

export async function getLeaveRequests() {
  const result = await apiFetch("GET", "/api/welfare/leave");
  if (result.success && Array.isArray(result.requests)) {
    result.requests = result.requests.map((req: WelfareRequest) => ({
      ...req,
      createdAt: formatThaiDate(req.createdAt),
    }));
  }
  return result;
}

export async function getSystemLogs(limit = 500) {
  return apiFetch("GET", `/api/logs?limit=${limit}`);
}

export async function getWelfareItems() {
  return apiFetch("GET", "/api/welfare-items");
}

export async function createWelfareItem(
  payload: {
    name: string;
    type: string;
    gang_limit?: number | null;
    female_gang_limit?: number | null;
    family_limit?: number | null;
  },
  actor?: string,
  actorRole?: string
) {
  const body: ApiPayload = { ...payload };
  if (actor) body.actor = actor;
  if (actorRole) body.actorRole = actorRole;
  return apiFetch("POST", "/api/welfare-items", body);
}

export async function updateWelfareItem(
  id: number,
  payload: {
    name?: string;
    type?: string;
    active?: boolean;
    gang_limit?: number | null;
    female_gang_limit?: number | null;
    family_limit?: number | null;
  },
  actor?: string,
  actorRole?: string
) {
  const body: ApiPayload = { ...payload };
  if (actor) body.actor = actor;
  if (actorRole) body.actorRole = actorRole;
  return apiFetch("PATCH", `/api/welfare-items/${id}`, body);
}

export async function deleteWelfareItem(id: number, actor?: string, actorRole?: string) {
  const payload: ApiPayload = {};
  if (actor) payload.actor = actor;
  if (actorRole) payload.actorRole = actorRole;
  return apiFetch("DELETE", `/api/welfare-items/${id}`, payload);
}

// ---------------------------------------------------------------------------
// Council Users
// ---------------------------------------------------------------------------
export async function loginCouncil(formData: FormData) {
  const payload = formDataToObject(formData);
  return apiFetch("POST", "/api/council/login", payload);
}

export async function getAllCouncilUsers() {
  return apiFetch("GET", "/api/council");
}

export async function createCouncilUser(formData: FormData) {
  const payload = formDataToObject(formData);
  return apiFetch("POST", "/api/council", payload);
}

export async function updateCouncilUserStatus(
  id: number,
  status: "อนุมัติ" | "ระงับใช้งาน",
  actor?: string,
  actorRole?: string
) {
  const payload: ApiPayload = { status };
  if (actor) payload.actor = actor;
  if (actorRole) payload.actorRole = actorRole;
  return apiFetch("PATCH", `/api/council/${id}/status`, payload);
}

export async function deleteCouncilUser(id: number, actor?: string, actorRole?: string) {
  const payload: ApiPayload = {};
  if (actor) payload.actor = actor;
  if (actorRole) payload.actorRole = actorRole;
  return apiFetch("DELETE", `/api/council/${id}`, payload);
}

// ---------------------------------------------------------------------------
// Admin Users
// ---------------------------------------------------------------------------
export async function loginAdmin(formData: FormData) {
  const payload = formDataToObject(formData);
  return apiFetch("POST", "/api/admin/login", payload);
}

export async function getAllAdminUsers() {
  return apiFetch("GET", "/api/admin");
}

export async function createAdminUser(formData: FormData) {
  const payload = formDataToObject(formData);
  return apiFetch("POST", "/api/admin", payload);
}

export async function updateAdminUserStatus(
  id: number,
  status: "อนุมัติ" | "ระงับใช้งาน",
  actor?: string,
  actorRole?: string
) {
  const payload: ApiPayload = { status };
  if (actor) payload.actor = actor;
  if (actorRole) payload.actorRole = actorRole;
  return apiFetch("PATCH", `/api/admin/${id}/status`, payload);
}

export async function deleteAdminUser(id: number, actor?: string, actorRole?: string) {
  const payload: ApiPayload = {};
  if (actor) payload.actor = actor;
  if (actorRole) payload.actorRole = actorRole;
  return apiFetch("DELETE", `/api/admin/${id}`, payload);
}

// ---------------------------------------------------------------------------
// Root Login (ไม่ผ่าน API - เก็บไว้ใน frontend/server action)
// ---------------------------------------------------------------------------
export async function loginRoot(formData: FormData) {
  const username = formData.get("username");
  const password = formData.get("password");

  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !username.trim() ||
    !password.trim()
  ) {
    return { success: false, message: "❌ กรุณากรอกข้อมูลให้ครบถ้วน" };
  }

  if (username.trim() !== ROOT_USERNAME || password !== ROOT_PASSWORD) {
    return { success: false, message: "❌ ชื่อผู้ใช้หรือรหัสผ่านผู้ดูแลสูงสุดไม่ถูกต้อง" };
  }

  return {
    success: true,
    message: "🎉 เข้าสู่ระบบผู้ดูแลสูงสุดสำเร็จ!",
    root: { username: ROOT_USERNAME },
  };
}
