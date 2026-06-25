"use client";

import { useAppStore, todayKey } from "@/lib/store";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useRef } from "react";

export default function DateNav() {
  const { selectedDate, goToPrevDay, goToNextDay, goToToday, setSelectedDate } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const today = todayKey();
  const isToday = selectedDate === today;

  const displayDate = new Date(selectedDate + "T12:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: selectedDate.slice(0, 4) !== today.slice(0, 4) ? "numeric" : undefined,
  });

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100">
      {/* Prev */}
      <button
        onClick={goToPrevDay}
        className="p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
        aria-label="Previous day"
      >
        <ChevronLeft className="w-5 h-5 text-gray-500" />
      </button>

      {/* Date label + calendar picker */}
      <button
        onClick={() => inputRef.current?.showPicker?.()}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors relative"
      >
        <CalendarDays className="w-4 h-4 text-gray-400" />
        <span className={`text-sm font-semibold ${isToday ? "text-orange-600" : "text-gray-700"}`}>
          {isToday ? "Today" : displayDate}
        </span>
        {/* hidden native date input for picker */}
        <input
          ref={inputRef}
          type="date"
          max={today}
          value={selectedDate}
          onChange={(e) => { if (e.target.value) setSelectedDate(e.target.value); }}
          className="absolute inset-0 opacity-0 w-full cursor-pointer"
          aria-label="Pick a date"
        />
      </button>

      {/* Next or Today */}
      {isToday ? (
        <div className="w-9" /> // spacer to keep layout balanced
      ) : (
        <button
          onClick={selectedDate >= today ? undefined : goToNextDay}
          className="p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
          aria-label="Next day"
        >
          <ChevronRight className="w-5 h-5 text-gray-500" />
        </button>
      )}

      {/* Today shortcut — only when viewing a past date */}
      {!isToday && (
        <button
          onClick={goToToday}
          className="text-xs font-semibold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg"
        >
          Today
        </button>
      )}
    </div>
  );
}
