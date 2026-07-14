"use client";

import Link from "next/link";
import { useState } from "react";
import { createRegistration } from "../register"; // 👈 นำเข้า Server Action จากไฟล์ register.ts

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [colorTheme, setColorTheme] = useState("#3b82f6"); // State สำหรับผูกค่าสี HEX และ Color Picker

  // ฟังก์ชันครอบตอนกด Submit ฟอร์ม
  const clientAction = async (formData: FormData) => {
    setLoading(true);
    
    // เรียกใช้ Server Action เหมือนฟังก์ชันธรรมดาตัวหนึ่ง
    const result = await createRegistration(formData);
    
    setLoading(false);
    alert(result.message);
  };

  return (
    <div 
      className="relative flex flex-col items-center justify-center min-h-screen bg-cover bg-center bg-no-repeat font-sans antialiased py-10"
      style={{ backgroundImage: "url('COUNCIL.PNG')" }}
    >
      <div className="absolute inset-0 bg-zinc-950/60 dark:bg-black/75 backdrop-blur-[2px]" />

      <main className="relative z-10 flex w-full max-w-3xl flex-col gap-8 py-12 px-6 md:px-12 bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl shadow-2xl mx-4">
        
        {/* Top Header */}
        <div className="w-full flex justify-between items-center border-b border-white/10 pb-4">
          <Link href="/gangs-menu" className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-zinc-200 text-sm font-medium transition-all duration-200 hover:bg-white/10 hover:text-white">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            ย้อนกลับ
          </Link>
          <span className="text-xs font-semibold tracking-widest text-zinc-200 uppercase bg-white/10 px-3 py-1 rounded-full border border-white/10">Register Action</span>
        </div>

        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Cloud City <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">Council Registration</span>
          </h1>
        </div>

        {/* ฟอร์มลงทะเบียนส่งข้อมูลผ่าน Server Action */}
        <form action={clientAction} className="flex flex-col gap-6 w-full text-white">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
            
            {/* 1. ชื่อเต็มแก๊ง */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-200">ชื่อเต็ม (Full Name)</label>
              <input type="text" name="fullName" placeholder="เช่น Cloud City Council" className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-blue-400 focus:outline-none text-sm" required />
            </div>

            {/* 2. ชื่อย่อแก๊ง */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-200">ชื่อย่อ (Abbreviation)</label>
              <input type="text" name="abbreviation" placeholder="เช่น CCC" className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-blue-400 focus:outline-none text-sm" required />
            </div>

            {/* 3. รหัสผ่านระบบแก๊ง */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-200">รหัสผ่าน (Password)</label>
              <input type="password" name="password" placeholder="••••••••" className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-blue-400 focus:outline-none text-sm" required />
            </div>

            {/* 4. ประเภทแก๊ง */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-200">ประเภทแก๊ง</label>
              <select name="type" className="w-full h-11 px-4 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:border-blue-400 focus:outline-none" required>
                <option value="">-- เลือกประเภทแก๊ง --</option>
                <option value="Family">Family</option>
                <option value="Gang">Gang</option>
                <option value="Gangs-LD">Gangs-LD</option>
              </select>
            </div>

            {/* 5. สีประจำกลุ่ม (รองรับทั้งการพิมพ์รหัส HEX และการกดจิ้มเลือกสี) */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-200">สีประจำกลุ่ม (Color Theme)</label>
              <div className="relative flex items-center gap-2">
                {/* กล่อง Preview สี และปุ่ม Color Picker */}
                <div className="relative w-11 h-11 rounded-xl border border-white/10 overflow-hidden flex-shrink-0 bg-white/5">
                  <input 
                    type="color" 
                    name="colorTheme"
                    value={colorTheme} 
                    onChange={(e) => setColorTheme(e.target.value)}
                    className="absolute inset-0 w-full h-full transform scale-150 cursor-pointer bg-transparent border-none p-0" 
                  />
                </div>
                
                {/* ช่องพิมพ์รหัส HEX */}
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-400 font-mono font-bold">#</span>
                  <input 
                    type="text" 
                    value={colorTheme.replace("#", "")} 
                    onChange={(e) => {
                      let val = e.target.value;
                      if (val.length <= 6) {
                        setColorTheme(`#${val}`);
                      }
                    }}
                    placeholder="3b82f6"
                    className="w-full h-11 pl-8 pr-4 rounded-xl bg-white/5 border border-white/10 focus:border-blue-400 focus:outline-none text-sm font-mono tracking-wider uppercase text-white" 
                    required
                  />
                </div>
              </div>
            </div>

            {/* 5. URL โลโก้แก๊ง */}
            <div className="flex flex-col gap-2 sm:col-span-2">
              <label className="text-sm font-medium text-zinc-200">URL โลโก้แก๊ง (Logo URL)</label>
              <input 
                type="url" 
                name="logoUrl" 
                placeholder="เช่น https://imgur.com/your-gang-logo.png" 
                className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-blue-400 focus:outline-none text-sm" 
              />
              <span className="text-[11px] text-zinc-400">*(แนะนำให้อัปโหลดรูปขึ้นเว็บฝากรูป เช่น Imgur หรือ Discord แล้วนำลิงก์มาวาง)*</span>
            </div>

            {/* ─── โซนข้อมูลหัวหน้าแก๊ง ─── */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-200">หัวหน้า (Leader)</label>
              <input type="text" name="leader" placeholder="ชื่อหัวหน้ากลุ่ม" className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-blue-400 focus:outline-none text-sm" required />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-200">เลขดิสคอร์ดหัวหน้า (Leader Discord ID)</label>
              <input type="text" name="leaderDiscord" placeholder="เช่น 3948571029485761" className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-blue-400 focus:outline-none text-sm" required />
            </div>

            {/* ─── โซนข้อมูลรองหัวหน้าคนที่ 1 ─── */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-200">รองหัวหน้า 1</label>
              <input type="text" name="coLeader1" placeholder="ชื่อรองหัวหน้าคนที่ 1" className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-blue-400 focus:outline-none text-sm" />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-200">เลขดิสคอร์ดรอง 1 (Co-Leader 1 Discord ID)</label>
              <input type="text" name="coLeader1Discord" placeholder="เช่น 3948571029485762" className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-blue-400 focus:outline-none text-sm" />
            </div>

            {/* ─── โซนข้อมูลรองหัวหน้าคนที่ 2 ─── */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-200">รองหัวหน้า 2</label>
              <input type="text" name="coLeader2" placeholder="ชื่อรองหัวหน้าคนที่ 2" className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-blue-400 focus:outline-none text-sm" />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-200">เลขดิสคอร์ดรอง 2 (Co-Leader 2 Discord ID)</label>
              <input type="text" name="coLeader2Discord" placeholder="เช่น 3948571029485763" className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-blue-400 focus:outline-none text-sm" />
            </div>

            {/* ─── โซนผู้อนุมัติแก๊ง ─── */}
            <div className="flex flex-col gap-2 sm:col-span-2">
              <label className="text-sm font-medium text-zinc-200">ชื่อของผู้อนุมัติ (Approver)</label>
              <input type="text" name="approver" placeholder="ชื่อผู้มีอำนาจอนุมัติ" className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-blue-400 focus:outline-none text-sm" required />
            </div>

          </div>

          {/* ปุ่ม Submit ฟอร์ม */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 mt-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 font-semibold text-white shadow-lg shadow-indigo-500/20 hover:opacity-90 active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "กำลังประมวลผลบนเซิร์ฟเวอร์..." : "ส่งข้อมูลลงทะเบียน"}
          </button>

        </form>
      </main>
    </div>
  );
}