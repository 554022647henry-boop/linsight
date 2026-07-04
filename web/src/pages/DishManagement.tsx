import { useState, useEffect } from 'react';
import { Dish } from '../types';
import { getDishes, createDish, updateDish, updateDishStatus, deleteDish } from '../api/dishes';

interface DishFormData {
  name: string;
  category: string;
  price: string;
  cost_estimate: string;
  is_active: 0 | 1;
  sort_order: string;
}

const categories = ['主食', '小菜', '饮品', '汤品'];

export default function DishManagement() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [formData, setFormData] = useState<DishFormData>({
    name: '',
    category: '主食',
    price: '',
    cost_estimate: '',
    is_active: 1,
    sort_order: '0',
  });

  useEffect(() => {
    loadDishes();
  }, []);

  async function loadDishes() {
    setLoading(true);
    try {
      const data = await getDishes();
      setDishes(data);
    } catch (error) {
      console.error('Failed to load dishes:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingDish(null);
    setFormData({
      name: '',
      category: '主食',
      price: '',
      cost_estimate: '',
      is_active: 1,
      sort_order: '0',
    });
    setShowModal(true);
  }

  function openEditModal(dish: Dish) {
    setEditingDish(dish);
    setFormData({
      name: dish.name,
      category: dish.category,
      price: String(dish.price),
      cost_estimate: String(dish.cost_estimate || ''),
      is_active: dish.is_active,
      sort_order: String(dish.sort_order),
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingDish) {
        await updateDish(editingDish.id, {
          name: formData.name,
          category: formData.category,
          price: parseFloat(formData.price),
          cost_estimate: formData.cost_estimate ? parseFloat(formData.cost_estimate) : null,
          is_active: formData.is_active,
          sort_order: parseInt(formData.sort_order),
        });
      } else {
        await createDish({
          name: formData.name,
          category: formData.category,
          price: parseFloat(formData.price),
          cost_estimate: formData.cost_estimate ? parseFloat(formData.cost_estimate) : null,
          is_active: formData.is_active,
          sort_order: parseInt(formData.sort_order),
          image_url: null,
        });
      }
      setShowModal(false);
      loadDishes();
    } catch (error) {
      console.error('Failed to save dish:', error);
    }
  }

  async function handleToggleStatus(dish: Dish) {
    try {
      await updateDishStatus(dish.id, dish.is_active === 1 ? 0 : 1);
      loadDishes();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  }

  async function handleDelete(dish: Dish) {
    if (!confirm(`确定删除菜品「${dish.name}」吗？`)) return;
    try {
      await deleteDish(dish.id);
      loadDishes();
    } catch (error) {
      console.error('Failed to delete dish:', error);
    }
  }

  const activeDishes = dishes.filter(d => d.is_active === 1);
  const inactiveDishes = dishes.filter(d => d.is_active === 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">菜品管理</h2>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + 新增菜品
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <h3 className="text-sm font-medium text-gray-700 mb-3">在售菜品</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {activeDishes.map(dish => (
                <div key={dish.id} className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900">{dish.name}</h4>
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">上架</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{dish.category}</p>
                  <p className="text-lg font-bold text-blue-600 mb-3">¥{dish.price.toFixed(2)}</p>
                  {dish.cost_estimate && (
                    <p className="text-xs text-gray-500 mb-3">成本估算: ¥{dish.cost_estimate.toFixed(2)}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(dish)}
                      className="flex-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleToggleStatus(dish)}
                      className="flex-1 px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                    >
                      下架
                    </button>
                    <button
                      onClick={() => handleDelete(dish)}
                      className="flex-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {inactiveDishes.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">已下架菜品</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {inactiveDishes.map(dish => (
                  <div key={dish.id} className="bg-gray-50 rounded-lg shadow p-4 opacity-60">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900">{dish.name}</h4>
                      <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded">下架</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{dish.category}</p>
                    <p className="text-lg font-bold text-gray-600 mb-3">¥{dish.price.toFixed(2)}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(dish)}
                        className="flex-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleToggleStatus(dish)}
                        className="flex-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                      >
                        上架
                      </button>
                      <button
                        onClick={() => handleDelete(dish)}
                        className="flex-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold">{editingDish ? '编辑菜品' : '新增菜品'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">菜品名称 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">售价 *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">成本估算</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.cost_estimate}
                    onChange={e => setFormData({ ...formData, cost_estimate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active === 1}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked ? 1 : 0 })}
                  className="mr-2"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">上架</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingDish ? '保存修改' : '创建菜品'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}