"use client";

import { MealType, Member, LoggedFood } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { getMemberColors } from "@/lib/colors";
import { CheckCircle, Plus, Trash2 } from "lucide-react";

interface Props {
  meal: MealType;
  members: Member[];
  onAdd: (meal: MealType, memberId: string) => void;
}

const MEAL_ICONS: Record<MealType, string> = {
  Breakfast: "☀️",
  Lunch:     "🌤️",
  Dinner:    "🌙",
  Snacks:    "🍎",
};

export default function MealSection({ meal, members, onAdd }: Props) {
  const { dayLog, getMealNutrition } = useAppStore();
  const mealLog = dayLog.meals[meal];
  const allDone = members.every((m) => mealLog.doneByMember[m.id]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
        <span className="text-lg">{MEAL_ICONS[meal]}</span>
        <span className="font-semibold text-gray-800">{meal}</span>
        {allDone && (
          <span className="ml-auto text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">
            Complete
          </span>
        )}
      </div>

      {members.map((member, idx) => {
        const nutrition = getMealNutrition(meal, member.id);
        const done      = !!mealLog.doneByMember[member.id];
        const foods     = mealLog.foodsByMember[member.id] ?? [];
        const isLast    = idx === members.length - 1;

        return (
          <div key={member.id}>
            <MemberRow
              member={member}
              calories={nutrition.calories}
              done={done}
              foods={foods}
              meal={meal}
              onAdd={() => onAdd(meal, member.id)}
            />
            {!isLast && <div className="border-t border-gray-100" />}
          </div>
        );
      })}
    </div>
  );
}

function MemberRow({ member, calories, done, foods, meal, onAdd }: {
  member: Member;
  calories: number;
  done: boolean;
  foods: LoggedFood[];
  meal: MealType;
  onAdd: () => void;
}) {
  const { removeFood } = useAppStore();
  const c = getMemberColors(member.avatarColor);

  return (
    <div className="px-4 py-3">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <div className={`w-7 h-7 rounded-full ${c.bg} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
          {member.initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-gray-800">{member.name}</span>
            {done && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
          </div>
          {calories > 0 ? (
            <span className={`text-xs font-semibold ${c.text}`}>
              {calories} kcal
              <span className="text-gray-400 font-normal ml-1">
                · {foods.length} item{foods.length !== 1 ? "s" : ""}
              </span>
            </span>
          ) : (
            <span className="text-xs text-gray-400">No food added yet</span>
          )}
        </div>

        {/* Always-active Add button */}
        <button
          onClick={onAdd}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold
                     bg-gray-900 text-white border border-gray-900
                     active:bg-gray-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {/* Logged food chips */}
      {foods.length > 0 && (
        <div className="mt-2 space-y-1 pl-10">
          {foods.map((f) => (
            <div key={f.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium text-gray-800 truncate block">
                  {f.isQuickEntry ? (f.quickDescription ?? f.foodItem.name) : f.foodItem.name}
                  {f.isQuickEntry && (
                    <span className="ml-1.5 text-gray-400 font-normal">(estimate)</span>
                  )}
                </span>
                <span className="text-xs text-gray-500">{f.portion}</span>
              </div>
              <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                <span className={`text-xs font-semibold ${c.text}`}>{f.nutrition.calories} kcal</span>
                <button
                  onClick={() => removeFood(f.id, meal, member.id)}
                  className="p-1 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
