/**
 * Integration tests for store auth flows
 * Tests the main PHASE 1 auth flows without modifying Supabase data
 */

import { useAppStore } from "./store";

describe("Store Auth Integration", () => {
  test("Store initializes with no user", () => {
    const store = useAppStore.getState();
    expect(store.currentUserId).toBeNull();
    expect(store.knownHouseholds).toEqual([]);
  });

  test("Store has initAuth method", () => {
    const store = useAppStore.getState();
    expect(typeof store.initAuth).toBe("function");
  });

  test("Store has saveHousehold method", () => {
    const store = useAppStore.getState();
    expect(typeof store.saveHousehold).toBe("function");
  });

  test("Store has joinHousehold method", () => {
    const store = useAppStore.getState();
    expect(typeof store.joinHousehold).toBe("function");
  });

  test("Household config is properly typed", () => {
    const store = useAppStore.getState();
    expect(store.household).toHaveProperty("householdId");
    expect(store.household).toHaveProperty("householdName");
    expect(store.household).toHaveProperty("members");
  });

  test("Known households list is properly typed", () => {
    const store = useAppStore.getState();
    expect(Array.isArray(store.knownHouseholds)).toBe(true);
  });
});

describe("Store Household Operations", () => {
  test("saveHousehold updates current household", async () => {
    const store = useAppStore.getState();
    const testConfig = {
      householdId: "test-household-id",
      householdName: "Test House",
      onboardingComplete: true,
      joinCode: "HPTEST",
      members: [
        {
          id: "test-member",
          name: "Test User",
          initials: "TU",
          avatarColor: "bg-blue-400",
          goals: { calories: 2000, protein: 100, carbs: 200, fibre: 25, fat: 60 },
        },
      ],
    };

    // Note: This won't actually save to Supabase without auth,
    // but the store should accept the operation
    await store.saveHousehold(testConfig);

    const updated = useAppStore.getState();
    expect(updated.household.householdId).toBe("test-household-id");
    expect(updated.household.householdName).toBe("Test House");
  });

  test("switchHousehold requires existing household", async () => {
    const store = useAppStore.getState();
    // Attempting to switch to non-existent household should be no-op
    await store.switchHousehold("non-existent-id");
    // Should not crash
  });
});

describe("Store Food Operations", () => {
  test("trackRecentFood adds to recent list", () => {
    const store = useAppStore.getState();
    store.trackRecentFood("APPLE");
    store.trackRecentFood("BANANA");

    const updated = useAppStore.getState();
    expect(updated.recentFoodCodes).toContain("APPLE");
    expect(updated.recentFoodCodes).toContain("BANANA");
  });

  test("recentFoodCodes maintains max 20 items", () => {
    const store = useAppStore.getState();
    for (let i = 0; i < 25; i++) {
      store.trackRecentFood(`FOOD_${i}`);
    }

    const updated = useAppStore.getState();
    expect(updated.recentFoodCodes.length).toBeLessThanOrEqual(20);
  });
});

describe("Store Date Navigation", () => {
  test("goToToday resets to today", async () => {
    const store = useAppStore.getState();
    const today = new Date().toISOString().split("T")[0];

    await store.goToToday();

    const updated = useAppStore.getState();
    expect(updated.selectedDate).toBe(today);
  });

  test("setSelectedDate changes date", async () => {
    const store = useAppStore.getState();
    const testDate = "2024-01-15";

    await store.setSelectedDate(testDate);

    const updated = useAppStore.getState();
    expect(updated.selectedDate).toBe(testDate);
  });
});
