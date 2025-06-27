import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Promotions() {
  const { userData } = useAuth();
  const [promotions, setPromotions] = useState([
    { 
      id: '1', 
      title: 'Weekend Special', 
      description: 'Get 20% off all court bookings on weekends',
      startDate: '2025-09-10',
      endDate: '2025-09-30',
      discountPercent: 20,
      active: true
    },
    { 
      id: '2', 
      title: 'First-Time Player', 
      description: 'New players get their first hour free',
      startDate: '2025-09-01',
      endDate: '2025-12-31',
      discountPercent: 100,
      active: true
    }
  ]);

  const [newPromotion, setNewPromotion] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    discountPercent: 10,
    active: true
  });

  // This would typically connect to your Firebase backend
  const handleAddPromotion = () => {
    const id = Math.random().toString(36).substr(2, 9);
    setPromotions([...promotions, { id, ...newPromotion }]);
    setNewPromotion({
      title: '',
      description: '',
      startDate: '',
      endDate: '',
      discountPercent: 10,
      active: true
    });
  };

  const handleToggleActive = (id: string) => {
    setPromotions(promotions.map(promo => 
      promo.id === id ? { ...promo, active: !promo.active } : promo
    ));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Promotions & Discounts</h1>
      </div>

      {/* Add New Promotion Form */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Create New Promotion</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={newPromotion.title}
              onChange={(e) => setNewPromotion({...newPromotion, title: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g. Summer Special"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Discount Percentage
            </label>
            <input
              type="number"
              value={newPromotion.discountPercent}
              onChange={(e) => setNewPromotion({...newPromotion, discountPercent: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="10"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={newPromotion.startDate}
              onChange={(e) => setNewPromotion({...newPromotion, startDate: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={newPromotion.endDate}
              onChange={(e) => setNewPromotion({...newPromotion, endDate: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={newPromotion.description}
              onChange={(e) => setNewPromotion({...newPromotion, description: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
              placeholder="Describe your promotion..."
            />
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={handleAddPromotion}
            className="px-4 py-2 bg-primary-600 text-white font-medium rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            Create Promotion
          </button>
        </div>
      </div>

      {/* Promotions List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Promotion
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Period
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Discount
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {promotions.map((promo) => (
              <tr key={promo.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{promo.title}</div>
                  <div className="text-sm text-gray-500">{promo.description}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {new Date(promo.startDate).toLocaleDateString()} - {new Date(promo.endDate).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{promo.discountPercent}% off</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${promo.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {promo.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button 
                    onClick={() => handleToggleActive(promo.id)}
                    className="text-primary-600 hover:text-primary-900 mr-3"
                  >
                    {promo.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button className="text-red-600 hover:text-red-900">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}