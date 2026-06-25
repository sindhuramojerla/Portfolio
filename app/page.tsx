"use client";

import { useState, useEffect } from "react";
import { MealType } from "@/lib/types";
import { useAppStore, MEALS, todayKey } from "@/lib/store";
import NutritionBar from "@/components/NutritionBar";
import MealSection from "@/components/MealSection";
import AddFoodSheet from "@/components/AddFoodSheet";
import MealSummaryModal from "@/components/MealSummaryModal";
import StepProgress from "@/components/StepProgress";
import DateNav from "@/components/DateNav";
import DailySummary from "@/components/DailySummary";
import Onboarding from "@/components/Onboarding";
import SettingsSheet from "@/components/SettingsSheet";
import SyncBanner from "@/components/SyncBanner";
import { Settings, BarChart2 } from "lucide-react";

export default function Home() {
  const {
    household,
    selectedDate,
    dayLog,
    startLogging,
    stopLogging,
    markMemberDone,
    getMemberNutrition,
    loadCustomFoods,
    showSummary,
    setShowSummary,
  } = useAppStore();

  const [addState, setAddState] = useState<{
    meal: MealType;
    memberId: string;
  } | null>(null);

  const [summaryMeal, setSummaryMeal] = useState<MealType | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Load custom foods once household is set up
  useEffect(() => {
    if (household.onboardingComplete && household.householdId) {
      loadCustomFoods();
    }
  }, [household.onboardingComplete, household.householdId]);

  // ── onboarding gate ────────────────────────────────────────────────────
  if (!household.onboardingComplete) return <Onboarding />;

  const { members, householdName } = household;

  // ── helpers ────────────────────────────────────────────────────────────
  function handleAddFood(meal: MealType, memberId: string) {
    startLogging(meal, memberId);
    setAddState({ meal, memberId });
  }

  function handleSheetClose() {
    stopLogging();
    setAddState(null);
  }

  function handleAdded() {
    // food was added — keep sheet open at pick mode (handled inside AddFoodSheet)
  }

  function handleDone() {
    if (!addState) return;
    const { meal, memberId } = addState;
    markMemberDone(meal, memberId);
    stopLogging();
    setAddState(null);

    // Check if all members done → show meal summary
    setTimeout(() => {
      const mealLog = useAppStore.getState().dayLog.meals[meal];
      const allDone = members.every((m) => mealLog.doneByMember[m.id]);
      if (allDone) setSummaryMeal(meal);
    }, 50);
  }

  function handleSummaryContinue() {
    if (!summaryMeal) return;
    const idx = MEALS.indexOf(summaryMeal);
    setSummaryMeal(null);
    if (idx < MEALS.length - 1) {
      const nextMeal = MEALS[idx + 1];
      const firstMember = members[0];
      startLogging(nextMeal, firstMember.id);
      setAddState({ meal: nextMeal, memberId: firstMember.id });
    }
  }

  const activeMember = addState ? members.find((m) => m.id === addState.memberId) : undefined;

  const isToday = selectedDate === todayKey();
  const displayDate = isToday
    ? "Today"
    : new Date(selectedDate + "T12:00:00").toLocaleDateString("en-IN", {
        weekday: "long", day: "numeric", month: "long",
      });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* App bar */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">🍽️ {householdName}</h1>
            <div className="text-xs text-gray-400">{displayDate}</div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSummary(true)}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
              aria-label="Daily summary"
            >
              <BarChart2 className="w-5 h-5 text-gray-500" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Date navigation */}
      <DateNav />

      {/* Step progress */}
      <StepProgress
        members={members}
        activeMeal={addState?.meal}
        activeMemberId={addState?.memberId}
      />

      {/* Page content */}
      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto pb-16">
        {/* Daily totals */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">
            {isToday ? "Today's totals" : "Totals for this day"}
          </div>
          {members.map((member) => (
            <NutritionBar
              key={member.id}
              member={member}
              nutrition={getMemberNutrition(member.id)}
            />
          ))}
        </div>

        <div className="h-px bg-gray-200" />

        {/* Meal sections */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">
            Meals
          </div>
          {MEALS.map((meal) => (
            <MealSection key={meal} meal={meal} members={members} onAdd={handleAddFood} />
          ))}
        </div>
      </div>

      {/* Add food sheet */}
      {addState && activeMember && (
        <AddFoodSheet
          meal={addState.meal}
          member={activeMember}
          allMembers={members}
          onClose={handleSheetClose}
          onAdded={handleAdded}
          onDone={handleDone}
        />
      )}

      {/* Meal summary modal */}
      {summaryMeal && (
        <MealSummaryModal
          meal={summaryMeal}
          members={members}
          onContinue={handleSummaryContinue}
          onClose={() => setSummaryMeal(null)}
        />
      )}

      {/* Daily summary screen */}
      {showSummary && (
        <DailySummary
          members={members}
          onClose={() => setShowSummary(false)}
          onEditMeal={(meal, memberId) => {
            setShowSummary(false);
            setTimeout(() => handleAddFood(meal, memberId), 100);
          }}
        />
      )}

      {/* Settings */}
      {showSettings && <SettingsSheet onClose={() => setShowSettings(false)} />}

      {/* Sync indicator */}
      <SyncBanner />
    </div>
  );
}
