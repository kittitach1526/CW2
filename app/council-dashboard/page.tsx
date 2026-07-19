"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAllUniformFiles,
  updateUniformStatus,
  getAllGangs,
  getAllWelfareRequests,
  updateGangStatus,
  updateWelfareStatus,
  getPendingGangEditRequests,
  approveGangEditRequest,
  rejectGangEditRequest,
  getPendingDisbandRequests,
  approveDisbandRequest,
  rejectDisbandRequest,
  getPauseRequests,
  approvePauseRequest,
  rejectPauseRequest,
  reportPauseRequest,
  getWelfareItems,
  createWelfareItem,
  updateWelfareItem,
  deleteWelfareItem,
} from "../register";
import Modal from "../components/Modal";

export default function CouncilAdminDashboard() {
  const router = useRouter();
  const [adminData, setAdminData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"approve_gang" | "approve_welfare" | "approve_uniform" | "approve_gang_edit" | "approve_disband" | "approve_pause" | "gang_list" | "welfare_by_gang" | "welfare_items">("approve_gang");
  const [loading, setLoading] = useState(false);
  const [selectedGangAbbr, setSelectedGangAbbr] = useState("");
  
  // Data States
  const [gangsList, setGangsList] = useState<any[]>([]);
  const [welfareRequests, setWelfareRequests] = useState<any[]>([]);
  const [uniformFiles, setUniformFiles] = useState<any[]>([]);
  const [editRequests, setEditRequests] = useState<any[]>([]);
  const [disbandRequests, setDisbandRequests] = useState<any[]>([]);
  const [pauseRequests, setPauseRequests] = useState<any[]>([]);
  const [welfareItems, setWelfareItems] = useState<any[]>([]);
  const [welfareItemName, setWelfareItemName] = useState("");
  const [welfareItemType, setWelfareItemType] = useState("");
  const [welfareItemGangLimit, setWelfareItemGangLimit] = useState("");
  const [welfareItemFemaleGangLimit, setWelfareItemFemaleGangLimit] = useState("");
  const [welfareItemFamilyLimit, setWelfareItemFamilyLimit] = useState("");
  const [editingWelfareItemId, setEditingWelfareItemId] = useState<number | null>(null);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [newTypeInput, setNewTypeInput] = useState("");

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
        if (activeTab === "approve_gang" || activeTab === "gang_list" || activeTab === "welfare_by_gang") {
          const result = await getAllGangs();
          if (result.success) {
            setGangsList(result.gangs || []);
          } else {
            setGangsList([]);
          }
        }

        if (activeTab === "approve_welfare" || activeTab === "welfare_by_gang") {
          const result = await getAllWelfareRequests();
          if (result.success) {
            setWelfareRequests(result.requests || []);
          } else {
            setWelfareRequests([]);
          }
        }

        if (activeTab === "approve_uniform") {
          const result = await getAllUniformFiles();
          if (result.success) {
            setUniformFiles(result.files || []);
          } else {
            setUniformFiles([]);
          }
        }

        if (activeTab === "approve_gang_edit") {
          const result = await getPendingGangEditRequests();
          if (result.success) {
            setEditRequests(result.requests || []);
          } else {
            setEditRequests([]);
          }
        }

        if (activeTab === "approve_disband") {
          const result = await getPendingDisbandRequests();
          if (result.success) {
            setDisbandRequests(result.requests || []);
          } else {
            setDisbandRequests([]);
          }
        }

        if (activeTab === "approve_pause") {
          const result = await getPauseRequests();
          if (result.success) {
            setPauseRequests(result.requests || []);
          } else {
            setPauseRequests([]);
          }
        }

        if (activeTab === "welfare_items") {
          const result = await getWelfareItems();
          if (result.success) {
            setWelfareItems(result.items || []);
          } else {
            setWelfareItems([]);
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
        setLoading(true);
        const result = await updateGangStatus(id, status);
        setLoading(false);
        if (result.success) {
          alert(`✨ อัปเดตสถานะแก๊ง ID: #${id} เป็น [${status}] สำเร็จ!`);
          setGangsList((prev) => prev.map((g) => g.id === id ? { ...g, status: status } : g));
        } else {
          alert(result.message);
        }
      } catch (error) {
        setLoading(false);
        alert("❌ เกิดข้อผิดพลาดในการอัปเดตสถานะแก๊ง");
      }
    }
  };

  const handleApproveWelfare = async (id: number, status: "รับไปแล้ว" | "เอาออกแล้ว") => {
    try {
      setLoading(true);
      const result = await updateWelfareStatus(id, status);
      setLoading(false);
      if (result.success) {
        alert(`✨ อัปเดตคำขอสวัสดิการ ID: #${id} เป็น [${status}] เรียบร้อย`);
        setWelfareRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: status } : r));
      } else {
        alert(result.message);
      }
    } catch (error) {
      setLoading(false);
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

  const resetWelfareItemForm = () => {
    setWelfareItemName("");
    setWelfareItemType("");
    setWelfareItemGangLimit("");
    setWelfareItemFemaleGangLimit("");
    setWelfareItemFamilyLimit("");
    setEditingWelfareItemId(null);
  };

  const handleSaveWelfareItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!welfareItemName.trim() || !welfareItemType.trim()) {
      alert("❌ กรุณากรอกชื่อและประเภทสวัสดิการ");
      return;
    }
    setLoading(true);
    try {
      const parseLimit = (value: string) => {
        const num = Number(value);
        return value.trim() === "" || Number.isNaN(num) ? null : num;
      };
      const payload = {
        name: welfareItemName.trim(),
        type: welfareItemType.trim(),
        gang_limit: parseLimit(welfareItemGangLimit),
        female_gang_limit: parseLimit(welfareItemFemaleGangLimit),
        family_limit: parseLimit(welfareItemFamilyLimit),
      };
      const result = editingWelfareItemId
        ? await updateWelfareItem(editingWelfareItemId, payload)
        : await createWelfareItem(payload);
      setLoading(false);
      if (result.success) {
        alert(result.message);
        resetWelfareItemForm();
        const refresh = await getWelfareItems();
        if (refresh.success) setWelfareItems(refresh.items || []);
      } else {
        alert(result.message);
      }
    } catch (error) {
      setLoading(false);
      alert("❌ เกิดข้อผิดพลาดในการบันทึกรายการสวัสดิการ");
    }
  };

  const handleEditWelfareItem = (item: any) => {
    setWelfareItemName(item.name || "");
    setWelfareItemType(item.type || "");
    setWelfareItemGangLimit(item.gang_limit?.toString() || "");
    setWelfareItemFemaleGangLimit(item.female_gang_limit?.toString() || "");
    setWelfareItemFamilyLimit(item.family_limit?.toString() || "");
    setEditingWelfareItemId(item.id);
  };

  const handleDeleteWelfareItem = async (id: number) => {
    if (!confirm("ยืนยันการลบรายการสวัสดิการนี้หรือไม่?")) return;
    setLoading(true);
    try {
      const result = await deleteWelfareItem(id);
      setLoading(false);
      if (result.success) {
        alert(result.message);
        const refresh = await getWelfareItems();
        if (refresh.success) setWelfareItems(refresh.items || []);
      } else {
        alert(result.message);
      }
    } catch (error) {
      setLoading(false);
      alert("❌ เกิดข้อผิดพลาดในการลบรายการสวัสดิการ");
    }
  };

  const handleApproveGangEdit = async (id: number, action: "approve" | "reject") => {
    const reviewer = adminData?.name || adminData?.username || "สภากลาง";
    const result = action === "approve"
      ? await approveGangEditRequest(id, reviewer)
      : await rejectGangEditRequest(id, reviewer);

    if (result.success) {
      alert(result.message);
      setEditRequests((prev) => prev.filter((r) => r.id !== id));
    } else {
      alert(result.message);
    }
  };

  const handleApproveDisband = async (id: number, action: "approve" | "reject") => {
    const reviewer = adminData?.name || adminData?.username || "สภากลาง";
    const result = action === "approve"
      ? await approveDisbandRequest(id, reviewer)
      : await rejectDisbandRequest(id, reviewer);

    if (result.success) {
      alert(result.message);
      setDisbandRequests((prev) => prev.filter((r) => r.id !== id));
    } else {
      alert(result.message);
    }
  };

  const handlePauseAction = async (id: number, action: "approve" | "reject" | "report") => {
    const reviewer = adminData?.name || adminData?.username || "สภากลาง";
    let result;
    if (action === "approve") {
      result = await approvePauseRequest(id, reviewer);
    } else if (action === "reject") {
      result = await rejectPauseRequest(id, reviewer);
    } else {
      result = await reportPauseRequest(id);
    }

    if (result.success) {
      alert(result.message);
      setPauseRequests((prev) => prev.filter((r) => r.id !== id));
    } else {
      alert(result.message);
    }
  };

  const translateWelfareItem = (item: string) => {
  if (item === "car") return "🚗 กล่องยานพาหนะกองกำลัง";
  if (item === "money") return "💰 ทุนสนับสนุนสภา (500,000 Roll)";
  if (item === "weapon") return "📦 คลังอาวุธยุทธภัณฑ์ (War Box)";
  if (item?.startsWith("อาวุธ:")) return `🔫 สวัสดิการอาวุธ ${item.replace("อาวุธ: ", "")}`;
  if (item?.startsWith("รถ:")) return `🚗 ${item.replace("รถ: ", "")}`;
  if (item === "เทรดสวัสดิการ") return "🔄 เทรดสวัสดิการ";
  if (item?.includes("ออก - ออกลอย")) return "🚪 ออก - ออกลอย";
  return item;
};

