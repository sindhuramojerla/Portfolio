"use client";

import { Member, MealType, Nutrition } from "@/lib/types";
import { useAppStore, MEALS, todayKey } from "@/lib/store";
import { X, ChevronLeft, ChevronRight, Edit2 } from "lucide-react";
import { getMemberColors } from "@/lib/colors";

interface Props {
  members: Member[];
  onClose: () => void;
  onEditMeal: (meal: MealType, memberId: string) => void;
}

const MEAL_ICONS: Record<MealType, string> = {
  Breakfast: "☀️", Lunch: "🌤️", Dinner: "🌙", Snacks: "🍎",
};

export default function DailySummary({ members, onClose, onEditMeal }: Props) {
  const {
    getMemberNutrition, getMealNutrition,
    selectedDate, goToPrevDay, goToNextDay,
  } = useAppStore();

  const today = todayKey();
  const isToday = selectedDate === today;

  const displayDate = new Date(selectedDate + "T12:00:00").toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 flex-shrink-0">
        <div className="w-9" />
        <div className="flex-1 text-center">
          <div className="font-semibold text-gray-800">Daily Summary</div>
          <div className="text-xs text-gray-400">{isToday ? "Today" : displayDate}</div>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
          <X className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Date nav strip */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-gray-50">
        <button onClick={goToPrevDay} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ChevronLeft className="w-4 h-4 text-gray-500" />
        </button>
        <span className="text-sm font-medium text-gray-600">{isToday ? "Today" : displayDate}</span>
        <button
          onClick={goToNextDay}
          disabled={isToday}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {members.map((member) => {
          const nutrition = getMemberNutrition(member.id);
          const goals     = member.goals;

          return (
            <MemberSummaryCard
              key={member.id}
              member={member}
              nutrition={nutrition}
              goals={goals}
              meal_nutritions={Object.fromEntries(
                MEALS.map((m) => [m, getMealNutrition(m, member.id)])
              ) as Record<MealType, Nutrition>}
              onEditMeal={(meal) => onEditMeal(meal, member.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function MemberSummaryCard({
  member, nutrition, goals, meal_nutritions, onEditMeal,
}: {
  member: Member;
  nutrition: Nutrition;
  goals: { calories: number; protein: number; carbs: number; fibre: number; fat: number };
  meal_nutritions: Record<MealType, Nutrition>;
  onEditMeal: (meal: MealType) => void;
}) {
  const c = getMemberColors(member.avatarColor);
  const textColor = c.text;
  const lightBg   = c.light;
  const barColor  = c.bg;

  const remaining = Math.max(0, goals.calories - nutrition.calories);
  const calPct    = Math.min(100, (nutrition.calories / goals.calories) * 100);
  const insight   = generateInsight(nutrition, goals);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Member header */}
      <div className={`${lightBg} px-4 py-3 flex items-center gap-3`}>
        <div className={`w-9 h-9 rounded-full ${member.avatarColor} flex items-center justify-center text-white text-sm font-bold`}>
          {member.initials}
        </div>
        <div>
          <div className="font-semibold text-gray-800">{member.name}</div>
          <div className={`text-xs ${textColor}`}>{remaining} kcal remaining</div>
        </div>
        <div className="ml-auto text-right">
          <div className={`text-2xl font-bold ${textColor}`}>{nutrition.calories}</div>
          <div className="text-xs text-gray-400">/ {goals.calories} kcal</div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Calorie bar */}
        <div className={`h-2.5 rounded-full ${c.lightMid}`}>
          <div className={`h-2.5 rounded-full ${barColor} transition-all duration-500`} style={{ width: `${calPct}%` }} />
        </div>

        {/* Nutrients */}
        <div className="space-y-2.5">
          {([
            { label: "Protein",       val: nutrition.protein, goal: goals.protein },
            { label: "Carbohydrates", val: nutrition.carbs,   goal: goals.carbs   },
            { label: "Fibre",         val: nutrition.fibre,   goal: goals.fibre   },
            { label: "Fat",           val: nutrition.fat,     goal: goals.fat     },
          ]).map(({ label, val, goal }) => (
            <NutrientRow key={label} label={label} val={val} goal={goal} barColor={barColor} />
          ))}
        </div>

        {/* Meal breakdown */}
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Meal breakdown</div>
          <div className="grid grid-cols-2 gap-2">
            {MEALS.map((meal) => {
              const cals = meal_nutritions[meal].calories;
              return (
                <button
                  key={meal}
                  onClick={() => onEditMeal(meal)}
                  className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5 text-left active:bg-gray-100"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{MEAL_ICONS[meal]}</span>
                    <span className="text-xs font-medium text-gray-600">{meal}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-gray-700">{cals}</span>
                    <Edit2 className="w-2.5 h-2.5 text-gray-300" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Insight */}
        {insight && (
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <div className="text-xs font-semibold text-gray-500 mb-0.5">Daily note</div>
            <div className="text-sm text-gray-600">{insight}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function NutrientRow({ label, val, goal, barColor }: {
  label: string; val: number; goal: number; barColor: string;
}) {
  const pct  = Math.min(100, goal > 0 ? (val / goal) * 100 : 0);
  const diff = Math.round(val - goal);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span className="text-xs text-gray-400">
          {Math.round(val * 10) / 10}g
          <span className="text-gray-300 mx-1">/</span>
          {goal}g
          {Math.abs(diff) > 2 && (
            <span className={`ml-1 ${diff > 0 ? "text-amber-500" : "text-gray-400"}`}>
              ({diff > 0 ? "+" : ""}{diff}g)
            </span>
          )}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100">
        <div className={`h-1.5 rounded-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Generate a single positive daily insight — never shame-based. */
function generateInsight(
  nutrition: Nutrition,
  goals: { calories: number; protein: number; carbs: number; fibre: number; fat: number }
): string {
  const calDiff = nutrition.calories - goals.calories;
  const calPct  = goals.calories > 0 ? nutrition.calories / goals.calories : 0;

  if (nutrition.calories === 0) return "Nothing logged yet today — add your first meal when ready.";

  const insights: string[] = [];

  // Calorie insight
  if (calPct >= 0.9 && calPct <= 1.1) {
    insights.push("You were close to your calorie target today.");
  } else if (calPct < 0.6) {
    insights.push("Calorie intake was lower than usual today.");
  } else if (calPct < 0.9) {
    insights.push(`About ${Math.round(goals.calories - nutrition.calories)} kcal below target.`);
  } else if (calPct > 1.15) {
    insights.push(`Calorie intake was a bit above target today.`);
  }

  // Protein insight
  const proteinDiff = nutrition.protein - goals.protein;
  if (proteinDiff < -15) {
    insights.push(`Protein was ${Math.abs(Math.round(proteinDiff))}g below target.`);
  } else if (proteinDiff >= 0) {
    insights.push("Protein goal reached.");
  }

  // Fibre insight
  if (nutrition.fibre >= goals.fibre) {
    insights.push("Great fibre intake today.");
  }

  return insights.slice(0, 2).join(" ");
}
