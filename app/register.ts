// app/actions.ts
"use server";

import { db } from "../lib/db"; // 👈 เช็ก path ตรงนี้ให้ดีว่ามองเห็นไฟล์ db.ts แล้ว

// ➕ Action สำหรับเปลี่ยนสถานะใน Model Gang เป็น "รอยุบ"
export async function requestDisbandGang(abbreviation: string) {
  try {
    if (!abbreviation) {
      return { success: false, message: "❌ ไม่พบข้อมูลชื่อย่อแก๊ง" };
    }

    // อัปเดตสถานะในฐานข้อมูลเป็น "รอยุบ"
    await db.gang.update({
      where: { abbreviation: abbreviation },
      data: { status: "รอยุบ" }
    });

    return { success: true, message: "⚠️ ส่งเรื่องขอยุบแก๊งไปยังระบบสภากลางเรียบร้อยแล้ว สถานะปัจจุบัน: รอยุบ" };
  } catch (error) {
    console.error("Disband Gang Error:", error);
    return { success: false, message: "❌ เกิดข้อผิดพลาดในระบบฐานข้อมูล" };
  }
}

export async function createRegistration(formData: FormData) {
  const fullName = formData.get("fullName") as string;
  const abbreviation = formData.get("abbreviation") as string;
  const password = formData.get("password") as string;
  const colorTheme = formData.get("colorTheme") as string;
  const logoUrl = formData.get("logoUrl") as string; 
  
  // ➕ ดึงค่า Discord ID ของหัวหน้าและรองทั้ง 2 คนเพิ่มเข้ามาจากหน้าฟอร์ม
  const leader = formData.get("leader") as string;
  const leaderDiscord = formData.get("leaderDiscord") as string;
  const coLeader1 = formData.get("coLeader1") as string;
  const coLeader1Discord = formData.get("coLeader1Discord") as string;
  const coLeader2 = formData.get("coLeader2") as string;
  const coLeader2Discord = formData.get("coLeader2Discord") as string;
  
  const approver = formData.get("approver") as string;

  // 1. ตรวจสอบว่ากรอกฟิลด์ที่จำเป็นครบถ้วนหรือไม่ (เพิ่มตรวจสอบเลขดิสคอร์ดของหัวหน้าด้วย)
  if (!fullName || !abbreviation || !password || !leader || !leaderDiscord || !approver) {
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
        
        approver: gang.approver,
        status: gang.status
      }
    };
  } catch (error) {
    console.error(error);
    return { success: false, message: "❌ ไม่พบข้อมูล" };
  }
}

// ➕ ปรับปรุง Action: บันทึกไฟล์ชุดโดยรับรายละเอียดประเภทชุดเพิ่ม และกำหนดสถานะเริ่มต้นเป็น "รอลง"
export async function createUniformFile(formData: FormData) {
  const gangName = formData.get("gangName") as string;
  const uniformType = formData.get("uniformType") as string; // 👈 ดึงค่าว่าคือชุดอะไรเพิ่มเข้ามา
  const fileUrl = formData.get("fileUrl") as string;
  const approver = formData.get("approver") as string;
  const approverDiscord = formData.get("approverDiscord") as string;

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
export async function updateUniformFileLink(id: number, newFileUrl: string) {
  if (!newFileUrl) {
    return { success: false, message: "❌ กรุณากรอกลิงก์ไฟล์ใหม่" };
  }

  try {
    await db.uniformFile.update({
      where: { id },
      data: { 
        fileUrl: newFileUrl,
        status: "รอลง" // 🔄 เมื่อยูสเซอร์เปลี่ยนไฟล์ชุดแล้ว ให้รีเซ็ตกลับเป็น "รอลง" เพื่อให้แอดมินตรวจเช็กและลงใหม่อีกครั้ง
      },
    });
    return { success: true, message: "🔄 อัปเดตลิงก์ไฟล์ชุดใหม่ และส่งเรื่องให้แอดมินตรวจสอบแล้ว!" };
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
    const formattedRequests = requests.map(req => ({
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
    const formattedRequests = requests.map(req => ({
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