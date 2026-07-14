"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation"; 
import { loginAdmin } from "../register"; // 👈 เปลี่ยนมานำเข้า loginAdmin สำหรับแอดมินโดยเฉพาะ
import StatusModal from "../components/StatusModal";

export default function AdminLoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter(); 
  const [statusModal, setStatusModal] = useState<{ open: boolean; type: "success" | "error"; message: string }>({
    open: false,
    type: "success",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); 
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      
      // 🚀 เรียกใช้งาน Server Action ของ Admin ที่ปรับปรุงตาม Model
      const result = await loginAdmin(formData);
      
      setStatusModal({ open: true, type: result.success ? "success" : "error", message: result.message });

      if (result.success && result.admin) {
        // 💾 บันทึกสิทธิ์ผู้ดูแลระบบลงใน Browser
        localStorage.setItem("currentAdmin", JSON.stringify(result.admin));
      }
    } catch (error) {
      console.error(error);
      setStatusModal({ open: true, type: "error", message: "❌ เกิดข้อผิดพลาดในการเชื่อมต่อระบบหน้าบ้านแอดมิน" });
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    setStatusModal((prev) => ({ ...prev, open: false }));
    if (statusModal.type === "success") {
      router.push("/admin-dashboard");
    }
  };

  return (
    <div 
      className="relative flex flex-col items-center justify-center min-h-screen bg-cover bg-center bg-no-repeat font-sans antialiased py-10"
      style={{ backgroundImage: "url('COUNCIL.PNG')" }}
    >
      {/* Background Overlay คุมแสงกระจกแบบเงียบขรึมล้อตามหน้าแรก */}
      <div className="absolute inset-0 bg-zinc-950/50 backdrop-blur-[2px]" />

      <main className="relative z-10 flex w-full max-w-md flex-col gap-8 py-12 px-6 md:px-8 bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl shadow-2xl mx-4">
        
        {/* Top Header */}
        <div className="w-full flex justify-between items-center border-b border-white/10 pb-4">
          <Link href="/" className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-zinc-200 text-sm font-medium transition-all duration-200 hover:bg-white/10 hover:text-white">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            ย้อนกลับ
          </Link>
          <span className="text-xs font-semibold tracking-widest text-zinc-200 uppercase bg-white/10 px-3 py-1 rounded-full border border-white/10">Admin Access</span>
        </div>

        {/* Brand Header (ถอดสีรุ้งออก คุมโทนขาว-เทาพรีเมียม) */}
        <div className="flex flex-col items-center gap-1 text-center w-full">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl uppercase">
            Cloud City
          </h1>
          <h2 className="text-lg font-medium text-zinc-300 tracking-wide">
            Root Administrator
          </h2>
          <p className="text-xs text-zinc-400 font-light mt-1">กรุณากรอกรหัสผ่านผู้ดูแลระบบสูงสุดเพื่อยืนยันตัวตน</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full text-white">
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-200">Username</label>
            <input 
              type="text" 
              name="username" 
              placeholder="admin_root" 
              className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-white/30 focus:bg-white/10 focus:outline-none text-sm text-white transition-all" 
              required 
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-200">Password</label>
            <input 
              type="password" 
              name="password" 
              placeholder="••••••••" 
              className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-white/30 focus:bg-white/10 focus:outline-none text-sm text-white transition-all" 
              required 
            />
          </div>

          {/* ปุ่มกดสไตล์กระจกเงาไฮเอนด์ ถอดการไล่เฉดสีรุ้งออก */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 mt-2 rounded-xl bg-white/15 hover:bg-white text-white hover:text-black border border-white/20 font-bold shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
          >
            {loading ? "กำลังตรวจสอบฐานข้อมูลแอดมิน..." : "เข้าสู่ระบบผู้ดูแลระบบ"}
          </button>

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