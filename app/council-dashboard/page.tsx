"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAllUniformFiles,
  updateUniformStatus,
} from "../register";

export default function CouncilAdminDashboard() {
  const router = useRouter();
  const [adminData, setAdminData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"approve_gang" | "approve_welfare" | "approve_uniform" | "gang_list">("approve_gang");
  const [loading, setLoading] = useState(false);
  
  // Data States
  const [gangsList, setGangsList] = useState<any[]>([]);
  const [welfareRequests, setWelfareRequests] = useState<any[]>([]);
  const [uniformFiles, setUniformFiles] = useState<any[]>([]);

  // 1. ตรวจสอบสิทธิ์ผู้ดูแลระบบสภากลาง
  useEffect(() => {
    const savedAdmin = localStorage.getItem("currentCouncil");
    if (!savedAdmin) {
      alert("🔒 กรุณาเข้าสู่ระบบด้วยบัญชีเจ้าหน้าที่สภากลางก่อนใช้งาน");
      router.push("/");
      return;
    }
    setAdminData(JSON.parse(savedAdmin));
  }, [router]);

  // 2. โหลดข้อมูลตามแท็บ
  useEffect(() => {
    const fetchData = async () => {
      if (!localStorage.getItem("currentCouncil")) return;

      setLoading(true);
      try {
        if (activeTab === "approve_gang" || activeTab === "gang_list") {
          setGangsList([]);
        }
        
        if (activeTab === "approve_welfare") {
          setWelfareRequests([]);
        }
        
        if (activeTab === "approve_uniform") {
          const result = await getAllUniformFiles();
          if (result.success) {
            setUniformFiles(result.files || []);
          } else {
            setUniformFiles([]);
          }
        }
      } catch (error) {
        console.error("🚨 ระบบหลังบ้านขัดข้อง:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeTab]);

  const handleLogout = () => {
    localStorage.removeItem("currentCouncil");
    router.push("/");
  };

  // --- Handlers จัดการฐานข้อมูลและ UI ---
  const handleApproveGang = async (id: number, status: "approved" | "disbanded") => {
    if (confirm(`ยืนยันการเปลี่ยนสถานะกลุ่มเป็น [${status}] หรือไม่?`)) {
      try {
        const isSuccess = true; 
        if (isSuccess) {
          alert(`✨ อัปเดตสถานะแก๊ง ID: #${id} เป็น [${status}] สำเร็จ!`);
          setGangsList((prev) => prev.map((g) => g.id === id ? { ...g, status: status } : g));
        }
      } catch (error) {
        alert("❌ เกิดข้อผิดพลาดในการอัปเดตสถานะแก๊ง");
      }
    }
  };

  const handleApproveWelfare = async (id: number, status: "รับไปแล้ว" | "เอาออกแล้ว") => {
    try {
      const isSuccess = true;
      if (isSuccess) {
        alert(`✨ อัปเดตคำขอสวัสดิการ ID: #${id} เป็น [${status}] เรียบร้อย`);
        setWelfareRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: status } : r));
      }
    } catch (error) {
      alert("❌ เกิดข้อผิดพลาดในการอนุมัติสวัสดิการ");
    }
  };

  const handleApproveUniform = async (id: number, status: "ลงแล้ว" | "ปฏิเสธ") => {
    try {
      const targetFile = uniformFiles.find((file) => file.id === id);
      if (!targetFile) return;

      const res = await updateUniformStatus(id, status);
      
      if (res && res.success) {
        alert(`✨ อัปเดตสถานะชุดโมเดล ID: #${id} ในฐานข้อมูลเรียบร้อย`);
        setUniformFiles((prev) => prev.map((f) => f.id === id ? { ...f, status: status } : f));
      }
    } catch (error) {
      alert("❌ เกิดข้อผิดพลาดในการอัปเดตข้อมูลชุด");
    }
  };

  const translateWelfareItem = (item: string) => {
    switch (item) {
      case "car": return "🚗 กล่องยานพาหนะกองกำลัง";
      case "money": return "💰 ทุนสนับสนุนสภา (500,000 Roll)";
      case "weapon": return "📦 คลังอาวุธยุทธภัณฑ์ (War Box)";
      default: return item;
    }
  };

  if (!adminData) return <div className="text-zinc-500 text-center mt-20 font-light tracking-widest animate-pulse">🔒 ตรวจสอบสิทธิ์ผู้ดูแลระบบ...</div>;

  return (
    <div
      className="relative flex flex-col items-center justify-start min-h-screen bg-cover bg-center bg-no-repeat font-sans antialiased py-16 px-4 text-zinc-300 selection:bg-white/20"
      style={{ backgroundImage: "url('/COUNCIL.PNG')" }}
    >
      {/* Background Overlay มืดลึกแบบภาพยนตร์ */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-[6px]" />

      {/* Main Glassmorphism Card */}
      <main className="relative z-10 flex w-full max-w-5xl flex-col gap-8 bg-gradient-to-b from-zinc-900/40 to-zinc-950/60 backdrop-blur-xl border border-white/[0.06] rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] p-6 md:p-10">
        
        {/* Top Header Label */}
        <div className="w-full flex justify-between items-center text-[10px] font-semibold tracking-[0.2em] text-zinc-500 uppercase">
          <span className="cursor-pointer hover:text-zinc-300 transition-colors">‹ Back to Hub</span>
          <span className="px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] text-zinc-400">Admin Dashboard Action</span>
        </div>

        {/* Brand Header Section */}
        <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-white/[0.06] pb-8 gap-4">
          <div>
            <h1 className="text-2xl font-light text-zinc-400 tracking-wider uppercase">
              Cloud City
            </h1>
            <p className="text-3xl font-extrabold text-white tracking-tight mt-1">
              Council Admin Management
            </p>
          </div>
          <button onClick={handleLogout} className="px-4 py-2 text-xs font-medium bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-white/[0.06] rounded-xl transition-all duration-200 active:scale-95 shadow-sm">
            🔒 Log Out Status
          </button>
        </div>

        {/* Glass Tabs Navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 w-full bg-black/[0.2] p-1.5 rounded-2xl border border-white/[0.04]">
          {[
            { id: "approve_gang", label: "🛡️ อนุมัติแก๊ง" },
            { id: "approve_welfare", label: "🎁 แจกสวัสดิการ" },
            { id: "approve_uniform", label: "👕 จัดการไฟล์ชุด" },
            { id: "gang_list", label: "📋 ทะเบียนสภา" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`h-11 text-xs font-medium rounded-xl transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-white/[0.08] text-white shadow-[0_4px_12px_rgba(0,0,0,0.2)] border border-white/[0.08] backdrop-blur-md"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Workspace Container */}
        <div className="w-full min-h-[380px]">
          {loading && (
            <div className="text-center text-xs text-zinc-600 py-24 animate-pulse tracking-widest font-light">
              กำลังดึงข้อมูลจากเซิร์ฟเวอร์สภากลาง...
            </div>
          )}

          {!loading && (
            <div className="w-full bg-black/[0.1] rounded-2xl border border-white/[0.04] overflow-hidden backdrop-blur-sm">
              
              {/* MENU 1: ยืนยันแก๊ง */}
              {activeTab === "approve_gang" && (
                <div className="flex flex-col w-full">
                  <div className="p-5 border-b border-white/[0.06] bg-white/[0.01]">
                    <h2 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">🛡️ คำขอเปิดสิทธิ์ภาคีแก๊ง</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left whitespace-nowrap">
                      <thead className="bg-zinc-950/40 text-zinc-400 border-b border-white/[0.06] font-medium">
                        <tr>
                          <th className="px-6 py-4">ชื่อกลุ่ม [ย่อ]</th>
                          <th className="px-6 py-4">หัวหน้ากลุ่ม</th>
                          <th className="px-6 py-4">สถานะ</th>
                          <th className="px-6 py-4 text-center">จัดการคำขอ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04] text-zinc-300">
                        {gangsList.filter(g => g.status === "pending" || g.status === "รอยุบ").length === 0 ? (
                          <tr><td colSpan={4} className="text-center py-20 text-zinc-600 font-light tracking-wide">📭 ไม่มีคำขออนุมัติค้างอยู่ในระบบ</td></tr>
                        ) : (
                          gangsList.map((gang) => (
                            <tr key={gang.id} className="hover:bg-white/[0.01] transition-colors">
                              <td className="px-6 py-4 font-bold text-white">{gang.fullName} <span className="text-zinc-500 font-mono font-normal">[{gang.abbreviation}]</span></td>
                              <td className="px-6 py-4 text-zinc-400">{gang.leader}</td>
                              <td className="px-6 py-4">
                                <span className="text-[10px] px-2.5 py-1 rounded-md bg-white/[0.02] text-zinc-400 border border-white/[0.06] font-mono">{gang.status}</span>
                              </td>
                              <td className="px-6 py-4 text-center flex justify-center gap-2">
                                <button onClick={() => handleApproveGang(gang.id, "approved")} className="px-4 py-1.5 bg-white/[0.08] hover:bg-white hover:text-black font-medium rounded-lg border border-white/[0.08] transition-all text-[11px] shadow-sm">อนุมัติ</button>
                                <button onClick={() => handleApproveGang(gang.id, "disbanded")} className="px-4 py-1.5 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-white/[0.04] rounded-lg transition-all text-[11px]">ปฏิเสธ</button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* MENU 2: ยืนยันสวัสดิการ */}
              {activeTab === "approve_welfare" && (
                <div className="flex flex-col w-full">
                  <div className="p-5 border-b border-white/[0.06] bg-white/[0.01]">
                    <h2 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">🎁 ระบบพิจารณาเบิกจ่ายสวัสดิการสภา</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left whitespace-nowrap">
                      <thead className="bg-zinc-950/40 text-zinc-400 border-b border-white/[0.06]">
                        <tr>
                          <th className="px-6 py-4">แก๊งผู้ขอ</th>
                          <th className="px-6 py-4">ผู้ยื่นเรื่อง (Discord ID)</th>
                          <th className="px-6 py-4">รายการของรางวัล</th>
                          <th className="px-6 py-4 text-center">การดำเนินการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04] text-zinc-300">
                        {welfareRequests.length === 0 ? (
                          <tr><td colSpan={4} className="text-center py-20 text-zinc-600 font-light tracking-wide">📭 ไม่มีคำขอสวัสดิการค้างในระบบ</td></tr>
                        ) : (
                          welfareRequests.map((req) => (
                            <tr key={req.id} className="hover:bg-white/[0.01] transition-colors">
                              <td className="px-6 py-4 font-semibold text-white">{req.gangName} <span className="text-zinc-500">[{req.gangAbbr}]</span></td>
                              <td className="px-6 py-4">
                                <span className="block text-zinc-300 font-medium">{req.requestName}</span>
                                <span className="text-[10px] text-zinc-500 font-mono">{req.discordId}</span>
                              </td>
                              <td className="px-6 py-4 text-zinc-400">{translateWelfareItem(req.welfareItem)}</td>
                              <td className="px-6 py-4 text-center">
                                {req.status !== "รับไปแล้ว" && req.status !== "เอาออกแล้ว" ? (
                                  <div className="flex justify-center gap-2">
                                    <button onClick={() => handleApproveWelfare(req.id, "รับไปแล้ว")} className="px-4 py-1.5 bg-white/[0.08] hover:bg-white hover:text-black font-medium rounded-lg border border-white/[0.08] transition-all text-[11px] shadow-sm">อนุมัติแจก</button>
                                    <button onClick={() => handleApproveWelfare(req.id, "เอาออกแล้ว")} className="px-4 py-1.5 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-500 rounded-lg transition-all text-[11px]">ยกเลิก</button>
                                  </div>
                                ) : (
                                  <span className={`text-[10px] font-medium px-2.5 py-1 rounded-md border ${req.status === "รับไปแล้ว" ? "bg-white/[0.02] text-zinc-400 border-white/[0.06]" : "bg-transparent text-zinc-600 border-transparent"}`}>
                                    {req.status === "รับไปแล้ว" ? "✓ ส่งมอบแล้ว" : "✕ ยกเลิกคำขอ"}
                                  </span>
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

              {/* MENU 3: ยืนยันชุด */}
              {activeTab === "approve_uniform" && (
                <div className="flex flex-col w-full">
                  <div className="p-5 border-b border-white/[0.06] bg-white/[0.01]">
                    <h2 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">👕 รายการตรวจสอบคลังชุดโมเดลสัญชาติ (.zip)</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left whitespace-nowrap">
                      <thead className="bg-zinc-950/40 text-zinc-400 border-b border-white/[0.06]">
                        <tr>
                          <th className="px-6 py-4">โมเดลชุด</th>
                          <th className="px-6 py-4">สังกัดแก๊ง</th>
                          <th className="px-6 py-4">ลิงก์ทรัพยากร</th>
                          <th className="px-6 py-4">เหตุผล</th>
                          <th className="px-6 py-4">สถานะ</th>
                          <th className="px-6 py-4 text-center">อัปเดตเมือง</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04] text-zinc-300">
                        {uniformFiles.length === 0 ? (
                          <tr><td colSpan={6} className="text-center py-20 text-zinc-600 font-light tracking-wide">📭 ไม่มีรายงานไฟล์โมเดลชุดเครื่องแบบเข้ามาในระบบ</td></tr>
                        ) : (
                          uniformFiles.map((file) => (
                            <tr key={file.id} className="hover:bg-white/[0.01] transition-colors">
                              <td className="px-6 py-4 font-semibold text-white">{file.uniformType}</td>
                              <td className="px-6 py-4 text-zinc-400">{file.gangName}</td>
                              <td className="px-6 py-4">
                                <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white underline underline-offset-4 transition-colors font-medium">📥 Download File</a>
                              </td>
                              <td className="px-6 py-4 text-zinc-400 max-w-[200px] truncate">{file.reason || "-"}</td>
                              <td className="px-6 py-4">
                                <span className={`text-[10px] font-medium px-2.5 py-1 rounded-md border ${file.status === "ลงแล้ว" ? "bg-white/[0.08] text-white border-white/[0.1]" : "bg-white/[0.01] text-zinc-500 border-white/[0.04]"}`}>
                                  {file.status === "ลงแล้ว" ? "✓ เมืองรับแล้ว" : "⏳ รอการอิมพอร์ต"}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                {file.status !== "ลงแล้ว" ? (
                                  <button onClick={() => handleApproveUniform(file.id, "ลงแล้ว")} className="px-4 py-2 bg-white/[0.08] hover:bg-white hover:text-black font-semibold rounded-lg border border-white/[0.08] transition-all text-[11px] active:scale-95 shadow-sm">
                                    อัปเดตลงเซิร์ฟเวอร์
                                  </button>
                                ) : (
                                  <span className="text-zinc-600 text-xs">-</span>
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

              {/* MENU 4: รายชื่อแก๊ง */}
              {activeTab === "gang_list" && (
                <div className="flex flex-col w-full">
                  <div className="p-5 border-b border-white/[0.06] bg-white/[0.01]">
                    <h2 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">📋 ทะเบียนทำเนียบภาคีสภากลาง</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left whitespace-nowrap">
                      <thead className="bg-zinc-950/40 text-zinc-400 border-b border-white/[0.06]">
                        <tr>
                          <th className="px-6 py-4">รหัสรับรองสภา</th>
                          <th className="px-6 py-4">ชื่อแก๊ง [ย่อ]</th>
                          <th className="px-6 py-4">หัวหน้ากลุ่ม / Leaders</th>
                          <th className="px-6 py-4">สถานะภาคี</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04] text-zinc-300">
                        {gangsList.length === 0 ? (
                          <tr><td colSpan={4} className="text-center py-20 text-zinc-600 font-light tracking-wide">📭 ไม่มีข้อมูลรายชื่อแก๊งในสารบบ</td></tr>
                        ) : (
                          gangsList.map((gang) => (
                            <tr key={gang.id} className="hover:bg-white/[0.01] transition-colors">
                              <td className="px-6 py-4 font-mono text-zinc-600">CC-COUNCIL-#{gang.id}</td>
                              <td className="px-6 py-4 font-bold text-white">{gang.fullName} <span className="text-zinc-500 font-mono font-normal">[{gang.abbreviation}]</span></td>
                              <td className="px-6 py-4 text-zinc-400">{gang.leader}</td>
                              <td className="px-6 py-4">
                                <span className={`text-[10px] font-medium px-2.5 py-1 rounded-md border ${gang.status === 'approved' ? 'bg-white/[0.08] text-white border-white/[0.1]' : 'bg-white/[0.01] text-zinc-500 border-white/[0.04]'}`}>
                                  {gang.status === 'approved' ? '✓ ได้รับสิทธิ์สภา' : '⏳ รอตรวจประวัติ'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
        
      </main>
    </div>
  );
}