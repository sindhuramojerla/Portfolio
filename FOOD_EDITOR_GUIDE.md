# 🍽️ Food Nutrition Editor Guide

## Access the Food Editor

Visit: `http://localhost:3000/admin/foods`

## Features

✅ **View All 53 Foods** - Complete list of all preconfigured foods organized by category
✅ **Edit Nutrition Data** - Click "Edit Nutrition" to modify:
   - Calories
   - Protein (g)
   - Carbs (g)
   - Fibre (g)
   - Fat (g)
   - Source Notes

✅ **Search & Filter** - Find foods by:
   - Name or food code
   - Category (Homemade, Basic Foods, Protein, Drinks, Fruits, Additions, etc.)

✅ **Quick Stats** - View summary cards showing:
   - Total foods (53)
   - Count by major categories
   - Number of validated foods

## How to Use

### View Food Details
1. Click on any food row to expand it
2. See complete nutrition breakdown
3. View serving size and data confidence level

### Edit Nutrition
1. Expand a food
2. Click "Edit Nutrition" button
3. Modify values (decimals supported)
4. Click "Save Changes"
5. Changes are immediately saved to Supabase

### Filter Foods
- **Search Box**: Type name or food_code to search
- **Category Dropdown**: Filter by food category
- Both filters work together

## Food Categories

- **Homemade**: Curries, dal, sauté dishes (18 foods)
- **Basic Foods**: Rice, roti, dosa, idli, milk, eggs (11 foods)
- **Packaged Foods**: Bread, curd (3 foods)
- **Drinks**: Coffee, chai, miso soup (3 foods)
- **Protein**: Chicken, fish, protein powders (4 foods)
- **Fruits**: Banana, mango, berries, etc. (7 foods)
- **Additions**: Potato, coconut, peanuts, oil, sugar (7 foods)

## Data Confidence Levels

- 🟢 **Validated**: Verified against USDA or official sources
- 🟡 **Approximate**: Standard recipe estimates
- 🔴 **Draft**: Unverified - update before trusting

## What Gets Synced

When you make edits in the Food Editor:
- Changes save directly to Supabase
- The app immediately reflects updates
- Custom foods created in the app are separate and unaffected
- All 53 foods always available app-wide

## Next: Seed Updated Data

If you've made changes to `foodConfig.ts` and want to push them to Supabase:

```bash
npm run seed
```

This will update all foods in Supabase based on foodConfig.ts.

---

**All 53 foods now available!** 🎉
