"use client";

import { MealType, Member } from "@/lib/types";
import { useAppStore, MEALS } from "@/lib/store";
import { getMemberColors } from "@/lib/colors";
import { CheckCircle } from "lucide-react";

interface Props {
  members: Member[];
  activeMeal?: MealType;
  activeMemberId?: string;
}

export default function StepProgress({ members, activeMeal, activeMemberId }: Props) {
  const { dayLog } = useAppStore();

  return (
    <div className="px-4 py-2 bg-white border-b border-gray-100 overflow-x-auto scrollbar-none">
      <div className="flex items-center gap-1 min-w-max">
        {MEALS.map((meal, mIdx) => {
          const mLog    = dayLog.meals[meal];
          const allDone = members.every((m) => mLog.doneByMember[m.id]);
          const isActive = meal === activeMeal;

          return (
            <div key={meal} className="flex items-center gap-1">
              {mIdx > 0 && (
                <div className={`w-4 h-px ${allDone ? "bg-green-400" : "bg-gray-200"}`} />
              )}
              <div className={`flex flex-col items-center px-2 py-1 rounded-xl ${isActive ? "bg-orange-50" : ""}`}>
                <div className="text-xs font-semibold text-gray-700 whitespace-nowrap">{meal}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  {members.map((member, mbrIdx) => {
                    const done   = !!mLog.doneByMember[member.id];
                    const active = isActive && activeMemberId === member.id;
                    const c      = getMemberColors(member.avatarColor);

                    return (
                      <div key={member.id} className="flex items-center gap-0.5">
                        {mbrIdx > 0 && <span className="text-gray-300 text-xs">→</span>}
                        {done ? (
                          <div className="flex items-center gap-0.5">
                            <span className="text-xs text-gray-500">{member.initials[0]}</span>
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          </div>
                        ) : (
                          <div className={`flex items-center gap-0.5 ${active ? c.text : "text-gray-400"}`}>
                            <span className="text-xs font-medium">{member.initials[0]}</span>
                            {active && <div className={`w-1.5 h-1.5 rounded-full ${c.bg} animate-pulse`} />}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
