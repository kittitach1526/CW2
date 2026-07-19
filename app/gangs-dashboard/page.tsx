// app/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  createUniformFile,
  getAllUniformFiles,
  createGangEditRequest,
  getGangEditRequestByGang,
  createWelfareRequest,
  getWelfareRequestsByGang,
  requestDisbandGang,
  getDisbandRequestByGang,
  requestPauseGang,
  getPauseRequestByGang,
  getCouncilNames,
  getWelfareItems,
} from "../register";
import ImageUpload from "../components/ImageUpload";
import { useStatusModal } from "../components/StatusModalProvider";

export default function GangDashboard() {
  const router = useRouter();
  const showStatus = useStatusModal();
  const [gangData, setGangData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "edit" | "welfare" | "upload_uniform" | "view_uniforms" | "leave" | "pause" | "disband">("overview");
  const [loading, setLoading] = useState(false);
  const [colorTheme, setColorTheme] = useState("#3b82f6");
  const [uniformFiles, setUniformFiles] = useState<any[]>([]);
  const [welfareRequests, setWelfareRequests] = useState<any[]>([]);
  const [pendingEdit, setPendingEdit] = useState<any>(null);
  const [pendingDisband, setPendingDisband] = useState<any>(null);
  const [pendingPause, setPendingPause] = useState<any>(null);

  // รายชื่อสภาสำหรับ dropdown ผู้อนุมัติ
  const [councilNames, setCouncilNames] = useState<string[]>([]);

  // รายการสวัสดิการจากฐานข้อมูล
  const [welfareItems, setWelfareItems] = useState<{ id: number; name: string; type: string; gang_limit?: number | null; female_gang_limit?: number | null; family_limit?: number | null }[]>([]);

  const loadWelfareItems = async () => {
    const result = await getWelfareItems();
    if (result.success && Array.isArray(result.items)) {
      setWelfareItems(result.items);
    }
  };

  // แท็บย่อยของสวัสดิการ
  const [welfareSubTab, setWelfareSubTab] = useState<"receive" | "trade">("receive");

  // ฟอร์มเพิ่มไฟล์ชุด
  const [uniformForm, setUniformForm] = useState({
    fileUrl: "",
    approver: "",
    internalPhone: "",
    actionType: "ลงเพิ่ม" as "สวัสดิการ" | "แก้ไข" | "ลงเพิ่ม" | "ถูกชิงสี",
    pieces: { Suit: false, Hood: false, Armor: false, Mod: false },
    pieceNumbers: { Suit: "", Hood: "", Armor: "", Mod: "" },
    oldPieceNumbers: { Suit: "", Hood: "", Armor: "", Mod: "" },
    colorName: "",
    hexColor: "#3b82f6",
    contractUrl: "",
    uniformImageUrl: "",
    reason: "",
  });

  // ฟอร์มสวัสดิการ / เทรด / ออกลอย
  const [welfareForm, setWelfareForm] = useState({
    requesterName: "",
    requesterDiscord: "",
    requesterPhone: "",
    requesterRole: "Leader" as "Leader" | "Deputy",
    receiverName: "",
    receiverDiscord: "",
    receiverPhone: "",
    welfareItemId: "",
    welfareItemName: "",
    category: "" as string,
    carType: "Rebla" as string,
    licensePlate: "",
    carQuantity: "4",
    tradeHolderName: "",
    tradeHolderDiscord: "",
    tradeHolderPhone: "",
    tradeHolderWelfare: "",
    tradeToName: "",
    tradeToDiscord: "",
    tradeToPhone: "",
    approver: "",
  });

  // ฟอร์มออก - ออกลอย (แยกเป็นเมนูหลัก)
  const [leaveForm, setLeaveForm] = useState({
    requesterName: "",
    requesterDiscord: "",
    requesterPhone: "",
    requesterRole: "Leader" as "Leader" | "Deputy",
    leaveName: "",
    leaveDiscord: "",
    leavePhone: "",
    approver: "",
  });

  // ไม่มี state สำหรับแก้ไขลิงก์ไฟล์ในตาราง (ให้ใช้ช่องเหตุผลตอนเพิ่มชุดแทน)

  // 1. ดึงข้อมูลแก๊งจาก localStorage เมื่อเข้าสู่ระบบ
  useEffect(() => {
    const savedGang = localStorage.getItem("currentGang");
    if (!savedGang) {
      showStatus({ type: "error", message: "🔒 กรุณาเข้าสู่ระบบก่อนใช้งานหน้า Dashboard" });
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
    const approver = formData.get("approver") as string;

    if (!approver) {
      showStatus({ type: "error", message: "❌ กรุณาเลือกชื่อสภาที่อนุมัติ" });
      return;
    }

    if (!confirm("❗ ยืนยันการส่งเรื่องขอยุบแก๊งใช่หรือไม่ คำขอนี้จะส่งไปยังสภากลางเพื่อพิจารณา")) return;

    setLoading(true);
    try {
      const result = await requestDisbandGang(gangData.abbreviation, reason, approver);
      setLoading(false);

      showStatus({ type: result.success ? "success" : "error", message: result.message });
      if (result.success) {
        const res = await getDisbandRequestByGang(gangData.id);
        if (res.success) setPendingDisband(res.request);
      }
    } catch (error) {
      console.error(error);
      setLoading(false);
      showStatus({ type: "error", message: "❌ ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้ในขณะนี้" });
    }
  };

  const handlePauseGang = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!gangData?.abbreviation) return;

    const formData = new FormData(e.currentTarget);
    const reason = formData.get("reason") as string;
    const approver = formData.get("approver") as string;
    const durationDays = Number(formData.get("durationDays"));

    if (!reason || !approver || !durationDays) {
      showStatus({ type: "error", message: "❌ กรุณากรอกเหตุผล เลือกสภา และระบุจำนวนวันพัก" });
      return;
    }
    if (durationDays < 1 || durationDays > 30) {
      showStatus({ type: "error", message: "❌ สามารถพักแก๊งได้สูงสุดไม่เกิน 30 วัน" });
      return;
    }

    if (!confirm(`❗ ยืนยันการส่งเรื่องขอพักแก๊ง ${durationDays} วัน ใช่หรือไม่ คำขอนี้จะส่งไปยังสภากลางเพื่อพิจารณา`)) return;

    setLoading(true);
    try {
      const result = await requestPauseGang(gangData.abbreviation, reason, approver, durationDays);
      setLoading(false);

      showStatus({ type: result.success ? "success" : "error", message: result.message });
      if (result.success) {
        const res = await getPauseRequestByGang(gangData.id);
        if (res.success) setPendingPause(res.request);
      }
    } catch (error) {
      console.error(error);
      setLoading(false);
      showStatus({ type: "error", message: "❌ ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้ในขณะนี้" });
    }
  };

  // โหลดคำขอยุบแก๊งล่าสุด
  const loadPendingDisband = async (id: number) => {
    const result = await getDisbandRequestByGang(id);
    if (result.success) {
      setPendingDisband(result.request);
    }
  };

  // โหลดคำขอพักแก๊งล่าสุด
  const loadPendingPause = async (id: number) => {
    const result = await getPauseRequestByGang(id);
    if (result.success) {
      setPendingPause(result.request);
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

  // คำนวณจำนวนคงเหลือของรายการสวัสดิการตามประเภทแก๊ง
  const welfareRemaining = useMemo(() => {
    if (!gangData?.type) return {} as Record<number, { name: string; limit: number | null; used: number; remaining: number | null }>;
    const limitColumn =
      gangData.type === "Family"
        ? "family_limit"
        : gangData.type === "Gangs-LD"
        ? "female_gang_limit"
        : "gang_limit";
    const removedStatuses = ["เอาออกแล้ว", "เอาสวัสดิการออกแล้ว"];
    const result: Record<number, { name: string; limit: number | null; used: number; remaining: number | null }> = {};
    for (const item of welfareItems) {
      const limit = (item as any)[limitColumn] ?? null;
      const used = welfareRequests.filter(
        (r) =>
          r.welfareItem === item.name &&
          (!r.requestType || r.requestType === "receive") &&
          !removedStatuses.includes(r.status)
      ).length;
      const remaining = limit == null ? null : Math.max(0, limit - used);
      result[item.id] = { name: item.name, limit, used, remaining };
    }
    return result;
  }, [welfareItems, welfareRequests, gangData?.type]);

  // โหลดรายชื่อสภาสำหรับ dropdown ผู้อนุมัติ
  const loadCouncilNames = async () => {
    const result = await getCouncilNames();
    if (result.success && Array.isArray(result.names)) {
      setCouncilNames(result.names);
    }
  };

  // โหลดชื่อสภาเมื่อเข้าหน้า
  useEffect(() => {
    loadCouncilNames();
  }, []);

  // ปรับชิ้นส่วนชุดเริ่มต้นตามประเภทแก๊ง (ครอบครัวใส่ Hood ได้อย่างเดียว)
  useEffect(() => {
    if (!gangData?.type) return;
    if (gangData.type === "Family") {
      setUniformForm((prev) => ({
        ...prev,
        pieces: { Suit: false, Hood: true, Armor: false, Mod: false },
        pieceNumbers: { Suit: "", Hood: "", Armor: "", Mod: "" },
        oldPieceNumbers: { Suit: "", Hood: "", Armor: "", Mod: "" },
      }));
    }
  }, [gangData?.type]);

  // เรียกโหลดข้อมูลเมื่อยูสเซอร์สลับแท็บ
  useEffect(() => {
    if (activeTab === "view_uniforms") {
      loadUniformFiles();
    }
    if ((activeTab === "welfare" || activeTab === "leave") && gangData?.abbreviation) {
      loadWelfareRequests(gangData.abbreviation);
    }
    if (activeTab === "welfare") {
      loadWelfareItems();
    }
    if (activeTab === "pause" && gangData?.id) {
      loadPendingPause(gangData.id);
    }
  }, [activeTab, gangData]);

  // ➕ โหลดข้อมูลสรุปทันทีหลังเข้าสู่ระบบ เพื่อใช้แสดงสถิติในหน้าภาพรวม
  useEffect(() => {
    if (gangData?.id) {
      loadUniformFiles();
      loadWelfareRequests(gangData.abbreviation);
      loadPendingEdit(gangData.id);
      loadPendingDisband(gangData.id);
      loadPendingPause(gangData.id);
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
    showStatus({ type: result.success ? "success" : "error", message: result.message });
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

  // Helpers สำหรับฟอร์มชุด
  const pieceOptions = ["Suit", "Hood", "Armor", "Mod"] as const;
  const isUniformActionNeedOld = (actionType: string) =>
    actionType === "แก้ไข" || actionType === "ถูกชิงสี";
  const isUniformActionNeedContract = (actionType: string) => actionType === "ถูกชิงสี";
  const resetUniformForm = () => ({
    fileUrl: "",
    approver: "",
    internalPhone: "",
    actionType: "ลงเพิ่ม" as "สวัสดิการ" | "แก้ไข" | "ลงเพิ่ม" | "ถูกชิงสี",
    pieces: gangData?.type === "Family"
      ? { Suit: false, Hood: true, Armor: false, Mod: false }
      : { Suit: false, Hood: false, Armor: false, Mod: false },
    pieceNumbers: { Suit: "", Hood: "", Armor: "", Mod: "" },
    oldPieceNumbers: { Suit: "", Hood: "", Armor: "", Mod: "" },
    colorName: "",
    hexColor: "#3b82f6",
    contractUrl: "",
    uniformImageUrl: "",
    reason: "",
  });

  const handleUniformPieceToggle = (piece: (typeof pieceOptions)[number]) => {
    if (gangData?.type === "Family" && piece !== "Hood") return;
    setUniformForm((prev) => ({
      ...prev,
      pieces: { ...prev.pieces, [piece]: !prev.pieces[piece] } as typeof prev.pieces,
    }));
  };

  const handleUniformPieceNumberChange = (
    piece: (typeof pieceOptions)[number],
    value: string,
    type: "new" | "old"
  ) => {
    setUniformForm((prev) => ({
      ...prev,
      [type === "new" ? "pieceNumbers" : "oldPieceNumbers"]: {
        ...prev[type === "new" ? "pieceNumbers" : "oldPieceNumbers"],
        [piece]: value,
      } as typeof prev.pieceNumbers,
    }));
  };

  const parseDetails = (raw: any) => {
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  };

  // 🔄 ฟังก์ชันส่งคำขอสวัสดิการ / เทรด / ออกลอย
  const handleRequestWelfareSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!gangData) return;

    if (!welfareForm.requesterName || !welfareForm.requesterDiscord || !welfareForm.requesterPhone) {
      showStatus({ type: "error", message: "❌ กรุณากรอกชื่อ เลขดิสคอร์ด และเบอร์โทรผู้ยื่นเรื่อง" });
      return;
    }

    if (!welfareForm.approver) {
      showStatus({ type: "error", message: "❌ กรุณาเลือกชื่อสภาที่อนุมัติ" });
      return;
    }

    let requestType: "receive" | "trade" = "receive";
    let welfareItem = "";
    const details: any = { requesterRole: welfareForm.requesterRole, requesterPhone: welfareForm.requesterPhone };

    if (welfareSubTab === "receive") {
      requestType = "receive";
      if (!welfareForm.receiverName || !welfareForm.receiverDiscord || !welfareForm.receiverPhone) {
        showStatus({ type: "error", message: "❌ กรุณากรอกชื่อ เลขดิสคอร์ด และเบอร์โทรคนรับสวัสดิการ" });
        return;
      }
      if (!welfareForm.welfareItemId) {
        showStatus({ type: "error", message: "❌ กรุณาเลือกประเภทสวัสดิการ" });
        return;
      }
      const selectedItem = welfareItems.find((i) => String(i.id) === welfareForm.welfareItemId);
      if (!selectedItem) {
        showStatus({ type: "error", message: "❌ ไม่พบรายการสวัสดิการที่เลือก" });
        return;
      }
      details.receiverName = welfareForm.receiverName;
      details.receiverDiscord = welfareForm.receiverDiscord;
      details.receiverPhone = welfareForm.receiverPhone;
      details.welfareItemId = selectedItem.id;
      details.welfareItemName = selectedItem.name;
      details.category = selectedItem.type;
      if (selectedItem.type === "car") {
        if (!welfareForm.licensePlate) {
          showStatus({ type: "error", message: "❌ กรุณากรอกเลขทะเบียนรถ" });
          return;
        }
        details.carType = welfareForm.carType;
        details.licensePlate = welfareForm.licensePlate;
        details.carQuantity = welfareForm.carQuantity;
      }
      welfareItem = selectedItem.name;
    } else if (welfareSubTab === "trade") {
      requestType = "trade";
      if (
        !welfareForm.tradeHolderName ||
        !welfareForm.tradeHolderDiscord ||
        !welfareForm.tradeHolderPhone ||
        !welfareForm.tradeHolderWelfare ||
        !welfareForm.tradeToName ||
        !welfareForm.tradeToDiscord ||
        !welfareForm.tradeToPhone
      ) {
        showStatus({ type: "error", message: "❌ กรุณากรอกข้อมูลผู้ถือสวัสดิการและผู้รับเทรดให้ครบ" });
        return;
      }
      details.tradeHolderName = welfareForm.tradeHolderName;
      details.tradeHolderDiscord = welfareForm.tradeHolderDiscord;
      details.tradeHolderPhone = welfareForm.tradeHolderPhone;
      details.tradeHolderWelfare = welfareForm.tradeHolderWelfare;
      details.tradeToName = welfareForm.tradeToName;
      details.tradeToDiscord = welfareForm.tradeToDiscord;
      details.tradeToPhone = welfareForm.tradeToPhone;
      welfareItem = "เทรดสวัสดิการ";
    }

    setLoading(true);
    try {
      const result = await createWelfareRequest({
        gangName: gangData.fullName,
        gangAbbreviation: gangData.abbreviation,
        requestName: welfareForm.requesterName,
        discordId: welfareForm.requesterDiscord,
        welfareItem,
        requestType,
        approver: welfareForm.approver,
        details: JSON.stringify(details),
      });
      showStatus({ type: result.success ? "success" : "error", message: result.message });
      if (result.success) {
        setWelfareForm((prev) => ({
          ...prev,
          requesterName: "",
          requesterDiscord: "",
          requesterPhone: "",
          requesterRole: "Leader",
          receiverName: "",
          receiverDiscord: "",
          receiverPhone: "",
          welfareItemId: "",
          welfareItemName: "",
          category: "",
          licensePlate: "",
          tradeHolderName: "",
          tradeHolderDiscord: "",
          tradeHolderPhone: "",
          tradeHolderWelfare: "",
          tradeToName: "",
          tradeToDiscord: "",
          tradeToPhone: "",
          approver: "",
        }));
        loadWelfareRequests(gangData.abbreviation);
      }
    } catch (error) {
      console.error("Error submitting welfare request:", error);
      showStatus({ type: "error", message: "❌ ไม่สามารถเชื่อมต่อกับระบบได้ในขณะนี้" });
    } finally {
      setLoading(false);
    }
  };

  // ฟังก์ชันส่งคำขอออก - ออกลอย (เมนูหลัก)
  const handleLeaveSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!gangData) return;

    if (!leaveForm.requesterName || !leaveForm.requesterDiscord || !leaveForm.requesterPhone) {
      showStatus({ type: "error", message: "❌ กรุณากรอกชื่อ เลขดิสคอร์ด และเบอร์โทรผู้ยื่นเรื่อง" });
      return;
    }
    if (!leaveForm.leaveName || !leaveForm.leaveDiscord || !leaveForm.leavePhone) {
      showStatus({ type: "error", message: "❌ กรุณากรอกชื่อ เลขดิสคอร์ด และเบอร์โทรคนออก - ออกลอย" });
      return;
    }
    if (!leaveForm.approver) {
      showStatus({ type: "error", message: "❌ กรุณาเลือกชื่อสภาที่อนุมัติ" });
      return;
    }

    const details: any = { requesterRole: leaveForm.requesterRole, requesterPhone: leaveForm.requesterPhone, leaveName: leaveForm.leaveName, leaveDiscord: leaveForm.leaveDiscord, leavePhone: leaveForm.leavePhone };

    setLoading(true);
    const result = await createWelfareRequest({
      gangName: gangData.fullName,
      gangAbbreviation: gangData.abbreviation,
      requestName: leaveForm.requesterName,
      discordId: leaveForm.requesterDiscord,
      welfareItem: "ออก - ออกลอย",
      requestType: "leave",
      approver: leaveForm.approver,
      details: JSON.stringify(details),
    });
    setLoading(false);

    showStatus({
      type: result.success ? (result.hasWelfare ? "error" : "success") : "error",
      message: result.message,
    });
    if (result.success) {
      setLeaveForm({
        requesterName: "",
        requesterDiscord: "",
        requesterPhone: "",
        requesterRole: "Leader",
        leaveName: "",
        leaveDiscord: "",
        leavePhone: "",
        approver: "",
      });
      loadWelfareRequests(gangData.abbreviation);
    }
  };

  // ฟังก์ชันส่งไฟล์ชุด
  const handleUploadUniformSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!gangData) return;

    if (!uniformForm.approver || !uniformForm.fileUrl) {
      showStatus({ type: "error", message: "❌ กรุณากรอกข้อมูลให้ครบถ้วน" });
      return;
    }

    const selectedPieces = pieceOptions.filter((p) => uniformForm.pieces[p]);
    if (selectedPieces.length === 0) {
      showStatus({ type: "error", message: "❌ กรุณาเลือกชิ้นส่วนชุด" });
      return;
    }

    if (isUniformActionNeedOld(uniformForm.actionType)) {
      if (!uniformForm.colorName || !uniformForm.hexColor) {
        showStatus({ type: "error", message: "❌ กรุณาใส่ Color และ Hex Color" });
        return;
      }
    }

    if (isUniformActionNeedContract(uniformForm.actionType) && !uniformForm.contractUrl) {
      showStatus({ type: "error", message: "❌ กรุณาใส่ลิงก์ URL ใบสัญญาสภา (รูปภาพ)" });
      return;
    }

    setLoading(true);
    const piecesDetail = selectedPieces
      .map((p) => `${p}${uniformForm.pieceNumbers[p] ? ` #${uniformForm.pieceNumbers[p]}` : ""}`)
      .join(", ");
    const details = JSON.stringify({
      actionType: uniformForm.actionType,
      internalPhone: uniformForm.internalPhone,
      pieces: uniformForm.pieces,
      pieceNumbers: uniformForm.pieceNumbers,
      oldPieceNumbers: uniformForm.oldPieceNumbers,
      colorName: uniformForm.colorName,
      hexColor: uniformForm.hexColor,
      contractUrl: uniformForm.contractUrl,
      uniformImageUrl: uniformForm.uniformImageUrl,
      reason: uniformForm.reason,
    });

    const result = await createUniformFile({
      gangName: gangData.fullName,
      uniformType: piecesDetail,
      fileUrl: uniformForm.fileUrl,
      approver: uniformForm.approver,
      approverDiscord: "",
      reason: uniformForm.reason,
      details,
    });
    setLoading(false);

    showStatus({ type: result.success ? "success" : "error", message: result.message });
    if (result.success) {
      setUniformForm(resetUniformForm());
      setActiveTab("view_uniforms");
    }
  };

  // ฟังก์ชันแปลงค่า Value ของไอเทมสวัสดิการให้เป็นข้อความภาษาไทยสวยๆ ในตาราง
  const translateWelfareItem = (item: string) => {
    if (item === "car") return "🚗 กล่องยานพาหนะแก๊ง";
    if (item === "money") return "💰 เงินสนับสนุน (500,000 Roll)";
    if (item === "weapon") return "📦 เซ็ตอาวุธสงคราม (War Box)";
    if (item?.startsWith("อาวุธ:")) return `🔫 สวัสดิการอาวุธ ${item.replace("อาวุธ: ", "")}`;
    if (item?.startsWith("รถ:")) return `🚗 ${item.replace("รถ: ", "")}`;
    if (item === "เทรดสวัสดิการ") return "🔄 เทรดสวัสดิการ";
    if (item?.includes("ออก - ออกลอย")) return "🚪 ออก - ออกลอย";
    return item;
  };

  const WelfareRequestsTable = ({ requests, title, emptyText }: { requests: any[]; title: string; emptyText: string }) => (
    <div className="flex flex-col gap-4 w-full">
      <h2 className="text-lg font-bold text-pink-400">{title}</h2>
      <div className="overflow-x-auto w-full border border-white/10 rounded-xl bg-zinc-950/40">
        <table className="w-full text-sm text-left text-zinc-200">
          <thead className="text-xs bg-white/5 text-zinc-400 border-b border-white/10 uppercase">
            <tr>
              <th className="px-4 py-3">ผู้ยื่นเรื่อง / Discord</th>
              <th className="px-4 py-3">รายการ</th>
              <th className="px-4 py-3">รายละเอียด</th>
              <th className="px-4 py-3">วันที่ยื่น</th>
              <th className="px-4 py-3 text-center">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-zinc-500">
                  {emptyText}
                </td>
              </tr>
            ) : (
              requests.map((req) => {
                const details = parseDetails(req.details);
                let extra = "-";
                if (req.requestType === "receive") {
                  if (details.category === "weapon") {
                    extra = details.weaponType ? `อาวุธ: ${details.weaponType}` : "อาวุธ";
                  } else if (details.category === "car") {
                    extra = `รถ: ${details.carType || "-"} (${details.licensePlate || "-"}) ${details.carQuantity || "4"} คัน`;
                  } else {
                    extra = details.welfareItemName || req.welfareItem || "-";
                  }
                } else if (req.requestType === "trade") {
                  extra = `ถือ: ${details.tradeHolderName || "-"} (${details.tradeHolderPhone || "-"}) [${details.tradeHolderWelfare || "-"}] → รับ: ${details.tradeToName || "-"} (${details.tradeToPhone || "-"})`;
                } else if (req.requestType === "leave") {
                  extra = `${details.leaveName || "-"} (${details.leaveDiscord || "-"}) ${details.leavePhone || ""}`;
                }
                return (
                  <tr key={req.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-white block">{req.requestName}</span>
                      <span className="text-[11px] text-zinc-400 font-mono">ID: {req.discordId}</span>
                      {details.requesterRole && <span className="text-[11px] text-purple-300 block">({details.requesterRole})</span>}
                      {details.requesterPhone && <span className="text-[11px] text-zinc-400 block">📞 {details.requesterPhone}</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-200 font-medium">
                      {translateWelfareItem(req.welfareItem)}
                    </td>
                    <td className="px-4 py-3 text-zinc-300 text-xs max-w-[240px] truncate" title={extra}>
                      {extra}
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
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (!gangData) return <div className="text-white text-center mt-20">กำลังโหลดข้อมูลแผงควบคุม...</div>;

  const navItems = [
    { id: "overview", label: "ภาพรวมแก๊ง", icon: "📊" },
    { id: "edit", label: "แก้ไขข้อมูล", icon: "⚙️" },
    { id: "welfare", label: "ยื่นสวัสดิการ", icon: "🎁" },
    { id: "leave", label: "ออก - ออกลอย", icon: "🚪" },
    { id: "upload_uniform", label: "เพิ่มไฟล์ชุด", icon: "➕" },
    { id: "view_uniforms", label: "ดูไฟล์ทั้งหมด", icon: "📁" },
    { id: "pause", label: "พักแก๊ง", icon: "⏸️" },
    { id: "disband", label: "ยุบแก๊ง", icon: "⚠️" },
  ] as const;

  const activeLabel = navItems.find((t) => t.id === activeTab)?.label || "";
  const pendingWelfareCount = welfareRequests.filter((r) => r.status !== "รับไปแล้ว" && r.status !== "เอาออกแล้ว").length;
  const pendingUniformCount = uniformFiles.filter((f) => f.status !== "ลงแล้ว").length;
  const pendingDisbandCount = pendingDisband?.status === "pending" ? 1 : 0;
  const pendingPauseCount = pendingPause?.status === "pending" || pendingPause?.status === "approved" ? 1 : 0;

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
            <span className={`text-xs font-bold px-2.5 py-1 rounded-md w-fit ${
              gangData.status === "pending" ? "bg-amber-500/20 text-amber-300" :
              gangData.status === "พัก" ? "bg-blue-500/20 text-blue-300" :
              "bg-green-500/20 text-green-300"
            }`}>
              {gangData.status === "pending" ? "⏳ รอการอนุมัติ" :
               gangData.status === "พัก" ? "⏸️ กำลังพัก" :
               "✅ อนุมัติแล้ว"}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 w-full">
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
            <div className="flex flex-col gap-1 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">พัก/รอพัก</span>
              <span className="text-2xl font-bold text-blue-400">{pendingPauseCount}</span>
            </div>
          </div>

          {/* Workspace Container */}
          <div className="w-full bg-black/[0.1] rounded-2xl border border-white/[0.04] p-6 text-white min-h-[380px]">

          {/* แท็บ 1: ภาพรวมแก๊ง */}
          {activeTab === "overview" && (
            <div className="flex flex-col gap-6">
              <h2 className="text-lg font-bold text-blue-400">ข้อมูลทั่วไปของสภาแก๊ง</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-xs text-zinc-400 block mb-1">สถานะแก๊งในเมือง</span>
                  <span className={`text-sm font-bold px-2.5 py-1 rounded-md ${
                    gangData.status === "pending" ? "bg-amber-500/20 text-amber-300" :
                    gangData.status === "พัก" ? "bg-blue-500/20 text-blue-300" :
                    "bg-green-500/20 text-green-300"
                  }`}>
                    {gangData.status === "pending" ? "⏳ รอการอนุมัติ (Pending)" :
                     gangData.status === "พัก" ? "⏸️ กำลังพัก" :
                     "✅ อนุมัติแล้ว (Approved)"}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-xs text-zinc-400 block mb-1">รหัสลงทะเบียนระบบ (ID)</span>
                  <span className="text-sm font-mono font-bold">#000{gangData.id}</span>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-xs text-zinc-400 block mb-1">ประเภทแก๊ง</span>
                  <span className="text-sm font-bold text-white">{gangData.type || "Gang"}</span>
                </div>
              </div>

              <h3 className="text-sm font-bold text-zinc-200 mt-2">ข้อมูลผู้บริหารแก๊ง</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { role: "หัวหน้า", name: gangData.leader, discord: gangData.leaderDiscord, phone: gangData.leaderPhone },
                  { role: "รองหัวหน้า 1", name: gangData.coLeader1, discord: gangData.coLeader1Discord, phone: gangData.coLeader1Phone },
                  { role: "รองหัวหน้า 2", name: gangData.coLeader2, discord: gangData.coLeader2Discord, phone: gangData.coLeader2Phone },
                ].map((person) => (
                  <div key={person.role} className="p-4 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-2">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{person.role}</span>
                    <div className="text-sm font-bold text-white">{person.name || "-"}</div>
                    <div className="flex flex-col gap-1 text-xs text-zinc-300">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Discord</span>
                        <span className="font-mono">{person.discord || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">เบอร์โทร</span>
                        <span>{person.phone || "-"}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm">
                <p className="font-medium">ℹ️ ทุกคำขอที่แก๊งส่งจากระบบนี้ต้องรอให้สภากลางกดยืนยันก่อนจึงจะสำเร็จ</p>
                <ul className="list-disc list-inside text-xs text-blue-200/70">
                  {pendingEdit?.status === "pending" && <li>📝 มีคำขอแก้ไขข้อมูลแก๊งรออนุมัติ</li>}
                  {pendingWelfareCount > 0 && <li>🎁 มีคำขอสวัสดิการ {pendingWelfareCount} รายการรอรับ</li>}
                  {pendingUniformCount > 0 && <li>👕 มีไฟล์ชุด {pendingUniformCount} รายการรอนำเข้า</li>}
                  {pendingDisbandCount > 0 && <li>⚠️ มีคำขอยุบแก๊งรอพิจารณา</li>}
                  {pendingPause?.status === "pending" && <li>⏸️ มีคำขอพักแก๊งรอพิจารณา</li>}
                  {pendingPause?.status === "approved" && <li>⏸️ แก๊งกำลังพัก จนถึง {new Date((pendingPause.endDate || "").replace(" ", "T")).toLocaleString("th-TH")}</li>}
                  {pendingEdit?.status !== "pending" && pendingWelfareCount === 0 && pendingUniformCount === 0 && pendingDisbandCount === 0 && !pendingPause && <li>✅ ไม่มีคำขอใดๆ รอดำเนินการ</li>}
                </ul>
              </div>
            </div>
          )}

          {/* แท็บ 2: แก้ไขข้อมูลกลุ่มแก๊ง */}
          {activeTab === "edit" && (
            <form key={`${gangData?.id || "no"}-${pendingEdit?.id || "edit"}`} onSubmit={handleUpdateGang} className="flex flex-col gap-6 w-full text-white">
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
                  <input type="hidden" name="fullName" defaultValue={gangData.fullName} />
                  <div className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 flex items-center text-sm text-zinc-400">{gangData.fullName}</div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-200">ชื่อย่อ (Abbreviation)</label>
                  <input type="hidden" name="abbreviation" defaultValue={gangData.abbreviation} />
                  <div className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 flex items-center text-sm text-zinc-400">{gangData.abbreviation}</div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-200">ประเภทแก๊ง</label>
                  <input type="hidden" name="type" defaultValue={gangData.type || "Gang"} />
                  <div className="w-full h-11 px-4 rounded-xl bg-zinc-900 border border-white/10 flex items-center text-sm text-zinc-400">{gangData.type || "Gang"}</div>
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
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-zinc-200">URL โลโก้แก๊ง (Logo URL)</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      name="logoUrl"
                      defaultValue={pendingEdit ? pendingEdit.logoUrl : gangData.logoUrl || ""}
                      placeholder="เช่น https://imgur.com/your-gang-logo.png"
                      className="flex-1 h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-400 focus:outline-none text-sm"
                    />
                    <a
                      href="https://imgbb.com/upload"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-11 px-4 rounded-xl bg-zinc-800 text-zinc-200 border border-white/10 hover:bg-zinc-700 text-sm font-medium flex items-center justify-center transition-all"
                    >
                      อัปโหลดรูปที่ imgbb
                    </a>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-zinc-200">ชื่อสภาที่อนุมัติ</label>
                  <select
                    name="approver"
                    defaultValue={pendingEdit ? pendingEdit.approver || "" : ""}
                    className="w-full h-11 px-4 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:border-indigo-400 focus:outline-none"
                    required
                  >
                    <option value="">-- เลือกสภา --</option>
                    {councilNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-zinc-200">
                    หัวหน้า (Leader) {gangData.leader && <span className="text-xs text-zinc-500 font-normal">— ชื่อเก่า: {gangData.leader}</span>}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <input type="text" name="leader" placeholder={gangData.leader || "ชื่อ"} defaultValue={pendingEdit ? pendingEdit.leader : gangData.leader} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm" required />
                    <input type="text" name="leaderDiscord" placeholder={gangData.leaderDiscord || "เลขดิสคอร์ด"} defaultValue={pendingEdit ? pendingEdit.leaderDiscord : gangData.leaderDiscord} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm" required />
                    <input type="tel" name="leaderPhone" placeholder={gangData.leaderPhone || "เบอร์โทร"} defaultValue={pendingEdit ? pendingEdit.leaderPhone : gangData.leaderPhone} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm" />
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-zinc-200">
                    รองหัวหน้า 1 {gangData.coLeader1 && <span className="text-xs text-zinc-500 font-normal">— ชื่อเก่า: {gangData.coLeader1}</span>}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <input type="text" name="coLeader1" placeholder={gangData.coLeader1 || "ชื่อ"} defaultValue={pendingEdit ? pendingEdit.coLeader1 : gangData.coLeader1} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm" />
                    <input type="text" name="coLeader1Discord" placeholder={gangData.coLeader1Discord || "เลขดิสคอร์ด"} defaultValue={pendingEdit ? pendingEdit.coLeader1Discord : gangData.coLeader1Discord} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm" />
                    <input type="tel" name="coLeader1Phone" placeholder={gangData.coLeader1Phone || "เบอร์โทร"} defaultValue={pendingEdit ? pendingEdit.coLeader1Phone : gangData.coLeader1Phone} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm" />
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-zinc-200">
                    รองหัวหน้า 2 {gangData.coLeader2 && <span className="text-xs text-zinc-500 font-normal">— ชื่อเก่า: {gangData.coLeader2}</span>}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <input type="text" name="coLeader2" placeholder={gangData.coLeader2 || "ชื่อ"} defaultValue={pendingEdit ? pendingEdit.coLeader2 : gangData.coLeader2} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm" />
                    <input type="text" name="coLeader2Discord" placeholder={gangData.coLeader2Discord || "เลขดิสคอร์ด"} defaultValue={pendingEdit ? pendingEdit.coLeader2Discord : gangData.coLeader2Discord} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm" />
                    <input type="tel" name="coLeader2Phone" placeholder={gangData.coLeader2Phone || "เบอร์โทร"} defaultValue={pendingEdit ? pendingEdit.coLeader2Phone : gangData.coLeader2Phone} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm" />
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-zinc-200">เหตุผลการแก้ไขข้อมูลแก๊ง</label>
                  <textarea name="editReason" rows={3} defaultValue={pendingEdit ? pendingEdit.editReason : ""} placeholder="ระบุเหตุผลที่ต้องแก้ไขข้อมูลแก๊ง เช่น เปลี่ยนหัวหน้า, เปลี่ยนสีแก๊ง" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-400 focus:outline-none text-sm resize-none" required />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full h-12 mt-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 font-semibold hover:opacity-90 transition-all disabled:opacity-50">{loading ? "กำลังบันทึก..." : (pendingEdit?.status === "pending" ? "อัปเดตคำขอแก้ไข" : "ส่งคำขอแก้ไขข้อมูล")}</button>
            </form>
          )}

          {/* แท็บ 3: ยื่นสวัสดิการ / เทรด / ออกลอย */}
          {activeTab === "welfare" && (
            <div className="flex flex-col gap-8 w-full">
              <div className="flex gap-2 bg-black/20 p-1.5 rounded-2xl w-full sm:w-fit">
                {[
                  { id: "receive", label: "รับสวัสดิการ" },
                  { id: "trade", label: "เทรดสวัสดิการ" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setWelfareSubTab(tab.id as any)}
                    className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                      welfareSubTab === tab.id
                        ? "bg-white/10 text-white shadow"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {Object.keys(welfareRemaining).length > 0 && (
                <div className="flex flex-col gap-3 border border-white/10 p-4 rounded-xl bg-white/[0.02]">
                  <h3 className="text-sm font-bold text-purple-400">คงเหลือสวัสดิการ</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(welfareRemaining).map(([id, item]) => (
                      <div key={id} className="flex flex-col gap-1 p-3 rounded-lg bg-zinc-950 border border-white/[0.06]">
                        <span className="text-xs text-zinc-400">{item.name}</span>
                        <span className={`text-sm font-semibold ${item.remaining === 0 ? "text-red-400" : "text-white"}`}>
                          {item.remaining === null ? "ไม่จำกัด" : `จำนวน ${item.remaining} / ${item.limit}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleRequestWelfareSubmit} className="flex flex-col gap-5 w-full text-white border-b border-white/10 pb-8">
                <h2 className="text-lg font-bold text-purple-400">
                  {welfareSubTab === "receive" && "🎁 ฟอร์มขอรับสวัสดิการ"}
                  {welfareSubTab === "trade" && "🔄 ฟอร์มเทรดสวัสดิการ"}
                </h2>

                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
                  ⏳ คำขอจะถูกบันทึกเป็น "รอรับ" และต้องรอให้สภากลางกดยืนยันก่อนจึงจะสำเร็จ
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-200">คนยื่นเรื่อง (มีแค่ Leader หรือ Deputy เท่านั้น)</label>
                  <div className="flex gap-4">
                    {["Leader", "Deputy"].map((role) => (
                      <label key={role} className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                        <input
                          type="radio"
                          name="requesterRole"
                          value={role}
                          checked={welfareForm.requesterRole === role}
                          onChange={(e) => setWelfareForm({ ...welfareForm, requesterRole: e.target.value as any })}
                          className="accent-purple-500"
                          required
                        />
                        {role}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-zinc-200">ชื่อผู้ยื่นเรื่อง</label>
                    <input
                      type="text"
                      value={welfareForm.requesterName}
                      onChange={(e) => setWelfareForm({ ...welfareForm, requesterName: e.target.value })}
                      placeholder="ชื่อผู้ยื่นเรื่อง"
                      className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-purple-400 focus:outline-none"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-zinc-200">เลขดิสคอร์ดผู้ยื่นเรื่อง</label>
                    <input
                      type="text"
                      value={welfareForm.requesterDiscord}
                      onChange={(e) => setWelfareForm({ ...welfareForm, requesterDiscord: e.target.value })}
                      placeholder="เช่น 4583920194857201"
                      className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-purple-400 focus:outline-none"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-zinc-200">เบอร์โทรผู้ยื่นเรื่อง</label>
                    <input
                      type="tel"
                      value={welfareForm.requesterPhone}
                      onChange={(e) => setWelfareForm({ ...welfareForm, requesterPhone: e.target.value })}
                      placeholder="เบอร์โทร"
                      className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-purple-400 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                {welfareSubTab === "receive" && (
                  <div className="flex flex-col gap-4 border border-white/10 p-4 rounded-xl bg-white/[0.02]">
                    <h3 className="text-sm font-bold text-zinc-200">ข้อมูลคนรับสวัสดิการ</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-zinc-200">ชื่อคนรับสวัสดิการ</label>
                        <input
                          type="text"
                          value={welfareForm.receiverName}
                          onChange={(e) => setWelfareForm({ ...welfareForm, receiverName: e.target.value })}
                          placeholder="ชื่อคนรับสวัสดิการ"
                          className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-purple-400 focus:outline-none"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-zinc-200">เลขดิสคอร์ดคนรับสวัสดิการ</label>
                        <input
                          type="text"
                          value={welfareForm.receiverDiscord}
                          onChange={(e) => setWelfareForm({ ...welfareForm, receiverDiscord: e.target.value })}
                          placeholder="เช่น 4583920194857201"
                          className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-purple-400 focus:outline-none"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-zinc-200">เบอร์โทรคนรับสวัสดิการ</label>
                        <input
                          type="tel"
                          value={welfareForm.receiverPhone}
                          onChange={(e) => setWelfareForm({ ...welfareForm, receiverPhone: e.target.value })}
                          placeholder="เบอร์โทร"
                          className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-purple-400 focus:outline-none"
                          required
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-zinc-200">ประเภทสวัสดิการ</label>
                      <select
                        value={welfareForm.welfareItemId}
                        onChange={(e) => {
                          const selected = welfareItems.find((i) => String(i.id) === e.target.value);
                          setWelfareForm({
                            ...welfareForm,
                            welfareItemId: e.target.value,
                            welfareItemName: selected?.name || "",
                            category: selected?.type || "",
                          });
                        }}
                        className="w-full h-11 px-4 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:border-purple-400 focus:outline-none"
                      >
                        <option value="">-- เลือกสวัสดิการ --</option>
                        {welfareItems.map((item) => {
                          const rem = welfareRemaining[item.id];
                          return (
                            <option key={item.id} value={item.id}>
                              {item.name}
                              {rem && (rem.remaining === null ? " (ไม่จำกัด)" : ` (คงเหลือ ${rem.remaining})`)}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    {welfareForm.category === "car" && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="flex flex-col gap-2 sm:col-span-1">
                          <label className="text-sm font-medium text-zinc-200">รถที่ขอรับ</label>
                          <select
                            value={welfareForm.carType}
                            onChange={(e) => setWelfareForm({ ...welfareForm, carType: e.target.value as any })}
                            className="w-full h-11 px-4 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:border-purple-400 focus:outline-none"
                          >
                            <option value="Rebla">Rebla 150 Kg 4 EA</option>
                            <option value="Zeno">Zeno 4 EA</option>
                            <option value="Komoda">Komoda 4 EA</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-2 sm:col-span-2">
                          <label className="text-sm font-medium text-zinc-200">เลขทะเบียนรถ</label>
                          <input
                            type="text"
                            value={welfareForm.licensePlate}
                            onChange={(e) => setWelfareForm({ ...welfareForm, licensePlate: e.target.value })}
                            placeholder="เลขทะเบียนรถ"
                            className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-purple-400 focus:outline-none"
                            required
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {welfareSubTab === "trade" && (
                  <div className="flex flex-col gap-4 border border-white/10 p-4 rounded-xl bg-white/[0.02]">
                    <h3 className="text-sm font-bold text-zinc-200">ข้อมูลผู้ถือสวัสดิการในปัจจุบัน</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-zinc-200">ชื่อผู้ถือสวัสดิการ</label>
                        <input
                          type="text"
                          value={welfareForm.tradeHolderName}
                          onChange={(e) => setWelfareForm({ ...welfareForm, tradeHolderName: e.target.value })}
                          placeholder="ชื่อผู้ถือสวัสดิการ"
                          className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-purple-400 focus:outline-none"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-zinc-200">เลขดิสคอร์ดผู้ถือสวัสดิการ</label>
                        <input
                          type="text"
                          value={welfareForm.tradeHolderDiscord}
                          onChange={(e) => setWelfareForm({ ...welfareForm, tradeHolderDiscord: e.target.value })}
                          placeholder="เลขดิสคอร์ด"
                          className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-purple-400 focus:outline-none"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-zinc-200">เบอร์โทรผู้ถือสวัสดิการ</label>
                        <input
                          type="tel"
                          value={welfareForm.tradeHolderPhone}
                          onChange={(e) => setWelfareForm({ ...welfareForm, tradeHolderPhone: e.target.value })}
                          placeholder="เบอร์โทร"
                          className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-purple-400 focus:outline-none"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-zinc-200">สวัสดิการที่มีอยู่</label>
                        <select
                          value={welfareForm.tradeHolderWelfare}
                          onChange={(e) => setWelfareForm({ ...welfareForm, tradeHolderWelfare: e.target.value })}
                          className="w-full h-11 px-4 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:border-purple-400 focus:outline-none"
                          required
                        >
                          <option value="">-- เลือกสวัสดิการ --</option>
                          {welfareItems.map((item) => (
                            <option key={item.id} value={item.name}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <h3 className="text-sm font-bold text-zinc-200 mt-2">ข้อมูลผู้รับสวัสดิการต่อ</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-zinc-200">ชื่อคนรับเทรด</label>
                        <input
                          type="text"
                          value={welfareForm.tradeToName}
                          onChange={(e) => setWelfareForm({ ...welfareForm, tradeToName: e.target.value })}
                          placeholder="ชื่อคนรับเทรด"
                          className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-purple-400 focus:outline-none"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-zinc-200">เลขดิสคอร์ดคนรับเทรด</label>
                        <input
                          type="text"
                          value={welfareForm.tradeToDiscord}
                          onChange={(e) => setWelfareForm({ ...welfareForm, tradeToDiscord: e.target.value })}
                          placeholder="เลขดิสคอร์ด"
                          className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-purple-400 focus:outline-none"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-zinc-200">เบอร์โทรคนรับเทรด</label>
                        <input
                          type="tel"
                          value={welfareForm.tradeToPhone}
                          onChange={(e) => setWelfareForm({ ...welfareForm, tradeToPhone: e.target.value })}
                          placeholder="เบอร์โทร"
                          className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-purple-400 focus:outline-none"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-200">ชื่อสภาที่อนุมัติ</label>
                  <select
                    value={welfareForm.approver}
                    onChange={(e) => setWelfareForm({ ...welfareForm, approver: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:border-purple-400 focus:outline-none"
                    required
                  >
                    <option value="">-- เลือกสภา --</option>
                    {councilNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                <button type="submit" disabled={loading} className="w-full h-12 mt-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-semibold hover:opacity-90 transition-all disabled:opacity-50">
                  {loading ? "กำลังส่งคำขอ..." : "ส่งคำขอ"}
                </button>
              </form>

              {/* ตารางประวัติสวัสดิการ */}
              <WelfareRequestsTable
                requests={welfareRequests.filter((r) => r.requestType !== "leave")}
                title="📋 ตารางตรวจสอบสถานะสวัสดิการภายในแก๊ง"
                emptyText="❌ ยังไม่มีประวัติการยื่นขอรับสวัสดิการของแก๊งนี้ในระบบ"
              />
            </div>
          )}

          {/* แท็บ: ออก - ออกลอย */}
          {activeTab === "leave" && (
            <div className="flex flex-col gap-8 w-full">
              <form onSubmit={handleLeaveSubmit} className="flex flex-col gap-5 w-full text-white border-b border-white/10 pb-8">
                <h2 className="text-lg font-bold text-purple-400">🚪 ฟอร์มออก - ออกลอย [มีสวัสดิการ]</h2>

                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
                  ⏳ คำขอจะถูกบันทึกเป็น "รอรับ" และต้องรอให้สภากลางกดยืนยันก่อนจึงจะสำเร็จ
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-200">คนยื่นเรื่อง (มีแค่ Leader หรือ Deputy เท่านั้น)</label>
                  <div className="flex gap-4">
                    {["Leader", "Deputy"].map((role) => (
                      <label key={role} className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                        <input
                          type="radio"
                          name="leaveRequesterRole"
                          value={role}
                          checked={leaveForm.requesterRole === role}
                          onChange={(e) => setLeaveForm({ ...leaveForm, requesterRole: e.target.value as any })}
                          className="accent-purple-500"
                          required
                        />
                        {role}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-zinc-200">ชื่อผู้ยื่นเรื่อง</label>
                    <input
                      type="text"
                      value={leaveForm.requesterName}
                      onChange={(e) => setLeaveForm({ ...leaveForm, requesterName: e.target.value })}
                      placeholder="ชื่อผู้ยื่นเรื่อง"
                      className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-purple-400 focus:outline-none"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-zinc-200">เลขดิสคอร์ดผู้ยื่นเรื่อง</label>
                    <input
                      type="text"
                      value={leaveForm.requesterDiscord}
                      onChange={(e) => setLeaveForm({ ...leaveForm, requesterDiscord: e.target.value })}
                      placeholder="เช่น 4583920194857201"
                      className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-purple-400 focus:outline-none"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-zinc-200">เบอร์โทรผู้ยื่นเรื่อง</label>
                    <input
                      type="tel"
                      value={leaveForm.requesterPhone}
                      onChange={(e) => setLeaveForm({ ...leaveForm, requesterPhone: e.target.value })}
                      placeholder="เบอร์โทร"
                      className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-purple-400 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-4 border border-white/10 p-4 rounded-xl bg-white/[0.02]">
                  <h3 className="text-sm font-bold text-zinc-200">ข้อมูลคนออก - ออกลอย [มีสวัสดิการ]</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-zinc-200">ชื่อคนออก</label>
                      <input
                        type="text"
                        value={leaveForm.leaveName}
                        onChange={(e) => setLeaveForm({ ...leaveForm, leaveName: e.target.value })}
                        placeholder="ชื่อคนออก"
                        className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-purple-400 focus:outline-none"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-zinc-200">เลขดิสคอร์ดคนออก</label>
                      <input
                        type="text"
                        value={leaveForm.leaveDiscord}
                        onChange={(e) => setLeaveForm({ ...leaveForm, leaveDiscord: e.target.value })}
                        placeholder="เลขดิสคอร์ด"
                        className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-purple-400 focus:outline-none"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-zinc-200">เบอร์โทรคนออก</label>
                      <input
                        type="tel"
                        value={leaveForm.leavePhone}
                        onChange={(e) => setLeaveForm({ ...leaveForm, leavePhone: e.target.value })}
                        placeholder="เบอร์โทร"
                        className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-purple-400 focus:outline-none"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-200">ชื่อสภาที่อนุมัติ</label>
                  <select
                    value={leaveForm.approver}
                    onChange={(e) => setLeaveForm({ ...leaveForm, approver: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:border-purple-400 focus:outline-none"
                    required
                  >
                    <option value="">-- เลือกสภา --</option>
                    {councilNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                <button type="submit" disabled={loading} className="w-full h-12 mt-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-semibold hover:opacity-90 transition-all disabled:opacity-50">
                  {loading ? "กำลังส่งคำขอ..." : "ส่งคำขอ"}
                </button>
              </form>

              <WelfareRequestsTable
                requests={welfareRequests.filter((r) => r.requestType === "leave")}
                title="📋 ประวัติการออก - ออกลอย"
                emptyText="❌ ยังไม่มีประวัติการออก - ออกลอยของแก๊งนี้"
              />
            </div>
          )}

          {/* แท็บ 4: ฟอร์มเพิ่มไฟล์ชุดใหม่ */}
          {activeTab === "upload_uniform" && (
            <form onSubmit={handleUploadUniformSubmit} className="flex flex-col gap-5 w-full text-white">
              <h2 className="text-lg font-bold text-teal-400">👕 ฟอร์มเพิ่มไฟล์ชุด/เครื่องแต่งกายสภาแก๊ง</h2>

              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
                ⏳ ไฟล์ชุดจะถูกบันทึกเป็น "รอลง" และต้องรอให้สภากลางตรวจสอบและนำเข้าก่อนจึงจะสำเร็จ
              </div>

              <div className="flex flex-col gap-2 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                <label className="text-sm font-medium text-zinc-200">ตัวอย่างชุด</label>
                <Image
                  src="/ex.jpg"
                  alt="ตัวอย่างชุด"
                  width={1200}
                  height={675}
                  className="w-full h-auto rounded-xl border border-white/10 object-cover"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-200">ชื่อแก๊ง (Gang Name)</label>
                  <input type="text" value={gangData.fullName} className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-zinc-400 focus:outline-none" readOnly />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-200">เบอร์โทรภายในเมือง</label>
                  <input
                    type="text"
                    value={uniformForm.internalPhone}
                    onChange={(e) => setUniformForm({ ...uniformForm, internalPhone: e.target.value })}
                    placeholder="เบอร์โทรภายในเมือง"
                    className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-teal-400 focus:outline-none text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-200">ประเภทการลงชุด</label>
                  <select
                    value={uniformForm.actionType}
                    onChange={(e) => setUniformForm({ ...uniformForm, actionType: e.target.value as any })}
                    className="w-full h-11 px-4 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:border-teal-400 focus:outline-none"
                  >
                    <option value="สวัสดิการ">สวัสดิการ</option>
                    <option value="แก้ไข">แก้ไข</option>
                    <option value="ลงเพิ่ม">ลงเพิ่ม</option>
                    <option value="ถูกชิงสี">ถูกชิงสี</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-200">ลิงก์ดาวน์โหลดไฟล์ชุด (.zip / .gta5)</label>
                  <input
                    type="url"
                    value={uniformForm.fileUrl}
                    onChange={(e) => setUniformForm({ ...uniformForm, fileUrl: e.target.value })}
                    placeholder="เช่น https://drive.google.com/file/..."
                    className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-teal-400 focus:outline-none text-sm"
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-200">ผู้อนุมัติ (เลือกจากรายชื่อสภา)</label>
                  <select
                    value={uniformForm.approver}
                    onChange={(e) => setUniformForm({ ...uniformForm, approver: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:border-teal-400 focus:outline-none"
                    required
                  >
                    <option value="">-- เลือกผู้อนุมัติ --</option>
                    {councilNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-zinc-200">เหตุผล / หมายเหตุ (ถ้ามี)</label>
                  <input
                    type="text"
                    value={uniformForm.reason}
                    onChange={(e) => setUniformForm({ ...uniformForm, reason: e.target.value })}
                    placeholder="เช่น แก้ไขลิงก์เดิมเสีย หรืออัปเดตชุดใหม่"
                    className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-teal-400 focus:outline-none text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                <h3 className="text-sm font-bold text-zinc-200">
                  รายละเอียดชุด (Uniform Details)
                  {gangData.type === "Family" && <span className="text-teal-400 ml-2">สำหรับครอบครัว: Hood เท่านั้น</span>}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {pieceOptions.map((piece) => (
                    <label key={piece} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                      uniformForm.pieces[piece]
                        ? "bg-teal-500/10 border-teal-500/30 text-teal-300"
                        : "bg-white/5 border-white/10 text-zinc-400"
                    } ${gangData.type === "Family" && piece !== "Hood" ? "opacity-50 cursor-not-allowed" : ""}`}>
                      <input
                        type="checkbox"
                        checked={uniformForm.pieces[piece]}
                        onChange={() => handleUniformPieceToggle(piece)}
                        disabled={gangData.type === "Family" && piece !== "Hood"}
                        className="accent-teal-500"
                      />
                      {piece === "Suit" && "สูท (Suit)"}
                      {piece === "Hood" && "Hood"}
                      {piece === "Armor" && "เกราะ (Armor)"}
                      {piece === "Mod" && "ชุด MOD"}
                    </label>
                  ))}
                </div>

                {pieceOptions.filter((p) => uniformForm.pieces[p]).map((piece) => (
                  <div key={piece} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-zinc-200">{piece} - เลขชุด (ถ้ามี)</label>
                      <input
                        type="text"
                        value={uniformForm.pieceNumbers[piece]}
                        onChange={(e) => handleUniformPieceNumberChange(piece, e.target.value, "new")}
                        placeholder={`เลขชุด ${piece} (ถ้ามี)`}
                        className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-teal-400 focus:outline-none text-sm"
                      />
                    </div>
                    {isUniformActionNeedOld(uniformForm.actionType) && (
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-zinc-200">{piece} - เลขชุดเดิม (ถ้ามี)</label>
                        <input
                          type="text"
                          value={uniformForm.oldPieceNumbers[piece]}
                          onChange={(e) => handleUniformPieceNumberChange(piece, e.target.value, "old")}
                          placeholder={`เลขชุดเดิม ${piece} (ถ้ามี)`}
                          className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-teal-400 focus:outline-none text-sm"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {isUniformActionNeedOld(uniformForm.actionType) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-zinc-200">Color</label>
                    <input
                      type="text"
                      value={uniformForm.colorName}
                      onChange={(e) => setUniformForm({ ...uniformForm, colorName: e.target.value })}
                      placeholder="ชื่อสี"
                      className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-teal-400 focus:outline-none text-sm"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-zinc-200">Hex Color</label>
                    <div className="relative flex items-center gap-2">
                      <div className="relative w-11 h-11 rounded-xl border border-white/10 overflow-hidden bg-white/5">
                        <input
                          type="color"
                          value={uniformForm.hexColor}
                          onChange={(e) => setUniformForm({ ...uniformForm, hexColor: e.target.value })}
                          className="absolute inset-0 w-full h-full transform scale-150 cursor-pointer bg-transparent border-none p-0"
                        />
                      </div>
                      <div className="relative flex-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-400 font-mono font-bold">#</span>
                        <input
                          type="text"
                          value={uniformForm.hexColor.replace("#", "")}
                          onChange={(e) => { if (e.target.value.length <= 6) setUniformForm({ ...uniformForm, hexColor: `#${e.target.value}` }); }}
                          className="w-full h-11 pl-8 pr-4 rounded-xl bg-white/5 border border-white/10 text-sm font-mono uppercase text-white focus:outline-none"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <ImageUpload
                label={isUniformActionNeedContract(uniformForm.actionType) ? "ลิงก์รูปใบสัญญาสภา (บังคับสำหรับถูกชิงสี)" : "ลิงก์รูปภาพประกอบชุด (ถ้ามี)"}
                value={uniformForm.uniformImageUrl || uniformForm.contractUrl}
                onUploaded={(url) => setUniformForm({ ...uniformForm, contractUrl: url, uniformImageUrl: url })}
              />

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
                      <th className="px-4 py-3">การลงชุด</th>
                      <th className="px-4 py-3">ลิงก์ดาวน์โหลด</th>
                      <th className="px-4 py-3">สถานะ</th>
                      <th className="px-4 py-3">ผู้อนุมัติ</th>
                      <th className="px-4 py-3">วันที่ส่ง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uniformFiles.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-zinc-500">❌ ไม่พบประวัติข้อมูลไฟล์ชุดในระบบสภากลาง</td></tr>
                    ) : (
                      uniformFiles.map((file) => {
                        const details = parseDetails(file.details);
                        const selectedPieces = pieceOptions.filter((p) => details.pieces?.[p]);
                        const piecesText = selectedPieces.map((p) => {
                          const num = details.pieceNumbers?.[p];
                          const old = details.oldPieceNumbers?.[p];
                          return `${p}${num ? ` #${num}` : ""}${old ? ` (เดิม #${old})` : ""}`;
                        }).join(", ");
                        return (
                          <tr key={file.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-semibold text-white block">{file.uniformType || piecesText || "-"}</span>
                              {details.internalPhone && <span className="text-[11px] text-zinc-400 font-mono">📞 {details.internalPhone}</span>}
                              {details.colorName && <span className="text-[11px] text-teal-300 block">Color: {details.colorName} ({details.hexColor})</span>}
                              {details.contractUrl && <a href={details.contractUrl} target="_blank" rel="noreferrer" className="text-[11px] text-blue-400 hover:underline block">ดูใบสัญญา/รูปภาพ</a>}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[11px] px-2 py-1 rounded bg-white/5 text-zinc-300 border border-white/10">{details.actionType || "ลงเพิ่ม"}</span>
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
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* แท็บ 6: พักแก๊ง */}
          {activeTab === "pause" && (
            <div className="flex flex-col gap-5">
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <h2 className="text-lg font-bold text-blue-400 mb-1">⏸️ ขอพักแก๊งชั่วคราว</h2>
                <p className="text-xs text-blue-200/70">สามารถพักแก๊งได้สูงสุด 30 วัน หลังอนุมัติสภาจะกด "รายงานตัวแล้ว" เมื่อแก๊งรายงานตัว</p>
              </div>

              {pendingPause?.status === "pending" || pendingPause?.status === "approved" ? (
                <div className={`p-4 rounded-xl border text-sm ${
                  pendingPause.status === "approved"
                    ? "bg-blue-500/10 border-blue-500/20 text-blue-300"
                    : "bg-amber-500/10 border-amber-500/20 text-amber-300"
                }`}>
                  {pendingPause.status === "approved" ? (
                    <>
                      ⏸️ แก๊งของคุณกำลังพักอยู่
                      <span className="block text-xs mt-1 text-blue-200/70">
                        พักจนถึง {new Date((pendingPause.endDate || "").replace(" ", "T")).toLocaleString("th-TH")}
                      </span>
                    </>
                  ) : (
                    <>⏳ คำขอพักแก๊งของคุณกำลังรอการพิจารณาจากสภากลาง</>
                  )}
                </div>
              ) : (
                <form onSubmit={handlePauseGang} className="flex flex-col gap-5 w-full text-white">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-zinc-200">ชื่อสภาที่อนุมัติ</label>
                    <select
                      name="approver"
                      className="w-full h-11 px-4 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:border-blue-400 focus:outline-none"
                      required
                    >
                      <option value="">-- เลือกสภา --</option>
                      {councilNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-zinc-200">จำนวนวันที่ต้องการพัก (1-30 วัน)</label>
                    <input
                      type="number"
                      name="durationDays"
                      min={1}
                      max={30}
                      placeholder="เช่น 7"
                      className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-blue-400 focus:outline-none text-sm"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-zinc-200">เหตุผลการขอพักแก๊ง</label>
                    <textarea name="reason" rows={3} placeholder="ระบุเหตุผลที่ต้องการพักแก๊ง" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-400 focus:outline-none text-sm resize-none" />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="h-11 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-sm transition-all text-white disabled:opacity-50"
                  >
                    {loading ? "กำลังส่งเรื่อง..." : "ยืนยันการส่งเรื่องพักแก๊ง"}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* แท็บ 7: ยุบแก๊ง */}
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
                    <label className="text-sm font-medium text-zinc-200">ชื่อสภาที่อนุมัติ</label>
                    <select
                      name="approver"
                      className="w-full h-11 px-4 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:border-red-400 focus:outline-none"
                      required
                    >
                      <option value="">-- เลือกสภา --</option>
                      {councilNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>

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