import { useEffect, useRef, useState } from "react";
import {
  deleteEntryFile,
  uploadEntryFile,
} from "../../api/entryFiles";
import { POS_REPORT_CATEGORY, type EntryFile } from "../../types";
import { Button } from "../ui/Button";
import { InvoiceGallery } from "../expense/InvoiceGallery";

type Props = {
  /** Existing POS report files attached to this entry (already saved). */
  files: EntryFile[];
  /** Files staged for upload after the entry is created (no entry id yet). */
  pendingFiles: File[];
  /** ID of the entry these files belong to. When missing, picks are kept as pending. */
  entryId?: string;
  /** When false, hides upload/delete controls. */
  editable?: boolean;
  /** True when the parent considers card sales > 0 (controls required hint + ring color). */
  required: boolean;
  /** Fires when local state changes — uploaded files and/or pending files. */
  onChange: (patch: { files?: EntryFile[]; pendingFiles?: File[] }) => void;
};

const isImageFile = (file: File) =>
  file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(file.name);

export function PosReportUploader({
  files,
  pendingFiles,
  entryId,
  editable = true,
  required,
  onChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const hasAny = files.length > 0 || pendingFiles.length > 0;
  const canInteract = editable;

  const handleFiles = async (picked: File[]) => {
    if (!picked.length || !canInteract) return;
    setError("");

    if (entryId) {
      setUploading(true);
      try {
        const newFiles: EntryFile[] = [];
        for (const file of picked) {
          newFiles.push(await uploadEntryFile(entryId, file, POS_REPORT_CATEGORY));
        }
        onChange({ files: [...files, ...newFiles], pendingFiles: [] });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
      return;
    }
    onChange({ pendingFiles: [...pendingFiles, ...picked] });
  };

  const removeUploaded = async (fileId: string) => {
    if (!canInteract) return;
    try {
      await deleteEntryFile(fileId);
      onChange({ files: files.filter((f) => f.id !== fileId) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove");
    }
  };

  const removePending = (index: number) => {
    onChange({ pendingFiles: pendingFiles.filter((_, i) => i !== index) });
  };

  const containerClass = required && !hasAny
    ? "rounded-2xl border-2 border-dashed border-amber-400/70 bg-amber-50/60 p-4 mt-3"
    : "rounded-2xl border border-black/10 bg-[var(--color-cream)]/60 p-4 mt-3";

  return (
    <div className={containerClass}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm">
            POS card sales report{required && <span className="text-rose-600 ml-1">*</span>}
          </p>
          <p className="text-xs text-[var(--color-muted)] mt-0.5 leading-snug">
            {required
              ? hasAny
                ? "Looks good — POS receipt attached for the card sales total."
                : "Attach a photo or PDF of the POS card sales report. Required before submit when any card sales are recorded."
              : "Optional — add the POS receipt for the card sales total when relevant."}
          </p>
        </div>
        {hasAny && (
          <span className="text-[11px] font-medium text-emerald-700 bg-emerald-100/80 rounded-full px-2 py-0.5 shrink-0">
            {files.length + pendingFiles.length} attached
          </span>
        )}
      </div>

      <div className="mt-3 space-y-3">
        {files.length > 0 && (
          <InvoiceGallery
            invoices={files.map((f) => ({ id: f.id, filename: f.filename }))}
            editable={canInteract}
            onDelete={canInteract ? (id) => void removeUploaded(id) : undefined}
          />
        )}

        {pendingFiles.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 mb-2">
              {entryId
                ? "Uploading…"
                : "Will upload as soon as you save the draft"}
            </p>
            <div className="flex flex-wrap gap-2">
              {pendingFiles.map((file, idx) => (
                <PendingThumb
                  key={`${file.name}-${file.size}-${idx}`}
                  file={file}
                  onRemove={canInteract ? () => removePending(idx) : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {canInteract && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                const picked = e.target.files ? [...e.target.files] : [];
                void handleFiles(picked);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant={required && !hasAny ? "primary" : "secondary"}
              className="!py-2.5 !text-sm w-full sm:w-auto"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading
                ? "Uploading…"
                : hasAny
                  ? "+ Add another POS receipt"
                  : "+ Upload POS report"}
            </Button>
          </>
        )}

        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      </div>
    </div>
  );
}

function PendingThumb({ file, onRemove }: { file: File; onRemove?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isImageFile(file)) return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <div className="relative w-20 h-20 rounded-xl border-2 border-dashed border-amber-400/60 bg-amber-50 overflow-hidden">
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-1">
          <span className="text-xl">📄</span>
          <span className="text-[8px] text-center text-[var(--color-muted)] truncate max-w-full px-0.5">
            {file.name}
          </span>
        </div>
      )}
      <span className="absolute bottom-0 inset-x-0 bg-amber-600/90 text-white text-[8px] text-center py-0.5 font-medium">
        New
      </span>
      {onRemove && (
        <button
          type="button"
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--color-danger)] text-white text-xs font-bold"
          aria-label={`Remove ${file.name}`}
          onClick={onRemove}
        >
          ×
        </button>
      )}
    </div>
  );
}
