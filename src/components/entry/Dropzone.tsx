import { useCallback, useRef, useState } from "react";

type Props = {
  onFile: (file: File) => void;
  disabled?: boolean;
};

export function Dropzone({ onFile, disabled }: Props) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }, [onFile]);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      className={[
        "flex cursor-pointer flex-col items-center justify-center border border-dashed px-8 py-14 text-center transition-colors",
        over ? "border-accent bg-accent/5" : "border-ink/25 bg-paper",
        disabled ? "pointer-events-none opacity-50" : "",
      ].join(" ")}
    >
      <div className="font-editorial text-[28px] leading-tight text-ink">
        Drop a CSV or XLSX
      </div>
      <div className="mt-2 text-[13px] text-ink-muted">
        or click to browse — UK dates, leading-zero IDs and header banners handled.
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </div>
  );
}
