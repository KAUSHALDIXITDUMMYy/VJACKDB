import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Plus, Trash2, Edit, Save, X, Search, Briefcase } from 'lucide-react';

interface Broker {
  id: string;
  name: string;
  commissionType: 'percentage' | 'flat' | 'both';
  commissionPercentage?: number;
  flatCommission?: number;
  referralPercentage?: number;
  referralFlat?: number;
  specialScenarios: string[];
  createdAt: Date;
}

export default function Brokers() {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [filteredBrokers, setFilteredBrokers] = useState<Broker[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingBroker, setEditingBroker] = useState<Broker | null>(null);
  const [newBroker, setNewBroker] = useState<{
    name: string;
    commissionType: 'percentage' | 'flat' | 'both';
    commissionPercentage: string;
    flatCommission: string;
    referralPercentage: string;
    referralFlat: string;
    specialScenarios: string[];
  }>({
    name: '',
    commissionType: 'both',
    commissionPercentage: '',
    flatCommission: '',
    referralPercentage: '',
    referralFlat: '',
    specialScenarios: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBrokers();
  }, []);

  useEffect(() => {
    // Filter brokers based on search term
    const filtered = brokers.filter(broker =>
      broker.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredBrokers(filtered);
  }, [brokers, searchTerm]);

  const fetchBrokers = async () => {
    try {
      const brokersSnapshot = await getDocs(collection(db, 'brokers'));
      const brokersData = brokersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        specialScenarios: doc.data().specialScenarios || []
      })) as Broker[];
      setBrokers(brokersData);
    } catch (error) {
      console.error('Error fetching brokers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBroker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBroker.name.trim()) return;

    try {
      await addDoc(collection(db, 'brokers'), {
        name: newBroker.name.trim(),
        commissionType: newBroker.commissionType,
        commissionPercentage: newBroker.commissionPercentage ? Number(newBroker.commissionPercentage) : 0,
        flatCommission: newBroker.flatCommission ? Number(newBroker.flatCommission) : 0,
        referralPercentage: newBroker.referralPercentage ? Number(newBroker.referralPercentage) : 0,
        referralFlat: newBroker.referralFlat ? Number(newBroker.referralFlat) : 0,
        specialScenarios: newBroker.specialScenarios,
        createdAt: new Date()
      });
      setNewBroker({
        name: '',
        commissionType: 'both',
        commissionPercentage: '',
        flatCommission: '',
        referralPercentage: '',
        referralFlat: '',
        specialScenarios: []
      });
      setShowModal(false);
      fetchBrokers();
    } catch (error) {
      console.error('Error adding broker:', error);
    }
  };

  const handleEditBroker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBroker || !editingBroker.name.trim()) return;

    try {
      await updateDoc(doc(db, 'brokers', editingBroker.id), {
        name: editingBroker.name.trim(),
        commissionType: editingBroker.commissionType,
        commissionPercentage: editingBroker.commissionPercentage || 0,
        flatCommission: editingBroker.flatCommission || 0,
        referralPercentage: editingBroker.referralPercentage || 0,
        referralFlat: editingBroker.referralFlat || 0,
        specialScenarios: editingBroker.specialScenarios || [],
        updatedAt: new Date()
      });
      setEditingBroker(null);
      fetchBrokers();
    } catch (error) {
      console.error('Error updating broker:', error);
    }
  };

  const handleDeleteBroker = async (brokerId: string) => {
    if (window.confirm('Are you sure you want to delete this broker?')) {
      try {
        await deleteDoc(doc(db, 'brokers', brokerId));
        fetchBrokers();
      } catch (error) {
        console.error('Error deleting broker:', error);
      }
    }
  };

  const toggleScenario = (scenario: string, isNew: boolean = false) => {
    if (isNew) {
      setNewBroker(prev => ({
        ...prev,
        specialScenarios: prev.specialScenarios.includes(scenario)
          ? prev.specialScenarios.filter(s => s !== scenario)
          : [...prev.specialScenarios, scenario]
      }));
    } else if (editingBroker) {
      setEditingBroker(prev => ({
        ...prev!,
        specialScenarios: prev!.specialScenarios.includes(scenario)
          ? prev!.specialScenarios.filter(s => s !== scenario)
          : [...prev!.specialScenarios, scenario]
      }));
    }
  };

  const commonScenarios = [
    "Accounts Brokered (No Referral & No Funding)",
    "Accounts Brokered (With a Referral But No Funding)",
    "Accounts Brokered (No Referral)",
    "Accounts Brokered (With a Referral)",
    "Accounts Brokered & Funded",
    "Accounts Brokered (With a Referral & Funding)"
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
            Brokers Management
          </h1>
          <p className="text-gray-400 mt-1">Manage brokers and their commission structures</p>
        </div>
        
        <button
          onClick={() => setShowModal(true)}
          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Add New Broker</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search brokers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white/5 border border-orange-500/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      {/* Brokers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12">
            <div className="text-gray-400">Loading brokers...</div>
          </div>
        ) : filteredBrokers.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">
              {searchTerm ? 'No brokers found matching your search.' : 'No brokers found. Create your first broker!'}
            </p>
          </div>
        ) : (
          filteredBrokers.map((broker) => (
            <div
              key={broker.id}
              className="bg-black/20 backdrop-blur-sm rounded-xl p-6 border border-orange-500/20 hover:scale-105 transition-transform duration-200"
            >
              {editingBroker?.id === broker.id ? (
                <form onSubmit={handleEditBroker} className="space-y-4">
                  <input
                    type="text"
                    value={editingBroker.name}
                    onChange={(e) => setEditingBroker({ ...editingBroker, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-orange-500/20 rounded-lg text-white text-lg font-semibold"
                    required
                  />
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Commission Type</label>
                    <select
                      value={editingBroker.commissionType}
                      onChange={(e) => setEditingBroker({ 
                        ...editingBroker, 
                        commissionType: e.target.value as 'percentage' | 'flat' | 'both' 
                      })}
                      className="w-full px-3 py-2 bg-white/5 border border-orange-500/20 rounded-lg text-white"
                    >
                      <option className="text-gray-900" value="percentage">Percentage Only</option>
                      <option className="text-gray-900" value="flat">Flat Only</option>
                      <option className="text-gray-900" value="both">Both Percentage and Flat</option>
                    </select>
                  </div>
                  
                  {(editingBroker.commissionType === 'percentage' || editingBroker.commissionType === 'both') && (
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Commission Percentage</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={editingBroker.commissionPercentage || ''}
                          onChange={(e) => setEditingBroker({ ...editingBroker, commissionPercentage: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 pr-8 bg-white/5 border border-orange-500/20 rounded-lg text-white"
                          required={true}
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
                      </div>
                    </div>
                  )}
                  
                  {(editingBroker.commissionType === 'flat' || editingBroker.commissionType === 'both') && (
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Flat Commission</label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editingBroker.flatCommission || ''}
                          onChange={(e) => setEditingBroker({ ...editingBroker, flatCommission: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 pr-8 bg-white/5 border border-orange-500/20 rounded-lg text-white"
                          required={true}
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Referral Percentage (if applicable)</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={editingBroker.referralPercentage || ''}
                        onChange={(e) => setEditingBroker({ ...editingBroker, referralPercentage: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 pr-8 bg-white/5 border border-orange-500/20 rounded-lg text-white"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Flat Referral (if applicable)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editingBroker.referralFlat || ''}
                        onChange={(e) => setEditingBroker({ ...editingBroker, referralFlat: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 pr-8 bg-white/5 border border-orange-500/20 rounded-lg text-white"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Special Scenarios</label>
                    <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                      {commonScenarios.map(scenario => (
                        <label key={scenario} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={editingBroker.specialScenarios.includes(scenario)}
                            onChange={() => toggleScenario(scenario)}
                            className="rounded bg-white/5 border-orange-500/20 text-amber-500 focus:ring-amber-500"
                          />
                          <span className="text-sm text-gray-300">{scenario}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      type="submit"
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-3 rounded-lg flex items-center justify-center"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingBroker(null)}
                      className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 px-3 rounded-lg flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500">
                        <Briefcase className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{broker.name}</h3>
                        <p className="text-sm text-gray-400">
                          Commission: {
                            broker.commissionType === 'percentage' ? `${broker.commissionPercentage}%` :
                            broker.commissionType === 'flat' ? `$${broker.flatCommission} flat` :
                            `${broker.commissionPercentage}% + $${broker.flatCommission} flat`
                          }
                        </p>
                        {(broker.referralPercentage || broker.referralFlat) && (
                          <p className="text-sm text-gray-400">
                            Referral: {
                              broker.referralPercentage && broker.referralFlat ? 
                                `${broker.referralPercentage}% + $${broker.referralFlat} flat` :
                                broker.referralPercentage ? `${broker.referralPercentage}%` :
                                `$${broker.referralFlat} flat`
                            }
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setEditingBroker(broker)}
                        className="p-2 text-gray-400 hover:text-amber-400 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteBroker(broker.id)}
                        className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {broker.specialScenarios && broker.specialScenarios.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-300 mb-2">Special Scenarios:</h4>
                      <ul className="text-sm text-gray-400 space-y-1">
                        {broker.specialScenarios.map((scenario, index) => (
                          <li key={index} className="flex items-start">
                            <span className="text-amber-400 mr-2">•</span>
                            <span>{scenario}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="text-sm text-gray-400">
                    Created: {broker.createdAt.toLocaleDateString()}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Broker Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-black/80 backdrop-blur-lg rounded-xl p-8 border border-orange-500/20 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-6">Add New Broker</h2>
            <form onSubmit={handleAddBroker} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Broker Name
                </label>
                <input
                  type="text"
                  value={newBroker.name}
                  onChange={(e) => setNewBroker({ ...newBroker, name: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-orange-500/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="Enter broker name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Commission Type
                </label>
                <select
                  value={newBroker.commissionType}
                  onChange={(e) => setNewBroker({ 
                    ...newBroker, 
                    commissionType: e.target.value as 'percentage' | 'flat' | 'both' 
                  })}
                  className="w-full px-4 py-3 bg-white/5 border border-orange-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option className="text-gray-900" value="percentage">Percentage Only</option>
                  <option className="text-gray-900" value="flat">Flat Only</option>
                  <option className="text-gray-900" value="both">Both Percentage and Flat</option>
                </select>
              </div>
              
              {(newBroker.commissionType === 'percentage' || newBroker.commissionType === 'both') && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Commission Percentage
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={newBroker.commissionPercentage}
                      onChange={(e) => setNewBroker({ ...newBroker, commissionPercentage: e.target.value })}
                      className="w-full px-4 py-3 pr-8 bg-white/5 border border-orange-500/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="Enter commission percentage"
                      required={true}
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
                  </div>
                </div>
              )}
              
              {(newBroker.commissionType === 'flat' || newBroker.commissionType === 'both') && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Flat Commission
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newBroker.flatCommission}
                      onChange={(e) => setNewBroker({ ...newBroker, flatCommission: e.target.value })}
                      className="w-full px-4 py-3 pr-8 bg-white/5 border border-orange-500/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="Enter flat commission amount"
                      required={true}
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Referral Percentage (if applicable)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={newBroker.referralPercentage}
                    onChange={(e) => setNewBroker({ ...newBroker, referralPercentage: e.target.value })}
                    className="w-full px-4 py-3 pr-8 bg-white/5 border border-orange-500/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="Enter referral percentage"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Flat Referral (if applicable)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newBroker.referralFlat}
                    onChange={(e) => setNewBroker({ ...newBroker, referralFlat: e.target.value })}
                    className="w-full px-4 py-3 pr-8 bg-white/5 border border-orange-500/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="Enter flat referral amount"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Special Scenarios
                </label>
                <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                  {commonScenarios.map(scenario => (
                    <label key={scenario} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newBroker.specialScenarios.includes(scenario)}
                        onChange={() => toggleScenario(scenario, true)}
                        className="rounded bg-white/5 border-orange-500/20 text-amber-500 focus:ring-amber-500"
                      />
                      <span className="text-sm text-gray-300">{scenario}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200"
                >
                  Add Broker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}