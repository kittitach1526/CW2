"use client";

import { useEffect, useState } from "react";
import {
  getWelfareSeasons,
  createWelfareSeason,
  updateWelfareSeason,
  deleteWelfareSeason,
  setWelfareSeasonWeapons,
} from "../register";

interface SeasonWeapon {
  id?: number;
  seasonId?: number;
  type: string;
  weapon: string;
}

interface Season {
  id: number;
  name: string;
  kind: "regular" | "event";
  startDate?: string;
  endDate?: string;
  active: number;
  allowedTypes: string[];
  gangSelection: "all" | "selected";
  selectedGangs: string[];
  weapons: SeasonWeapon[];
}

const GANG_TYPES = [
  { value: "Gang", label: "แก๊ง" },
  { value: "Family", label: "ครอบครัว" },
  { value: "Gangs-LD", label: "แก๊งหญิง" },
];

const WEAPON_PRESETS = ["ปืน", "ไม้", "ปากกาฉลาม", "มีด", "มาเช", "สนับ"];

interface WelfareSeasonManagerProps {
  gangsList: { id: number; fullName: string; abbreviation: string }[];
}

export default function WelfareSeasonManager({ gangsList }: WelfareSeasonManagerProps) {
  const [subTab, setSubTab] = useState<"regular" | "event">("regular");
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    active: true,
    allowedTypes: [] as string[],
    gangSelection: "all" as "all" | "selected",
    selectedGangs: [] as string[],
  });
  const [formWeapons, setFormWeapons] = useState<SeasonWeapon[]>([]);
  const [customWeapons, setCustomWeapons] = useState<Record<string, string>>({});
  const [selectedWeaponType, setSelectedWeaponType] = useState<string>(GANG_TYPES[0].value);

  const loadSeasons = async () => {
    setLoading(true);
    const result = await getWelfareSeasons();
    if (result.success) {
      setSeasons(result.seasons || []);
    } else {
      setSeasons([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSeasons();
  }, []);

  const resetForm = () => {
    setForm({
      name: "",
      startDate: "",
      endDate: "",
      active: true,
      allowedTypes: [],
      gangSelection: "all",
      selectedGangs: [],
    });
    setFormWeapons([]);
    setCustomWeapons({});
    setEditingId(null);
  };

  const startEdit = (season: Season) => {
    setEditingId(season.id);
    setForm({
      name: season.name || "",
      startDate: season.startDate || "",
      endDate: season.endDate || "",
      active: !!season.active,
      allowedTypes: season.allowedTypes || [],
      gangSelection: (season.gangSelection as "all" | "selected") || "all",
      selectedGangs: season.selectedGangs || [],
    });
    setFormWeapons(season.weapons ? [...season.weapons] : []);
    setCustomWeapons({});
  };

  const handleSaveSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert("❌ กรุณากรอกชื่อซีซัน");
      return;
    }
    const payload = {
      name: form.name.trim(),
      kind: subTab,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      active: form.active,
      allowedTypes: subTab === "event" ? form.allowedTypes : [],
      gangSelection: subTab === "event" ? form.gangSelection : "all",
      selectedGangs: subTab === "event" && form.gangSelection === "selected" ? form.selectedGangs : [],
    };
    const result = editingId
      ? await updateWelfareSeason(editingId, payload)
      : await createWelfareSeason(payload);
    if (result.success) {
      const seasonId = editingId || result.season?.id;
      if (seasonId) {
        await setWelfareSeasonWeapons(seasonId, formWeapons);
      }
      alert("✅ บันทึกซีซันสำเร็จ");
      resetForm();
      loadSeasons();
    } else {
      alert(result.message || "❌ ไม่สามารถบันทึกซีซันได้");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("ต้องการลบซีซันนี้ใช่หรือไม่?")) return;
    const result = await deleteWelfareSeason(id);
    if (result.success) {
      loadSeasons();
    } else {
      alert(result.message || "❌ ไม่สามารถลบซีซันได้");
    }
  };

  const toggleActive = async (season: Season) => {
    const result = await updateWelfareSeason(season.id, { active: !season.active });
    if (result.success) {
      loadSeasons();
    } else {
      alert(result.message || "❌ ไม่สามารถอัปเดตสถานะได้");
    }
  };

  const togglePreset = (type: string, weapon: string, checked: boolean) => {
    setFormWeapons((prev) => {
      const exists = prev.some((w) => w.type === type && w.weapon === weapon);
      if (checked && !exists) {
        return [...prev, { type, weapon }];
      }
      if (!checked && exists) {
        return prev.filter((w) => !(w.type === type && w.weapon === weapon));
      }
      return prev;
    });
  };

  const addCustomWeapon = (type: string) => {
    const weapon = (customWeapons[type] || "").trim();
    if (!weapon) return;
    setFormWeapons((prev) => {
      if (prev.some((w) => w.type === type && w.weapon === weapon)) return prev;
      return [...prev, { type, weapon }];
    });
    setCustomWeapons((prev) => ({ ...prev, [type]: "" }));
  };

  const removeWeapon = (type: string, weapon: string) => {
    setFormWeapons((prev) => prev.filter((w) => !(w.type === type && w.weapon === weapon)));
  };

  const weaponsByType = (type: string) =>
    formWeapons.filter((w) => w.type === type).map((w) => w.weapon);

  const filteredSeasons = seasons.filter((s) => s.kind === subTab);

  const WeaponEditor = ({ t }: { t: { value: string; label: string } }) => (
    <div className="flex flex-col gap-3 p-4 rounded-xl bg-zinc-950/50 border border-white/[0.06]">
      <span className="text-xs font-semibold text-zinc-300">{t.label}</span>
      <div className="flex flex-wrap gap-2">
        {WEAPON_PRESETS.map((w) => (
          <label
            key={w}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] cursor-pointer transition-all ${
              weaponsByType(t.value).includes(w)
                ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                : "bg-zinc-900 text-zinc-400 border-white/10 hover:bg-zinc-800"
            }`}
          >
            <input
              type="checkbox"
              checked={weaponsByType(t.value).includes(w)}
              onChange={(e) => togglePreset(t.value, w, e.target.checked)}
              className="hidden"
            />
            {w}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={customWeapons[t.value] || ""}
          onChange={(e) => setCustomWeapons((prev) => ({ ...prev, [t.value]: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomWeapon(t.value); } }}
          placeholder="อาวุธอื่นๆ"
          className="flex-1 h-9 px-3 rounded-lg bg-zinc-950 border border-white/[0.06] text-zinc-200 text-xs focus:outline-none"
        />
        <button
          type="button"
          onClick={() => addCustomWeapon(t.value)}
          className="h-9 px-3 rounded-lg bg-zinc-800 text-zinc-300 border border-white/10 hover:bg-zinc-700 text-xs"
        >
          เพิ่ม
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {weaponsByType(t.value).filter((w) => !WEAPON_PRESETS.includes(w)).map((w) => (
          <span key={w} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-900 text-zinc-300 text-[11px] border border-white/10">
            {w}
            <button type="button" onClick={() => removeWeapon(t.value, w)} className="text-zinc-500 hover:text-red-400">×</button>
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 w-full text-zinc-200">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setSubTab("regular"); resetForm(); }}
          className={`h-10 px-4 rounded-xl text-xs font-medium border transition-all ${
            subTab === "regular"
              ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
              : "bg-zinc-900 text-zinc-400 border-white/10 hover:bg-zinc-800"
          }`}
        >
          📅 ซีซันสวัสดิการ
        </button>
        <button
          onClick={() => { setSubTab("event"); resetForm(); }}
          className={`h-10 px-4 rounded-xl text-xs font-medium border transition-all ${
            subTab === "event"
              ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
              : "bg-zinc-900 text-zinc-400 border-white/10 hover:bg-zinc-800"
          }`}
        >
          ⭐ อีเว้น (อาวุธพิเศษ)
        </button>
      </div>

      <form onSubmit={handleSaveSeason} className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
        <div className="flex flex-col gap-2 md:col-span-2">
          <label className="text-xs font-medium text-zinc-400">ชื่อ{subTab === "event" ? "อีเว้น" : "ซีซัน"}</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={subTab === "event" ? "ชื่ออีเว้น" : "ชื่อซีซันสวัสดิการ"}
            className="w-full h-10 px-3 rounded-lg bg-zinc-950 border border-white/[0.06] text-zinc-200 text-xs focus:outline-none"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-zinc-400">วันเริ่มต้น</label>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className="w-full h-10 px-3 rounded-lg bg-zinc-950 border border-white/[0.06] text-zinc-200 text-xs focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-zinc-400">วันสิ้นสุด</label>
          <input
            type="date"
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            className="w-full h-10 px-3 rounded-lg bg-zinc-950 border border-white/[0.06] text-zinc-200 text-xs focus:outline-none"
          />
        </div>

        {subTab === "event" && (
          <>
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-xs font-medium text-zinc-400">ประเภทแก๊งที่เข้าร่วมได้</label>
              <div className="flex flex-wrap gap-3">
                {GANG_TYPES.map((t) => (
                  <label key={t.value} className="flex items-center gap-2 text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      checked={form.allowedTypes.includes(t.value)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          allowedTypes: e.target.checked
                            ? [...form.allowedTypes, t.value]
                            : form.allowedTypes.filter((x) => x !== t.value),
                        })
                      }
                      className="rounded border-white/20 bg-zinc-950"
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-xs font-medium text-zinc-400">แก๊งที่รับอีเว้นนี้ได้</label>
              <div className="flex flex-wrap gap-3 mb-2">
                <label className="flex items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="radio"
                    name="gangSelection"
                    checked={form.gangSelection === "all"}
                    onChange={() => setForm({ ...form, gangSelection: "all", selectedGangs: [] })}
                    className="border-white/20 bg-zinc-950"
                  />
                  ทั้งหมด
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="radio"
                    name="gangSelection"
                    checked={form.gangSelection === "selected"}
                    onChange={() => setForm({ ...form, gangSelection: "selected" })}
                    className="border-white/20 bg-zinc-950"
                  />
                  เลือกเฉพาะแก๊ง
                </label>
              </div>
              {form.gangSelection === "selected" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-32 overflow-y-auto p-2 rounded-lg bg-zinc-950 border border-white/[0.06]">
                  {gangsList.map((g) => (
                    <label key={g.id} className="flex items-center gap-2 text-xs text-zinc-300">
                      <input
                        type="checkbox"
                        checked={form.selectedGangs.includes(g.abbreviation)}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            selectedGangs: e.target.checked
                              ? [...form.selectedGangs, g.abbreviation]
                              : form.selectedGangs.filter((x) => x !== g.abbreviation),
                          })
                        }
                        className="rounded border-white/20 bg-zinc-950"
                      />
                      <span className="truncate">{g.fullName} [{g.abbreviation}]</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex flex-col gap-2 md:col-span-2">
          <label className="text-xs font-medium text-zinc-400 flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="rounded border-white/20 bg-zinc-950"
            />
            เปิดใช้งานซีซันนี้
          </label>
        </div>

        <div className="flex flex-col gap-4 md:col-span-2 border-t border-white/[0.06] pt-4">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">⚔️ อาวุธสวัสดิการแยกตามประเภท</p>
          <div className="flex flex-col gap-3">
            <label className="text-xs font-medium text-zinc-400">ประเภทอาวุธ</label>
            <select
              value={selectedWeaponType}
              onChange={(e) => setSelectedWeaponType(e.target.value)}
              className="w-full sm:w-64 h-10 px-3 rounded-lg bg-zinc-950 border border-white/[0.06] text-zinc-200 text-xs focus:outline-none"
            >
              {GANG_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {(() => {
              const t = GANG_TYPES.find((x) => x.value === selectedWeaponType) || GANG_TYPES[0];
              return <WeaponEditor t={t} />;
            })()}
          </div>
        </div>

        <div className="flex gap-2 md:col-span-2">
          <button
            type="submit"
            className="h-10 px-4 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 text-xs font-medium transition-all"
          >
            {editingId ? "💾 บันทึก" : "➕ เพิ่ม"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="h-10 px-4 rounded-lg bg-zinc-800 text-zinc-300 border border-white/10 hover:bg-zinc-700 text-xs font-medium transition-all"
            >
              ยกเลิก
            </button>
          )}
        </div>
      </form>

      <div className="flex flex-col gap-4">
        <h3 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
          {subTab === "event" ? "รายการอีเว้น" : "รายการซีซันสวัสดิการ"}
        </h3>
        {loading ? (
          <div className="text-center text-xs text-zinc-600 py-10">กำลังโหลด...</div>
        ) : filteredSeasons.length === 0 ? (
          <div className="text-center text-xs text-zinc-600 py-10">📭 ยังไม่มีรายการ</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredSeasons.map((season) => (
              <div key={season.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-bold text-white">{season.name}</p>
                    <p className="text-[11px] text-zinc-500">
                      {season.startDate || "-"} ถึง {season.endDate || "-"}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleActive(season)}
                    className={`h-7 px-3 rounded-lg text-[11px] font-medium border transition-all ${
                      season.active
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : "bg-zinc-800 text-zinc-400 border-white/10"
                    }`}
                  >
                    {season.active ? "เปิด" : "ปิด"}
                  </button>
                </div>

                {subTab === "event" && (
                  <div className="text-[11px] text-zinc-400 flex flex-col gap-1">
                    <p>
                      ประเภทที่เข้าร่วม: {" "}
                      {season.allowedTypes && season.allowedTypes.length
                        ? season.allowedTypes.map((t) => GANG_TYPES.find((g) => g.value === t)?.label || t).join(", ")
                        : "ทั้งหมด"}
                    </p>
                    <p>
                      แก๊งที่รับ: {" "}
                      {season.gangSelection === "all"
                        ? "ทั้งหมด"
                        : season.selectedGangs && season.selectedGangs.length
                        ? season.selectedGangs.join(", ")
                        : "ยังไม่เลือก"}
                    </p>
                  </div>
                )}

                <div className="text-[11px] text-zinc-400">
                  <p className="mb-1">อาวุธ:</p>
                  <div className="flex flex-wrap gap-2">
                    {GANG_TYPES.map((t) => {
                      const weapons = season.weapons?.filter((w) => w.type === t.value).map((w) => w.weapon) || [];
                      return weapons.length > 0 ? (
                        <span key={t.value} className="px-2 py-1 rounded bg-zinc-900 border border-white/[0.06]">
                          {t.label}: {weapons.join(", ")}
                        </span>
                      ) : null;
                    })}
                    {(!season.weapons || season.weapons.length === 0) && <span className="text-zinc-600">ไม่มีข้อมูลอาวุธ</span>}
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => startEdit(season)}
                    className="h-8 px-3 rounded-lg bg-zinc-800 text-zinc-300 border border-white/10 hover:bg-zinc-700 text-xs"
                  >
                    แก้ไข
                  </button>
                  <button
                    onClick={() => handleDelete(season.id)}
                    className="h-8 px-3 rounded-lg bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/20 text-xs"
                  >
                    ลบ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
