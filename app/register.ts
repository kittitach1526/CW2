"use server";

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:4000";

const ROOT_USERNAME = "root";
const ROOT_PASSWORD = "p@ssw0rd";

interface WelfareRequest {
  id: number;
  gangName?: string;
  gangAbbreviation?: string;
  requestName: string;
  discordId: string;
  welfareItem: string;
  status: string;
  createdAt: string;
  approver?: string;
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

export async function reportPauseRequest(id: number) {
  return apiFetch("POST", `/api/pause-requests/${id}/report`);
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
  status: "approved" | "disbanded" | "pending" | "รอยุบ" | "พัก"
) {
  return apiFetch("PATCH", `/api/gangs/${id}/status`, { status });
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
  reason: string
) {
  return apiFetch("PATCH", `/api/uniform-files/${id}/link`, {
    newFileUrl,
    reason,
  });
}

export async function updateUniformStatus(
  id: number,
  status: "ลงแล้ว" | "ปฏิเสธ" | "รอลง"
) {
  return apiFetch("PATCH", `/api/uniform-files/${id}/status`, { status });
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
  status: "รับไปแล้ว" | "เอาออกแล้ว" | "รอรับ"
) {
  return apiFetch("PATCH", `/api/welfare/${id}/status`, { status });
}

export async function getWelfareItems() {
  return apiFetch("GET", "/api/welfare-items");
}

export async function createWelfareItem(name: string, type: string) {
  return apiFetch("POST", "/api/welfare-items", { name, type });
}

export async function updateWelfareItem(
  id: number,
  payload: { name?: string; type?: string; active?: boolean }
) {
  return apiFetch("PATCH", `/api/welfare-items/${id}`, payload);
}

export async function deleteWelfareItem(id: number) {
  return apiFetch("DELETE", `/api/welfare-items/${id}`);
}

// ---------------------------------------------------------------------------
// Welfare Season Management
// ---------------------------------------------------------------------------
export async function getWelfareSeasons() {
  return apiFetch("GET", "/api/welfare-seasons");
}

export async function createWelfareSeason(payload: Record<string, unknown>) {
  return apiFetch("POST", "/api/welfare-seasons", payload);
}

export async function updateWelfareSeason(
  id: number,
  payload: Record<string, unknown>
) {
  return apiFetch("PATCH", `/api/welfare-seasons/${id}`, payload);
}

export async function deleteWelfareSeason(id: number) {
  return apiFetch("DELETE", `/api/welfare-seasons/${id}`);
}

export async function setWelfareSeasonWeapons(
  id: number,
  weapons: { type: string; weapon: string }[]
) {
  return apiFetch("POST", `/api/welfare-seasons/${id}/weapons`, { weapons });
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
  status: "อนุมัติ" | "ระงับใช้งาน"
) {
  return apiFetch("PATCH", `/api/council/${id}/status`, { status });
}

export async function deleteCouncilUser(id: number) {
  return apiFetch("DELETE", `/api/council/${id}`);
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
  status: "อนุมัติ" | "ระงับใช้งาน"
) {
  return apiFetch("PATCH", `/api/admin/${id}/status`, { status });
}

export async function deleteAdminUser(id: number) {
  return apiFetch("DELETE", `/api/admin/${id}`);
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
