import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div 
      className="relative flex flex-col items-center justify-center min-h-screen bg-cover bg-center bg-no-repeat bg-fixed font-sans antialiased"
      style={{ backgroundImage: "url('COUNCIL.PNG')" }}
    >
      {/* Dark / Light Overlay ชั้นกรองแสงเพื่อให้พื้นหลังไม่แย่งซีนข้อความ */}
      <div className="absolute inset-0 bg-zinc-950/50 dark:bg-black/70 backdrop-blur-[2px]" />

      {/* ตัวกล่องเนื้อหาดีไซน์แบบ Glassmorphism */}
      <main className="relative z-10 flex w-full max-w-4xl flex-col items-center justify-between gap-12 py-16 px-6 md:px-16 bg-white/10 dark:bg-zinc-900/20 backdrop-blur-md border border-white/20 dark:border-zinc-800/30 rounded-3xl shadow-2xl text-center sm:items-start sm:text-left mx-4 animate-fade-in">
        
        {/* Top Header / Logo & ปุ่มย้อนกลับ */}
        <div className="w-full flex justify-between items-center border-b border-white/10 pb-6">
          
          {/* 👈 ปุ่มย้อนกลับดีไซน์โปร่งแสงแบบมินิมอล */}
          <Link 
            href="/" // เปลี่ยน URL ปลายทางที่ต้องการให้ย้อนกลับไปได้ตรงนี้ครับ
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-zinc-200 text-sm font-medium transition-all duration-200 hover:bg-white/10 hover:text-white hover:scale-[1.02]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            ย้อนกลับ
          </Link>

          <span className="text-xs font-semibold tracking-widest text-zinc-200 uppercase bg-white/10 px-3 py-1 rounded-full border border-white/10">
            v1.0.0
          </span>
        </div>

        {/* Hero Section */}
        <div className="flex flex-col items-center gap-4 sm:items-start w-full">
          <h1 className="max-w-2xl text-4xl font-extrabold leading-[1.15] tracking-tight text-white sm:text-5xl drop-shadow-sm">
            Cloud City <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
              Council Management
            </span>
          </h1>
          <p className="text-zinc-200 text-sm md:text-base font-light">
            กรุณาเลือกประเภทการเข้าใช้งานเพื่อเข้าสู่ระบบ
          </p>
        </div>

        {/* ส่วนปุ่มเลือกประเภทผู้ใช้งาน (User Role Selection) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
          
          {/* 1. สำหรับ Gang / Family */}
          <Link
            href="/gangs-menu"
            className="group flex flex-col items-center sm:items-start gap-3 p-6 rounded-2xl bg-white/5 border border-white/10 text-white transition-all duration-300 hover:bg-gradient-to-br hover:from-blue-600/30 hover:to-indigo-600/30 hover:border-blue-400/50 hover:scale-[1.02] active:scale-[0.98] shadow-lg text-center sm:text-left"
          >
            <div className="p-3 bg-blue-500/20 rounded-xl text-blue-300 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold">Gang / Family</h3>
              <p className="text-xs text-zinc-300/80 mt-1 font-light">สำหรับประชาชนและบุคคลทั่วไปเพื่อรับบริการ</p>
            </div>
          </Link>

          {/* 2. สำหรับหน่วยงาน */}
          <Link
            href="/council-login"
            className="group flex flex-col items-center sm:items-start gap-3 p-6 rounded-2xl bg-white/5 border border-white/10 text-white transition-all duration-300 hover:bg-gradient-to-br hover:from-indigo-600/30 hover:to-purple-600/30 hover:border-indigo-400/50 hover:scale-[1.02] active:scale-[0.98] shadow-lg text-center sm:text-left"
          >
            <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-300 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold">Council</h3>
              <p className="text-xs text-zinc-300/80 mt-1 font-light">สำหรับเจ้าหน้าที่และหน่วยงานภายในระบบ</p>
            </div>
          </Link>

          {/* 3. สำหรับ Admin */}
          <Link
            href="/admin-login"
            className="group flex flex-col items-center sm:items-start gap-3 p-6 rounded-2xl bg-white/5 border border-white/10 text-white transition-all duration-300 hover:bg-gradient-to-br hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400/50 hover:scale-[1.02] active:scale-[0.98] shadow-lg text-center sm:text-left"
          >
            <div className="p-3 bg-purple-500/20 rounded-xl text-purple-300 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold">Admin</h3>
              <p className="text-xs text-zinc-300/80 mt-1 font-light">สำหรับผู้ดูแลระบบและจัดการโครงสร้างทั้งหมด</p>
            </div>
          </Link>

        </div>
      </main>
    </div>
  );
}