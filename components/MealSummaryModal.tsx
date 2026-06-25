"use client";

import { MealType, Member } from "@/lib/types";
import { useAppStore, MEALS } from "@/lib/store";
import { getMemberColors } from "@/lib/colors";
import { CheckCircle } from "lucide-react";

interface Props {
  meal: MealType;
  members: Member[];
  onContinue: () => void;
  onClose: () => void;
}

const NEXT_MEAL: Record<MealType, MealType | null> = {
  Breakfast: "Lunch",
  Lunch:     "Dinner",
  Dinner:    "Snacks",
  Snacks:    null,
};

export default function MealSummaryModal({ meal, members, onContinue, onClose }: Props) {
  const { getMealNutrition } = useAppStore();
  const next = NEXT_MEAL[meal];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-3xl p-6 space-y-5 max-w-lg mx-auto">
        <div className="flex justify-center">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="text-center space-y-1">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
          <div className="text-xl font-bold text-gray-800">{meal} complete</div>
        </div>

        <div className="space-y-3">
          {members.map((member) => {
            const c    = getMemberColors(member.avatarColor);
            const cals = getMealNutrition(meal, member.id).calories;
            return (
              <div key={member.id} className={`flex items-center justify-between ${c.light} rounded-2xl px-4 py-3`}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full ${c.bg} flex items-center justify-center text-white text-xs font-bold`}>
                    {member.initials}
                  </div>
                  <span className="font-medium text-gray-800">{member.name}</span>
                </div>
                <span className={`text-lg font-bold ${c.text}`}>{cals} kcal</span>
              </div>
            );
          })}
        </div>

        <div className="space-y-2 pt-1">
          {next && (
            <button onClick={onContinue} className="w-full py-4 rounded-2xl bg-gray-900 text-white font-semibold text-base">
              Continue to {next} →
            </button>
          )}
          <button onClick={onClose} className="w-full py-3 rounded-2xl bg-gray-100 text-gray-700 font-semibold">
            Back to Today
          </button>
        </div>
      </div>
    </div>
  );
}
