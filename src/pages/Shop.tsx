import React from 'react';

export default function Shop() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Shop</h1>
        <p className="text-gray-600">Browse and purchase pickleball equipment</p>
      </div>
      
      <div className="glass-card p-6">
        <div className="text-center py-12">
          <h2 className="text-xl font-medium text-gray-700 mb-2">Coming Soon</h2>
          <p className="text-gray-600">
            Shop functionality is under development. Check back soon!
          </p>
        </div>
      </div>
    </div>
  );
}