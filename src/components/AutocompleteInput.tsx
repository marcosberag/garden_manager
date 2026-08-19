'use client';

import React, { useState, useEffect, useRef } from 'react';

interface AutocompleteInputProps {
  id: string;
  name: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  apiEndpoint?: string;
  // Modo controlado: si llegan value/onChange, el estado vive en el padre
  // (lo necesita la ficha de producto para poder rellenar desde el escáner).
  value?: string;
  onChange?: (value: string) => void;
}

export default function AutocompleteInput({ id, name, placeholder, defaultValue = '', required, apiEndpoint = '/api/plants/suggest', value, onChange }: AutocompleteInputProps) {
  const [interno, setInterno] = useState(defaultValue);
  const valor = value !== undefined ? value : interno;
  const cambiar = (v: string) => {
    if (onChange) onChange(v);
    else setInterno(v);
  };

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  // Solo se piden sugerencias mientras el usuario teclea aquí: un valor puesto
  // desde fuera (el escáner) no debe abrir el desplegable.
  const [enfocado, setEnfocado] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Click outside to close dropdown
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (valor.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch(`${apiEndpoint}?q=${encodeURIComponent(valor)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
          setShowDropdown(true);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce to prevent hitting the API on every single keystroke
    const timeoutId = setTimeout(() => {
      if (enfocado && valor !== defaultValue) {
        fetchSuggestions();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, defaultValue, enfocado]);

  const handleSelect = (suggestion: string) => {
    cambiar(suggestion);
    setShowDropdown(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        id={id}
        name={name}
        required={required}
        placeholder={placeholder}
        value={valor}
        onChange={(e) => {
          cambiar(e.target.value);
          setShowDropdown(true);
        }}
        onFocus={() => {
          setEnfocado(true);
          if (suggestions.length > 0) setShowDropdown(true);
        }}
        onBlur={() => setEnfocado(false)}
        autoComplete="off"
        className="input-field"
        style={{ borderBottom: required ? '2px solid var(--color-eucalyptus)' : undefined }}
      />

      {isLoading && (
        <div style={{ position: 'absolute', right: '15px', top: '15px', fontSize: '12px', color: 'var(--color-graphite)' }}>
          Buscando...
        </div>
      )}

      {showDropdown && suggestions.length > 0 && (
        <ul style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: '#fff',
          border: '1px solid var(--color-mist)',
          borderTop: 'none',
          listStyle: 'none',
          margin: 0,
          padding: 0,
          zIndex: 10,
          boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          {suggestions.map((suggestion, index) => (
            <li
              key={index}
              onClick={() => handleSelect(suggestion)}
              style={{
                padding: '12px 15px',
                cursor: 'pointer',
                borderBottom: index < suggestions.length - 1 ? '1px solid var(--color-mist)' : 'none',
                fontSize: '14px',
                color: 'var(--color-ink-black)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-fog)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
