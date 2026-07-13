// app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUniformFile,
  getAllUniformFiles,
  updateUniformFileLink,
  createWelfareRequest,       // ➕ นำเข้าฟังก์ชันสวัสดิการใหม่
  getWelfareRequestsByGang    // ➕ นำเข้าฟังก์ชันสวัสดิการใหม่
} from "../register";

import { requestDisbandGang } from "../register";

export default function GangDashboard() {
  const router = useRouter();
  const [gangData, setGangData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "edit" | "welfare" | "upload_uniform" | "view_uniforms" | "disband">("overview");
  const [loading, setLoading] = useState(false);
  const [colorTheme, setColorTheme] = useState("#3b82f6");
  const [uniformFiles, setUniformFiles] = useState<any[]>([]);
  const [welfareRequests, setWelfareRequests] = useState<any[]>([]); // ➕ State เก็บประวัติสวัสดิการ

  const [editingFileId, setEditingFileId] = useState<number | null>(null);
  const [newUrlInput, setNewUrlInput] = useState("");

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

  const handleDisbandGang = async () => {
    if (!gangData?.abbreviation) return;

    if (confirm("❗ ยืนยันการส่งเรื่องยุบแก๊งใช่หรือไม่ ข้อมูลสถานะแก๊งจะเปลี่ยนเป็น 'รอยุบ' และระบบจะระงับการทำงานของคุณ")) {
      setLoading(true); // ปรับเปิด loading
      try {
        const result = await requestDisbandGang(gangData.abbreviation);

        if (result.success) {
          alert(result.message);
          localStorage.removeItem("currentGang");
          router.push("/");
        } else {
          alert(result.message);
        }
      } catch (error) {
        console.error(error);
        alert("❌ ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้ในขณะนี้");
      } finally {
        setLoading(false); // ปิด loading เมื่อเสร็จงาน
      }
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

  const handleLogout = () => {
    localStorage.removeItem("currentGang");
    router.push("/");
  };

  const handleUpdateGang = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    alert("🎉 บันทึกการแก้ไขข้อมูลแก๊งสำเร็จแล้ว!");
  };

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

  const handleUpdateLinkSubmit = async (id: number) => {
    if (!newUrlInput.trim()) return alert("❌ กรุณากรอก URL ไฟล์ชุดใหม่");
    setLoading(true);
    const result = await updateUniformFileLink(id, newUrlInput);
    setLoading(false);

    alert(result.message);
    if (result.success) {
      setEditingFileId(null);
      setNewUrlInput("");
      loadUniformFiles();
    }
  };

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

  return (
    <div
      className="relative flex flex-col items-center justify-start min-h-screen bg-cover bg-center bg-no-repeat font-sans antialiased py-10"
      style={{ backgroundImage: "url('/COUNCIL.PNG')" }}
    >
      <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-[4px]" />

      <main className="relative z-10 flex w-full max-w-5xl flex-col gap-6 py-8 px-4 md:px-8 bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl shadow-2xl mx-4">

        {/* Header */}
        <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/10 pb-5 gap-4">
          <div className="flex items-center gap-4">
            {gangData.logoUrl ? (
              <img
                src={gangData.logoUrl}
                alt="Gang Logo"
                className="w-14 h-14 rounded-2xl border-2 border-white/20 shadow-md object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl border-2 border-white/20 shadow-md" style={{ backgroundColor: colorTheme }} />
            )}
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                {gangData.fullName} <span className="text-sm font-bold opacity-60">[{gangData.abbreviation}]</span>
              </h1>
              <p className="text-xs text-zinc-300">ระบบจัดการภายในกลุ่มและข้อมูลชุดเครื่องแต่งกาย</p>
            </div>
          </div>
          <button onClick={handleLogout} className="px-4 py-2 text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-all duration-200">
            ออกจากระบบ
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 w-full">
          <button onClick={() => setActiveTab("overview")} className={`h-11 text-xs md:text-sm font-medium rounded-xl border transition-all ${activeTab === "overview" ? "bg-white/10 border-blue-400 text-white" : "bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10"}`}>📊 ภาพรวมแก๊ง</button>
          <button onClick={() => setActiveTab("edit")} className={`h-11 text-xs md:text-sm font-medium rounded-xl border transition-all ${activeTab === "edit" ? "bg-white/10 border-indigo-400 text-white" : "bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10"}`}>⚙️ แก้ไขข้อมูล</button>
          <button onClick={() => setActiveTab("welfare")} className={`h-11 text-xs md:text-sm font-medium rounded-xl border transition-all ${activeTab === "welfare" ? "bg-white/10 border-purple-400 text-white" : "bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10"}`}>🎁 ยื่นสวัสดิการ</button>
          <button onClick={() => setActiveTab("upload_uniform")} className={`h-11 text-xs md:text-sm font-medium rounded-xl border transition-all ${activeTab === "upload_uniform" ? "bg-white/10 border-teal-400 text-white" : "bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10"}`}>➕ เพิ่มไฟล์ชุด</button>
          <button onClick={() => setActiveTab("view_uniforms")} className={`h-11 text-xs md:text-sm font-medium rounded-xl border transition-all ${activeTab === "view_uniforms" ? "bg-white/10 border-amber-400 text-white" : "bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10"}`}>📁 ดูไฟล์ทั้งหมด</button>
          <button onClick={() => setActiveTab("disband")} className={`h-11 text-xs md:text-sm font-medium rounded-xl border transition-all ${activeTab === "disband" ? "bg-red-500/20 border-red-500/5 text-red-300" : "bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10"}`}>⚠️ ยุบแก๊ง</button>
        </div>

        {/* Content Box */}
        <div className="w-full bg-zinc-900/60 border border-white/10 rounded-2xl p-6 text-white min-h-[300px]">

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
              </div>
            </div>
          )}

          {/* แท็บ 2: แก้ไขข้อมูลกลุ่มแก๊ง */}
          {activeTab === "edit" && (
            <form onSubmit={handleUpdateGang} className="flex flex-col gap-6 w-full text-white">
              <h2 className="text-lg font-bold text-indigo-400">⚙️ ฟอร์มแก้ไขรายละเอียดแก๊ง</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-200">ชื่อเต็ม (Full Name)</label>
                  <input type="text" name="fullName" defaultValue={gangData.fullName} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-400 focus:outline-none text-sm" required />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-200">ชื่อย่อ (Abbreviation)</label>
                  <input type="text" name="abbreviation" defaultValue={gangData.abbreviation} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm opacity-50" disabled />
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
                <div className="flex flex-col gap-2"><label className="text-sm font-medium text-zinc-200">หัวหน้า (Leader)</label><input type="text" name="leader" defaultValue={gangData.leader} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm" required /></div>
                <div className="flex flex-col gap-2"><label className="text-sm font-medium text-zinc-200">เลขดิสคอร์ดหัวหน้า</label><input type="text" name="leaderDiscord" defaultValue={gangData.leaderDiscord} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm" required /></div>
                <div className="flex flex-col gap-2"><label className="text-sm font-medium text-zinc-200">รองหัวหน้า 1</label><input type="text" name="coLeader1" defaultValue={gangData.coLeader1} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm" /></div>
                <div className="flex flex-col gap-2"><label className="text-sm font-medium text-zinc-200">เลขดิสคอร์ดรอง 1</label><input type="text" name="coLeader1Discord" defaultValue={gangData.coLeader1Discord} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm" /></div>
                <div className="flex flex-col gap-2"><label className="text-sm font-medium text-zinc-200">รองหัวหน้า 2</label><input type="text" name="coLeader2" defaultValue={gangData.coLeader2} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm" /></div>
                <div className="flex flex-col gap-2"><label className="text-sm font-medium text-zinc-200">เลขดิสคอร์ดรอง 2</label><input type="text" name="coLeader2Discord" defaultValue={gangData.coLeader2Discord} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm" /></div>
              </div>
              <button type="submit" className="w-full h-12 mt-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 font-semibold hover:opacity-90 transition-all">บันทึกข้อมูลการแก้ไขทั้งหมด</button>
            </form>
          )}

          {/* 🔄 แท็บ 3: ยื่นคำขอรับของรางวัลสวัสดิการ + ตารางบันทึกประวัติ */}
          {activeTab === "welfare" && (
            <div className="flex flex-col gap-8 w-full">
              {/* Form ยื่นคำขอ */}
              <form onSubmit={handleRequestWelfareSubmit} className="flex flex-col gap-5 w-full text-white border-b border-white/10 pb-8">
                <h2 className="text-lg font-bold text-purple-400">🎁 ฟอร์มยื่นเรื่องขอรับสวัสดิการแก๊งประจำสัปดาห์</h2>
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
                      <th className="px-4 py-3">ผู้เซ็นอนุมัติ</th>
                      <th className="px-4 py-3">วันที่ส่งเรื่อง</th>
                      <th className="px-4 py-3 text-center">จัดการลิงก์ไฟล์</th>
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
                          <td className="px-4 py-3 text-zinc-300 text-xs">{file.approver}</td>
                          <td className="px-4 py-3 text-zinc-400 text-xs font-mono">{file.createdAt}</td>
                          <td className="px-4 py-3 text-center">
                            {editingFileId === file.id ? (
                              <div className="flex flex-col gap-1.5 min-w-[200px] bg-zinc-900/90 p-2 rounded-lg border border-white/10">
                                <input type="url" value={newUrlInput} onChange={(e) => setNewUrlInput(e.target.value)} placeholder="วางลิงก์ไฟล์ .zip ตัวใหม่" className="w-full h-8 px-2 rounded bg-zinc-950 border border-white/20 text-xs text-white focus:outline-none" />
                                <div className="flex justify-center gap-1">
                                  <button onClick={() => handleUpdateLinkSubmit(file.id)} disabled={loading} className="px-2 py-0.5 bg-green-600 hover:bg-green-500 text-[10px] rounded text-white font-medium">บันทึก</button>
                                  <button onClick={() => { setEditingFileId(null); setNewUrlInput(""); }} className="px-2 py-0.5 bg-zinc-700 hover:bg-zinc-600 text-[10px] rounded text-zinc-300">ยกเลิก</button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => { setEditingFileId(file.id); setNewUrlInput(file.fileUrl); }} className="px-3 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-medium rounded-lg transition-all">
                                🔄 เปลี่ยนลิงก์ไฟล์
                              </button>
                            )}
                          </td>
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
                <p className="text-xs text-red-200/70">การกดปุ่มนี้จะเป็นการเปลี่ยนสถานะของแก๊งเป็น 'รอยุบ' ในระบบฐานข้อมูลและระงับการเข้าใช้งานแผงควบคุม</p>
              </div>
              <button
                onClick={handleDisbandGang} // 👈 เปลี่ยนมาผูกกับฟังก์ชันหลักที่มีการยิง Server Action
                disabled={loading}          // 👈 ป้องกันการกดเบิ้ลระหว่างที่กำลังอัปเดตฐานข้อมูล
                className="h-11 rounded-xl bg-red-600 hover:bg-red-500 font-bold text-sm transition-all text-white disabled:opacity-50"
              >
                {loading ? "กำลังส่งเรื่อง..." : "ยืนยันการส่งเรื่องยุบแก๊ง"}
              </button>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}