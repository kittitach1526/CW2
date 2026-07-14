// app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUniformFile,
  getAllUniformFiles,
  createGangEditRequest,
  getGangEditRequestByGang,
  createWelfareRequest,
  getWelfareRequestsByGang,
  requestDisbandGang,
  getDisbandRequestByGang,
} from "../register";

export default function GangDashboard() {
  const router = useRouter();
  const [gangData, setGangData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "edit" | "welfare" | "upload_uniform" | "view_uniforms" | "disband">("overview");
  const [loading, setLoading] = useState(false);
  const [colorTheme, setColorTheme] = useState("#3b82f6");
  const [uniformFiles, setUniformFiles] = useState<any[]>([]);
  const [welfareRequests, setWelfareRequests] = useState<any[]>([]);
  const [pendingEdit, setPendingEdit] = useState<any>(null);
  const [pendingDisband, setPendingDisband] = useState<any>(null);

  // ไม่มี state สำหรับแก้ไขลิงก์ไฟล์ในตาราง (ให้ใช้ช่องเหตุผลตอนเพิ่มชุดแทน)

  // 1. ดึงข้อมูลแก๊งจาก localStorage เมื่อเข้าสู่ระบบ
  useEffect(() => {
    const savedGang = localStorage.getItem("currentGang");
    if (!savedGang) {
      alert("🔒 กรุณาเข้าสู่ระบบก่อนใช้งานหน้า Dashboard");
      router.push("/");
      return;
    }
    const parsedData = JSON.parse(savedGang);
    setGangData(parsedData);
    if (parsedData.colorTheme) setColorTheme(parsedData.colorTheme);
  }, [router]);

  const handleDisbandGang = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!gangData?.abbreviation) return;

    const formData = new FormData(e.currentTarget);
    const reason = formData.get("reason") as string;

    if (!confirm("❗ ยืนยันการส่งเรื่องขอยุบแก๊งใช่หรือไม่ คำขอนี้จะส่งไปยังสภากลางเพื่อพิจารณา")) return;

    setLoading(true);
    try {
      const result = await requestDisbandGang(gangData.abbreviation, reason);
      setLoading(false);

      alert(result.message);
      if (result.success) {
        const res = await getDisbandRequestByGang(gangData.id);
        if (res.success) setPendingDisband(res.request);
      }
    } catch (error) {
      console.error(error);
      setLoading(false);
      alert("❌ ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้ในขณะนี้");
    }
  };

  // โหลดคำขอยุบแก๊งล่าสุด
  const loadPendingDisband = async (id: number) => {
    const result = await getDisbandRequestByGang(id);
    if (result.success) {
      setPendingDisband(result.request);
    }
  };

  // 2. ฟังก์ชันโหลดรายการไฟล์ชุดจากฐานข้อมูล SQLite
  const loadUniformFiles = async () => {
    const result = await getAllUniformFiles();
    if (result.success) {
      setUniformFiles(result.files || []);
    }
  };

  // ➕ 3. ฟังก์ชันโหลดประวัติการรับสวัสดิการของแก๊งนี้
  const loadWelfareRequests = async (abbr: string) => {
    const result = await getWelfareRequestsByGang(abbr);
    if (result.success) {
      setWelfareRequests(result.requests || []);
    }
  };

  // เรียกโหลดข้อมูลเมื่อยูสเซอร์สลับแท็บ
  useEffect(() => {
    if (activeTab === "view_uniforms") {
      loadUniformFiles();
    }
    if (activeTab === "welfare" && gangData?.abbreviation) {
      loadWelfareRequests(gangData.abbreviation);
    }
  }, [activeTab, gangData]);

  // ➕ โหลดข้อมูลสรุปทันทีหลังเข้าสู่ระบบ เพื่อใช้แสดงสถิติในหน้าภาพรวม
  useEffect(() => {
    if (gangData?.id) {
      loadUniformFiles();
      loadWelfareRequests(gangData.abbreviation);
      loadPendingEdit(gangData.id);
      loadPendingDisband(gangData.id);
    }
  }, [gangData?.id]);

  const handleLogout = () => {
    localStorage.removeItem("currentGang");
    router.push("/");
  };

  const handleUpdateGang = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = await createGangEditRequest(formData);
    setLoading(false);
    alert(result.message);
    if (result.success && result.editRequest) {
      setPendingEdit(result.editRequest);
      setColorTheme(result.editRequest.colorTheme || colorTheme);
    }
  };

  // โหลดคำขอแก้ไขล่าสุดของแก๊ง
  const loadPendingEdit = async (id: number) => {
    const result = await getGangEditRequestByGang(id);
    if (result.success && result.request) {
      setPendingEdit(result.request);
      setColorTheme(result.request.colorTheme || gangData?.colorTheme || "#3b82f6");
    }
  };

  useEffect(() => {
    if (activeTab === "edit" && gangData?.id) {
      loadPendingEdit(gangData.id);
    }
    if (activeTab === "disband" && gangData?.id) {
      loadPendingDisband(gangData.id);
    }
  }, [activeTab, gangData]);

  // 🔄 ปรับปรุงฟังก์ชันยื่นสวัสดิการให้บันทึกลง SQLite จริง
  const handleRequestWelfareSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formElement = e.currentTarget;
    const formData = new FormData(formElement);

    const result = await createWelfareRequest(formData);
    setLoading(false);

    alert(result.message);
    if (result.success) {
      formElement.reset();
      // โหลดตารางใหม่เพื่อให้เห็นรายการล่าสุดที่เพิ่งกดขอไป
      if (gangData?.abbreviation) {
        loadWelfareRequests(gangData.abbreviation);
      }
    }
  };

  const handleUploadUniformSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formElement = e.currentTarget;
    const formData = new FormData(formElement);

    const result = await createUniformFile(formData);
    setLoading(false);

    alert(result.message);
    if (result.success) {
      formElement.reset();
      setActiveTab("view_uniforms");
    }
  };

  // ปิดการแก้ไขลิงก์ไฟล์ในตาราง (ให้ใช้ช่องเหตุผลตอนเพิ่มชุดแทน)

  // ฟังก์ชันแปลงค่า Value ของไอเทมสวัสดิการให้เป็นข้อความภาษาไทยสวยๆ ในตาราง
  const translateWelfareItem = (item: string) => {
    switch (item) {
      case "car": return "🚗 กล่องยานพาหนะแก๊ง";
      case "money": return "💰 เงินสนับสนุน (500,000 Roll)";
      case "weapon": return "📦 เซ็ตอาวุธสงคราม (War Box)";
      default: return item;
    }
  };

  if (!gangData) return <div className="text-white text-center mt-20">กำลังโหลดข้อมูลแผงควบคุม...</div>;

  const navItems = [
    { id: "overview", label: "ภาพรวมแก๊ง", icon: "📊" },
    { id: "edit", label: "แก้ไขข้อมูล", icon: "⚙️" },
    { id: "welfare", label: "ยื่นสวัสดิการ", icon: "🎁" },
    { id: "upload_uniform", label: "เพิ่มไฟล์ชุด", icon: "➕" },
    { id: "view_uniforms", label: "ดูไฟล์ทั้งหมด", icon: "📁" },
    { id: "disband", label: "ยุบแก๊ง", icon: "⚠️" },
  ] as const;

  const activeLabel = navItems.find((t) => t.id === activeTab)?.label || "";
  const pendingWelfareCount = welfareRequests.filter((r) => r.status !== "รับไปแล้ว" && r.status !== "เอาออกแล้ว").length;
  const pendingUniformCount = uniformFiles.filter((f) => f.status !== "ลงแล้ว").length;
  const pendingDisbandCount = pendingDisband?.status === "pending" ? 1 : 0;

  return (
    <div
      className="relative flex min-h-screen bg-cover bg-center bg-no-repeat font-sans antialiased text-zinc-300 selection:bg-white/20"
      style={{ backgroundImage: "url('/COUNCIL.PNG')" }}
    >
      {/* Background Overlay มืดลึกแบบภาพยนตร์ */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-[6px]" />

      <div className="relative z-10 flex w-full max-w-7xl mx-auto gap-6 p-4 md:p-8 items-start">

        {/* ─── Sidebar Navigation (Desktop) ─── */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 gap-6 bg-gradient-to-b from-zinc-900/40 to-zinc-950/60 backdrop-blur-xl border border-white/[0.06] rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] p-6 sticky top-8">
          <div className="flex items-center gap-3">
            {gangData.logoUrl ? (
              <img
                src={gangData.logoUrl}
                alt="Gang Logo"
                className="w-12 h-12 rounded-2xl border-2 border-white/20 shadow-md object-cover shrink-0"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="w-12 h-12 rounded-2xl border-2 border-white/20 shadow-md shrink-0" style={{ backgroundColor: colorTheme }} />
            )}
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-white tracking-tight truncate">{gangData.fullName}</p>
              <p className="text-[10px] text-zinc-500 font-mono">[{gangData.abbreviation}]</p>
            </div>
          </div>

          <nav className="flex flex-col gap-1.5">
            {navItems.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-3 h-11 px-4 text-xs font-medium rounded-xl transition-all duration-200 text-left ${
                  activeTab === tab.id
                    ? tab.id === "disband"
                      ? "bg-red-500/10 text-red-300 border border-red-500/20 shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
                      : "bg-white/[0.08] text-white shadow-[0_4px_12px_rgba(0,0,0,0.2)] border border-white/[0.08] backdrop-blur-md"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02] border border-transparent"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-3 pt-6 border-t border-white/[0.06]">
            <div className="text-[10px] text-zinc-500 tracking-wide uppercase">สถานะแก๊ง</div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-md w-fit ${gangData.status === "pending" ? "bg-amber-500/20 text-amber-300" : "bg-green-500/20 text-green-300"}`}>
              {gangData.status === "pending" ? "⏳ รอการอนุมัติ" : "✅ อนุมัติแล้ว"}
            </span>
            <button onClick={handleLogout} className="w-full px-4 py-2 text-xs font-medium bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-white/[0.06] rounded-xl transition-all duration-200 active:scale-95 shadow-sm">
              🔒 ออกจากระบบ
            </button>
          </div>
        </aside>

        {/* ─── Main Content ─── */}
        <main className="relative z-10 flex flex-1 flex-col gap-6 bg-gradient-to-b from-zinc-900/40 to-zinc-950/60 backdrop-blur-xl border border-white/[0.06] rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] p-6 md:p-10 min-w-0">

          {/* Top Header Bar */}
          <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-white/[0.06] pb-8">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-zinc-500 uppercase mb-2">
                <span>Gang Dashboard</span>
                <span>/</span>
                <span className="text-zinc-300">{activeLabel}</span>
              </div>
              <p className="text-3xl font-extrabold text-white tracking-tight">{activeLabel}</p>
            </div>
            <button onClick={handleLogout} className="lg:hidden px-4 py-2 text-xs font-medium bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-white/[0.06] rounded-xl transition-all duration-200 active:scale-95 shadow-sm">
              🔒 ออกจากระบบ
            </button>
          </div>

          {/* Mobile Tabs Navigation */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 w-full bg-black/[0.2] p-1.5 rounded-2xl border border-white/[0.04] lg:hidden">
            {navItems.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`h-11 text-xs font-medium rounded-xl transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-white/[0.08] text-white shadow-[0_4px_12px_rgba(0,0,0,0.2)] border border-white/[0.08] backdrop-blur-md"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]"
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Stat Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 w-full">
            <div className="flex flex-col gap-1 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">รหัสลงทะเบียน</span>
              <span className="text-2xl font-bold text-white font-mono">#000{gangData.id}</span>
            </div>
            <div className="flex flex-col gap-1 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">คำขอแก้ไขรอตรวจ</span>
              <span className="text-2xl font-bold text-amber-300">{pendingEdit?.status === "pending" ? 1 : 0}</span>
            </div>
            <div className="flex flex-col gap-1 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">สวัสดิการรอรับ</span>
              <span className="text-2xl font-bold text-amber-300">{pendingWelfareCount}</span>
            </div>
            <div className="flex flex-col gap-1 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">ไฟล์ชุดรอนำเข้า</span>
              <span className="text-2xl font-bold text-amber-300">{pendingUniformCount}</span>
            </div>
            <div className="flex flex-col gap-1 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">คำขอยุบรอตรวจ</span>
              <span className="text-2xl font-bold text-red-400">{pendingDisbandCount}</span>
            </div>
          </div>

          {/* Workspace Container */}
          <div className="w-full bg-black/[0.1] rounded-2xl border border-white/[0.04] p-6 text-white min-h-[380px]">

          {/* แท็บ 1: ภาพรวมแก๊ง */}
          {activeTab === "overview" && (
            <div className="flex flex-col gap-6">
              <h2 className="text-lg font-bold text-blue-400">ข้อมูลทั่วไปของสภาแก๊ง</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-xs text-zinc-400 block mb-1">สถานะแก๊งในเมือง</span>
                  <span className={`text-sm font-bold px-2.5 py-1 rounded-md ${gangData.status === "pending" ? "bg-amber-500/20 text-amber-300" : "bg-green-500/20 text-green-300"}`}>
                    {gangData.status === "pending" ? "⏳ รอการอนุมัติ (Pending)" : "✅ อนุมัติแล้ว (Approved)"}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-xs text-zinc-400 block mb-1">รหัสลงทะเบียนระบบ (ID)</span>
                  <span className="text-sm font-mono font-bold">#000{gangData.id}</span>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-xs text-zinc-400 block mb-1">หัวหน้าแก๊ง</span>
                  <span className="text-sm font-bold text-white">{gangData.leader}</span>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-xs text-zinc-400 block mb-1">ประเภทแก๊ง</span>
                  <span className="text-sm font-bold text-white">{gangData.type || "Gang"}</span>
                </div>
              </div>
              <div className="flex flex-col gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm">
                <p className="font-medium">ℹ️ ทุกคำขอที่แก๊งส่งจากระบบนี้ต้องรอให้สภากลางกดยืนยันก่อนจึงจะสำเร็จ</p>
                <ul className="list-disc list-inside text-xs text-blue-200/70">
                  {pendingEdit?.status === "pending" && <li>📝 มีคำขอแก้ไขข้อมูลแก๊งรออนุมัติ</li>}
                  {pendingWelfareCount > 0 && <li>🎁 มีคำขอสวัสดิการ {pendingWelfareCount} รายการรอรับ</li>}
                  {pendingUniformCount > 0 && <li>👕 มีไฟล์ชุด {pendingUniformCount} รายการรอนำเข้า</li>}
                  {pendingDisbandCount > 0 && <li>⚠️ มีคำขอยุบแก๊งรอพิจารณา</li>}
                  {pendingEdit?.status !== "pending" && pendingWelfareCount === 0 && pendingUniformCount === 0 && pendingDisbandCount === 0 && <li>✅ ไม่มีคำขอใดๆ รอดำเนินการ</li>}
                </ul>
              </div>
            </div>
          )}

          {/* แท็บ 2: แก้ไขข้อมูลกลุ่มแก๊ง */}
          {activeTab === "edit" && (
            <form key={pendingEdit?.id || "edit"} onSubmit={handleUpdateGang} className="flex flex-col gap-6 w-full text-white">
              <h2 className="text-lg font-bold text-indigo-400">⚙️ ฟอร์มแก้ไขรายละเอียดแก๊ง</h2>

              {pendingEdit?.status === "pending" && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
                  📝 คำขอแก้ไขข้อมูลของแก๊งกำลังรอการอนุมัติจากสภากลาง คุณสามารถแก้ไขฟอร์มด้านล่างเพื่ออัปเดตคำขอเดิมได้
                </div>
              )}

              <input type="hidden" name="id" value={gangData.id} />
              <input type="hidden" name="colorTheme" value={colorTheme} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-200">ชื่อเต็ม (Full Name)</label>
                  <input type="text" name="fullName" defaultValue={pendingEdit ? pendingEdit.fullName : gangData.fullName} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-400 focus:outline-none text-sm" required />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-200">ชื่อย่อ (Abbreviation)</label>
                  <input type="text" name="abbreviation" defaultValue={pendingEdit ? pendingEdit.abbreviation : gangData.abbreviation} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-400 focus:outline-none text-sm" required />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-200">ประเภทแก๊ง</label>
                  <select name="type" defaultValue={pendingEdit ? pendingEdit.type : (gangData.type || "Gang")} className="w-full h-11 px-4 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:border-indigo-400 focus:outline-none" required>
                    <option value="Family">Family</option>
                    <option value="Gang">Gang</option>
                    <option value="Gangs-LD">Gangs-LD</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-200">รหัสผ่านใหม่ (Password)</label>
                  <input type="password" name="password" placeholder="พิมพ์รหัสผ่านใหม่หากต้องการเปลี่ยน" className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-400 focus:outline-none text-sm" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-200">สีประจำกลุ่ม (Color Theme - HEX)</label>
                  <div className="relative flex items-center gap-2">
                    <div className="relative w-11 h-11 rounded-xl border border-white/10 overflow-hidden bg-white/5">
                      <input type="color" value={colorTheme} onChange={(e) => setColorTheme(e.target.value)} className="absolute inset-0 w-full h-full transform scale-150 cursor-pointer bg-transparent border-none p-0" />
                    </div>
                    <div className="relative flex-1">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-400 font-mono font-bold">#</span>
                      <input type="text" value={colorTheme.replace("#", "")} onChange={(e) => { if (e.target.value.length <= 6) setColorTheme(`#${e.target.value}`); }} className="w-full h-11 pl-8 pr-4 rounded-xl bg-white/5 border border-white/10 text-sm font-mono uppercase text-white focus:outline-none" required />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2"><label className="text-sm font-medium text-zinc-200">หัวหน้า (Leader)</label><input type="text" name="leader" defaultValue={pendingEdit ? pendingEdit.leader : gangData.leader} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm" required /></div>
                <div className="flex flex-col gap-2"><label className="text-sm font-medium text-zinc-200">เลขดิสคอร์ดหัวหน้า</label><input type="text" name="leaderDiscord" defaultValue={pendingEdit ? pendingEdit.leaderDiscord : gangData.leaderDiscord} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm" required /></div>
                <div className="flex flex-col gap-2"><label className="text-sm font-medium text-zinc-200">รองหัวหน้า 1</label><input type="text" name="coLeader1" defaultValue={pendingEdit ? pendingEdit.coLeader1 : gangData.coLeader1} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm" /></div>
                <div className="flex flex-col gap-2"><label className="text-sm font-medium text-zinc-200">เลขดิสคอร์ดรอง 1</label><input type="text" name="coLeader1Discord" defaultValue={pendingEdit ? pendingEdit.coLeader1Discord : gangData.coLeader1Discord} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm" /></div>
                <div className="flex flex-col gap-2"><label className="text-sm font-medium text-zinc-200">รองหัวหน้า 2</label><input type="text" name="coLeader2" defaultValue={pendingEdit ? pendingEdit.coLeader2 : gangData.coLeader2} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm" /></div>
                <div className="flex flex-col gap-2"><label className="text-sm font-medium text-zinc-200">เลขดิสคอร์ดรอง 2</label><input type="text" name="coLeader2Discord" defaultValue={pendingEdit ? pendingEdit.coLeader2Discord : gangData.coLeader2Discord} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm" /></div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-zinc-200">เหตุผลการแก้ไขข้อมูลแก๊ง</label>
                  <textarea name="editReason" rows={3} defaultValue={pendingEdit ? pendingEdit.editReason : ""} placeholder="ระบุเหตุผลที่ต้องแก้ไขข้อมูลแก๊ง เช่น เปลี่ยนหัวหน้า, เปลี่ยนสีแก๊ง" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-400 focus:outline-none text-sm resize-none" required />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full h-12 mt-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 font-semibold hover:opacity-90 transition-all disabled:opacity-50">{loading ? "กำลังบันทึก..." : (pendingEdit?.status === "pending" ? "อัปเดตคำขอแก้ไข" : "ส่งคำขอแก้ไขข้อมูล")}</button>
            </form>
          )}

          {/* 🔄 แท็บ 3: ยื่นคำขอรับของรางวัลสวัสดิการ + ตารางบันทึกประวัติ */}
          {activeTab === "welfare" && (
            <div className="flex flex-col gap-8 w-full">
              {/* Form ยื่นคำขอ */}
              <form onSubmit={handleRequestWelfareSubmit} className="flex flex-col gap-5 w-full text-white border-b border-white/10 pb-8">
                <h2 className="text-lg font-bold text-purple-400">🎁 ฟอร์มยื่นเรื่องขอรับสวัสดิการแก๊งประจำสัปดาห์</h2>
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
                  ⏳ คำขอรับสวัสดิการจะถูกบันทึกเป็น "รอรับ" และต้องรอให้สภากลางกดยืนยันก่อนจึงจะสำเร็จ
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2"><label className="text-sm font-medium text-zinc-200">ชื่อผู้ยื่นเรื่อง</label><input type="text" name="requestName" placeholder="กรอกชื่อของคุณ" className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-purple-400 focus:outline-none" required /></div>
                  <div className="flex flex-col gap-2"><label className="text-sm font-medium text-zinc-200">ชื่อแก๊ง</label><input type="text" name="gangName" value={gangData.fullName} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-zinc-400 focus:outline-none" readOnly /></div>
                  <div className="flex flex-col gap-2"><label className="text-sm font-medium text-zinc-200">ชื่อย่อแก๊ง</label><input type="text" name="gangAbbr" value={gangData.abbreviation} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-zinc-400 focus:outline-none" readOnly /></div>
                  <div className="flex flex-col gap-2"><label className="text-sm font-medium text-zinc-200">เลขดิสคอร์ด</label><input type="text" name="discordId" placeholder="เช่น 4583920194857201" className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-purple-400 focus:outline-none" required /></div>
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <label className="text-sm font-medium text-zinc-200">ของรางวัลที่ต้องการเบิก</label>
                  <select name="welfareItem" className="w-full h-11 px-4 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:border-purple-400 focus:outline-none" required>
                    <option value="">-- กรุณาเลือกรายการสวัสดิการ --</option>
                    <option value="car">🚗 กล่องเบิกยานพาหนะแก๊งประจำสัปดาห์</option>
                    <option value="money">💰 เงินสนับสนุนกองทุนพัฒนาแก๊ง (500,000 Roll)</option>
                    <option value="weapon">📦 เซ็ตอาวุธและเสบียงสงครามชิงสภา (War Box)</option>
                  </select>
                </div>
                <button type="submit" disabled={loading} className="w-full h-12 mt-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-semibold hover:opacity-90 transition-all disabled:opacity-50">
                  {loading ? "กำลังส่งคำขอ..." : "ส่งคำขอรับของสวัสดิการ"}
                </button>
              </form>

              {/* 📊 ส่วนตารางประวัติการรับสวัสดิการ */}
              <div className="flex flex-col gap-4 w-full">
                <h2 className="text-lg font-bold text-pink-400">📋 ตารางตรวจสอบสถานะการรับสวัสดิการภายในแก๊ง</h2>
                <div className="overflow-x-auto w-full border border-white/10 rounded-xl bg-zinc-950/40">
                  <table className="w-full text-sm text-left text-zinc-200">
                    <thead className="text-xs bg-white/5 text-zinc-400 border-b border-white/10 uppercase">
                      <tr>
                        <th className="px-4 py-3">ผู้ยื่นเรื่อง / Discord</th>
                        <th className="px-4 py-3">รายการสวัสดิการ</th>
                        <th className="px-4 py-3">วันที่ยื่นเรื่อง</th>
                        <th className="px-4 py-3 text-center">สถานะปัจจุบัน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {welfareRequests.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-8 text-zinc-500">
                            ❌ ยังไม่มีประวัติการยื่นขอรับสวัสดิการของแก๊งนี้ในระบบ
                          </td>
                        </tr>
                      ) : (
                        welfareRequests.map((req) => (
                          <tr key={req.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-semibold text-white block">{req.requestName}</span>
                              <span className="text-[11px] text-zinc-400 font-mono">ID: {req.discordId}</span>
                            </td>
                            <td className="px-4 py-3 text-zinc-200 font-medium">
                              {translateWelfareItem(req.welfareItem)}
                            </td>
                            <td className="px-4 py-3 text-zinc-400 text-xs font-mono">
                              {req.createdAt}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${req.status === "รับไปแล้ว"
                                ? "bg-green-500/20 text-green-300 border-green-500/30"
                                : req.status === "เอาออกแล้ว"
                                  ? "bg-red-500/20 text-red-300 border-red-500/30"
                                  : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                }`}>
                                {req.status === "รับไปแล้ว" && "✅ รับไปแล้ว"}
                                {req.status === "เอาออกแล้ว" && "❌ เอาออกแล้ว"}
                                {req.status === "รอรับ" && "⏳ รอรับ"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* แท็บ 4: ฟอร์มเพิ่มไฟล์ชุดใหม่ */}
          {activeTab === "upload_uniform" && (
            <form onSubmit={handleUploadUniformSubmit} className="flex flex-col gap-5 w-full text-white">
              <h2 className="text-lg font-bold text-teal-400">👕 ฟอร์มเพิ่มไฟล์ชุด/เครื่องแต่งกายสภาแก๊ง</h2>
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
                ⏳ ไฟล์ชุดจะถูกบันทึกเป็น "รอลง" และต้องรอให้สภากลางตรวจสอบและนำเข้าก่อนจึงจะสำเร็จ
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-200">ชื่อแก๊ง (Gang Name)</label>
                  <input type="text" name="gangName" value={gangData.fullName} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-zinc-400 focus:outline-none" readOnly />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-200">ชุดอะไร / รายละเอียดชุด (Uniform Details)</label>
                  <input type="text" name="uniformType" placeholder="เช่น ชุดสูททำงาน, ชุดเซ็ตสตอรี่ ซีซั่น 2" className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-teal-400 focus:outline-none text-sm" required />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-200">ลิงก์ดาวน์โหลดไฟล์ชุด (.zip / .gta5)</label>
                  <input type="url" name="fileUrl" placeholder="เช่น https://drive.google.com/file/..." className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-teal-400 focus:outline-none text-sm" required />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-200">ชื่อผู้อนุมัติชุด</label>
                  <input type="text" name="approver" placeholder="ชื่อบุคคลที่เซ็นรับรองให้แก๊ง" className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-teal-400 focus:outline-none text-sm" required />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-zinc-200">เลข Discord ผู้อนุมัติ</label>
                  <input type="text" name="approverDiscord" placeholder="เช่น 9874561230123456" className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-teal-400 focus:outline-none text-sm" required />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-zinc-200">เหตุผล / หมายเหตุ (ถ้ามี)</label>
                  <input type="text" name="reason" placeholder="เช่น แก้ไขลิงก์เดิมเสีย หรืออัปเดตชุดใหม่" className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-teal-400 focus:outline-none text-sm" />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full h-12 mt-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 font-semibold text-white hover:opacity-90 transition-all disabled:opacity-50">
                {loading ? "กำลังบันทึกข้อมูล..." : "💾 บันทึกและส่งเรื่องเพิ่มไฟล์ชุด"}
              </button>
            </form>
          )}

          {/* แท็บ 5: ตารางดูไฟล์ชุดทั้งหมด */}
          {activeTab === "view_uniforms" && (
            <div className="flex flex-col gap-4 w-full">
              <h2 className="text-lg font-bold text-amber-400">📁 รายการไฟล์ชุดทั้งหมดและสถานะจากแอดมิน</h2>
              <div className="overflow-x-auto w-full border border-white/10 rounded-xl bg-zinc-950/40">
                <table className="w-full text-sm text-left text-zinc-200">
                  <thead className="text-xs bg-white/5 text-zinc-400 border-b border-white/10 uppercase">
                    <tr>
                      <th className="px-4 py-3">รายละเอียดชุด</th>
                      <th className="px-4 py-3">ลิงก์ดาวน์โหลด</th>
                      <th className="px-4 py-3">สถานะระบบ</th>
                      <th className="px-4 py-3">เหตุผล</th>
                      <th className="px-4 py-3">ผู้เซ็นอนุมัติ</th>
                      <th className="px-4 py-3">วันที่ส่งเรื่อง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uniformFiles.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-zinc-500">❌ ไม่พบประวัติข้อมูลไฟล์ชุดในระบบสภากลาง</td></tr>
                    ) : (
                      uniformFiles.map((file) => (
                        <tr key={file.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-semibold text-white block">{file.uniformType}</span>
                            <span className="text-[11px] text-zinc-400 font-mono">{file.gangName}</span>
                          </td>
                          <td className="px-4 py-3">
                            <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1 text-xs">
                              📥 ดาวน์โหลดไฟล์ (.zip)
                            </a>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold px-2.5 py-0.5 rounded ${file.status === "ลงแล้ว" ? "bg-green-500/20 text-green-300 border border-green-500/30" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"}`}>
                              {file.status === "ลงแล้ว" ? "✅ ลงแล้ว" : "⏳ รอลง"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-300 text-xs max-w-[160px] truncate">{file.reason || "-"}</td>
                          <td className="px-4 py-3 text-zinc-300 text-xs">{file.approver}</td>
                          <td className="px-4 py-3 text-zinc-400 text-xs font-mono">{file.createdAt}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* แท็บ 6: ยุบแก๊ง */}
          {activeTab === "disband" && (
            <div className="flex flex-col gap-5">
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <h2 className="text-lg font-bold text-red-400 mb-1">⚠️ โซนอันตราย: ขอยุบแก๊งออกจากระบบสภา</h2>
                <p className="text-xs text-red-200/70">การส่งคำขอนี้จะส่งไปยังสภากลางเพื่อพิจารณา แก๊งจะยังไม่ถูกยุบจนกว่าสภาจะอนุมัติ</p>
              </div>

              {pendingDisband?.status === "pending" ? (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
                  ⏳ คำขอยุบแก๊งของคุณกำลังรอการพิจารณาจากสภากลาง
                </div>
              ) : (
                <form onSubmit={handleDisbandGang} className="flex flex-col gap-5 w-full text-white">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-zinc-200">เหตุผลการขอยุบแก๊ง</label>
                    <textarea name="reason" rows={3} placeholder="ระบุเหตุผลที่ต้องการยุบแก๊ง" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-red-400 focus:outline-none text-sm resize-none" />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="h-11 rounded-xl bg-red-600 hover:bg-red-500 font-bold text-sm transition-all text-white disabled:opacity-50"
                  >
                    {loading ? "กำลังส่งเรื่อง..." : "ยืนยันการส่งเรื่องยุบแก๊ง"}
                  </button>
                </form>
              )}
            </div>
          )}

          </div>
        </main>
      </div>
    </div>
  );
}