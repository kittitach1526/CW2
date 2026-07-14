"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation"; // 👈 นำเข้า Router เพื่อใช้เปลี่ยนหน้า
import { loginGang } from "../register"; // 👈 เปลี่ยนมานำเข้า Action สำหรับ Login
import StatusModal from "../components/StatusModal";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const router = useRouter(); // 👈 เรียกใช้งาน Router
  const [statusModal, setStatusModal] = useState<{ open: boolean; type: "success" | "error"; message: string }>({
    open: false,
    type: "success",
    message: "",
  });

  // ฟังก์ชันครอบตอนกด Submit
  const clientAction = async (formData: FormData) => {
    setLoading(true);
    
    // เรียกใช้ Server Action ตรวจสอบข้อมูลในฐานข้อมูล SQLite
    const result = await loginGang(formData);
    
    setLoading(false);
    setStatusModal({ open: true, type: result.success ? "success" : "error", message: result.message });

    if (result.success && result.gang) {
      // 💾 1. สั่งบันทึกข้อมูลแก๊งลงใน Browser (localStorage)
      localStorage.setItem("currentGang", JSON.stringify(result.gang));
    }
  };

  const handleModalClose = () => {
    setStatusModal((prev) => ({ ...prev, open: false }));
    if (statusModal.type === "success") {
      router.push("/gangs-dashboard");
    }
  };

  return (
    <div 
      className="relative flex flex-col items-center justify-center min-h-screen bg-cover bg-center bg-no-repeat font-sans antialiased py-10"
      style={{ backgroundImage: "url('COUNCIL.PNG')" }}
    >
      <div className="absolute inset-0 bg-zinc-950/60 dark:bg-black/75 backdrop-blur-[2px]" />

      <main className="relative z-10 flex w-full max-w-md flex-col gap-8 py-12 px-6 md:px-8 bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl shadow-2xl mx-4">
        
        {/* Top Header */}
        <div className="w-full flex justify-between items-center border-b border-white/10 pb-4">
          <Link href="/" className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-zinc-200 text-sm font-medium transition-all duration-200 hover:bg-white/10 hover:text-white">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            ย้อนกลับ
          </Link>
          <span className="text-xs font-semibold tracking-widest text-zinc-200 uppercase bg-white/10 px-3 py-1 rounded-full border border-white/10">Gang Login</span>
        </div>

        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl text-center">
            Cloud City <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">Gang Portal</span>
          </h1>
          <p className="text-sm text-zinc-300 text-center mt-2">กรุณาเข้าสู่ระบบด้วยบัญชีแก๊งของคุณ</p>
        </div>

        {/* ฟอร์มส่งข้อมูล Login */}
        <form action={clientAction} className="flex flex-col gap-5 w-full text-white">
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-200">ชื่อย่อแก๊ง (Abbreviation)</label>
            <input type="text" name="abbreviation" placeholder="เช่น CCC" className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-blue-400 focus:outline-none text-sm" required />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-200">รหัสผ่านกลุ่ม (Password)</label>
            <input type="password" name="password" placeholder="••••••••" className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-blue-400 focus:outline-none text-sm" required />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 mt-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 font-semibold text-white shadow-lg shadow-indigo-500/20 hover:opacity-90 active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "กำลังตรวจสอบข้อมูล..." : "เข้าสู่ระบบแก๊ง"}
          </button>

          <p className="text-xs text-center text-zinc-400 mt-2">
            หากยังไม่ได้ลงทะเบียนแก๊ง? <Link href="/register" className="text-blue-400 hover:underline">ลงทะเบียนที่นี่</Link>
          </p>

        </form>
      </main>

      <StatusModal
        open={statusModal.open}
        type={statusModal.type}
        title={statusModal.type === "success" ? "เข้าสู่ระบบสำเร็จ" : "เข้าสู่ระบบไม่สำเร็จ"}
        message={statusModal.message}
        onClose={handleModalClose}
      />
    </div>
  );
}