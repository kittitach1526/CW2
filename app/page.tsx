import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    // 1. เพิ่ม Background Image และ Overlay สีเข้ม/จาง เพื่อให้ข้อความอ่านง่าย
    <div 
      className="relative flex flex-col items-center justify-center min-h-screen bg-cover bg-center bg-no-repeat font-sans antialiased"
      style={{ backgroundImage: "url('COUNCIL.PNG')" }} // 👈 ใส่พาธรูปภาพของคุณตรงนี้
    >
      {/* Dark / Light Overlay ชั้นกรองแสงเพื่อให้พื้นหลังไม่แย่งซีนข้อความ */}
      <div className="absolute inset-0 bg-zinc-950/40 dark:bg-black/60 backdrop-blur-[2px]" />

      {/* 2. ตัวกล่องเนื้อหาดีไซน์แบบ Glassmorphism (กระจกฝ้าโปร่งแสง) */}
      <main className="relative z-10 flex w-full max-w-4xl flex-col items-center justify-between gap-16 py-20 px-8 md:px-16 bg-white/10 dark:bg-zinc-900/20 backdrop-blur-md border border-white/20 dark:border-zinc-800/30 rounded-3xl shadow-2xl text-center sm:items-start sm:text-left mx-4 animate-fade-in">
        
        {/* Top Header / Logo */}
        <div className="w-full flex justify-between items-center border-b border-white/10 pb-6">
          <Image
            className=""
            src="/logo.png"
            alt="Next.js logo"
            width={110}
            height={22}
            priority
          />

          <Image
            className=""
            src="/text.png"
            alt="Next.js logo"
            width={140}
            height={22}
            priority
          />
          
          <span className="text-xs font-semibold tracking-widest text-zinc-200 uppercase bg-white/10 px-3 py-1 rounded-full border border-white/10">
            v1.0.0
          </span>
        </div>

        {/* Hero Section */}
        <div className="flex flex-col items-center gap-6 sm:items-start w-full">
          <h1 className="max-w-2xl text-4xl font-extrabold leading-[1.15] tracking-tight text-white sm:text-6xl drop-shadow-sm">
            Clound City <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
              Council Management
            </span>
          </h1>
          {/* <p className="max-w-xl text-lg md:text-xl leading-relaxed text-zinc-200/90 font-light drop-shadow-sm">
            ร่วมเป็นส่วนหนึ่งกับแพลตฟอร์มที่รวมทุกเครื่องมือสำคัญไว้ในที่เดียว ปรับแต่งง่าย ปลอดภัย และรวดเร็วที่สุดสำหรับคุณ
          </p> */}
        </div>

        {/* Call to Action Buttons */}
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row w-full sm:w-auto">
          
          {/* ปุ่มเข้าใช้งานหลัก - ไล่เฉดสี มีเงา และ Effect Hover ขยายตัวเล็กน้อย */}
          <Link
            className="group flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 text-white transition-all duration-300 hover:from-blue-500 hover:to-indigo-500 hover:scale-[1.02] active:scale-[0.98] md:w-[200px] text-center font-semibold shadow-lg shadow-indigo-500/20"
            href="/select" // 👈 ใส่ URL หน้าถัดไปที่นี่
          >
            เริ่มต้นใช้งาน
            <svg 
              className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </Link>

          {/* ปุ่มรอง - แบบโปร่งแสงเข้ากับธีมกระจก
          <a
            className="flex h-14 w-full items-center justify-center rounded-2xl border border-solid border-white/20 bg-white/5 px-6 text-white transition-all duration-300 hover:bg-white/10 hover:border-white/40 md:w-[170px]"
            href="https://nextjs.org/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            เรียนรู้เพิ่มเติม
          </a> */}
          
        </div>
      </main>
    </div>
  );
}