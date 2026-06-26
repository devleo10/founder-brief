"use client";

import { Mic, Square } from "lucide-react";
import type { VoiceControl } from "@/lib/useSpeechInput";

export default function VoiceField({
  id,
  label,
  placeholder,
  value,
  onValue,
  voice,
  required,
  textarea,
  rows = 2,
  wide,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onValue: (value: string) => void;
  voice: VoiceControl;
  required?: boolean;
  textarea?: boolean;
  rows?: number;
  wide?: boolean;
}) {
  const listening = voice.listeningField === id;
  const error = voice.error?.field === id && !listening ? voice.error.message : null;

  const handleMic = () => {
    if (listening) voice.stop();
    else voice.start(id, value, onValue);
  };

  return (
    <div className={`field ${wide ? "field-wide" : ""}`}>
      <label htmlFor={id}>
        {label} {required && <span className="req">required</span>}
      </label>
      <div className={`field-input-shell ${listening ? "listening" : ""}`}>
        {textarea ? (
          <textarea id={id} placeholder={placeholder} rows={rows} value={value} onChange={e => onValue(e.target.value)} />
        ) : (
          <input id={id} placeholder={placeholder} value={value} onChange={e => onValue(e.target.value)} autoComplete="off" />
        )}
        {voice.supported && (
          <button
            type="button"
            className={`voice-inline-btn ${listening ? "listening" : ""}`}
            onClick={handleMic}
            aria-label={listening ? `Stop dictating ${label}` : `Dictate ${label}`}
            title={listening ? "Stop dictating" : "Dictate with your voice"}
          >
            {listening ? <Square size={10} fill="currentColor" strokeWidth={0} /> : <Mic size={13} strokeWidth={2} />}
          </button>
        )}
      </div>
      {listening && (
        <div className="listening-bar">
          <span className="eq" aria-hidden="true"><i /><i /><i /><i /></span>
          <span className={`listening-text ${voice.interim ? "has-interim" : ""}`}>
            {voice.interim || "Listening — speak now"}
          </span>
          <span className="listening-hint">■ to stop</span>
        </div>
      )}
      {error && <div className="voice-error">{error}</div>}
    </div>
  );
}
