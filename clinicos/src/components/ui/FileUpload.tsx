"use client";
import { useState, useRef, useCallback } from "react";

import { Upload, X, FileText, Image, File, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadService } from "@/services/upload.service";
import { toast } from "sonner";

interface FileUploadProps {
  patientId: string;
  onUploaded?: () => void;
  accept?: string;
  maxSizeMB?: number;
}

interface UploadFile {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
}

const FILE_ICONS: Record<string, React.ElementType> = {
  "image/": Image,
  "application/pdf": FileText,
};

function getFileIcon(type: string): React.ElementType {
  for (const [prefix, Icon] of Object.entries(FILE_ICONS)) {
    if (type.startsWith(prefix) || type === prefix) return Icon;
  }
  return File;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUpload({ patientId, onUploaded, accept = ".pdf,.jpg,.jpeg,.png,.webp", maxSizeMB = 10 }: FileUploadProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: File[]) => {
    const maxBytes = maxSizeMB * 1024 * 1024;
    const valid = newFiles.filter(f => {
      if (f.size > maxBytes) {
        toast.error(`${f.name} dépasse la limite de ${maxSizeMB} MB`);
        return false;
      }
      return true;
    });

    setFiles(prev => [
      ...prev,
      ...valid.map(f => ({
        id: `${Date.now()}-${f.name}`,
        file: f,
        status: "pending" as const,
        progress: 0,
      })),
    ]);
  }, [maxSizeMB]);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const uploadAll = async () => {
    const pending = files.filter(f => f.status === "pending");
    if (!pending.length) return;

    for (const uf of pending) {
      setFiles(prev => prev.map(f => f.id === uf.id ? { ...f, status: "uploading", progress: 30 } : f));
      try {
        await uploadService.uploadDocument(patientId, uf.file);
        setFiles(prev => prev.map(f => f.id === uf.id ? { ...f, status: "done", progress: 100 } : f));
      } catch (err: any) {
        const msg = err?.response?.data?.error || "Erreur d'upload";
        setFiles(prev => prev.map(f => f.id === uf.id ? { ...f, status: "error", error: msg, progress: 0 } : f));
      }
    }

    const doneCount = files.filter(f => f.status === "done").length + pending.length;
    toast.success(`${doneCount} fichier(s) uploadé(s)`);
    onUploaded?.();
  };

  const hasPending = files.some(f => f.status === "pending");

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(Array.from(e.dataTransfer.files));
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
          dragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-accent/30"
        )}
      >
        <div className="flex flex-col items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
            dragging ? "gradient-primary" : "bg-muted"
          )}>
            <Upload className={cn("w-5 h-5", dragging ? "text-white" : "text-muted-foreground")} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {dragging ? "Déposez ici" : "Glissez & déposez ou cliquez"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, JPG, PNG — Max {maxSizeMB} MB par fichier
            </p>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={(e) => addFiles(Array.from(e.target.files || []))}
        />
      </div>

      {/* File list */}
      <div className="space-y-2">
        {files.map((uf) => {
          const Icon = getFileIcon(uf.file.type);
          return (
            <div
              key={uf.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-muted/20 animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                uf.status === "done" ? "gradient-success" : uf.status === "error" ? "bg-red-50" : "bg-muted"
              )}>
                {uf.status === "done"
                  ? <CheckCircle className="w-4.5 h-4.5 text-white" />
                  : uf.status === "error"
                  ? <AlertCircle className="w-4.5 h-4.5 text-red-500" />
                  : <Icon className="w-4.5 h-4.5 text-muted-foreground" />}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{uf.file.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{formatSize(uf.file.size)}</span>
                  {uf.status === "uploading" && (
                    <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full gradient-primary rounded-full transition-all duration-500"
                        style={{ width: `${uf.progress}%` }}
                      />
                    </div>
                  )}
                  {uf.status === "error" && <span className="text-[10px] text-red-500">{uf.error}</span>}
                  {uf.status === "done" && <span className="text-[10px] text-emerald-600 font-medium">Uploadé</span>}
                </div>
              </div>

              {uf.status !== "uploading" && uf.status !== "done" && (
                <button
                  onClick={() => removeFile(uf.id)}
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-all flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Upload button */}
      {hasPending && (
        <button
          onClick={uploadAll}
          className="w-full py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <Upload className="w-4 h-4" />
          Uploader {files.filter(f => f.status === "pending").length} fichier(s)
        </button>
      )}
    </div>
  );
}
