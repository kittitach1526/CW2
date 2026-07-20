"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getAllCouncilUsers,
  getAllAdminUsers,
  createCouncilUser,
  createAdminUser,
  updateCouncilUser,
  updateAdminUser,
  updateCouncilUserStatus,
  updateAdminUserStatus,
  deleteCouncilUser,
  deleteAdminUser,
} from "../register";
import StatusModal from "../components/StatusModal";

type UserRow = {
  id: number;
  name: string;
  username: string;
  status: string;
  createdAt: string;
};

function getInitialRoot(): { username: string } | null {
  if (typeof window === "undefined") return null;
  const saved = localStorage.getItem("currentRoot");
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

export default function RootDashboard() {
  const router = useRouter();
  const [rootData] = useState(getInitialRoot);
  const activeActor = rootData?.username || "root";
  const activeActorRole = "root";
  const [activeTab, setActiveTab] = useState<"council" | "admin">("council");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [councilUsers, setCouncilUsers] = useState<UserRow[]>([]);
  const [adminUsers, setAdminUsers] = useState<UserRow[]>([]);
  const [statusModal, setStatusModal] = useState<{ open: boolean; type: "success" | "error"; message: string }>({
    open: false,
    type: "success",
    message: "",
  });

  useEffect(() => {
    if (!rootData) {
      router.push("/root-login");
    }
  }, [rootData, router]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "council") {
        const result = await getAllCouncilUsers();
        setCouncilUsers(result.success ? (result.users as UserRow[]) || [] : []);
      } else {
        const result = await getAllAdminUsers();
        setAdminUsers(result.success ? (result.users as UserRow[]) || [] : []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!rootData) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, rootData]);

  const handleLogout = () => {
    localStorage.removeItem("currentRoot");
    router.push("/");
  };

  const handleCreateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);
    const formData = new FormData(e.currentTarget);

    try {
      const result =
        activeTab === "council"
          ? await createCouncilUser(formData, activeActor, activeActorRole)
          : await createAdminUser(formData, activeActor, activeActorRole);

      setStatusModal({ open: true, type: result.success ? "success" : "error", message: result.message });

      if (result.success) {
        e.currentTarget.reset();
        fetchData();
      }
    } catch (error) {
      console.error(error);
      setStatusModal({ open: true, type: "error", message: "❌ ไม่สามารถเพิ่มบัญชีได้" });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: string) => {
    const nextStatus = currentStatus === "ระงับใช้งาน" ? "อนุมัติ" : "ระงับใช้งาน";
    const result =
      activeTab === "council"
        ? await updateCouncilUserStatus(id, nextStatus, activeActor, activeActorRole)
        : await updateAdminUserStatus(id, nextStatus, activeActor, activeActorRole);

    if (result.success) {
      if (activeTab === "council") {
        setCouncilUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: nextStatus } : u)));
      } else {
        setAdminUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: nextStatus } : u)));
      }
    } else {
      setStatusModal({ open: true, type: "error", message: result.message });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("⚠️ ยืนยันการลบบัญชีนี้ออกจากระบบ? การกระทำนี้ไม่สามารถย้อนกลับได้")) return;

    const result =
      activeTab === "council"
        ? await deleteCouncilUser(id, activeActor, activeActorRole)
        : await deleteAdminUser(id, activeActor, activeActorRole);

    if (result.success) {
      if (activeTab === "council") {
        setCouncilUsers((prev) => prev.filter((u) => u.id !== id));
      } else {
        setAdminUsers((prev) => prev.filter((u) => u.id !== id));
      }
    } else {
      setStatusModal({ open: true, type: "error", message: result.message });
    }
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser) return;

    const formData = new FormData(e.currentTarget);
    const result =
      activeTab === "council"
        ? await updateCouncilUser(editingUser.id, formData, activeActor, activeActorRole)
        : await updateAdminUser(editingUser.id, formData, activeActor, activeActorRole);

    setStatusModal({ open: true, type: result.success ? "success" : "error", message: result.message });

    if (result.success) {
      setEditingUser(null);
      fetchData();
    }
  };

  if (!rootData) {
    return (
      <div className="text-zinc-500 text-center mt-20 font-light tracking-widest animate-pulse">
        🔒 กำลังตรวจสอบสิทธิ์ผู้ดูแลสูงสุด...
      </div>
    );
  }

  const currentUsers = activeTab === "council" ? councilUsers : adminUsers;

  return (
    <div
      className="relative flex flex-col items-center justify-start min-h-screen bg-cover bg-center bg-no-repeat bg-fixed font-sans antialiased py-12 px-4 text-zinc-300"
      style={{ backgroundImage: "url('/COUNCIL.PNG')" }}
    >
      <div className="absolute inset-0 bg-zinc-950/60 dark:bg-black/75 backdrop-blur-[2px]" />

      <main className="relative z-10 flex w-full max-w-5xl flex-col gap-8 bg-white/10 dark:bg-zinc-900/20 backdrop-blur-md border border-white/20 dark:border-zinc-800/30 rounded-3xl shadow-2xl p-6 md:p-10 mx-4">
        {/* Header */}
        <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/10 pb-6 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold tracking-widest text-amber-300 uppercase bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                Super Admin
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Root Control Panel
            </h1>
            <p className="text-zinc-200 text-sm md:text-base font-light mt-1">
              จัดการบัญชีผู้ใช้งานระดับสภากลางและผู้ดูแลระบบ
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-zinc-200 text-sm font-medium transition-all duration-200 hover:bg-white/10 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              ย้อนกลับ
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium bg-white/5 border border-white/10 text-zinc-200 rounded-xl hover:bg-white/10 hover:text-white transition-all duration-200"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          <button
            onClick={() => setActiveTab("council")}
            className={`group flex flex-col items-center sm:items-start gap-3 p-6 rounded-2xl border text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-lg text-center sm:text-left ${
              activeTab === "council"
                ? "bg-gradient-to-br from-indigo-600/30 to-purple-600/30 border-indigo-400/50"
                : "bg-white/5 border-white/10 hover:bg-white/10"
            }`}
          >
            <div className={`p-3 rounded-xl transition-transform group-hover:scale-110 ${activeTab === "council" ? "bg-indigo-500/20 text-indigo-300" : "bg-white/10 text-zinc-300"}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold">บัญชีสภากลาง</h3>
              <p className="text-xs text-zinc-300/80 mt-1 font-light">จัดการบัญชีเจ้าหน้าที่สภากลาง ({councilUsers.length})</p>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("admin")}
            className={`group flex flex-col items-center sm:items-start gap-3 p-6 rounded-2xl border text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-lg text-center sm:text-left ${
              activeTab === "admin"
                ? "bg-gradient-to-br from-purple-600/30 to-pink-600/30 border-purple-400/50"
                : "bg-white/5 border-white/10 hover:bg-white/10"
            }`}
          >
            <div className={`p-3 rounded-xl transition-transform group-hover:scale-110 ${activeTab === "admin" ? "bg-purple-500/20 text-purple-300" : "bg-white/10 text-zinc-300"}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold">บัญชีแอดมิน</h3>
              <p className="text-xs text-zinc-300/80 mt-1 font-light">จัดการบัญชีผู้ดูแลระบบ ({adminUsers.length})</p>
            </div>
          </button>
        </div>

        {/* Create User Form */}
        <form
          onSubmit={handleCreateSubmit}
          className="w-full flex flex-col sm:flex-row gap-3 items-end bg-black/10 rounded-2xl border border-white/10 p-5"
        >
          <div className="flex flex-col gap-1.5 w-full sm:w-1/4">
            <label className="text-xs font-medium text-zinc-300">ชื่อ-นามสกุล</label>
            <input
              type="text"
              name="name"
              placeholder="ชื่อผู้ใช้งาน"
              className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:border-indigo-400 focus:outline-none"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5 w-full sm:w-1/4">
            <label className="text-xs font-medium text-zinc-300">Username</label>
            <input
              type="text"
              name="username"
              placeholder="username"
              className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:border-indigo-400 focus:outline-none"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5 w-full sm:w-1/4">
            <label className="text-xs font-medium text-zinc-300">Password</label>
            <input
              type="password"
              name="password"
              placeholder="••••••••"
              className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:border-indigo-400 focus:outline-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="w-full sm:w-auto h-10 px-6 rounded-lg bg-white/15 hover:bg-white text-white hover:text-black border border-white/20 font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] whitespace-nowrap"
          >
            {creating ? "กำลังเพิ่ม..." : `+ เพิ่มบัญชี${activeTab === "council" ? "สภา" : "แอดมิน"}`}
          </button>
        </form>

        {/* Table */}
        <div className="w-full min-h-[300px] bg-black/10 rounded-2xl border border-white/10 overflow-hidden backdrop-blur-sm">
          {loading && (
            <div className="text-center text-xs text-zinc-500 py-24 animate-pulse tracking-widest font-light">
              กำลังดึงข้อมูลจากฐานข้อมูล...
            </div>
          )}

          {!loading && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left whitespace-nowrap">
                <thead className="bg-zinc-950/40 text-zinc-400 border-b border-white/10 font-medium">
                  <tr>
                    <th className="px-6 py-4">รหัส</th>
                    <th className="px-6 py-4">ชื่อ</th>
                    <th className="px-6 py-4">Username</th>
                    <th className="px-6 py-4">วันที่สร้าง</th>
                    <th className="px-6 py-4">สถานะ</th>
                    <th className="px-6 py-4 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-zinc-300">
                  {currentUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-20 text-zinc-500 font-light tracking-wide">
                        📭 ยังไม่มีบัญชี{activeTab === "council" ? "สภากลาง" : "แอดมิน"}ในระบบ
                      </td>
                    </tr>
                  ) : (
                    currentUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-mono text-zinc-600">#{user.id}</td>
                        <td className="px-6 py-4 font-semibold text-white">{user.name}</td>
                        <td className="px-6 py-4 text-zinc-400 font-mono">{user.username}</td>
                        <td className="px-6 py-4 text-zinc-500">{user.createdAt}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`text-[10px] font-medium px-2.5 py-1 rounded-md border ${
                              user.status === "ระงับใช้งาน"
                                ? "bg-red-500/10 text-red-300 border-red-500/20"
                                : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                            }`}
                          >
                            {user.status === "ระงับใช้งาน" ? "🔒 ระงับใช้งาน" : "✓ อนุมัติ"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => setEditingUser(user)}
                              className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500 hover:text-white text-indigo-300 border border-indigo-500/20 rounded-lg transition-all text-[11px]"
                            >
                              แก้ไข
                            </button>
                            <button
                              onClick={() => handleToggleStatus(user.id, user.status)}
                              className="px-3 py-1.5 bg-white/10 hover:bg-white hover:text-black font-medium rounded-lg border border-white/10 transition-all text-[11px] shadow-sm"
                            >
                              {user.status === "ระงับใช้งาน" ? "เปิดใช้งาน" : "ระงับ"}
                            </button>
                            <button
                              onClick={() => handleDelete(user.id)}
                              className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-300 border border-red-500/20 rounded-lg transition-all text-[11px]"
                            >
                              ลบ
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-md bg-zinc-900/90 border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-4">
                แก้ไขบัญชี{activeTab === "council" ? "สภา" : "แอดมิน"}
              </h3>
              <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs text-zinc-300">ชื่อ-นามสกุล</label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={editingUser.name}
                    required
                    className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:border-indigo-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-300">Username</label>
                  <input
                    type="text"
                    name="username"
                    defaultValue={editingUser.username}
                    required
                    className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:border-indigo-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-300">Password (เว้นว่างหากไม่เปลี่ยน)</label>
                  <input
                    type="password"
                    name="password"
                    placeholder="••••••••"
                    className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:border-indigo-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-300">สถานะ</label>
                  <select
                    name="status"
                    defaultValue={editingUser.status}
                    className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:border-indigo-400 focus:outline-none"
                  >
                    <option value="อนุมัติ">อนุมัติ</option>
                    <option value="ระงับใช้งาน">ระงับใช้งาน</option>
                  </select>
                </div>
                <div className="flex gap-3 justify-end mt-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 text-sm"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium"
                  >
                    บันทึก
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <StatusModal
        open={statusModal.open}
        type={statusModal.type}
        title={statusModal.type === "success" ? "ดำเนินการสำเร็จ" : "เกิดข้อผิดพลาด"}
        message={statusModal.message}
        onClose={() => setStatusModal((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
