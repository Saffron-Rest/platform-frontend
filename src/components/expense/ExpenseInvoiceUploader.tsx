import { useEffect, useRef, useState } from "react";
import { uploadExpenseInvoice, deleteExpenseInvoice } from "../../api/expenses";
import type { ExpenseInvoice } from "../../types";
import { InvoiceGallery } from "./InvoiceGallery";
import { Button } from "../ui/Button";

function isImageFile(file: File) {
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
}

type Props = {
  expenseId?: string;
  invoices: ExpenseInvoice[];
  pendingFiles?: File[];
  disabled?: boolean;
  /** When false, files stay pending until parent saves (e.g. new expense line). */
  uploadImmediately?: boolean;
  pendingHint?: string;
  onChange: (patch: { invoices?: ExpenseInvoice[]; pendingFiles?: File[] }) => void;
};

export function ExpenseInvoiceUploader({
  expenseId,
  invoices,
  pendingFiles = [],
  disabled,
  uploadImmediately = true,
  pendingHint = "Will upload when you save the report",
  onChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const canAdd = !disabled;
  const shouldUploadNow = Boolean(expenseId && uploadImmediately);

  const handleFiles = async (files: File[]) => {
    if (!files.length || !canAdd) return;
    setError("");

    if (shouldUploadNow && expenseId) {
      setUploading(true);
      try {
        let nextInvoices = invoices;
        for (const file of files) {
          const updated = await uploadExpenseInvoice(expenseId, file);
          nextInvoices = updated.invoices ?? nextInvoices;
        }
        onChange({ invoices: nextInvoices, pendingFiles: [] });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
      return;
    }

    onChange({ pendingFiles: [...pendingFiles, ...files] });
  };

  const removePending = (index: number) => {
    onChange({ pendingFiles: pendingFiles.filter((_, i) => i !== index) });
  };

  return (
    <div className="mt-2 space-y-2">
      <InvoiceGallery
        invoices={invoices}
        editable={canAdd && Boolean(expenseId)}
        onDelete={
          expenseId && canAdd
            ? async (fileId) => {
                try {
                  const updated = await deleteExpenseInvoice(expenseId, fileId);
                  onChange({ invoices: updated.invoices });
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not remove");
                }
              }
            : undefined
        }
      />

      {pendingFiles.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 mb-2">
            {pendingHint}
          </p>
          <div className="flex flex-wrap gap-2">
            {pendingFiles.map((file, fi) => (
              <PendingFileThumb
                key={`${file.name}-${file.size}-${fi}`}
                file={file}
                onRemove={canAdd ? () => removePending(fi) : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {canAdd && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              const files = e.target.files ? [...e.target.files] : [];
              void handleFiles(files);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="secondary"
            className="!py-2.5 !text-sm w-full sm:w-auto"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? "Uploading…" : "+ Add invoice photos"}
          </Button>
          <p className="text-xs text-[var(--color-muted)]">
            Select multiple photos or PDFs in one go — you can add more anytime.
          </p>
        </>
      )}

      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}

function PendingFileThumb({ file, onRemove }: { file: File; onRemove?: () => void }) {
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
