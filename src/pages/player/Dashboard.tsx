import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, updateDoc, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { CreditCard, TrendingUp, Calendar, ExternalLink, Filter, Edit, Trash2, Save, X } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Account {
  id: string;
  type: 'pph' | 'legal';
  username?: string;
  name?: string;
  websiteURL?: string;
  agentName: string;
  status: 'active' | 'inactive';
  depositAmount?: number;
}

interface Entry {
  id: string;
  accountId: string;
  date: string;
  profitLoss: number;
  startingBalance: number;
  endingBalance: number;
  refillAmount: number;
  withdrawal: number;
  notes: string;
}

export default function PlayerDashboard() {
  const { userData } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [accountFilter, setAccountFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [playerPercentage, setPlayerPercentage] = useState<number>(0);

  useEffect(() => {
    if (userData?.uid) {
      fetchPlayerData();
      fetchPlayerPercentage();
    }
  }, [userData]);

  const fetchPlayerData = async () => {
    if (!userData?.uid) return;
    
    try {
      // Fetch assigned accounts
      const accountsQuery = query(collection(db, 'accounts'), where('assignedToPlayerUid', '==', userData.uid));
      const accountsSnapshot = await getDocs(accountsQuery);
      const accountsData = await Promise.all(
        accountsSnapshot.docs.map(async (accountDoc) => {
          const accountData = accountDoc.data();
          
          // Get agent name
          try {
            const agentDoc = await getDoc(doc(db, 'agents', accountData.agentId));
            const agentName = agentDoc.exists() ? agentDoc.data().name : 'Unknown Agent';
            
            return {
              id: accountDoc.id,
              type: accountData.type || 'pph',
              username: accountData.username,
              name: accountData.name,
              websiteURL: accountData.websiteURL,
              agentName,
              status: accountData.status || 'active',
              depositAmount: accountData.depositAmount
            };
          } catch (error) {
            console.error('Error fetching agent data:', error);
            return {
              id: accountDoc.id,
              type: accountData.type || 'pph',
              username: accountData.username,
              name: accountData.name,
              websiteURL: accountData.websiteURL,
              agentName: 'Unknown Agent',
              status: accountData.status || 'active',
              depositAmount: accountData.depositAmount
            };
          }
        })
      );
      setAccounts(accountsData);
  
      // Fetch entries for assigned accounts with proper ordering
      if (accountsData.length > 0) {
        const entriesQuery = query(
          collection(db, 'entries'), 
          where('playerUid', '==', userData.uid),
          orderBy('date', 'desc')
        );
        const entriesSnapshot = await getDocs(entriesQuery);
        const entriesData = entriesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Entry[];
        setEntries(entriesData);
      }
    } catch (error) {
      console.error('Error fetching player data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayerPercentage = async () => {
    if (!userData?.uid) return;
    try {
      // Try to get from users collection first
      let playerDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', userData.uid)));
      let percentage = 0;
      if (!playerDoc.empty) {
        percentage = playerDoc.docs[0].data().percentage || 0;
      } else {
        // Fallback to players collection (inactive)
        playerDoc = await getDocs(query(collection(db, 'players'), where('uid', '==', userData.uid)));
        if (!playerDoc.empty) {
          percentage = playerDoc.docs[0].data().percentage || 0;
        }
      }
      setPlayerPercentage(percentage);
    } catch (error) {
      setPlayerPercentage(0);
    }
  };

  const handleEditEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    
    setSaving(true);
    try {
      // Calculate profit/loss
      const profitLoss = editingEntry.endingBalance - editingEntry.startingBalance + editingEntry.withdrawal - editingEntry.refillAmount;
      
      await updateDoc(doc(db, 'entries', editingEntry.id), {
        ...editingEntry,
        profitLoss,
        updatedAt: new Date()
      });
      setEditingEntry(null);
      fetchPlayerData();
    } catch (error) {
      console.error('Error updating entry:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      try {
        await deleteDoc(doc(db, 'entries', entryId));
        fetchPlayerData();
      } catch (error) {
        console.error('Error deleting entry:', error);
      }
    }
  };

  const handleEditInputChange = (field: keyof Entry, value: string | number) => {
    setEditingEntry(prev => prev ? ({
      ...prev,
      [field]: value
    }) : null);
  };

  const totalProfit = entries.reduce((sum, entry) => sum + (entry.profitLoss || 0), 0);
  const activeAccounts = accounts.filter(acc => acc.status === 'active');
  const inactiveAccounts = accounts.filter(acc => acc.status === 'inactive');

  const filteredAccounts = accountFilter === 'all' ? accounts : 
                          accountFilter === 'active' ? activeAccounts : inactiveAccounts;

  const playerShare = totalProfit * (playerPercentage / 100);

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-cyberpunk-blue to-cyberpunk-pink bg-clip-text text-transparent">
          Clicker's Dashboard
        </h1>
        <p className="text-cyberpunk-yellow mt-1">Welcome back, {userData?.name}!</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="bg-gradient-to-r from-cyberpunk-blue/10 to-cyberpunk-pink/10 backdrop-blur-sm rounded-xl p-4 lg:p-6 border border-cyberpunk-blue/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs lg:text-sm text-gray-400">Total Accounts</p>
              <p className="text-xl lg:text-2xl font-bold text-cyberpunk-blue">{accounts.length}</p>
            </div>
            <CreditCard className="w-6 h-6 lg:w-8 lg:h-8 text-cyberpunk-blue" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-cyberpunk-green/10 to-emerald-500/10 backdrop-blur-sm rounded-xl p-4 lg:p-6 border border-cyberpunk-green/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs lg:text-sm text-gray-400">Active Accounts</p>
              <p className="text-xl lg:text-2xl font-bold text-cyberpunk-green">{activeAccounts.length}</p>
            </div>
            <div className="w-3 h-3 bg-cyberpunk-green rounded-full"></div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-cyberpunk-red/10 to-pink-500/10 backdrop-blur-sm rounded-xl p-4 lg:p-6 border border-cyberpunk-red/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs lg:text-sm text-gray-400">Inactive Accounts</p>
              <p className="text-xl lg:text-2xl font-bold text-cyberpunk-red">{inactiveAccounts.length}</p>
            </div>
            <div className="w-3 h-3 bg-cyberpunk-red rounded-full"></div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-cyberpunk-violet/10 to-pink-500/10 backdrop-blur-sm rounded-xl p-4 lg:p-6 border border-cyberpunk-violet/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs lg:text-sm text-gray-400">Total Profit/Loss (Company)</p>
              <p className={`text-xl lg:text-2xl font-bold ${totalProfit >= 0 ? 'text-cyberpunk-green' : 'text-cyberpunk-red'}`}>${totalProfit.toLocaleString()}</p>
              <p className="text-xs lg:text-sm text-gray-400 mt-1">Your Share ({playerPercentage}%): <span className={`font-bold ${playerShare >= 0 ? 'text-cyberpunk-green' : 'text-cyberpunk-red'}`}>${playerShare.toLocaleString()}</span></p>
              <p className="text-xs lg:text-sm text-gray-400">Clicker Commission ({playerPercentage}% of Gross): <span className={`font-bold ${playerShare >= 0 ? 'text-cyberpunk-green' : 'text-cyberpunk-red'}`}>${playerShare.toLocaleString()}</span></p>
            </div>
            <TrendingUp className="w-6 h-6 lg:w-8 lg:h-8 text-cyberpunk-violet" />
          </div>
        </div>
      </div>

      {/* Account Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <span className="text-gray-400 text-sm">Filter accounts:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All Accounts' },
            { key: 'active', label: 'Active Only' },
            { key: 'inactive', label: 'Inactive Only' }
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => setAccountFilter(filter.key as any)}
              className={`px-3 py-1 rounded-lg transition-all duration-200 text-sm ${
                accountFilter === filter.key
                  ? 'bg-gradient-to-r from-cyberpunk-blue to-cyberpunk-pink text-white'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Assigned Accounts */}
      <div className="bg-black/20 backdrop-blur-sm rounded-xl p-4 lg:p-6 border border-cyberpunk-violet/20">
        <h2 className="text-lg lg:text-xl font-bold text-white mb-4 lg:mb-6">Your Assigned Accounts</h2>
        
        {loading ? (
          <div className="text-center py-8">
            <div className="text-gray-400">Loading accounts...</div>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="text-center py-8">
            <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">
              {accountFilter === 'all' 
                ? 'No accounts assigned yet.' 
                : `No ${accountFilter} accounts found.`}
            </p>
            {accountFilter === 'all' && (
              <p className="text-sm text-gray-500 mt-2">Contact your administrator to get accounts assigned.</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {filteredAccounts.map((account) => (
              <div
                key={account.id}
                className={`backdrop-blur-sm rounded-xl p-4 lg:p-6 border hover:scale-105 transition-transform duration-200 ${
                  account.status === 'active'
                    ? 'bg-gradient-to-r from-cyberpunk-green/10 to-emerald-500/10 border-cyberpunk-green/20'
                    : 'bg-gradient-to-r from-cyberpunk-red/10 to-pink-500/10 border-cyberpunk-red/20'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 lg:p-3 rounded-lg ${
                      account.status === 'active'
                        ? 'bg-gradient-to-r from-cyberpunk-green to-emerald-500'
                        : 'bg-gradient-to-r from-cyberpunk-red to-pink-500'
                    }`}>
                      <CreditCard className="w-4 h-4 lg:w-6 lg:h-6 text-white" />
                    </div>
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 space-y-1 sm:space-y-0">
                        <h3 className="text-base lg:text-lg font-semibold text-white">
                          {account.type === 'pph' ? account.username : account.name}
                        </h3>
                        <div className="flex items-center space-x-1">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            account.type === 'pph' 
                              ? 'bg-cyberpunk-violet/20 text-cyberpunk-violet' 
                              : 'bg-cyberpunk-yellow/20 text-cyberpunk-yellow'
                          }`}>
                            {account.type.toUpperCase()}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            account.status === 'active' 
                              ? 'bg-cyberpunk-green/20 text-cyberpunk-green' 
                              : 'bg-cyberpunk-red/20 text-cyberpunk-red'
                          }`}>
                            {account.status}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs lg:text-sm text-gray-400">Agent: {account.agentName}</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {account.type === 'pph' && account.websiteURL && (
                    <div className="flex items-center space-x-2">
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                      <a
                        href={account.websiteURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyberpunk-blue hover:text-cyberpunk-blue-light transition-colors text-xs lg:text-sm truncate"
                      >
                        {account.websiteURL}
                      </a>
                    </div>
                  )}
                  
                  {account.type === 'legal' && account.depositAmount && (
                    <div className="text-xs lg:text-sm text-gray-400">
                      Starting Balance: ${account.depositAmount.toLocaleString()}
                    </div>
                  )}
                  
                  <Link
                    to={`/player/account/${account.id}`}
                    className={`block w-full font-medium py-2 px-4 rounded-lg transition-all duration-200 text-center text-sm lg:text-base ${
                      account.status === 'active'
                        ? 'bg-gradient-to-r from-cyberpunk-green to-emerald-500 hover:from-cyberpunk-green-dark hover:to-emerald-600 text-white'
                        : 'bg-gradient-to-r from-cyberpunk-gray/50 to-cyberpunk-gray/60 hover:from-cyberpunk-gray/60 hover:to-cyberpunk-gray/70 text-white'
                    }`}
                  >
                    {account.status === 'active' ? 'Manage Account' : 'View Account'}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Entries */}
      <div className="bg-black/20 backdrop-blur-sm rounded-xl p-4 lg:p-6 border border-cyberpunk-violet/20">
        <h2 className="text-lg lg:text-xl font-bold text-white mb-4 lg:mb-6">Recent Entries</h2>
        
        {entries.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">No entries yet.</p>
            <p className="text-sm text-gray-500 mt-2">Start by adding performance data for your assigned accounts.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.slice(0, 10).map((entry) => {
              const account = accounts.find(acc => acc.id === entry.accountId);
              return (
                <div
                  key={entry.id}
                  className="bg-white/5 rounded-lg p-4 border border-cyberpunk-violet/20"
                >
                  {editingEntry?.id === entry.id ? (
                    <form onSubmit={handleEditEntry} className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">Edit Entry</h3>
                        <button
                          type="button"
                          onClick={() => setEditingEntry(null)}
                          className="p-1 text-gray-400 hover:text-white transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Date</label>
                          <input
                            type="date"
                            value={editingEntry.date}
                            onChange={(e) => handleEditInputChange('date', e.target.value)}
                            className="w-full px-3 py-2 bg-white/5 border border-cyberpunk-violet/20 rounded text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Starting Balance</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editingEntry.startingBalance}
                            onChange={(e) => handleEditInputChange('startingBalance', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-white/5 border border-cyberpunk-violet/20 rounded text-white text-sm"
                            readOnly={account?.type === 'legal'}
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Ending Balance</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editingEntry.endingBalance}
                            onChange={(e) => handleEditInputChange('endingBalance', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-white/5 border border-cyberpunk-violet/20 rounded text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Refill Amount</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editingEntry.refillAmount}
                            onChange={(e) => handleEditInputChange('refillAmount', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-white/5 border border-cyberpunk-violet/20 rounded text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Withdrawal</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editingEntry.withdrawal}
                            onChange={(e) => handleEditInputChange('withdrawal', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-white/5 border border-cyberpunk-violet/20 rounded text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Profit/Loss</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editingEntry.endingBalance - editingEntry.startingBalance + editingEntry.withdrawal - editingEntry.refillAmount}
                            className={`w-full px-3 py-2 bg-white/5 border border-cyberpunk-violet/20 rounded text-sm cursor-not-allowed ${
                              (editingEntry.endingBalance - editingEntry.startingBalance + editingEntry.withdrawal - editingEntry.refillAmount) >= 0 ? 'text-cyberpunk-green' : 'text-cyberpunk-red'
                            }`}
                            disabled
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Notes</label>
                        <textarea
                          value={editingEntry.notes}
                          onChange={(e) => handleEditInputChange('notes', e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 bg-white/5 border border-cyberpunk-violet/20 rounded text-white text-sm"
                        />
                      </div>
                      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                        <button
                          type="submit"
                          disabled={saving}
                          className="bg-cyberpunk-green hover:bg-cyberpunk-green-dark text-white py-2 px-4 rounded-lg flex items-center justify-center space-x-2 disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                          <span>{saving ? 'Saving...' : 'Save'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingEntry(null)}
                          className="bg-cyberpunk-gray hover:bg-cyberpunk-gray-dark text-white py-2 px-4 rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                          <p className="font-medium text-white">
                            {account?.type === 'pph' ? account?.username : account?.name}
                          </p>
                          <p className="text-sm text-gray-400">{entry.date}</p>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-400">Starting</p>
                            <p className="text-white">${entry.startingBalance.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Ending</p>
                            <p className="text-white">${entry.endingBalance.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Profit/Loss</p>
                            <p className={`font-bold ${entry.profitLoss >= 0 ? 'text-cyberpunk-green' : 'text-cyberpunk-red'}`}>
                              ${entry.profitLoss.toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center justify-end space-x-2 lg:justify-start">
                            <button
                              onClick={() => setEditingEntry(entry)}
                              className="p-2 text-gray-400 hover:text-cyberpunk-blue transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteEntry(entry.id)}
                              className="p-2 text-gray-400 hover:text-cyberpunk-red transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}