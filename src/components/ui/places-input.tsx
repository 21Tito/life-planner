"use client";

import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";

let mapsLoaded = false;
let mapsLoading: Promise<void> | null = null;

function loadMaps(): Promise<void> {
  if (mapsLoaded) return Promise.resolve();
  if (mapsLoading) return mapsLoading;
  mapsLoading = new Loader({
    apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: ["places"],
  })
    .load()
    .then(() => { mapsLoaded = true; });
  return mapsLoading;
}

interface Suggestion {
  placeId: string;
  description: string;
  mainText: string;
}

interface PlacesInputProps {
  value: string;
  onChange: (location: string, mapsUrl?: string) => void;
  placeholder?: string;
  className?: string;
}

export function PlacesInput({ value, onChange, placeholder, className }: PlacesInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadMaps().then(() => {
      autocompleteService.current = new google.maps.places.AutocompleteService();
      // PlacesService needs a DOM element or map
      const div = document.createElement("div");
      placesService.current = new google.maps.places.PlacesService(div);
      setReady(true);
    });
  }, []);

  // Sync external value changes (e.g. opening edit modal with existing value)
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setInputValue(val);
    onChange(val); // keep parent in sync as user types
    setActiveIndex(-1);

    if (!ready || val.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    autocompleteService.current!.getPlacePredictions(
      { input: val },
      (predictions, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestions(
            predictions.slice(0, 5).map((p) => ({
              placeId: p.place_id,
              description: p.description,
              mainText: p.structured_formatting.main_text,
            }))
          );
          setOpen(true);
        } else {
          setSuggestions([]);
          setOpen(false);
        }
      }
    );
  }

  function selectSuggestion(suggestion: Suggestion) {
    setInputValue(suggestion.mainText);
    setSuggestions([]);
    setOpen(false);

    // Fetch place details to get the Maps URL
    placesService.current!.getDetails(
      { placeId: suggestion.placeId, fields: ["url", "name"] },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          onChange(place.name || suggestion.mainText, place.url || undefined);
        } else {
          onChange(suggestion.mainText);
        }
      }
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent input blur before click
                selectSuggestion(s);
              }}
              className={`px-3 py-2.5 cursor-pointer text-sm flex flex-col gap-0.5 ${
                i === activeIndex ? "bg-blue-50" : "hover:bg-gray-50"
              }`}
            >
              <span className="font-medium text-gray-900 truncate">{s.mainText}</span>
              <span className="text-xs text-gray-400 truncate">{s.description}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
