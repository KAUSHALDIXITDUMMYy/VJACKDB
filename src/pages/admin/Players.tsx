import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { doc as firestoreDoc, setDoc, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Plus, UserPlus, Trash2, Edit, Save, X, Search, ChevronDown, ChevronUp, UserCheck, UserX } from 'lucide-react';
import { createUserWithEmailAndPassword } from 'firebase/auth';

interface Player {
  id: string;
  uid: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
  status?: string; // For inactive players
  percentage?: number; // Player's winning percentage
}

export default function Players() {
  const [activePlayers, setActivePlayers] = useState<Player[]>([]);
  const [inactivePlayers, setInactivePlayers] = useState<Player[]>([]);
  const [filteredActivePlayers, setFilteredActivePlayers] = useState<Player[]>([]);
  const [filteredInactivePlayers, setFilteredInactivePlayers] = useState<Player[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [newPlayer, setNewPlayer] = useState({
    email: '',
    password: '',
    name: '',
    percentage: ''
  });
  const [loading, setLoading] = useState(true);
  const [activePlayersExpanded, setActivePlayersExpanded] = useState(true);
  const [inactivePlayersExpanded, setInactivePlayersExpanded] = useState(true);
  // Add local state for editing percentage input
  const [editingPercentage, setEditingPercentage] = useState<string>('');

  useEffect(() => {
    fetchPlayers();
  }, []);

  useEffect(() => {
    // Filter players based on search term
    const filteredActive = activePlayers.filter(player =>
      player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredActivePlayers(filteredActive);

    const filteredInactive = inactivePlayers.filter(player =>
      player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredInactivePlayers(filteredInactive);
  }, [activePlayers, inactivePlayers, searchTerm]);

  const fetchPlayers = async () => {
    try {
      setLoading(true);
      
      // Fetch active players (from users collection)
      const activeQuery = query(collection(db, 'users'), where('role', '==', 'player'));
      const activeSnapshot = await getDocs(activeQuery);
      const activeData = activeSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Player[];
      setActivePlayers(activeData);

      // Fetch inactive players (from players collection)
      const inactiveQuery = query(collection(db, 'players'));
      const inactiveSnapshot = await getDocs(inactiveQuery);
      const inactiveData = inactiveSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Player[];
      setInactivePlayers(inactiveData);
    } catch (error) {
      console.error('Error fetching players:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayer.email || !newPlayer.password || !newPlayer.name) return;

    try {
      // Create player in the players collection (inactive)
      await addDoc(collection(db, 'players'), {
        email: newPlayer.email,
        password: newPlayer.password, // Note: In production, this should be hashed
        name: newPlayer.name,
        role: 'player',
        status: 'pending',
        createdAt: new Date(),
        percentage: Number(newPlayer.percentage) || 0
      });
      
      setNewPlayer({ email: '', password: '', name: '', percentage: '' });
      setShowModal(false);
      fetchPlayers();
    } catch (error) {
      console.error('Error adding player:', error);
    }
  };

  const handleEditPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer || !editingPlayer.name.trim()) return;

    try {
      // Determine which collection to update based on player status
      const collectionName = editingPlayer.status ? 'players' : 'users';
      await updateDoc(doc(db, collectionName, editingPlayer.id), {
        name: editingPlayer.name.trim(),
        email: editingPlayer.email.trim(),
        percentage: editingPlayer.percentage === undefined ? 0 : editingPlayer.percentage,
        updatedAt: new Date()
      });
      setEditingPlayer(null);
      fetchPlayers();
    } catch (error) {
      console.error('Error updating player:', error);
    }
  };

  const handleDeletePlayer = async (playerId: string, isActive: boolean) => {
    if (window.confirm('Are you sure you want to delete this player? This action cannot be undone.')) {
      try {
        // Delete from appropriate collection
        const collectionName = isActive ? 'users' : 'players';
        await deleteDoc(doc(db, collectionName, playerId));
        fetchPlayers();
      } catch (error) {
        console.error('Error deleting player:', error);
      }
    }
  };

  const activatePlayer = async (playerId: string) => {
    if (window.confirm('Are you sure you want to activate this player?')) {
      try {
        const playerToActivate = inactivePlayers.find(p => p.id === playerId);
        if (!playerToActivate) return;

        // Create user in users collection (active)
        await addDoc(collection(db, 'users'), {
          email: playerToActivate.email,
          name: playerToActivate.name,
          role: 'player',
          createdAt: new Date()
        });
        
        // Remove from inactive players
        await deleteDoc(doc(db, 'players', playerId));
        
        fetchPlayers();
      } catch (error) {
        console.error('Error activating player:', error);
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Clickers Management
          </h1>
          <p className="text-gray-400 mt-1">Manage active and inactive clicker accounts</p>
        </div>
        
        <button
          onClick={() => setShowModal(true)}
          className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Add New Clicker</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search clickers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
        />
      </div>

      {/* Active Players Section */}
      <div className="bg-black/20 backdrop-blur-sm rounded-xl border border-green-500/20 overflow-hidden">
        <button
          onClick={() => setActivePlayersExpanded(!activePlayersExpanded)}
          className="w-full flex items-center justify-between p-6 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500">
              <UserCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Active Clickers</h2>
              <p className="text-sm text-gray-400">{activePlayers.length} registered clickers</p>
            </div>
          </div>
          {activePlayersExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>
        
        {activePlayersExpanded && (
          <div className="p-6 pt-0">
            {loading ? (
              <div className="text-center py-8">
                <div className="text-gray-400">Loading active clickers...</div>
              </div>
            ) : filteredActivePlayers.length === 0 ? (
              <div className="text-center py-8">
                <UserCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400">
                  {searchTerm ? 'No active clickers found matching your search.' : 'No active clickers found.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredActivePlayers.map((player) => (
                  <div
                    key={player.id}
                    className="bg-white/5 rounded-xl p-6 border border-green-500/20 hover:scale-105 transition-transform duration-200"
                  >
                    {editingPlayer?.id === player.id ? (
                      <form onSubmit={handleEditPlayer} className="space-y-4">
                        <input
                          type="text"
                          value={editingPlayer.name}
                          onChange={(e) => setEditingPlayer({ ...editingPlayer, name: e.target.value })}
                          className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white text-lg font-semibold"
                          placeholder="Player Name"
                          required
                        />
                        <input
                          type="email"
                          value={editingPlayer.email}
                          onChange={(e) => setEditingPlayer({ ...editingPlayer, email: e.target.value })}
                          className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white"
                          placeholder="Email Address"
                          required
                        />
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={editingPercentage}
                            onChange={(e) => setEditingPercentage(e.target.value)}
                            onBlur={() => setEditingPlayer(editingPlayer ? { ...editingPlayer, percentage: editingPercentage === '' ? undefined : Number(editingPercentage) } : null)}
                            className="w-full px-3 py-2 pr-8 bg-white/5 border border-purple-500/20 rounded-lg text-white"
                            placeholder="Percentage (%)"
                            required
                          />
                          <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
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
                            onClick={() => setEditingPlayer(null)}
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
                            <div className="p-3 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500">
                              <UserCheck className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-white">{player.name}</h3>
                              <p className="text-sm text-gray-400">{player.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => { setEditingPlayer(player); setEditingPercentage(player.percentage !== undefined ? String(player.percentage) : ''); }}
                              className="p-2 text-gray-400 hover:text-cyan-400 transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePlayer(player.id, true)}
                              className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="text-gray-400">
                            Status: <span className="text-green-400">Active</span>
                          </div>
                          <div className="text-gray-400">
                            Created: {player.createdAt.toLocaleDateString()}
                          </div>
                          <div className="text-gray-400">
                            Commission: {typeof player.percentage === 'number' ? player.percentage : 0}%
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inactive Players Section */}
      <div className="bg-black/20 backdrop-blur-sm rounded-xl border border-orange-500/20 overflow-hidden">
        <button
          onClick={() => setInactivePlayersExpanded(!inactivePlayersExpanded)}
          className="w-full flex items-center justify-between p-6 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500">
              <UserX className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Inactive Clickers</h2>
              <p className="text-sm text-gray-400">{inactivePlayers.length} pending clickers</p>
            </div>
          </div>
          {inactivePlayersExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>
        
        {inactivePlayersExpanded && (
          <div className="p-6 pt-0">
            {loading ? (
              <div className="text-center py-8">
                <div className="text-gray-400">Loading inactive clickers...</div>
              </div>
            ) : filteredInactivePlayers.length === 0 ? (
              <div className="text-center py-8">
                <UserX className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400">
                  {searchTerm ? 'No inactive clickers found matching your search.' : 'No inactive clickers found.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredInactivePlayers.map((player) => (
                  <div
                    key={player.id}
                    className="bg-white/5 rounded-xl p-6 border border-orange-500/20 hover:scale-105 transition-transform duration-200"
                  >
                    {editingPlayer?.id === player.id ? (
                      <form onSubmit={handleEditPlayer} className="space-y-4">
                        <input
                          type="text"
                          value={editingPlayer.name}
                          onChange={(e) => setEditingPlayer({ ...editingPlayer, name: e.target.value })}
                          className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white text-lg font-semibold"
                          placeholder="Player Name"
                          required
                        />
                        <input
                          type="email"
                          value={editingPlayer.email}
                          onChange={(e) => setEditingPlayer({ ...editingPlayer, email: e.target.value })}
                          className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white"
                          placeholder="Email Address"
                          required
                        />
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={editingPlayer?.percentage ?? 0}
                          onChange={(e) => setEditingPlayer(editingPlayer ? { ...editingPlayer, percentage: Number(e.target.value) } : null)}
                          className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white"
                          placeholder="Percentage (%)"
                          required
                        />
                        <div className="flex space-x-2">
                          <button
                            type="submit"
                            className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-3 rounded-lg flex items-center justify-center"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPlayer(null)}
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
                            <div className="p-3 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500">
                              <UserX className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-white">{player.name}</h3>
                              <p className="text-sm text-gray-400">{player.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => setEditingPlayer(player)}
                              className="p-2 text-gray-400 hover:text-cyan-400 transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePlayer(player.id, false)}
                              className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="text-gray-400">
                            Status: <span className="text-orange-400 capitalize">{player.status || 'pending'}</span>
                          </div>
                          <div className="text-gray-400">
                            Created: {player.createdAt.toLocaleDateString()}
                          </div>
                          <div className="text-gray-400">
                            Commission: {typeof player.percentage === 'number' ? player.percentage : 0}%
                          </div>
                        </div>

                        
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Player Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-black/80 backdrop-blur-lg rounded-xl p-8 border border-purple-500/20 w-full max-w-md">
            <h2 className="text-2xl font-bold text-white mb-6">Add New Clicker</h2>
            <form onSubmit={handleAddPlayer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newPlayer.name}
                  onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  placeholder="Enter clicker name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={newPlayer.email}
                  onChange={(e) => setNewPlayer({ ...newPlayer, email: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  placeholder="Enter email address"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={newPlayer.password}
                  onChange={(e) => setNewPlayer({ ...newPlayer, password: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  placeholder="Enter password"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Percentage (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newPlayer.percentage}
                  onChange={(e) => setNewPlayer({ ...newPlayer, percentage: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  placeholder="Enter clicker percentage"
                  required
                />
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
                  className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200"
                >
                  Add Clicker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}