const parseDetails = (raw: any) => {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try { return JSON.parse(raw); } catch { return {}; }
};

const welfareTypeLabel = (req: any) => {
  const type = req.requestType;
  if (type === "trade") return "เทรดสวัสดิการ";
  if (type === "leave") return "ออก - ออกลอย";
  return "รับสวัสดิการ";
};

const formatWelfareDetails = (req: any) => {
  const details = parseDetails(req.details);
  const type = req.requestType;
  if (type === "receive") {
    const itemName = details.welfareItemName || req.welfareItem || "-";
    if (details.category === "weapon") return details.weaponType ? `${itemName} (${details.weaponType})` : itemName;
    if (details.category === "car") return `${itemName}: ${details.carType || "-"} (${details.licensePlate || "-"}) ${details.carQuantity || "4"} คัน`;
    return itemName;
  }
  if (type === "trade") {
    return `ถือ: ${details.tradeHolderName || "-"} (${details.tradeHolderDiscord || "-"}) (${details.tradeHolderPhone || "-"}) [${details.tradeHolderWelfare || "-"}] → รับ: ${details.tradeToName || "-"} (${details.tradeToDiscord || "-"}) (${details.tradeToPhone || "-"})`;
  }
  if (type === "leave") {
    return `ผู้ยื่น: ${details.requesterName || req.requestName || "-"} (${details.requesterPhone || "-"}) → ออก: ${details.leaveName || "-"} (${details.leaveDiscord || "-"})${details.leavePhone ? ` ${details.leavePhone}` : ""}${details.weaponType ? ` [${details.weaponType}]` : ""}`;
  }
  return "-";
};

