// ─────────────────────────────────────────────────────────
//  src/screens/kanban/components/EvidenceModal.tsx
//  Modal obligatorio para transiciones que requieren evidencia
// ─────────────────────────────────────────────────────────

import React, { useState } from "react";
import { X, AlertTriangle, Link2, MessageSquare, FileText, CheckCircle2 } from "lucide-react";
import type { EvidencePayload, EvidenceType } from "../../../types/domain";

interface Props {
  fromStateName: string;
  toStateName: string;
  evidenceTypes: EvidenceType[];
  onConfirm: (evidence: EvidencePayload) => void;
  onCancel: () => void;
}

const TYPE_ICONS: Record<EvidenceType, React.ReactNode> = {
  link:    <Link2 size={14} />,
  comment: <MessageSquare size={14} />,
  file:    <FileText size={14} />,
};

const TYPE_LABELS: Record<EvidenceType, string> = {
  link:    "Enlace",
  comment: "Comentario",
  file:    "Archivo",
};

const Input: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean;
}> = ({ label, value, onChange, placeholder, multiline }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{
      display: "block", fontSize: 11, fontWeight: 600, color: "#605E5C",
      textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5,
      fontFamily: "'Segoe UI', sans-serif",
    }}>{label}</label>
    {multiline ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{
          width: "100%", boxSizing: "border-box", resize: "vertical",
          fontFamily: "'Segoe UI', sans-serif", fontSize: 13, color: "#201F1E",
          border: "1px solid #EDEBE9", borderRadius: 4, padding: "8px 10px",
          background: "#fff", outline: "none",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "#0078D4")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "#EDEBE9")}
      />
    ) : (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", boxSizing: "border-box",
          fontFamily: "'Segoe UI', sans-serif", fontSize: 13, color: "#201F1E",
          border: "1px solid #EDEBE9", borderRadius: 4, padding: "8px 10px",
          background: "#fff", outline: "none",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "#0078D4")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "#EDEBE9")}
      />
    )}
  </div>
);

export const EvidenceModal: React.FC<Props> = ({
  fromStateName, toStateName, evidenceTypes, onConfirm, onCancel,
}) => {
  const defaultType = evidenceTypes[0] ?? "comment";
  const [type, setType]     = useState<EvidenceType>(defaultType);
  const [value, setValue]   = useState("");
  const [comment, setComment] = useState("");
  const [error, setError]   = useState<string | null>(null);

  const handleConfirm = () => {
    if (type === "link" && !value.trim()) {
      setError("El enlace es obligatorio."); return;
    }
    if (!comment.trim()) {
      setError("El comentario es obligatorio."); return;
    }
    onConfirm({ type, value: value.trim(), comment: comment.trim() });
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onCancel}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          zIndex: 2000, backdropFilter: "blur(2px)",
        }}
      />

      {/* Modal */}
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 480, zIndex: 2001, background: "#fff",
        borderRadius: 10, boxShadow: "0 16px 48px rgba(0,0,0,0.22)",
        fontFamily: "'Segoe UI', sans-serif",
        animation: "fadeUp 180ms ease-out",
      }}>
        <style>{`@keyframes fadeUp{from{opacity:0;transform:translate(-50%,-48%)}to{opacity:1;transform:translate(-50%,-50%)}}`}</style>

        {/* Header */}
        <div style={{
          padding: "16px 20px 12px", borderBottom: "1px solid #EDEBE9",
          display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <AlertTriangle size={18} color="#CA8B00" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#201F1E", marginBottom: 3 }}>
              Evidencia requerida
            </div>
            <div style={{ fontSize: 12, color: "#605E5C" }}>
              Para mover de <strong>{fromStateName}</strong> → <strong>{toStateName}</strong>
              &nbsp;es obligatorio adjuntar una evidencia.
            </div>
          </div>
          <button
            onClick={onCancel}
            style={{ border: "none", background: "transparent", cursor: "pointer", color: "#605E5C", padding: 2 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 20px 20px" }}>
          {/* Tipo de evidencia */}
          <div style={{ marginBottom: 14 }}>
            <label style={{
              display: "block", fontSize: 11, fontWeight: 600, color: "#605E5C",
              textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6,
            }}>Tipo de evidencia</label>
            <div style={{ display: "flex", gap: 6 }}>
              {evidenceTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 14px", borderRadius: 5, cursor: "pointer", fontSize: 12,
                    border: `1.5px solid ${type === t ? "#0078D4" : "#EDEBE9"}`,
                    background: type === t ? "#EFF6FC" : "#fff",
                    color: type === t ? "#0078D4" : "#605E5C",
                    fontFamily: "'Segoe UI', sans-serif", fontWeight: type === t ? 600 : 400,
                  }}
                >
                  {TYPE_ICONS[t]} {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Campo URL (solo si link) */}
          {type === "link" && (
            <Input
              label="Enlace (URL)"
              value={value}
              onChange={setValue}
              placeholder="https://sharepoint.com/..."
            />
          )}

          {/* Comentario (siempre requerido) */}
          <Input
            label="Comentario"
            value={comment}
            onChange={setComment}
            placeholder="Describe el contexto de la evidencia..."
            multiline
          />

          {/* Error */}
          {error && (
            <div style={{
              background: "#FDE7E9", border: "1px solid #F4B8BB", borderRadius: 5,
              padding: "8px 12px", fontSize: 12, color: "#A4262C", marginBottom: 12,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <AlertTriangle size={13} /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 20px 16px", borderTop: "1px solid #EDEBE9",
          display: "flex", gap: 8, justifyContent: "flex-end",
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 16px", borderRadius: 5, border: "1px solid #EDEBE9",
              background: "#fff", color: "#605E5C", cursor: "pointer",
              fontSize: 13, fontFamily: "'Segoe UI', sans-serif",
            }}
          >Cancelar</button>
          <button
            onClick={handleConfirm}
            style={{
              padding: "8px 20px", borderRadius: 5, border: "none",
              background: "#0078D4", color: "#fff", cursor: "pointer",
              fontSize: 13, fontWeight: 600, fontFamily: "'Segoe UI', sans-serif",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <CheckCircle2 size={14} /> Confirmar y mover
          </button>
        </div>
      </div>
    </>
  );
};
