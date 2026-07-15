// app/actions.ts
"use server";

import { db } from "../lib/db"; // 👈 เช็ก path ตรงนี้ให้ดีว่ามองเห็นไฟล์ db.ts แล้ว
import type { WelfareRequest } from "@prisma/client";

// ➕ Action สำหรับส่งคำขอยุบแก๊ง (ไม่อัปเดตสถานะทันที รอสภาอนุมัติ)
export async function requestDisbandGang(abbreviation: string, reason?: string) {
  try {
    if (!abbreviation) {
      return { success: false, message: "❌ ไม่พบข้อมูลชื่อย่อแก๊ง" };
    }

    const gang = await db.gang.findUnique({ where: { abbreviation } });
    if (!gang) {
      return { success: false, message: "❌ ไม่พบแก๊งในระบบ" };
    }

    const existing = await db.disbandRequest.findUnique({
      where: { gangId: gang.id },
    });

    if (existing && existing.status === "pending") {
      return { success: false, message: "⏳ คำขอยุบแก๊งนี้กำลังรอการอนุมัติจากสภากลางอยู่แล้ว" };
    }

    const thaiNow = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" });

    await db.disbandRequest.upsert({
      where: { gangId: gang.id },
      update: { status: "pending", reason: reason || null, createdAt: thaiNow, reviewedAt: null, reviewer: null },
      create: { gangId: gang.id, reason: reason || null, status: "pending", createdAt: thaiNow },
    });

    return { success: true, message: "⚠️ ส่งเรื่องขอยุบแก๊งไปยังระบบสภากลางเรียบร้อยแล้ว กรุณารอสภาพิจารณา" };
  } catch (error) {
    console.error("Disband Gang Error:", error);
    return { success: false, message: "❌ เกิดข้อผิดพลาดในระบบฐานข้อมูล" };
  }
}