const formatUniformDetails = (file: any) => {
  const details = parseDetails(file.details);
  const pieces = ["Suit", "Hood", "Armor", "Mod"].filter((p) => details.pieces?.[p]);
  const piecesText = pieces.map((p) => {
    const num = details.pieceNumbers?.[p];
    const old = details.oldPieceNumbers?.[p];
    return `${p}${num ? ` #${num}` : ""}${old ? ` (เดิม #${old})` : ""}`;
  }).join(", ");
  return { ...details, piecesText };
};

if (!adminData) return <div className="text-zinc-500 text-center mt-20 font-light tracking-widest animate-pulse">🔒 ตรวจสอบสิทธิ์ผู้ดูแลระบบ...</div>;

  const navItems = [
    { id: "approve_gang", label: "อนุมัติแก๊ง", icon: "🛡️" },
    { id: "approve_gang_edit", label: "อนุมัติแก้ไขแก๊ง", icon: "✏️" },
    { id: "approve_disband", label: "อนุมัติยุบแก๊ง", icon: "⚠️" },
    { id: "approve_pause", label: "อนุมัติพักแก๊ง", icon: "⏸️" },
    { id: "approve_welfare", label: "แจกสวัสดิการ", icon: "🎁" },
    { id: "approve_uniform", label: "จัดการไฟล์ชุด", icon: "👕" },
    { id: "gang_list", label: "รายชื่อแก๊งทั้งหมด", icon: "📋" },
    { id: "welfare_by_gang", label: "สวัสดิการตามแก๊ง", icon: "🎁" },
    { id: "welfare_items", label: "จัดการรายการสวัสดิการ", icon: "📦" },
  ] as const;

  const pendingGangCount = gangsList.filter((g) => g.status === "pending" || g.status === "รอยุบ").length;
  const pendingEditCount = editRequests.filter((r) => r.status === "pending").length;
  const pendingDisbandCount = disbandRequests.filter((r) => r.status === "pending").length;
  const pendingPauseCount = pauseRequests.length;
  const pendingWelfareCount = welfareRequests.filter((r) => r.status !== "รับไปแล้ว" && r.status !== "เอาออกแล้ว").length;
  const pendingUniformCount = uniformFiles.filter((f) => f.status !== "ลงแล้ว").length;

  const activeLabel = navItems.find((t) => t.id === activeTab)?.label || "";

  return (
    <div
      className="relative flex min-h-screen bg-cover bg-center bg-no-repeat bg-fixed font-sans antialiased text-zinc-300 selection:bg-white/20"
      style={{ backgroundImage: "url('/COUNCIL.PNG')" }}
    >
      {/* Background Overlay มืดลึกแบบภาพยนตร์ */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-[6px]" />

      <div className="relative z-10 flex w-full max-w-7xl mx-auto gap-6 p-4 md:p-8 items-start">

        {/* ─── Sidebar Navigation (Desktop) ─── */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 gap-6 bg-gradient-to-b from-zinc-900/40 to-zinc-950/60 backdrop-blur-xl border border-white/[0.06] rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] p-6 sticky top-8">
          <div>
            <h1 className="text-xs font-light text-zinc-500 tracking-[0.2em] uppercase">Cloud City</h1>
            <p className="text-lg font-extrabold text-white tracking-tight mt-1">Council Admin</p>
          </div>

          <nav className="flex flex-col gap-1.5">
            {navItems.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-3 h-11 px-4 text-xs font-medium rounded-xl transition-all duration-200 text-left ${
                  activeTab === tab.id
                    ? "bg-white/[0.08] text-white shadow-[0_4px_12px_rgba(0,0,0,0.2)] border border-white/[0.08] backdrop-blur-md"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02] border border-transparent"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-3 pt-6 border-t border-white/[0.06]">
            <div className="text-[10px] text-zinc-500 tracking-wide uppercase">เจ้าหน้าที่สภากลาง</div>
            <div className="text-sm font-semibold text-white truncate">{adminData?.name || adminData?.username}</div>
            <button onClick={handleLogout} className="w-full px-4 py-2 text-xs font-medium bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-white/[0.06] rounded-xl transition-all duration-200 active:scale-95 shadow-sm">
              🔒 Log Out
            </button>
          </div>
        </aside>

        {/* ─── Main Content ─── */}
        <main className="relative z-10 flex flex-1 flex-col gap-6 bg-gradient-to-b from-zinc-900/40 to-zinc-950/60 backdrop-blur-xl border border-white/[0.06] rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] p-6 md:p-10 min-w-0">

          {/* Top Header Bar */}
          <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-white/[0.06] pb-8">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-zinc-500 uppercase mb-2">
                <span>Dashboard</span>
                <span>/</span>
                <span className="text-zinc-300">{activeLabel}</span>
              </div>
              <p className="text-3xl font-extrabold text-white tracking-tight">{activeLabel}</p>
            </div>
            <button onClick={handleLogout} className="lg:hidden px-4 py-2 text-xs font-medium bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-white/[0.06] rounded-xl transition-all duration-200 active:scale-95 shadow-sm">
              🔒 Log Out
            </button>
          </div>

          {/* Mobile Tabs Navigation */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 w-full bg-black/[0.2] p-1.5 rounded-2xl border border-white/[0.04] lg:hidden">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 w-full">
            <div className="flex flex-col gap-1 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">แก๊งทั้งหมด</span>
              <span className="text-2xl font-bold text-white">{gangsList.length}</span>
            </div>
            <div className="flex flex-col gap-1 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">รออนุมัติแก๊ง</span>
              <span className="text-2xl font-bold text-amber-300">{pendingGangCount}</span>
            </div>
            <div className="flex flex-col gap-1 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">แก้ไขแก๊งรอตรวจ</span>
              <span className="text-2xl font-bold text-amber-300">{pendingEditCount}</span>
            </div>
            <div className="flex flex-col gap-1 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">คำขอยุบ</span>
              <span className="text-2xl font-bold text-red-400">{pendingDisbandCount}</span>
            </div>
            <div className="flex flex-col gap-1 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">สวัสดิการค้าง</span>
              <span className="text-2xl font-bold text-amber-300">{pendingWelfareCount}</span>
            </div>
            <div className="flex flex-col gap-1 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">ไฟล์ชุดรอนำเข้า</span>
              <span className="text-2xl font-bold text-amber-300">{pendingUniformCount}</span>
            </div>
            <div className="flex flex-col gap-1 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">พัก/รอพัก</span>
              <span className="text-2xl font-bold text-blue-400">{pendingPauseCount}</span>
            </div>
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

              {/* MENU 2: อนุมัติการแก้ไขแก๊ง */}
              {activeTab === "approve_gang_edit" && (
                <div className="flex flex-col w-full">
                  <div className="p-5 border-b border-white/[0.06] bg-white/[0.01]">
                    <h2 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">✏️ คำขอแก้ไขข้อมูลแก๊ง</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left whitespace-nowrap">
                      <thead className="bg-zinc-950/40 text-zinc-400 border-b border-white/[0.06] font-medium">
                        <tr>
                          <th className="px-6 py-4">แก๊ง</th>
                          <th className="px-6 py-4">ชื่อใหม่ [ย่อใหม่]</th>
                          <th className="px-6 py-4">หัวหน้าใหม่</th>
                          <th className="px-6 py-4">ประเภท</th>
                          <th className="px-6 py-4">โลโก้ใหม่</th>
                          <th className="px-6 py-4">เหตุผล</th>
                          <th className="px-6 py-4 text-center">จัดการคำขอ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04] text-zinc-300">
                        {editRequests.length === 0 ? (
                          <tr><td colSpan={7} className="text-center py-20 text-zinc-600 font-light tracking-wide">📭 ไม่มีคำขอแก้ไขแก๊งค้างในระบบ</td></tr>
                        ) : (
                          editRequests.map((req) => (
                            <tr key={req.id} className="hover:bg-white/[0.01] transition-colors">
                              <td className="px-6 py-4 font-bold text-white">{req.gang?.fullName} <span className="text-zinc-500 font-mono font-normal">[{req.gang?.abbreviation}]</span></td>
                              <td className="px-6 py-4 text-zinc-400">{req.fullName} <span className="text-zinc-600 font-mono">[{req.abbreviation}]</span></td>
                              <td className="px-6 py-4 text-zinc-400">{req.leader}</td>
                              <td className="px-6 py-4">
                                <span className={`text-[10px] font-medium px-2.5 py-1 rounded-md border ${
                                  req.type === 'Gangs-LD'
                                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                    : req.type === 'Family'
                                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                    : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                                }`}>
                                  {req.type || 'Gang'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-zinc-400">
                                {req.logoUrl ? (
                                  <div className="flex flex-col gap-1">
                                    <a href={req.logoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-[11px]">ดูโลโก้</a>
                                    <a href="https://imgbb.com/upload" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-zinc-200 text-[11px]">imgbb</a>
                                  </div>
                                ) : "-"}
                              </td>
                              <td className="px-6 py-4 text-zinc-400 max-w-[200px] truncate">{req.editReason || "-"}</td>
                              <td className="px-6 py-4 text-center flex justify-center gap-2">
                                <button onClick={() => handleApproveGangEdit(req.id, "approve")} className="px-4 py-1.5 bg-white/[0.08] hover:bg-white hover:text-black font-medium rounded-lg border border-white/[0.08] transition-all text-[11px] shadow-sm">อนุมัติ</button>
                                <button onClick={() => handleApproveGangEdit(req.id, "reject")} className="px-4 py-1.5 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-white/[0.04] rounded-lg transition-all text-[11px]">ปฏิเสธ</button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* MENU 3: อนุมัติยุบแก๊ง */}
              {activeTab === "approve_disband" && (
                <div className="flex flex-col w-full">
                  <div className="p-5 border-b border-white/[0.06] bg-white/[0.01]">
                    <h2 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">⚠️ คำขอยุบแก๊ง</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left whitespace-nowrap">
                      <thead className="bg-zinc-950/40 text-zinc-400 border-b border-white/[0.06] font-medium">
                        <tr>
                          <th className="px-6 py-4">แก๊ง</th>
                          <th className="px-6 py-4">หัวหน้า</th>
                          <th className="px-6 py-4">เหตุผล</th>
                          <th className="px-6 py-4 text-center">จัดการคำขอ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04] text-zinc-300">
                        {disbandRequests.length === 0 ? (
                          <tr><td colSpan={4} className="text-center py-20 text-zinc-600 font-light tracking-wide">📭 ไม่มีคำขอยุบแก๊งค้างในระบบ</td></tr>
                        ) : (
                          disbandRequests.map((req) => (
                            <tr key={req.id} className="hover:bg-white/[0.01] transition-colors">
                              <td className="px-6 py-4 font-bold text-white">{req.gang?.fullName} <span className="text-zinc-500 font-mono font-normal">[{req.gang?.abbreviation}]</span></td>
                              <td className="px-6 py-4 text-zinc-400">{req.gang?.leader}</td>
                              <td className="px-6 py-4 text-zinc-400 max-w-[200px] truncate">{req.reason || "-"}</td>
                              <td className="px-6 py-4 text-center flex justify-center gap-2">
                                <button onClick={() => handleApproveDisband(req.id, "approve")} className="px-4 py-1.5 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-300 font-medium rounded-lg border border-red-500/20 transition-all text-[11px] shadow-sm">อนุมัติยุบ</button>
                                <button onClick={() => handleApproveDisband(req.id, "reject")} className="px-4 py-1.5 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-white/[0.04] rounded-lg transition-all text-[11px]">ปฏิเสธ</button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* MENU 4: อนุมัติพักแก๊ง */}
              {activeTab === "approve_pause" && (
                <div className="flex flex-col w-full">
                  <div className="p-5 border-b border-white/[0.06] bg-white/[0.01]">
                    <h2 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">⏸️ คำขอพักแก๊ง</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left whitespace-nowrap">
                      <thead className="bg-zinc-950/40 text-zinc-400 border-b border-white/[0.06] font-medium">
                        <tr>
                          <th className="px-6 py-4">แก๊ง</th>
                          <th className="px-6 py-4">หัวหน้า</th>
                          <th className="px-6 py-4">เหตุผล</th>
                          <th className="px-6 py-4">สภาที่เลือก</th>
                          <th className="px-6 py-4">ระยะเวลา</th>
                          <th className="px-6 py-4">สถานะ</th>
                          <th className="px-6 py-4 text-center">จัดการคำขอ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04] text-zinc-300">
                        {pauseRequests.length === 0 ? (
                          <tr><td colSpan={7} className="text-center py-20 text-zinc-600 font-light tracking-wide">📭 ไม่มีคำขอพักแก๊งค้างในระบบ</td></tr>
                        ) : (
                          pauseRequests.map((req) => (
                            <tr key={req.id} className="hover:bg-white/[0.01] transition-colors">
                              <td className="px-6 py-4 font-bold text-white">{req.gang?.fullName} <span className="text-zinc-500 font-mono font-normal">[{req.gang?.abbreviation}]</span></td>
                              <td className="px-6 py-4 text-zinc-400">{req.gang?.leader}</td>
                              <td className="px-6 py-4 text-zinc-400 max-w-[200px] truncate">{req.reason || "-"}</td>
                              <td className="px-6 py-4 text-zinc-400">{req.approver || "-"}</td>
                              <td className="px-6 py-4 text-zinc-400">{req.durationDays ? `${req.durationDays} วัน` : "-"}</td>
                              <td className="px-6 py-4">
                                <span className={`text-[10px] font-medium px-2.5 py-1 rounded-md border ${
                                  req.status === 'approved'
                                    ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                                    : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                }`}>
                                  {req.status === 'approved' ? `⏸️ พักจนถึง ${new Date((req.endDate || "").replace(" ", "T")).toLocaleString("th-TH")}` : '⏳ รออนุมัติ'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center flex justify-center gap-2">
                                {req.status === "pending" ? (
                                  <>
                                    <button onClick={() => handlePauseAction(req.id, "approve")} className="px-4 py-1.5 bg-white/[0.08] hover:bg-white hover:text-black font-medium rounded-lg border border-white/[0.08] transition-all text-[11px] shadow-sm">อนุมัติ</button>
                                    <button onClick={() => handlePauseAction(req.id, "reject")} className="px-4 py-1.5 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-white/[0.04] rounded-lg transition-all text-[11px]">ปฏิเสธ</button>
                                  </>
                                ) : req.status === "approved" ? (
                                  <button onClick={() => handlePauseAction(req.id, "report")} className="px-4 py-1.5 bg-blue-500/10 hover:bg-blue-500 hover:text-white text-blue-300 font-medium rounded-lg border border-blue-500/20 transition-all text-[11px] shadow-sm">รายงานตัวแล้ว</button>
                                ) : null}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* MENU 5: ยืนยันสวัสดิการ */}
              {activeTab === "approve_welfare" && (
                <div className="flex flex-col w-full">
                  <div className="p-5 border-b border-white/[0.06] bg-white/[0.01]">
                    <h2 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">🎁 ระบบพิจารณาเบิกจ่ายสวัสดิการสภา</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left whitespace-nowrap">
                      <thead className="bg-zinc-950/40 text-zinc-400 border-b border-white/[0.06]">
                        <tr>
                          <th className="px-6 py-4">แก๊ง</th>
                          <th className="px-6 py-4">ผู้ยื่นเรื่อง</th>
                          <th className="px-6 py-4">ประเภท</th>
                          <th className="px-6 py-4">รายการ</th>
                          <th className="px-6 py-4">รายละเอียด</th>
                          <th className="px-6 py-4 text-center">การดำเนินการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04] text-zinc-300">
                        {welfareRequests.length === 0 ? (
                          <tr><td colSpan={6} className="text-center py-20 text-zinc-600 font-light tracking-wide">📭 ไม่มีคำขอสวัสดิการค้างในระบบ</td></tr>
                        ) : (
                          welfareRequests.map((req) => (
                            <tr key={req.id} className="hover:bg-white/[0.01] transition-colors">
                              <td className="px-6 py-4 font-semibold text-white">{req.gangName} <span className="text-zinc-500">[{req.gangAbbreviation || req.gangAbbr}]</span></td>
                              <td className="px-6 py-4">
                                <span className="block text-zinc-300 font-medium">{req.requestName}</span>
                                <span className="text-[10px] text-zinc-500 font-mono">{req.discordId}</span>
                                {(() => { const d = parseDetails(req.details); return d.requesterRole ? <span className="text-[10px] text-purple-300 block">({d.requesterRole})</span> : null; })()}
                                {(() => { const d = parseDetails(req.details); return d.requesterPhone ? <span className="text-[10px] text-zinc-400 block">📞 {d.requesterPhone}</span> : null; })()}
                              </td>
                              <td className="px-6 py-4 text-zinc-400">{welfareTypeLabel(req)}</td>
                              <td className="px-6 py-4 text-zinc-400">{translateWelfareItem(req.welfareItem)}</td>
                              <td className="px-6 py-4 text-zinc-400 max-w-[260px] truncate" title={formatWelfareDetails(req)}>{formatWelfareDetails(req)}</td>
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
                          <th className="px-6 py-4">สังกัด</th>
                          <th className="px-6 py-4">การลงชุด</th>
                          <th className="px-6 py-4">ลิงก์ทรัพยากร</th>
                          <th className="px-6 py-4">รายละเอียด</th>
                          <th className="px-6 py-4">สถานะ</th>
                          <th className="px-6 py-4 text-center">อัปเดตเมือง</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04] text-zinc-300">
                        {uniformFiles.length === 0 ? (
                          <tr><td colSpan={7} className="text-center py-20 text-zinc-600 font-light tracking-wide">📭 ไม่มีรายงานไฟล์โมเดลชุดเครื่องแบบเข้ามาในระบบ</td></tr>
                        ) : (
                          uniformFiles.map((file) => {
                            const details = formatUniformDetails(file);
                            return (
                            <tr key={file.id} className="hover:bg-white/[0.01] transition-colors">
                              <td className="px-6 py-4 font-semibold text-white">
                                {file.uniformType || details.piecesText || "-"}
                                {details.colorName && <span className="block text-[10px] text-teal-300">Color: {details.colorName} ({details.hexColor})</span>}
                                {details.contractUrl && <a href={details.contractUrl} target="_blank" rel="noreferrer" className="block text-[10px] text-blue-400 hover:underline">ดูใบสัญญา/รูปภาพ</a>}
                              </td>
                              <td className="px-6 py-4 text-zinc-400">{file.gangName}</td>
                              <td className="px-6 py-4">
                                <span className="text-[10px] px-2 py-1 rounded bg-white/[0.05] text-zinc-300 border border-white/[0.10]">{details.actionType || "ลงเพิ่ม"}</span>
                              </td>
                              <td className="px-6 py-4">
                                <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white underline underline-offset-4 transition-colors font-medium">📥 Download File</a>
                              </td>
                              <td className="px-6 py-4 text-zinc-400 max-w-[220px] truncate">
                                {details.piecesText ? details.piecesText : "-"}
                                {details.internalPhone && <span className="block text-[10px] text-zinc-500">📞 {details.internalPhone}</span>}
                              </td>
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
                            );
                          })
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
                    <h2 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">📋 รายชื่อแก๊งทั้งหมด</h2>
                  </div>
                  <div className="flex flex-col gap-6 p-4">
                    {[
                      { key: "Gang", label: "Gang" },
                      { key: "Gangs-LD", label: "Gang-LD" },
                      { key: "Family", label: "Family" },
                    ].map(({ key, label }) => {
                      const list = gangsList.filter(
                        (g) => (g.type || "Gang") === key
                      );
                      return (
                        <div key={key} className="flex flex-col gap-2">
                          <h3 className="text-sm font-bold text-zinc-200">🏷️ {label}</h3>
                          <div className="overflow-x-auto border border-white/[0.04] rounded-xl">
                            <table className="w-full text-xs text-left whitespace-nowrap">
                              <thead className="bg-zinc-950/40 text-zinc-400 border-b border-white/[0.06]">
                                <tr>
                                  <th className="px-6 py-4">รหัส</th>
                                  <th className="px-6 py-4">ชื่อแก๊ง [ย่อ]</th>
                                  <th className="px-6 py-4">หัวหน้า / รอง</th>
                                  <th className="px-6 py-4">สีแก๊ง</th>
                                  <th className="px-6 py-4">สถานะ</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/[0.04] text-zinc-300">
                                {list.length === 0 ? (
                                  <tr><td colSpan={5} className="text-center py-8 text-zinc-600 font-light tracking-wide">📭 ไม่มีข้อมูลในหมวด {label}</td></tr>
                                ) : (
                                  list.map((gang) => (
                                    <tr key={gang.id} className="hover:bg-white/[0.01] transition-colors">
                                      <td className="px-6 py-4 font-mono text-zinc-600">#{gang.id}</td>
                                      <td className="px-6 py-4 font-bold text-white">{gang.fullName} <span className="text-zinc-500 font-mono font-normal">[{gang.abbreviation}]</span></td>
                                      <td className="px-6 py-4 text-zinc-400">
                                        {gang.leader}
                                        {gang.coLeader1 && `, ${gang.coLeader1}`}
                                        {gang.coLeader2 && `, ${gang.coLeader2}`}
                                      </td>
                                      <td className="px-6 py-4">
                                        <div className="w-6 h-6 rounded-md border border-white/[0.1]" style={{ backgroundColor: gang.colorTheme || "#3b82f6" }} />
                                      </td>
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
                      );
                    })}
                  </div>
                </div>
              )}

              {/* MENU 5: สวัสดิการตามแก๊ง */}
              {activeTab === "welfare_by_gang" && (
                <div className="flex flex-col w-full">
                  <div className="p-5 border-b border-white/[0.06] bg-white/[0.01] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h2 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">🎁 สวัสดิการตามแก๊ง</h2>
                    <select
                      value={selectedGangAbbr}
                      onChange={(e) => setSelectedGangAbbr(e.target.value)}
                      className="h-9 px-3 rounded-lg bg-zinc-950 border border-white/[0.06] text-zinc-300 text-xs focus:outline-none"
                    >
                      <option value="">-- เลือกแก๊ง --</option>
                      {gangsList.map((gang) => (
                        <option key={gang.abbreviation} value={gang.abbreviation}>
                          {gang.fullName} [{gang.abbreviation}]
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left whitespace-nowrap">
                      <thead className="bg-zinc-950/40 text-zinc-400 border-b border-white/[0.06]">
                        <tr>
                          <th className="px-6 py-4">ผู้ยื่นเรื่อง</th>
                          <th className="px-6 py-4">ประเภท</th>
                          <th className="px-6 py-4">รายการของรางวัล</th>
                          <th className="px-6 py-4">รายละเอียด</th>
                          <th className="px-6 py-4">สถานะ</th>
                          <th className="px-6 py-4">วันที่ยื่น</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04] text-zinc-300">
                        {!selectedGangAbbr ? (
                          <tr><td colSpan={6} className="text-center py-20 text-zinc-600 font-light tracking-wide">👆 กรุณาเลือกแก๊งจากเมนูด้านบน</td></tr>
                        ) : welfareRequests.filter(r => r.gangAbbreviation === selectedGangAbbr).length === 0 ? (
                          <tr><td colSpan={6} className="text-center py-20 text-zinc-600 font-light tracking-wide">📭 ไม่มีประวัติการขอสวัสดิการของแก๊งนี้</td></tr>
                        ) : (
                          welfareRequests.filter(r => r.gangAbbreviation === selectedGangAbbr).map((req) => (
                            <tr key={req.id} className="hover:bg-white/[0.01] transition-colors">
                              <td className="px-6 py-4 font-medium text-white">
                                {req.requestName}
                                <span className="block text-zinc-500 font-mono">{req.discordId}</span>
                                {(() => { const d = parseDetails(req.details); return d.requesterRole ? <span className="text-[10px] text-purple-300 block">({d.requesterRole})</span> : null; })()}
                                {(() => { const d = parseDetails(req.details); return d.requesterPhone ? <span className="text-[10px] text-zinc-400 block">📞 {d.requesterPhone}</span> : null; })()}
                              </td>
                              <td className="px-6 py-4 text-zinc-400">{welfareTypeLabel(req)}</td>
                              <td className="px-6 py-4 text-zinc-400">{translateWelfareItem(req.welfareItem)}</td>
                              <td className="px-6 py-4 text-zinc-400 max-w-[220px] truncate" title={formatWelfareDetails(req)}>{formatWelfareDetails(req)}</td>
                              <td className="px-6 py-4">
                                <span className={`text-[10px] font-medium px-2.5 py-1 rounded-md border ${req.status === 'รับไปแล้ว' ? 'bg-white/[0.08] text-white border-white/[0.1]' : req.status === 'เอาออกแล้ว' ? 'bg-transparent text-zinc-600 border-transparent' : 'bg-white/[0.01] text-zinc-500 border-white/[0.04]'}`}>
                                  {req.status === 'รับไปแล้ว' ? '✓ ส่งมอบแล้ว' : req.status === 'เอาออกแล้ว' ? '✕ ยกเลิกคำขอ' : '⏳ รอรับ'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-zinc-500">{req.createdAt}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* MENU 6: จัดการรายการสวัสดิการ */}
              {activeTab === "welfare_items" && (
                <div className="flex flex-col w-full">
                  <div className="p-5 border-b border-white/[0.06] bg-white/[0.01]">
                    <h2 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">📦 จัดการรายการสวัสดิการ</h2>
                  </div>
                  <div className="p-5 flex flex-col gap-6">
                    <form onSubmit={handleSaveWelfareItem} className="grid grid-cols-1 sm:grid-cols-8 gap-4 items-end">
                      <div className="flex flex-col gap-2 sm:col-span-2">
                        <label className="text-xs font-medium text-zinc-400">ชื่อสวัสดิการ</label>
                        <input
                          type="text"
                          value={welfareItemName}
                          onChange={(e) => setWelfareItemName(e.target.value)}
                          placeholder="เช่น สวัสดิการอาวุธ"
                          className="w-full h-10 px-3 rounded-lg bg-zinc-950 border border-white/[0.06] text-zinc-200 text-xs focus:outline-none"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-2 sm:col-span-1">
                        <label className="text-xs font-medium text-zinc-400">ประเภท</label>
                        <input
                          type="text"
                          list="welfareTypeList"
                          value={welfareItemType}
                          onChange={(e) => setWelfareItemType(e.target.value)}
                          placeholder="เช่น weapon / car / ใหม่"
                          className="w-full h-10 px-3 rounded-lg bg-zinc-950 border border-white/[0.06] text-zinc-200 text-xs focus:outline-none"
                          required
                        />
                        <datalist id="welfareTypeList">
                          {Array.from(new Set(welfareItems.map((i) => i.type))).map((type) => (
                            <option key={type} value={type} />
                          ))}
                        </datalist>
                      </div>
                      <div className="flex flex-col gap-2 sm:col-span-1">
                        <label className="text-xs font-medium text-zinc-400">แก๊ง</label>
                        <input
                          type="number"
                          min="0"
                          value={welfareItemGangLimit}
                          onChange={(e) => setWelfareItemGangLimit(e.target.value)}
                          placeholder="ไม่จำกัด"
                          className="w-full h-10 px-3 rounded-lg bg-zinc-950 border border-white/[0.06] text-zinc-200 text-xs focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-2 sm:col-span-1">
                        <label className="text-xs font-medium text-zinc-400">แก๊งหญิง</label>
                        <input
                          type="number"
                          min="0"
                          value={welfareItemFemaleGangLimit}
                          onChange={(e) => setWelfareItemFemaleGangLimit(e.target.value)}
                          placeholder="ไม่จำกัด"
                          className="w-full h-10 px-3 rounded-lg bg-zinc-950 border border-white/[0.06] text-zinc-200 text-xs focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-2 sm:col-span-1">
                        <label className="text-xs font-medium text-zinc-400">ครอบครัว</label>
                        <input
                          type="number"
                          min="0"
                          value={welfareItemFamilyLimit}
                          onChange={(e) => setWelfareItemFamilyLimit(e.target.value)}
                          placeholder="ไม่จำกัด"
                          className="w-full h-10 px-3 rounded-lg bg-zinc-950 border border-white/[0.06] text-zinc-200 text-xs focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2 sm:col-span-2 items-end">
                        <button
                          type="button"
                          onClick={() => {
                            setNewTypeInput("");
                            setIsTypeModalOpen(true);
                          }}
                          className="h-10 px-4 rounded-lg bg-zinc-800 text-zinc-300 border border-white/10 hover:bg-zinc-700 text-xs font-medium transition-all"
                        >
                          ➕ เพิ่มประเภท
                        </button>
                        <button
                          type="submit"
                          className="h-10 px-4 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 text-xs font-medium transition-all"
                        >
                          {editingWelfareItemId ? "💾 บันทึก" : "➕ เพิ่ม"}
                        </button>
                        {editingWelfareItemId && (
                          <button
                            type="button"
                            onClick={resetWelfareItemForm}
                            className="h-10 px-4 rounded-lg bg-zinc-800 text-zinc-300 border border-white/10 hover:bg-zinc-700 text-xs font-medium transition-all"
                          >
                            ยกเลิก
                          </button>
                        )}
                      </div>
                    </form>

                    <Modal
                      isOpen={isTypeModalOpen}
                      onClose={() => setIsTypeModalOpen(false)}
                      title="เพิ่มประเภทสวัสดิการใหม่"
                    >
                      <div className="flex flex-col gap-4">
                        <input
                          type="text"
                          value={newTypeInput}
                          onChange={(e) => setNewTypeInput(e.target.value)}
                          placeholder="ชื่อประเภทใหม่ เช่น drone"
                          className="w-full h-10 px-3 rounded-lg bg-zinc-950 border border-white/[0.06] text-zinc-200 text-xs focus:outline-none"
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsTypeModalOpen(false)}
                            className="h-9 px-4 rounded-lg bg-zinc-800 text-zinc-300 border border-white/10 hover:bg-zinc-700 text-xs font-medium transition-all"
                          >
                            ยกเลิก
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!newTypeInput.trim()) {
                                alert("❌ กรุณากรอกชื่อประเภท");
                                return;
                              }
                              setWelfareItemType(newTypeInput.trim());
                              setNewTypeInput("");
                              setIsTypeModalOpen(false);
                            }}
                            className="h-9 px-4 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 text-xs font-medium transition-all"
                          >
                            ยืนยัน
                          </button>
                        </div>
                      </div>
                    </Modal>

                    <div className="overflow-x-auto border border-white/[0.04] rounded-xl">
                      <table className="w-full text-xs text-left whitespace-nowrap">
                        <thead className="bg-zinc-950/40 text-zinc-400 border-b border-white/[0.06]">
                          <tr>
                            <th className="px-6 py-4">ชื่อสวัสดิการ</th>
                            <th className="px-6 py-4">ประเภท</th>
                            <th className="px-6 py-4 text-center">แก๊ง</th>
                            <th className="px-6 py-4 text-center">แก๊งหญิง</th>
                            <th className="px-6 py-4 text-center">ครอบครัว</th>
                            <th className="px-6 py-4 text-center">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04] text-zinc-300">
                          {welfareItems.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-20 text-zinc-600 font-light tracking-wide">📭 ไม่มีรายการสวัสดิการในระบบ</td></tr>
                          ) : (
                            welfareItems.map((item) => (
                              <tr key={item.id} className="hover:bg-white/[0.01] transition-colors">
                                <td className="px-6 py-4 font-medium text-white">{item.name}</td>
                                <td className="px-6 py-4 text-zinc-400">
                                  <span className={`text-[10px] font-medium px-2.5 py-1 rounded-md border ${
                                    item.type === 'car' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : item.type === 'weapon' ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' : 'bg-zinc-500/10 text-zinc-300 border-zinc-500/20'
                                  }`}>
                                    {item.type === 'car' ? 'รถ' : item.type === 'weapon' ? 'อาวุธ' : item.type || 'อื่นๆ'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center text-zinc-400">{item.gang_limit === null || item.gang_limit === undefined ? 'ไม่จำกัด' : item.gang_limit}</td>
                                <td className="px-6 py-4 text-center text-zinc-400">{item.female_gang_limit === null || item.female_gang_limit === undefined ? 'ไม่จำกัด' : item.female_gang_limit}</td>
                                <td className="px-6 py-4 text-center text-zinc-400">{item.family_limit === null || item.family_limit === undefined ? 'ไม่จำกัด' : item.family_limit}</td>
                                <td className="px-6 py-4">
                                  <div className="flex justify-center gap-2">
                                    <button
                                      onClick={() => handleEditWelfareItem(item)}
                                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 text-[11px] transition-all"
                                    >
                                      แก้ไข
                                    </button>
                                    <button
                                      onClick={() => handleDeleteWelfareItem(item.id)}
                                      className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 text-[11px] transition-all"
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
                  </div>
                </div>
              )}

            </div>
          )}
          </div>

        </main>
      </div>
    </div>
  );
}