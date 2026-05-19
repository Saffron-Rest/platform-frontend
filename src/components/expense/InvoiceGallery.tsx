import { useEffect, useState } from "react";
import { downloadFile, downloadUrl } from "../../api/client";
import type { ExpenseInvoice } from "../../types";

function isImageFilename(filename: string) {
  return /\.(jpe?g|png|webp|gif)$/i.test(filename);
}

type Props = {
  invoices: ExpenseInvoice[];
  editable?: boolean;
  onDelete?: (fileId: string) => void;
};

export function InvoiceGallery({ invoices, editable, onDelete }: Props) {
  const [preview, setPreview] = useState<{ id: string; filename: string; url: string } | null>(null);

  if (!invoices.length) return null;

  return (
    <div className="mt-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)] mb-2">
        Receipt photos
      </p>
      <div className="flex flex-wrap gap-2">
        {invoices.map((inv) => (
          <InvoiceThumb
            key={inv.id}
            invoice={inv}
            editable={editable}
            onPreview={(url) => setPreview({ id: inv.id, filename: inv.filename, url })}
            onDelete={onDelete}
          />
        ))}
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreview(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-black/10">
              <p className="font-semibold text-sm truncate">{preview.filename}</p>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  className="text-sm text-[var(--color-saffron)] font-semibold"
                  onClick={() => downloadFile(`/files/download/${preview.id}`, preview.filename)}
                >
                  Download
                </button>
                <button
                  type="button"
                  className="text-sm font-semibold"
                  onClick={() => setPreview(null)}
                >
                  Close
                </button>
              </div>
            </div>
            {isImageFilename(preview.filename) ? (
              <img
                src={preview.url}
                alt={preview.filename}
                className="w-full max-h-[70vh] object-contain bg-[var(--color-cream)]"
              />
            ) : (
              <div className="p-6 text-center">
                <p className="text-sm text-[var(--color-muted)] mb-3">
                  Preview not available for this file type.
                </p>
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--color-saffron)] font-semibold underline"
                >
                  Open file
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InvoiceThumb({
  invoice,
  editable,
  onPreview,
  onDelete,
}: {
  invoice: ExpenseInvoice;
  editable?: boolean;
  onPreview: (url: string) => void;
  onDelete?: (fileId: string) => void;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked: string | undefined;
    let cancelled = false;

    async function load() {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(downloadUrl(`/files/download/${invoice.id}`), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const blob = await res.blob();
        revoked = URL.createObjectURL(blob);
        if (!cancelled) setThumbUrl(revoked);
      } catch {
        /* ignore */
      }
    }

    if (isImageFilename(invoice.filename)) {
      load();
    }

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [invoice.id, invoice.filename]);

  return (
    <div className="relative group">
      <button
        type="button"
        className="w-20 h-20 rounded-xl border border-black/10 overflow-hidden bg-[var(--color-cream)] flex flex-col items-center justify-center hover:ring-2 hover:ring-[var(--color-saffron)]/40 transition"
        onClick={() => {
          if (thumbUrl) onPreview(thumbUrl);
          else downloadFile(`/files/download/${invoice.id}`, invoice.filename);
        }}
        title="View receipt"
      >
        {thumbUrl ? (
          <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <>
            <span className="text-2xl">📄</span>
            <span className="text-[9px] text-[var(--color-muted)] px-1 truncate max-w-full">
              {invoice.filename}
            </span>
          </>
        )}
      </button>
      {editable && onDelete && (
        <button
          type="button"
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--color-danger)] text-white text-xs font-bold leading-none"
          aria-label="Remove invoice"
          onClick={() => onDelete(invoice.id)}
        >
          ×
        </button>
      )}
    </div>
  );
}