// ดึงคำขอยุบแก๊งที่รออนุมัติทั้งหมด
export async function getPendingDisbandRequests() {
  try {
    const requests = await db.disbandRequest.findMany({
      where: { status: "pending" },
      include: {
        gang: {
          select: { id: true, fullName: true, abbreviation: true, leader: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, requests };
  } catch (error) {
    console.error("Get Pending Disband Requests Error:", error);
    return { success: false, requests: [] };
  }
}

// ดึงคำขอยุบแก๊งของแก๊งนั้นๆ
export async function getDisbandRequestByGang(gangId: number) {
  try {
    const request = await db.disbandRequest.findUnique({
      where: { gangId },
    });
    return { success: true, request };
  } catch (error) {
    console.error("Get Disband Request Error:", error);
    return { success: false, request: null };
  }
}

// อนุมัติคำขอยุบแก๊ง
export async function approveDisbandRequest(id: number, reviewer: string) {
  try {
    const request = await db.disbandRequest.findUnique({ where: { id } });
    if (!request || request.status !== "pending") {
      return { success: false, message: "❌ ไม่พบคำขอ หรือคำขอนี้ถูกดำเนินการไปแล้ว" };
    }

    const thaiNow = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" });

    await db.gang.update({
      where: { id: request.gangId },
      data: { status: "รอยุบ" },
    });

    await db.disbandRequest.update({
      where: { id },
      data: { status: "approved", reviewer, reviewedAt: thaiNow },
    });

    return { success: true, message: "✅ อนุมัติคำขอยุบแก๊งแล้ว สถานะแก๊งเปลี่ยนเป็น 'รอยุบ'" };
  } catch (error) {
    console.error("Approve Disband Request Error:", error);
    return { success: false, message: "❌ เกิดข้อผิดพลาดในการอนุมัติคำขอยุบแก๊ง" };
  }
}

// ปฏิเสธคำขอยุบแก๊ง
export async function rejectDisbandRequest(id: number, reviewer: string) {
  try {
    const request = await db.disbandRequest.findUnique({ where: { id } });
    if (!request || request.status !== "pending") {
      return { success: false, message: "❌ ไม่พบคำขอ หรือคำขอนี้ถูกดำเนินการไปแล้ว" };
    }

    const thaiNow = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" });

    await db.disbandRequest.update({
      where: { id },
      data: { status: "rejected", reviewer, reviewedAt: thaiNow },
    });

    return { success: true, message: "✕ ปฏิเสธคำขอยุบแก๊งแล้ว" };
  } catch (error) {
    console.error("Reject Disband Request Error:", error);
    return { success: false, message: "❌ เกิดข้อผิดพลาดในการปฏิเสธคำขอ" };
  }
}

export async function createRegistration(formData: FormData) {
  const fullName = formData.get("fullName") as string;
  const abbreviation = formData.get("abbreviation") as string;
  const password = formData.get("password") as string;
  const colorTheme = formData.get("colorTheme") as string;
  const logoUrl = formData.get("logoUrl") as string; 
  const type = formData.get("type") as string;
  
  // ➕ ดึงค่า Discord ID ของหัวหน้าและรองทั้ง 2 คนเพิ่มเข้ามาจากหน้าฟอร์ม
  const leader = formData.get("leader") as string;
  const leaderDiscord = formData.get("leaderDiscord") as string;
  const coLeader1 = formData.get("coLeader1") as string;
  const coLeader1Discord = formData.get("coLeader1Discord") as string;
  const coLeader2 = formData.get("coLeader2") as string;
  const coLeader2Discord = formData.get("coLeader2Discord") as string;
  
  const approver = formData.get("approver") as string;

  // 1. ตรวจสอบว่ากรอกฟิลด์ที่จำเป็นครบถ้วนหรือไม่ (เพิ่มตรวจสอบเลขดิสคอร์ดของหัวหน้าด้วย)
  if (!fullName || !abbreviation || !password || !type || !leader || !leaderDiscord || !approver) {
    return { success: false, message: "❌ กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน" };
  }

  try {
    // 2. 🛡️ เพิ่มระบบดักเช็กชื่อย่อซ้ำ (ป้องกันฐานข้อมูลพังจากเงื่อนไข @unique)
    const existingGang = await db.gang.findUnique({
      where: { abbreviation },
    });

    if (existingGang) {
      return { success: false, message: `⚠️ ชื่อย่อ "${abbreviation}" มีผู้ใช้งานในระบบแล้ว` };
    }

    // แปลงเวลาปัจจุบันเป็น String รูปแบบไทย (ป/ด/ว ชม:นาที:วิ) อ่านง่ายใน DBeaver
    const thaiNow = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" });

    // 3. สั่งบันทึกลงตาราง Gang
    await db.gang.create({
      data: {
        fullName,
        abbreviation,
        password,
        colorTheme,
        logoUrl: logoUrl || null,
        type,

        // บันทึกข้อมูลหัวหน้า + ดิสคอร์ด
        leader,
        leaderDiscord,

        // บันทึกข้อมูลรอง 1 + ดิสคอร์ด (ถ้าว่างใส่ null)
        coLeader1: coLeader1 || null,
        coLeader1Discord: coLeader1Discord || null,

        // บันทึกข้อมูลรอง 2 + ดิสคอร์ด (ถ้าว่างใส่ null)
        coLeader2: coLeader2 || null,
        coLeader2Discord: coLeader2Discord || null,

        approver,
        status: "pending",
        createdAt: thaiNow,
      },
    });

    return { success: true, message: "🎉 ลงทะเบียนแก๊งสำเร็จเรียบร้อยแล้วครับ!" };
  } catch (error) {
    console.error("Database Save Error:", error);
    return { success: false, message: "❌ เกิดข้อผิดพลาดในการบันทึกข้อมูลลงระบบ" };
  }
}

export async function loginGang(formData: FormData) {
  const abbreviation = formData.get("abbreviation") as string;
  const password = formData.get("password") as string;

  if (!abbreviation || !password) {
    return { success: false, message: "❌ กรุณากรอกข้อมูลให้ครบถ้วน" };
  }

  try {
    // 🔍 ค้นหาแก๊งจากชื่อย่อ
    const gang = await db.gang.findUnique({
      where: { abbreviation },
    });

    // ❌ ถ้าไม่เจอแก๊ง หรือ รหัสผ่านไม่ตรงกัน
    if (!gang || gang.password !== password) {
      return { success: false, message: "❌ ชื่อย่อหรือรหัสผ่านไม่ถูกต้อง" };
    }

    // 🔒 [เพิ่มเงื่อนไขล็อกอิน] ดักเช็กสถานะแก๊ง หากเป็นสถานะ "รอยุบ" จะไม่อนุญาตให้ Login เข้าสู่ระบบ
    if (gang.status === "รอยุบ") {
      return { 
        success: false, 
        message: "🔒 แก๊งนี้อยู่ในสถานะ 'รอยุบ' ระบบแผงควบคุมถูกระงับการเข้าใช้งานชั่วคราว" 
      };
    }

    // 🔒 ส่งข้อมูลแก๊งกลับไปให้หน้าบ้านจำ (รวมฟิลด์ Discord ID ทั้งหมดเพื่อให้หน้า Dashboard ดึงไปใช้แสดงผลหรือแก้ข้อมูลต่อได้)
    return {
      success: true,
      message: "🎉 เข้าสู่ระบบสำเร็จ!",
      gang: {
        id: gang.id,
        fullName: gang.fullName,
        abbreviation: gang.abbreviation,
        colorTheme: gang.colorTheme,
        logoUrl: gang.logoUrl,
        
        leader: gang.leader,
        leaderDiscord: gang.leaderDiscord, // ➕ ส่งกลับไป
        coLeader1: gang.coLeader1,
        coLeader1Discord: gang.coLeader1Discord, // ➕ ส่งกลับไป
        coLeader2: gang.coLeader2,
        coLeader2Discord: gang.coLeader2Discord, // ➕ ส่งกลับไป
        type: gang.type,
        approver: gang.approver,
        status: gang.status
      }
    };
  } catch (error) {
    console.error(error);
    return { success: false, message: "❌ ไม่พบข้อมูล" };
  }
}

// ➕ Action สำหรับส่งคำขอแก้ไขข้อมูลแก๊ง (ต้องรอสภาอนุมัติก่อน)
export async function createGangEditRequest(formData: FormData) {
  const gangId = Number(formData.get("id"));
  const fullName = formData.get("fullName") as string;
  const abbreviation = formData.get("abbreviation") as string;
  const colorTheme = formData.get("colorTheme") as string;
  const password = formData.get("password") as string;
  const leader = formData.get("leader") as string;
  const leaderDiscord = formData.get("leaderDiscord") as string;
  const coLeader1 = formData.get("coLeader1") as string;
  const coLeader1Discord = formData.get("coLeader1Discord") as string;
  const coLeader2 = formData.get("coLeader2") as string;
  const coLeader2Discord = formData.get("coLeader2Discord") as string;
  const editReason = formData.get("editReason") as string;
  const type = formData.get("type") as string;

  if (!gangId || !fullName || !abbreviation || !leader || !leaderDiscord || !type) {
    return { success: false, message: "❌ กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน" };
  }

  try {
    const existing = await db.gang.findUnique({ where: { id: gangId } });
    if (!existing) {
      return { success: false, message: "❌ ไม่พบแก๊งในระบบ" };
    }

    // ตรวจสอบชื่อย่อไม่ให้ซ้ำกับแก๊งอื่นในระบบ
    if (abbreviation !== existing.abbreviation) {
      const taken = await db.gang.findUnique({ where: { abbreviation } });
      if (taken) {
        return { success: false, message: "❌ ชื่อย่อแก๊งนี้ถูกใช้งานแล้ว" };
      }
    }

    const thaiNow = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" });

    const payload = {
      fullName,
      abbreviation,
      colorTheme,
      leader,
      leaderDiscord,
      coLeader1: coLeader1 || null,
      coLeader1Discord: coLeader1Discord || null,
      coLeader2: coLeader2 || null,
      coLeader2Discord: coLeader2Discord || null,
      type,
      editReason: editReason || null,
      newPassword: password ? password.trim() : null,
    };

    // ถ้ามีคำขอแก้ไขที่กำลังรออยู่ ให้อัปเดตทับแทน
    const pending = await db.gangEditRequest.findFirst({
      where: { gangId, status: "pending" },
    });

    if (pending) {
      const updated = await db.gangEditRequest.update({
        where: { id: pending.id },
        data: { ...payload, createdAt: thaiNow },
      });
      return { success: true, message: "📝 อัปเดตคำขอแก้ไขข้อมูลที่รออนุมัติสำเร็จแล้ว", editRequest: updated };
    }

    const created = await db.gangEditRequest.create({
      data: { gangId, ...payload, createdAt: thaiNow },
    });

    return { success: true, message: "📝 ส่งคำขอแก้ไขข้อมูลแก๊งไปยังสภากลางแล้ว กรุณารออนุมัติ", editRequest: created };
  } catch (error) {
    console.error("Create Gang Edit Request Error:", error);
    return { success: false, message: "❌ เกิดข้อผิดพลาดในการส่งคำขอแก้ไขข้อมูล" };
  }
}

// ดึงคำขอแก้ไขแก๊งที่รออนุมัติทั้งหมด
export async function getPendingGangEditRequests() {
  try {
    const requests = await db.gangEditRequest.findMany({
      where: { status: "pending" },
      include: {
        gang: {
          select: { id: true, fullName: true, abbreviation: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, requests };
  } catch (error) {
    console.error("Get Pending Gang Edit Requests Error:", error);
    return { success: false, requests: [] };
  }
}

// ดึงคำขอแก้ไขล่าสุดของแก๊ง
export async function getGangEditRequestByGang(gangId: number) {
  try {
    const request = await db.gangEditRequest.findFirst({
      where: { gangId, status: "pending" },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, request };
  } catch (error) {
    console.error("Get Gang Edit Request Error:", error);
    return { success: false, request: null };
  }
}

// อนุมัติคำขอแก้ไขแก๊ง
export async function approveGangEditRequest(id: number, reviewer: string) {
  try {
    const request = await db.gangEditRequest.findUnique({ where: { id } });
    if (!request || request.status !== "pending") {
      return { success: false, message: "❌ ไม่พบคำขอ หรือคำขอนี้ถูกดำเนินการไปแล้ว" };
    }

    const thaiNow = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" });

    await db.gang.update({
      where: { id: request.gangId },
      data: {
        fullName: request.fullName,
        abbreviation: request.abbreviation,
        colorTheme: request.colorTheme,
        leader: request.leader,
        leaderDiscord: request.leaderDiscord,
        coLeader1: request.coLeader1,
        coLeader1Discord: request.coLeader1Discord,
        coLeader2: request.coLeader2,
        coLeader2Discord: request.coLeader2Discord,
        type: request.type,
        editReason: request.editReason,
        ...(request.newPassword ? { password: request.newPassword } : {}),
      },
    });

    await db.gangEditRequest.update({
      where: { id },
      data: { status: "approved", reviewer, reviewedAt: thaiNow },
    });

    return { success: true, message: "✅ อนุมัติการแก้ไขข้อมูลแก๊งสำเร็จแล้ว" };
  } catch (error) {
    console.error("Approve Gang Edit Request Error:", error);
    return { success: false, message: "❌ เกิดข้อผิดพลาดในการอนุมัติคำขอ" };
  }
}

// ปฏิเสธคำขอแก้ไขแก๊ง
export async function rejectGangEditRequest(id: number, reviewer: string) {
  try {
    const request = await db.gangEditRequest.findUnique({ where: { id } });
    if (!request || request.status !== "pending") {
      return { success: false, message: "❌ ไม่พบคำขอ หรือคำขอนี้ถูกดำเนินการไปแล้ว" };
    }

    const thaiNow = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" });

    await db.gangEditRequest.update({
      where: { id },
      data: { status: "rejected", reviewer, reviewedAt: thaiNow },
    });

    return { success: true, message: "✕ ปฏิเสธคำขอแก้ไขข้อมูลแก๊งแล้ว" };
  } catch (error) {
    console.error("Reject Gang Edit Request Error:", error);
    return { success: false, message: "❌ เกิดข้อผิดพลาดในการปฏิเสธคำขอ" };
  }
}

// ➕ ปรับปรุง Action: บันทึกไฟล์ชุดโดยรับรายละเอียดประเภทชุดและเหตุผลเพิ่ม และกำหนดสถานะเริ่มต้นเป็น "รอลง"
export async function createUniformFile(formData: FormData) {
  const gangName = formData.get("gangName") as string;
  const uniformType = formData.get("uniformType") as string; // 👈 ดึงค่าว่าคือชุดอะไรเพิ่มเข้ามา
  const fileUrl = formData.get("fileUrl") as string;
  const approver = formData.get("approver") as string;
  const approverDiscord = formData.get("approverDiscord") as string;
  const reason = formData.get("reason") as string | null;

  if (!gangName || !uniformType || !fileUrl || !approver || !approverDiscord) {
    return { success: false, message: "❌ กรุณากรอกข้อมูลไฟล์ชุดให้ครบถ้วน" };
  }

  try {
    const thaiNow = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" });

    await db.uniformFile.create({
      data: {
        gangName,
        uniformType, // 👈 บันทึกประเภทชุด
        fileUrl,
        approver,
        approverDiscord,
        reason: reason || null, // 👈 บันทึกเหตุผล (ถ้ามี)
        status: "รอลง", // 👈 ตั้งค่าเริ่มต้นเป็น "รอลง" ให้แอดมินมาจัดการภายหลัง
        createdAt: thaiNow,
      },
    });

    return { success: true, message: "🎉 เพิ่มไฟล์ชุดเรียบร้อยแล้ว!" };
  } catch (error) {
    console.error(error);
    return { success: false, message: "❌ เกิดข้อผิดพลาดในการบันทึกไฟล์ชุด" };
  }
}

// ➕ Action สำหรับดึงข้อมูลไฟล์ชุดทั้งหมดขึ้นมาแสดงผลในตาราง (คงเดิม)
export async function getAllUniformFiles() {
  try {
    const files = await db.uniformFile.findMany({
      orderBy: { id: "desc" }, // เอาไฟล์ใหม่ล่าสุดขึ้นก่อน
    });
    return { success: true, files };
  } catch (error) {
    console.error(error);
    return { success: false, message: "❌ ไม่สามารถดึงข้อมูลไฟล์ชุดได้" };
  }
}

// ➕ Action ใหม่สำหรับกด "อัปเดต/เปลี่ยนลิงก์ไฟล์ชุด" จากฝั่งผู้ใช้ หน้าแดชบอร์ดแก๊ง
export async function updateUniformFileLink(id: number, newFileUrl: string, reason: string) {
  if (!newFileUrl) {
    return { success: false, message: "❌ กรุณากรอกลิงก์ไฟล์ใหม่" };
  }

  if (!reason || !reason.trim()) {
    return { success: false, message: "❌ กรุณากรอกเหตุผลการเปลี่ยนลิงก์ไฟล์ชุด" };
  }

  try {
    await db.uniformFile.update({
      where: { id },
      data: { 
        fileUrl: newFileUrl,
        reason: reason.trim(),
        status: "รอลง" // 🔄 เมื่อยูสเซอร์เปลี่ยนไฟล์ชุดแล้ว ให้รีเซ็ตกลับเป็น "รอลง" เพื่อให้แอดมินตรวจเช็กและลงใหม่อีกครั้ง
      },
    });
    return { success: true, message: "🔄 อัปเดตลิงก์ไฟล์ชุดใหม่ พร้อมเหตุผลเรียบร้อย ส่งเรื่องให้แอดมินตรวจสอบแล้ว!" };
  } catch (error) {
    console.error(error);
    return { success: false, message: "❌ ไม่สามารถอัปเดตไฟล์ชุดได้" };
  }
}

export async function createWelfareRequest(formData: FormData) {
  try {
    const gangName = formData.get("gangName") as string;
    const gangAbbreviation = formData.get("gangAbbr") as string;
    const requestName = formData.get("requestName") as string;
    const discordId = formData.get("discordId") as string;
    const welfareItem = formData.get("welfareItem") as string;

    if (!requestName || !discordId || !welfareItem) {
      return { success: false, message: "❌ กรุณากรอกข้อมูลให้ครบถ้วน" };
    }

    await db.welfareRequest.create({
      data: {
        gangName,
        gangAbbreviation,
        requestName,
        discordId,
        welfareItem,
        status: "รอรับ", // ค่าเริ่มต้นตาม Model
      },
    });

    return { success: true, message: "📦 ส่งคำขอรับสวัสดิการไปยังระบบสภากลางเรียบร้อยแล้ว!" };
  } catch (error) {
    console.error(error);
    return { success: false, message: "❌ เกิดข้อผิดพลาดในระบบฐานข้อมูล" };
  }
}

// 2. ฟังก์ชันดึงข้อมูลสวัสดิการทั้งหมดของแก๊งนั้นๆ
export async function getWelfareRequestsByGang(gangAbbreviation: string) {
  try {
    const requests = await db.welfareRequest.findMany({
      where: {
        gangAbbreviation: gangAbbreviation,
      },
      orderBy: {
        createdAt: "desc", // เอาข้อมูลใหม่ขึ้นก่อน
      },
    });

    // แปลงข้อมูลวันที่ให้อ่านง่ายก่อนส่งกลับไป Client Component
    const formattedRequests = requests.map((req: WelfareRequest) => ({
      ...req,
      createdAt: req.createdAt.toLocaleString("th-TH"), 
    }));

    return { success: true, requests: formattedRequests };
  } catch (error) {
    console.error(error);
    return { success: false, requests: [], message: "❌ ไม่สามารถโหลดข้อมูลสวัสดิการได้" };
  }
}

export async function loginCouncil(formData: FormData) {
  const username = formData.get("username");
  const password = formData.get("password");

  // ดักจับประเภทข้อมูลให้ชัวร์ว่าเป็น String และไม่เป็นค่าว่าง
  if (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password.trim()) {
    return { success: false, message: "❌ กรุณากรอกข้อมูลให้ครบถ้วน" };
  }

  try {
    // 1. ค้นหาผู้ใช้จากฐานข้อมูลกลางสภา
    const councilUser = await db.council.findFirst({
      where: { username: username.trim() },
    });

    // ถ้าไม่พบในระบบ
    if (!councilUser) {
      console.log(`[AUTH] ไม่พบชื่อผู้ใช้ในระบบ: ${username}`);
      return { success: false, message: "❌ ไม่พบชื่อผู้ใช้ในระบบ" };
    }

    // 2. ตรวจสอบรหัสผ่าน (หากระบบจริงแนะนำให้ใช้ bcrypt.compare)
    if (councilUser.password !== password) {
      return { success: false, message: "❌ รหัสผ่านไม่ถูกต้อง" };
    }

    // 3. ตรวจสอบสถานะการเปิดสิทธิ์ใช้งาน
    if (councilUser.status === "ระงับใช้งาน") {
      return { success: false, message: "🔒 บัญชีนี้ถูกสภากลางระงับการใช้งานแล้ว" };
    }

    // ส่งข้อมูลกลับไปยัง Client (ตรวจคีย์ปลายทางให้ตรงกับหน้าจอนะครับ)
    return {
      success: true,
      message: "🎉 เข้าสู่ระบบสภากลางสำเร็จ!",
      council: {
        id: councilUser.id,
        name: councilUser.name,
        username: councilUser.username,
        status: councilUser.status,
      }
    };
  } catch (error) {
    console.error("🚨 DATABASE DEBUG ERROR:", error);
    return { success: false, message: "❌ ฐานข้อมูลระบบสภาขัดข้อง (ดู Terminal)" };
  }
}

export async function getAllGangs() {
  try {
    const gangs = await db.gang.findMany({
      orderBy: { id: "desc" }, // เอาแก๊งที่สมัครล่าสุดขึ้นก่อน
    });
    return { success: true, gangs };
  } catch (error) {
    console.error("Get All Gangs Error:", error);
    return { success: false, gangs: [], message: "❌ ไม่สามารถดึงข้อมูลรายชื่อแก๊งได้" };
  }
}

/**
 * 🛡️ 2. เปลี่ยนสถานะและอนุมัติสิทธิ์ของแก๊ง (ยืนยันแก๊ง / ระงับแก๊ง)
 */
export async function updateGangStatus(id: number, status: "approved" | "disbanded" | "pending" | "รอยุบ") {
  try {
    if (!id || !status) {
      return { success: false, message: "❌ ข้อมูลไม่ครบถ้วนสำหรับการเปลี่ยนสถานะ" };
    }

    await db.gang.update({
      where: { id },
      data: { status },
    });

    // กำหนดข้อความแจ้งกลับตามสถานะที่อัปเดต
    let msg = `✨ เปลี่ยนสถานะแก๊งเป็น '${status}' เรียบร้อยแล้ว`;
    if (status === "approved") msg = "🎉 อนุมัติสิทธิ์ภาคีเครือข่ายแก๊งเข้าสู่ระบบสภากลางสำเร็จ!";
    if (status === "disbanded") msg = "❌ ทำการระงับสิทธิ์/ยื่นเรื่องยุบกลุ่มแก๊งออกจากระบบถาวรแล้ว";

    return { success: true, message: msg };
  } catch (error) {
    console.error("Update Gang Status Error:", error);
    return { success: false, message: "❌ เกิดข้อผิดพลาดในระบบฐานข้อมูลสภา" };
  }
}

/**
 * 🎁 3. ดึงรายการคำขอสวัสดิการทั้งหมดของทุกแก๊ง (สำหรับตาราง 'ยืนยันสวัสดิการ')
 */
export async function getAllWelfareRequests() {
  try {
    const requests = await db.welfareRequest.findMany({
      orderBy: { id: "desc" }, // ดึงคำขอเบิกสวัสดิการใหม่ล่าสุดขึ้นก่อน
    });
    
    // จัดรูปแบบโครงสร้างเวลาก่อนส่งไปแสดงผล
    const formattedRequests = requests.map((req: WelfareRequest) => ({
      ...req,
      createdAt: req.createdAt ? req.createdAt.toLocaleString("th-TH") : "ไม่ระบุเวลา"
    }));

    return { success: true, requests: formattedRequests };
  } catch (error) {
    console.error("Get All Welfare Requests Error:", error);
    return { success: false, requests: [], message: "❌ ไม่สามารถดึงข้อมูลคำขอสวัสดิการได้" };
  }
}

/**
 * 🎁 4. อัปเดตสถานะการแจกจ่ายพัสดุ/สวัสดิการประจำสัปดาห์
 */
export async function updateWelfareStatus(id: number, status: "รับไปแล้ว" | "เอาออกแล้ว" | "รอรับ") {
  try {
    if (!id || !status) {
      return { success: false, message: "❌ ข้อมูลไม่ครบถ้วน" };
    }

    await db.welfareRequest.update({
      where: { id },
      data: { status },
    });

    return { 
      success: true, 
      message: status === "รับไปแล้ว" ? "✅ อนุมัติการแจกจ่ายพัสดุและทำเครื่องหมายส่งมอบแล้ว" : "❌ ยกเลิก/นำคำขอสวัสดิการนี้ออกจากระบบแล้ว" 
    };
  } catch (error) {
    console.error("Update Welfare Status Error:", error);
    return { success: false, message: "❌ ไม่สามารถอัปเดตสถานะสวัสดิการได้" };
  }
}

/**
 * 👕 5. อัปเดตสถานะของไฟล์โมเดลชุดเมื่อแอดมินนำเข้าเซิร์ฟเวอร์หลักแล้ว
 */
export async function updateUniformStatus(id: number, status: "ลงแล้ว" | "ปฏิเสธ" | "รอลง") {
  try {
    if (!id || !status) {
      return { success: false, message: "❌ ไม่พบรหัสไฟล์ชุดเสื้อผ้า" };
    }

    await db.uniformFile.update({
      where: { id },
      data: { status },
    });

    return { 
      success: true, 
      message: status === "ลงแล้ว" ? "👕 อัปเดตสถานะ: โมเดลชุดถูกติดตั้งเข้าเซิร์ฟเวอร์หลักเรียบร้อย!" : "❌ ปฏิเสธไฟล์ชุดทรัพยากรดังกล่าว" 
    };
  } catch (error) {
    console.error("Update Uniform Status Error:", error);
    return { success: false, message: "❌ ไม่สามารถอัปเดตไฟล์ชุดในฐานข้อมูลได้" };
  }
}


export async function loginAdmin(formData: FormData) {
  const username = formData.get("username");
  const password = formData.get("password");

  // ดักจับประเภทข้อมูลให้ชัวร์ว่าเป็น String และไม่เป็นค่าว่าง
  if (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password.trim()) {
    return { success: false, message: "❌ กรุณากรอกข้อมูลให้ครบถ้วน" };
  }

  try {
    // 1. ค้นหาผู้ดูแลระบบจากตาราง db.admin (อิงตามโครงสร้างตัวพิมพ์เล็ก)
    const adminUser = await db.admin.findFirst({
      where: { username: username.trim() },
    });

    // ถ้าไม่พบในระบบ
    if (!adminUser) {
      console.log(`[AUTH-ADMIN] ไม่พบชื่อผู้ใช้งานระดับแอดมิน: ${username}`);
      return { success: false, message: "❌ ไม่พบชื่อผู้ดูแลระบบในสารบบ" };
    }

    // 2. ตรวจสอบรหัสผ่านตรง ๆ อิงตาม Model
    if (adminUser.password !== password) {
      return { success: false, message: "❌ รหัสผ่านไม่ถูกต้อง" };
    }

    // 3. ตรวจสอบสถานะการเปิดสิทธิ์ใช้งาน (อิงตามฟิลด์ status ในโมเดลของคุณ)
    if (adminUser.status === "ระงับใช้งาน") {
      return { success: false, message: "🔒 บัญชีผู้ดูแลระบบนี้ถูกระงับสิทธิ์การใช้งานแล้ว" };
    }
    
    if (adminUser.status === "รอรับ") {
      return { success: false, message: "⏳ บัญชีผู้ดูแลระบบนี้อยู่ระหว่างรอเปิดใช้งาน" };
    }

    // ส่งข้อมูลกลับไปยัง Client โดยเอาฟิลด์ role ออกให้ตรงกับ Model จริง
    return {
      success: true,
      message: "🎉 เข้าสู่ระบบผู้ดูแลระบบสำเร็จ!",
      admin: {
        id: adminUser.id,
        name: adminUser.name,
        username: adminUser.username,
        status: adminUser.status,
        createdAt: adminUser.createdAt
      }
    };
  } catch (error) {
    console.error("🚨 ADMIN DATABASE DEBUG ERROR:", error);
    return { success: false, message: "❌ ฐานข้อมูลระบบแอดมินขัดข้อง (ดู Terminal)" };
  }
}

// =====================================================================
// 👑 ROOT / SUPER ADMIN — จัดการบัญชี Council และ Admin ทั้งหมดในระบบ
// ⚠️ เปลี่ยน username/password เริ่มต้นตรงนี้ก่อนนำระบบไปใช้งานจริง!
// =====================================================================
const ROOT_USERNAME = "root";
const ROOT_PASSWORD = "changeme123";

export async function loginRoot(formData: FormData) {
  const username = formData.get("username");
  const password = formData.get("password");

  if (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password.trim()) {
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

export async function getAllCouncilUsers() {
  try {
    const users = await db.council.findMany({ orderBy: { id: "desc" } });
    return { success: true, users };
  } catch (error) {
    console.error("Get All Council Users Error:", error);
    return { success: false, users: [], message: "❌ ไม่สามารถดึงข้อมูลบัญชีสภาได้" };
  }
}

export async function getAllAdminUsers() {
  try {
    const users = await db.admin.findMany({ orderBy: { id: "desc" } });
    return { success: true, users };
  } catch (error) {
    console.error("Get All Admin Users Error:", error);
    return { success: false, users: [], message: "❌ ไม่สามารถดึงข้อมูลบัญชีแอดมินได้" };
  }
}

export async function createCouncilUser(formData: FormData) {
  const name = formData.get("name");
  const username = formData.get("username");
  const password = formData.get("password");

  if (
    typeof name !== "string" || typeof username !== "string" || typeof password !== "string" ||
    !name.trim() || !username.trim() || !password.trim()
  ) {
    return { success: false, message: "❌ กรุณากรอกข้อมูลให้ครบถ้วน" };
  }

  try {
    const existing = await db.council.findFirst({ where: { username: username.trim() } });
    if (existing) {
      return { success: false, message: "❌ ชื่อผู้ใช้นี้มีอยู่ในระบบสภาแล้ว" };
    }

    const thaiNow = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" });
    await db.council.create({
      data: {
        name: name.trim(),
        username: username.trim(),
        password,
        status: "อนุมัติ",
        createdAt: thaiNow,
      },
    });

    return { success: true, message: "✅ เพิ่มบัญชีสภากลางเรียบร้อยแล้ว" };
  } catch (error) {
    console.error("Create Council User Error:", error);
    return { success: false, message: "❌ ไม่สามารถเพิ่มบัญชีสภากลางได้" };
  }
}

export async function createAdminUser(formData: FormData) {
  const name = formData.get("name");
  const username = formData.get("username");
  const password = formData.get("password");

  if (
    typeof name !== "string" || typeof username !== "string" || typeof password !== "string" ||
    !name.trim() || !username.trim() || !password.trim()
  ) {
    return { success: false, message: "❌ กรุณากรอกข้อมูลให้ครบถ้วน" };
  }

  try {
    const existing = await db.admin.findFirst({ where: { username: username.trim() } });
    if (existing) {
      return { success: false, message: "❌ ชื่อผู้ใช้นี้มีอยู่ในระบบแอดมินแล้ว" };
    }

    const thaiNow = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" });
    await db.admin.create({
      data: {
        name: name.trim(),
        username: username.trim(),
        password,
        status: "อนุมัติ",
        createdAt: thaiNow,
      },
    });

    return { success: true, message: "✅ เพิ่มบัญชีแอดมินเรียบร้อยแล้ว" };
  } catch (error) {
    console.error("Create Admin User Error:", error);
    return { success: false, message: "❌ ไม่สามารถเพิ่มบัญชีแอดมินได้" };
  }
}

export async function updateCouncilUserStatus(id: number, status: "อนุมัติ" | "ระงับใช้งาน") {
  try {
    await db.council.update({ where: { id }, data: { status } });
    return { success: true, message: status === "อนุมัติ" ? "✅ เปิดใช้งานบัญชีสภาแล้ว" : "🔒 ระงับการใช้งานบัญชีสภาแล้ว" };
  } catch (error) {
    console.error("Update Council User Status Error:", error);
    return { success: false, message: "❌ ไม่สามารถอัปเดตสถานะบัญชีสภาได้" };
  }
}

export async function updateAdminUserStatus(id: number, status: "อนุมัติ" | "ระงับใช้งาน") {
  try {
    await db.admin.update({ where: { id }, data: { status } });
    return { success: true, message: status === "อนุมัติ" ? "✅ เปิดใช้งานบัญชีแอดมินแล้ว" : "🔒 ระงับการใช้งานบัญชีแอดมินแล้ว" };
  } catch (error) {
    console.error("Update Admin User Status Error:", error);
    return { success: false, message: "❌ ไม่สามารถอัปเดตสถานะบัญชีแอดมินได้" };
  }
}

export async function deleteCouncilUser(id: number) {
  try {
    await db.council.delete({ where: { id } });
    return { success: true, message: "🗑️ ลบบัญชีสภาเรียบร้อยแล้ว" };
  } catch (error) {
    console.error("Delete Council User Error:", error);
    return { success: false, message: "❌ ไม่สามารถลบบัญชีสภาได้" };
  }
}

export async function deleteAdminUser(id: number) {
  try {
    await db.admin.delete({ where: { id } });
    return { success: true, message: "🗑️ ลบบัญชีแอดมินเรียบร้อยแล้ว" };
  } catch (error) {
    console.error("Delete Admin User Error:", error);
    return { success: false, message: "❌ ไม่สามารถลบบัญชีแอดมินได้" };
  }
}