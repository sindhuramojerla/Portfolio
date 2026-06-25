"use client";

import { Member, Nutrition } from "@/lib/types";
import { getMemberColors } from "@/lib/colors";

interface Props {
  member: Member;
  nutrition: Nutrition;
}

export default function NutritionBar({ member, nutrition }: Props) {
  const c = getMemberColors(member.avatarColor);
  const { goals } = member;
  const remaining = Math.max(0, goals.calories - nutrition.calories);
  const pct = Math.min(100, goals.calories > 0 ? (nutrition.calories / goals.calories) * 100 : 0);

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full ${c.bg} flex items-center justify-center text-white text-xs font-bold`}>
            {member.initials}
          </div>
          <span className="font-semibold text-gray-800 text-base">{member.name}</span>
        </div>
        <span className={`text-xs font-medium ${c.text}`}>
          {remaining} kcal left
        </span>
      </div>

      <div className="flex items-end gap-1 mb-2 mt-2">
        <span className={`text-3xl font-bold ${c.text}`}>{nutrition.calories}</span>
        <span className="text-sm text-gray-400 mb-1">/ {goals.calories} kcal</span>
      </div>

      <div className={`h-2 rounded-full ${c.lightMid} mb-3`}>
        <div className={`h-2 rounded-full ${c.bg} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: "Protein", val: nutrition.protein },
          { label: "Carbs",   val: nutrition.carbs   },
          { label: "Fibre",   val: nutrition.fibre   },
          { label: "Fat",     val: nutrition.fat     },
        ].map((m) => (
          <div key={m.label}>
            <div className="text-xs text-gray-400">{m.label}</div>
            <div className="text-sm font-semibold text-gray-700">
              {Math.round(m.val * 10) / 10}
              <span className="text-xs font-normal text-gray-400">g</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
