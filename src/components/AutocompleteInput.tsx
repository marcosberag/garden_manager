'use client';

import React, { useState, useEffect, useRef } from 'react';

interface AutocompleteInputProps {
  id: string;
  name: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  apiEndpoint?: string;
}

export default function AutocompleteInput({ id, name, placeholder, defaultValue = '', required, apiEndpoint = '/api/plants/suggest' }: AutocompleteInputProps) {
  const [value, setValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
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
      if (value.length < 2) {
        setSuggestions([]);
        return;
      }
      
      setIsLoading(true);
      try {
        const res = await fetch(`${apiEndpoint}?q=${encodeURIComponent(value)}`);
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
      // Only fetch if the user is actually typing something new and dropdown isn't hidden by a selection
      if (value !== defaultValue) {
        fetchSuggestions();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [value, defaultValue]);

  const handleSelect = (suggestion: string) => {
    setValue(suggestion);
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
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setShowDropdown(true);
        }}
        onFocus={() => {
          if (suggestions.length > 0) setShowDropdown(true);
        }}
        autoComplete="off"
        style={{
          width: '100%',
          padding: '15px',
          backgroundColor: 'var(--color-pure-canvas)',
          border: '1px solid var(--color-mist)',
          borderRadius: '0',
          fontFamily: 'inherit',
          fontSize: '16px',
          color: 'var(--color-ink-black)',
          outline: 'none',
          borderBottom: required ? '2px solid var(--color-eucalyptus)' : '1px solid var(--color-mist)'
        }}
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
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-mist)'}
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
