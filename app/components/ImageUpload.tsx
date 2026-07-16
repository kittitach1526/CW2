"use client";

import { ChangeEvent, useState } from "react";

interface ImageUploadProps {
  label?: string;
  value?: string;
  onUploaded: (url: string) => void;
}

export default function ImageUpload({ label = "ลิงก์รูปภาพ", value = "", onUploaded }: ImageUploadProps) {
  const [url, setUrl] = useState(value);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    onUploaded(newUrl);
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <label className="text-sm font-medium text-zinc-200">{label}</label>
      <input
        type="url"
        value={url}
        onChange={handleChange}
        placeholder="https://..."
        className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 focus:border-blue-400 focus:outline-none text-sm"
      />
      {url && (
        <div className="mt-2">
          <img src={url} alt="preview" className="max-h-40 rounded-xl border border-white/10 object-contain" />
        </div>
      )}
    </div>
  );
}
