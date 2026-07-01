'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ChevronDown, Edit2, Save, X } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Food {
  id: string;
  food_code: string;
  name: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fibre: number;
  fat: number;
  default_serving_qty: number;
  default_serving_unit: string;
  confidence: string;
  source_notes?: string;
}

export default function FoodsAdminPage() {
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Food>>({});
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchFoods();
  }, []);

  const fetchFoods = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .is('household_id', null)
        .order('category', { ascending: true });

      if (error) {
        console.error('Supabase error details:', error);
        throw new Error(error.message || 'Failed to fetch foods from Supabase');
      }
      setFoods(data || []);
    } catch (err) {
      console.error('Error fetching foods:', err instanceof Error ? err.message : err);
      alert(`Failed to load foods: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (food: Food) => {
    setEditingId(food.id);
    setEditData({ ...food });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveChanges = async () => {
    if (!editingId) return;

    try {
      const { error } = await supabase
        .from('foods')
        .update({
          calories: editData.calories,
          protein: editData.protein,
          carbs: editData.carbs,
          fibre: editData.fibre,
          fat: editData.fat,
          source_notes: editData.source_notes,
        })
        .eq('id', editingId);

      if (error) throw error;

      setFoods(foods.map(f => f.id === editingId ? { ...f, ...editData } : f));
      setEditingId(null);
      setEditData({});
      alert('✅ Food updated successfully');
    } catch (err) {
      console.error('Error updating food:', err);
      alert('Failed to update food');
    }
  };

  const filteredFoods = foods.filter(food => {
    const matchesCategory = categoryFilter === 'all' || food.category === categoryFilter;
    const matchesSearch = food.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         food.food_code.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = Array.from(new Set(foods.map(f => f.category))).sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading foods...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-rose-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Food Nutrition Editor</h1>
          <p className="text-gray-600">View and edit nutritional information for all {foods.length} foods</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                placeholder="Search by name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Foods Grid */}
        <div className="space-y-3">
          {filteredFoods.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg">
              <p className="text-gray-500">No foods found</p>
            </div>
          ) : (
            filteredFoods.map(food => (
              <div key={food.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                {/* Food Row */}
                <button
                  onClick={() => setExpandedId(expandedId === food.id ? null : food.id)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  <div className="flex items-center flex-1 gap-4">
                    <ChevronDown
                      size={20}
                      className={`text-gray-400 transition transform ${expandedId === food.id ? 'rotate-180' : ''}`}
                    />
                    <div className="text-left flex-1">
                      <h3 className="font-semibold text-gray-900">{food.name}</h3>
                      <p className="text-sm text-gray-500">{food.category} • {food.food_code}</p>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="hidden md:flex gap-6 text-right">
                    <div>
                      <div className="text-lg font-bold text-orange-600">{food.calories}</div>
                      <div className="text-xs text-gray-500">cal</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-600">{food.protein}g</div>
                      <div className="text-xs text-gray-500">protein</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-yellow-600">{food.carbs}g</div>
                      <div className="text-xs text-gray-500">carbs</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-red-600">{food.fat}g</div>
                      <div className="text-xs text-gray-500">fat</div>
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {expandedId === food.id && (
                  <div className="border-t border-gray-100 px-6 py-6 bg-gray-50">
                    {editingId === food.id ? (
                      // Edit Mode
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Calories</label>
                            <input
                              type="number"
                              value={editData.calories || 0}
                              onChange={(e) => setEditData({...editData, calories: parseFloat(e.target.value)})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Protein (g)</label>
                            <input
                              type="number"
                              step="0.1"
                              value={editData.protein || 0}
                              onChange={(e) => setEditData({...editData, protein: parseFloat(e.target.value)})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Carbs (g)</label>
                            <input
                              type="number"
                              step="0.1"
                              value={editData.carbs || 0}
                              onChange={(e) => setEditData({...editData, carbs: parseFloat(e.target.value)})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fibre (g)</label>
                            <input
                              type="number"
                              step="0.1"
                              value={editData.fibre || 0}
                              onChange={(e) => setEditData({...editData, fibre: parseFloat(e.target.value)})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fat (g)</label>
                            <input
                              type="number"
                              step="0.1"
                              value={editData.fat || 0}
                              onChange={(e) => setEditData({...editData, fat: parseFloat(e.target.value)})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Source Notes</label>
                          <textarea
                            value={editData.source_notes || ''}
                            onChange={(e) => setEditData({...editData, source_notes: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            rows={2}
                          />
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={saveChanges}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                          >
                            <Save size={18} />
                            Save Changes
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                          >
                            <X size={18} />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-6">
                          <div className="text-center">
                            <div className="text-3xl font-bold text-orange-600">{food.calories}</div>
                            <div className="text-sm text-gray-600 mt-1">Calories</div>
                          </div>
                          <div className="text-center">
                            <div className="text-3xl font-bold text-blue-600">{food.protein}</div>
                            <div className="text-sm text-gray-600 mt-1">Protein (g)</div>
                          </div>
                          <div className="text-center">
                            <div className="text-3xl font-bold text-yellow-600">{food.carbs}</div>
                            <div className="text-sm text-gray-600 mt-1">Carbs (g)</div>
                          </div>
                          <div className="text-center">
                            <div className="text-3xl font-bold text-green-600">{food.fibre}</div>
                            <div className="text-sm text-gray-600 mt-1">Fibre (g)</div>
                          </div>
                          <div className="text-center">
                            <div className="text-3xl font-bold text-red-600">{food.fat}</div>
                            <div className="text-sm text-gray-600 mt-1">Fat (g)</div>
                          </div>
                        </div>

                        <div className="bg-white rounded-lg p-4 mb-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Serving Size:</span>
                              <span className="ml-2 font-medium">{food.default_serving_qty} {food.default_serving_unit}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Confidence:</span>
                              <span className={`ml-2 font-medium px-2 py-1 rounded text-xs ${
                                food.confidence === 'validated' ? 'bg-green-100 text-green-800' :
                                food.confidence === 'approximate' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {food.confidence}
                              </span>
                            </div>
                          </div>
                          {food.source_notes && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <p className="text-xs text-gray-600">📝 {food.source_notes}</p>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => startEditing(food)}
                          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
                        >
                          <Edit2 size={18} />
                          Edit Nutrition
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Summary Stats */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-gray-900">{foods.length}</div>
            <div className="text-sm text-gray-600 mt-1">Total Foods</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-orange-600">{foods.filter(f => f.category === 'Homemade').length}</div>
            <div className="text-sm text-gray-600 mt-1">Homemade</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{foods.filter(f => f.category === 'Basic Foods').length}</div>
            <div className="text-sm text-gray-600 mt-1">Basic Foods</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{foods.filter(f => f.confidence === 'validated').length}</div>
            <div className="text-sm text-gray-600 mt-1">Validated</div>
          </div>
        </div>
      </div>
    </div>
  );
}
