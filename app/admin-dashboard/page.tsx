"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getAllWelfareRequests,
  updateWelfareStatus,
  getAllUniformFiles,
  updateUniformStatus,
} from "../register";

type AdminData = {
  id: number;
  name: string;
  username: string;
  status: string;
  createdAt: string;
};

type WelfareRequest = {
  id: number;
  gangName: string;
  gangAbbreviation: string;
  requestName: string;
  discordId: string;
  welfareItem: string;
  status: string;
  createdAt: string;
};

type UniformFile = {
  id: number;
  gangName: string;
  uniformType: string;
  fileUrl: string;
  approver: string;
  approverDiscord: string;
  reason: string | null;
  status: string;
  createdAt: string;
};

function getInitialAdminData(): AdminData | null {
  if (typeof window === "undefined") return null;
  const saved = localStorage.getItem("currentAdmin");
  if (!saved) return null;
  try {
    return JSON.parse(saved) as AdminData;
  } catch {
    return null;
  }
}

export default function AdminDashboard() {
  const router = useRouter();
  const [adminData] = useState<AdminData | null>(getInitialAdminData);
  const [activeTab, setActiveTab] = useState<"welfare" | "outfit">("welfare");
  const [loading, setLoading] = useState(false);
  const [welfareRequests, setWelfareRequests] = useState<WelfareRequest[]>([]);
  const [uniformFiles, setUniformFiles] = useState<UniformFile[]>([]);

  useEffect(() => {
    if (!adminData) {
      alert("🔒 กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบก่อน");
      router.push("/admin-login");
    }
  }, [adminData, router]);

  useEffect(() => {
    if (!adminData) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        if (activeTab === "welfare") {
          const welfareResult = await getAllWelfareRequests();
          setWelfareRequests(welfareResult.success ? welfareResult.requests || [] : []);
        }

        if (activeTab === "outfit") {
          const uniformResult = await getAllUniformFiles();
          setUniformFiles(uniformResult.success ? uniformResult.files || [] : []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeTab, adminData]);

  const handleLogout = () => {
    localStorage.removeItem("currentAdmin");
    router.push("/");
  };

  const translateWelfareItem = (item: string) => {
    switch (item) {
      case "car":
        return "🚗 กล่องยานพาหนะกองกำลัง";
      case "money":
        return "💰 ทุนสนับสนุนสภา (500,000 Roll)";
      case "weapon":
        return "📦 คลังอาวุธยุทธภัณฑ์ (War Box)";
      default:
        return item;
    }
  };

  const handleWelfareAction = async (id: number, status: "รับไปแล้ว" | "เอาออกแล้ว") => {
    try {
      const result = await updateWelfareStatus(id, status);
      if (result.success) {
        alert(result.message);
        setWelfareRequests((prev) =>
          prev.map((req) => (req.id === id ? { ...req, status } : req))
        );
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error(error);
      alert("❌ ไม่สามารถอัปเดตสถานะสวัสดิการได้");
    }
  };

  const handleOutfitAction = async (id: number, status: "ลงแล้ว" | "ปฏิเสธ") => {
    try {
      const result = await updateUniformStatus(id, status);
      if (result.success) {
        alert(result.message);
        setUniformFiles((prev) =>
          prev.map((file) => (file.id === id ? { ...file, status } : file))
        );
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error(error);
      alert("❌ ไม่สามารถอัปเดตสถานะชุดได้");
    }
  };

  if (!adminData) {
    return (
      <div className="text-zinc-500 text-center mt-20 font-light tracking-widest animate-pulse">
        🔒 กำลังตรวจสอบสิทธิ์ผู้ดูแลระบบ...
      </div>
    );
  }

  return (
    <div
      className="relative flex flex-col items-center justify-start min-h-screen bg-cover bg-center bg-no-repeat bg-fixed font-sans antialiased py-12 px-4 text-zinc-300"
      style={{ backgroundImage: "url('/COUNCIL.PNG')" }}
    >
      <div className="absolute inset-0 bg-zinc-950/60 dark:bg-black/70 backdrop-blur-[2px]" />

      <main className="relative z-10 flex w-full max-w-5xl flex-col gap-8 bg-white/10 dark:bg-zinc-900/20 backdrop-blur-md border border-white/20 dark:border-zinc-800/30 rounded-3xl shadow-2xl p-6 md:p-10 mx-4">
        {/* Header */}
        <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/10 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Cloud City
            </h1>
            <p className="text-zinc-200 text-sm md:text-base font-light mt-1">
              หน้าจัดการระบบสำหรับผู้ดูแลระบบ
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

        {/* Tab Selection - สไตล์หน้า select */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          <button
            onClick={() => setActiveTab("welfare")}
            className={`group flex flex-col items-center sm:items-start gap-3 p-6 rounded-2xl border text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-lg text-center sm:text-left ${
              activeTab === "welfare"
                ? "bg-gradient-to-br from-blue-600/30 to-indigo-600/30 border-blue-400/50"
                : "bg-white/5 border-white/10 hover:bg-white/10"
            }`}
          >
            <div className={`p-3 rounded-xl transition-transform group-hover:scale-110 ${activeTab === "welfare" ? "bg-blue-500/20 text-blue-300" : "bg-white/10 text-zinc-300"}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold">สวัสดิการ</h3>
              <p className="text-xs text-zinc-300/80 mt-1 font-light">จัดการคำขอรับสวัสดิการจากแก๊งต่างๆ</p>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("outfit")}
            className={`group flex flex-col items-center sm:items-start gap-3 p-6 rounded-2xl border text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-lg text-center sm:text-left ${
              activeTab === "outfit"
                ? "bg-gradient-to-br from-purple-600/30 to-pink-600/30 border-purple-400/50"
                : "bg-white/5 border-white/10 hover:bg-white/10"
            }`}
          >
            <div className={`p-3 rounded-xl transition-transform group-hover:scale-110 ${activeTab === "outfit" ? "bg-purple-500/20 text-purple-300" : "bg-white/10 text-zinc-300"}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold">ชุด / ไฟล์</h3>
              <p className="text-xs text-zinc-300/80 mt-1 font-light">ตรวจสอบและอัปเดตสถานะไฟล์ชุดที่ส่งเข้ามา</p>
            </div>
          </button>
        </div>

        {/* Content Area */}
        <div className="w-full min-h-[300px] bg-black/10 rounded-2xl border border-white/10 overflow-hidden backdrop-blur-sm">
          {loading && (
            <div className="text-center text-xs text-zinc-500 py-24 animate-pulse tracking-widest font-light">
              กำลังดึงข้อมูลจากฐานข้อมูล...
            </div>
          )}

          {!loading && activeTab === "welfare" && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left whitespace-nowrap">
                <thead className="bg-zinc-950/40 text-zinc-400 border-b border-white/10 font-medium">
                  <tr>
                    <th className="px-6 py-4">แก๊ง</th>
                    <th className="px-6 py-4">ผู้ยื่นเรื่อง (Discord)</th>
                    <th className="px-6 py-4">รายการ</th>
                    <th className="px-6 py-4">สถานะ</th>
                    <th className="px-6 py-4 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-zinc-300">
                  {welfareRequests.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-20 text-zinc-500 font-light tracking-wide">
                        📭 ไม่มีคำขอสวัสดิการในระบบ
                      </td>
                    </tr>
                  ) : (
                    welfareRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-semibold text-white">
                          {req.gangName}{" "}
                          <span className="text-zinc-500 font-normal">[{req.gangAbbreviation}]</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="block text-zinc-300 font-medium">{req.requestName}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">{req.discordId}</span>
                        </td>
                        <td className="px-6 py-4 text-zinc-400">{translateWelfareItem(req.welfareItem)}</td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] px-2.5 py-1 rounded-md bg-white/5 text-zinc-300 border border-white/10 font-mono">
                            {req.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {req.status !== "รับไปแล้ว" && req.status !== "เอาออกแล้ว" ? (
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => handleWelfareAction(req.id, "รับไปแล้ว")}
                                className="px-4 py-1.5 bg-white/10 hover:bg-white hover:text-black font-medium rounded-lg border border-white/10 transition-all text-[11px] shadow-sm"
                              >
                                อนุมัติ
                              </button>
                              <button
                                onClick={() => handleWelfareAction(req.id, "เอาออกแล้ว")}
                                className="px-4 py-1.5 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-white/10 rounded-lg transition-all text-[11px]"
                              >
                                ยกเลิก
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] font-medium px-2.5 py-1 rounded-md border bg-white/5 text-zinc-300 border-white/10">
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
          )}

          {!loading && activeTab === "outfit" && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left whitespace-nowrap">
                <thead className="bg-zinc-950/40 text-zinc-400 border-b border-white/10 font-medium">
                  <tr>
                    <th className="px-6 py-4">แก๊ง</th>
                    <th className="px-6 py-4">ประเภทชุด</th>
                    <th className="px-6 py-4">ลิงก์ไฟล์</th>
                    <th className="px-6 py-4">เหตุผล</th>
                    <th className="px-6 py-4">สถานะ</th>
                    <th className="px-6 py-4 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-zinc-300">
                  {uniformFiles.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-20 text-zinc-500 font-light tracking-wide">
                        📭 ไม่มีไฟล์ชุดในระบบ
                      </td>
                    </tr>
                  ) : (
                    uniformFiles.map((file) => (
                      <tr key={file.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-semibold text-white">{file.gangName}</td>
                        <td className="px-6 py-4 text-zinc-400">{file.uniformType}</td>
                        <td className="px-6 py-4">
                          <a
                            href={file.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-400 hover:text-white underline underline-offset-4 transition-colors font-medium"
                          >
                            📥 ดาวน์โหลด
                          </a>
                        </td>
                        <td className="px-6 py-4 text-zinc-400 max-w-[200px] truncate">{file.reason || "-"}</td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-medium px-2.5 py-1 rounded-md border ${
                            file.status === "ลงแล้ว"
                              ? "bg-white/10 text-white border-white/20"
                              : "bg-white/5 text-zinc-400 border-white/10"
                          }`}>
                            {file.status === "ลงแล้ว" ? "✓ ลงแล้ว" : "⏳ รอลง"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {file.status !== "ลงแล้ว" ? (
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => handleOutfitAction(file.id, "ลงแล้ว")}
                                className="px-4 py-1.5 bg-white/10 hover:bg-white hover:text-black font-medium rounded-lg border border-white/10 transition-all text-[11px] shadow-sm"
                              >
                                ลงแล้ว
                              </button>
                              <button
                                onClick={() => handleOutfitAction(file.id, "ปฏิเสธ")}
                                className="px-4 py-1.5 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-white/10 rounded-lg transition-all text-[11px]"
                              >
                                ปฏิเสธ
                              </button>
                            </div>
                          ) : (
                            <span className="text-zinc-500 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
