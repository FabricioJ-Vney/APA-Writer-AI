import React, { useState, useEffect } from 'react';
import { Settings, X, Key, Database, Info } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, onSave }) {
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');

  useEffect(() => {
    // Cargar valores existentes desde localStorage o fallbacks de .env
    setSupabaseUrl(localStorage.getItem('apa_supabase_url') || import.meta.env.VITE_SUPABASE_URL || '');
    setSupabaseKey(localStorage.getItem('apa_supabase_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '');
    setGeminiKey(localStorage.getItem('apa_gemini_key') || import.meta.env.VITE_GEMINI_API_KEY || '');
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Guardar en localStorage
    localStorage.setItem('apa_supabase_url', supabaseUrl.trim());
    localStorage.setItem('apa_supabase_key', supabaseKey.trim());
    localStorage.setItem('apa_gemini_key', geminiKey.trim());

    onSave({
      supabaseUrl: supabaseUrl.trim(),
      supabaseKey: supabaseKey.trim(),
      geminiKey: geminiKey.trim()
    });
    
    alert('Configuración guardada correctamente. La aplicación se recargará para aplicar las credenciales.');
    window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <div className="settings-modal-overlay">
      <div className="settings-modal animated-fade-in">
        <div className="modal-header">
          <span className="modal-title">
            <Settings size={18} className="icon-blue" />
            Configuración del Desarrollador (API Keys)
          </span>
          <button type="button" className="close-tool" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-help-box" style={{ background: '#f0f4f9', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d3e3fd', fontSize: '11px', display: 'flex', gap: '8px', alignItems: 'flex-start', color: '#1a73e8', lineHeight: '1.4' }}>
            <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              La aplicación lee primero las variables del archivo <code>.env</code> local. Sin embargo, puedes sobrescribirlas temporalmente ingresando las claves aquí. Se almacenarán únicamente en tu navegador (<code>localStorage</code>).
            </span>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Database size={14} className="icon-blue" />
              Supabase Project URL
            </label>
            <input 
              type="url" 
              className="form-input"
              placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Key size={14} className="icon-blue" />
              Supabase Anon Key (API Key pública)
            </label>
            <input 
              type="password" 
              className="form-input"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={supabaseKey}
              onChange={(e) => setSupabaseKey(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} className="icon-blue" />
              Google Gemini API Key
            </label>
            <input 
              type="password" 
              className="form-input"
              placeholder="AIzaSy..."
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
            />
            <span className="form-help">
              Puedes obtener una API Key gratuita en <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>Google AI Studio</a> para activar correcciones en tiempo real.
            </span>
          </div>

          <div className="modal-actions">
            <button 
              type="button" 
              className="btn btn-secondary btn-small"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="btn btn-primary btn-small"
            >
              Guardar y Recargar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
