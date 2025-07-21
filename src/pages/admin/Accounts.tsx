import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Plus, CreditCard, Trash2, Edit, ExternalLink, Save, X, BarChart3, Search, Filter } from 'lucide-react';

interface Account {
  id: string;
  type: 'pph' | 'legal';
  username?: string;
  websiteURL?: string;
  password?: string;
  deal?: string;
  ip?: string;
  name?: string;
  sharePercentage?: number;
  depositAmount?: number;
  agentId: string;
  agentName: string;
  assignedToPlayerUid?: string;
  assignedToPlayerName?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
}

interface Agent {
  id: string;
  name: string;
  accountCount: number;
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [newAccount, setNewAccount] = useState({
    type: 'pph' as 'pph' | 'legal',
    username: '',
    websiteURL: '',
    password: '',
    deal: '',
    ip: '',
    name: '',
    sharePercentage: '',
    depositAmount: '',
    agentId: '',
    status: 'active' as 'active' | 'inactive'
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'pph' | 'legal'>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');

  useEffect(() => {
    fetchAccounts();
    fetchAgents();
  }, []);

  useEffect(() => {
    let filtered = accounts;
    
    if (searchTerm) {
      filtered = filtered.filter(account => {
        const searchableText = `${account.type === 'pph' ? account.username : account.name} ${account.agentName}`.toLowerCase();
        return searchableText.includes(searchTerm.toLowerCase());
      });
    }
    
    if (filter !== 'all') {
      if (filter === 'active' || filter === 'inactive') {
        filtered = filtered.filter(account => account.status === filter);
      } else if (filter === 'pph' || filter === 'legal') {
        filtered = filtered.filter(account => account.type === filter);
      }
    }
    
    if (agentFilter !== 'all') {
      filtered = filtered.filter(account => account.agentId === agentFilter);
    }
    
    setFilteredAccounts(filtered);
  }, [accounts, searchTerm, filter, agentFilter]);

  const fetchAccounts = async () => {
    try {
      const accountsSnapshot = await getDocs(collection(db, 'accounts'));
      const accountsData = await Promise.all(
        accountsSnapshot.docs.map(async (accountDoc) => {
          const accountData = accountDoc.data();
          
          const agentDoc = await getDocs(query(collection(db, 'agents'), where('__name__', '==', accountData.agentId)));
          const agentName = agentDoc.docs[0]?.data().name || 'Unknown Agent';
          
          let assignedToPlayerName = '';
          if (accountData.assignedToPlayerUid) {
            const playerDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', accountData.assignedToPlayerUid)));
            assignedToPlayerName = playerDoc.docs[0]?.data().name || 'Unknown Player';
          }
          
          return {
            id: accountDoc.id,
            ...accountData,
            type: accountData.type || 'pph',
            status: accountData.status || 'active',
            agentName,
            assignedToPlayerName,
            createdAt: accountData.createdAt?.toDate() || new Date()
          };
        })
      ) as Account[];
      setAccounts(accountsData);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const accountsSnapshot = await getDocs(collection(db, 'accounts'));
      const accountCounts: Record<string, number> = {};
      
      accountsSnapshot.forEach(doc => {
        const agentId = doc.data().agentId;
        accountCounts[agentId] = (accountCounts[agentId] || 0) + 1;
      });

      const agentsSnapshot = await getDocs(collection(db, 'agents'));
      const agentsData = agentsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        accountCount: accountCounts[doc.id] || 0
      })).sort((a, b) => b.accountCount - a.accountCount);
      
      setAgents(agentsData);
    } catch (error) {
      console.error('Error fetching agents:', error);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.agentId) return;

    const accountData: any = {
      type: newAccount.type,
      agentId: newAccount.agentId,
      status: newAccount.status,
      createdAt: new Date()
    };

    if (newAccount.type === 'pph') {
      if (!newAccount.username || !newAccount.websiteURL || !newAccount.password) return;
      accountData.username = newAccount.username.trim();
      accountData.websiteURL = newAccount.websiteURL.trim();
      accountData.password = newAccount.password.trim();
      accountData.deal = newAccount.deal.trim();
      accountData.ip = newAccount.ip.trim();
    } else {
      if (!newAccount.name) return;
      accountData.name = newAccount.name.trim();
      accountData.sharePercentage = newAccount.sharePercentage;
      accountData.depositAmount = newAccount.depositAmount;
    }

    try {
      await addDoc(collection(db, 'accounts'), accountData);
      setNewAccount({
        type: 'pph',
        username: '',
        websiteURL: '',
        password: '',
        deal: '',
        ip: '',
        name: '',
        sharePercentage: 0,
        depositAmount: 0,
        agentId: '',
        status: 'active'
      });
      setShowModal(false);
      fetchAccounts();
      fetchAgents();
    } catch (error) {
      console.error('Error adding account:', error);
    }
  };

  const handleEditAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;

    const updateData: any = {
      type: editingAccount.type,
      agentId: editingAccount.agentId,
      status: editingAccount.status,
      updatedAt: new Date()
    };

    if (editingAccount.type === 'pph') {
      updateData.username = editingAccount.username?.trim();
      updateData.websiteURL = editingAccount.websiteURL?.trim();
      updateData.password = editingAccount.password?.trim();
      updateData.deal = editingAccount.deal?.trim();
      updateData.ip = editingAccount.ip?.trim();
    } else {
      updateData.name = editingAccount.name?.trim();
      updateData.sharePercentage = editingAccount.sharePercentage;
      updateData.depositAmount = editingAccount.depositAmount;
    }

    try {
      await updateDoc(doc(db, 'accounts', editingAccount.id), updateData);
      setEditingAccount(null);
      fetchAccounts();
    } catch (error) {
      console.error('Error updating account:', error);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (window.confirm('Are you sure you want to delete this account?')) {
      try {
        await deleteDoc(doc(db, 'accounts', accountId));
        fetchAccounts();
        fetchAgents();
      } catch (error) {
        console.error('Error deleting account:', error);
      }
    }
  };

  const accountStats = {
    total: accounts.length,
    active: accounts.filter(a => a.status === 'active').length,
    inactive: accounts.filter(a => a.status === 'inactive').length,
    pph: accounts.filter(a => a.type === 'pph').length,
    legal: accounts.filter(a => a.type === 'legal').length
  };

  const dropdownArrowSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23ffffff'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyberpunk-blue to-cyberpunk-pink bg-clip-text text-transparent">
            Accounts Management
          </h1>
          <p className="text-gray-400 mt-1">Manage trading accounts and credentials</p>
        </div>
        
        <button
          onClick={() => setShowModal(true)}
          className="bg-gradient-to-r from-cyberpunk-blue to-cyberpunk-pink hover:from-cyberpunk-blue/60 hover:to-cyberpunk-pink/60 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Add New Account</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-gradient-to-r from-cyberpunk-blue/10 to-cyberpunk-pink/10 backdrop-blur-sm rounded-xl p-4 border border-cyberpunk-blue/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total</p>
              <p className="text-2xl font-bold text-cyberpunk-blue">{accountStats.total}</p>
            </div>
            <BarChart3 className="w-6 h-6 text-cyberpunk-blue" />
          </div>
        </div>
        <div className="bg-gradient-to-r from-cyberpunk-green/10 to-cyberpunk-emerald/10 backdrop-blur-sm rounded-xl p-4 border border-cyberpunk-green/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Active</p>
              <p className="text-2xl font-bold text-cyberpunk-green">{accountStats.active}</p>
            </div>
            <div className="w-3 h-3 bg-cyberpunk-green rounded-full"></div>
          </div>
        </div>
        <div className="bg-gradient-to-r from-cyberpunk-red/10 to-cyberpunk-pink/10 backdrop-blur-sm rounded-xl p-4 border border-cyberpunk-red/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Inactive</p>
              <p className="text-2xl font-bold text-cyberpunk-red">{accountStats.inactive}</p>
            </div>
            <div className="w-3 h-3 bg-cyberpunk-red rounded-full"></div>
          </div>
        </div>
        <div className="bg-gradient-to-r from-cyberpunk-violet/10 to-cyberpunk-pink/10 backdrop-blur-sm rounded-xl p-4 border border-cyberpunk-violet/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">PPH</p>
              <p className="text-2xl font-bold text-cyberpunk-violet">{accountStats.pph}</p>
            </div>
            <CreditCard className="w-6 h-6 text-cyberpunk-violet" />
          </div>
        </div>
        <div className="bg-gradient-to-r from-cyberpunk-orange/10 to-cyberpunk-yellow/10 backdrop-blur-sm rounded-xl p-4 border border-cyberpunk-orange/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Legal</p>
              <p className="text-2xl font-bold text-cyberpunk-orange">{accountStats.legal}</p>
            </div>
            <div className="w-6 h-6 bg-gradient-to-r from-cyberpunk-orange to-cyberpunk-yellow rounded"></div>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search accounts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-cyberpunk-violet/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue"
          />
        </div>

        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Filter className="h-5 w-5 text-gray-400" />
          </div>
          <select
            value={agentFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAgentFilter(e.target.value)}
            className="appearance-none w-full pl-10 pr-8 py-3 bg-white/5 border border-cyberpunk-violet/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue bg-no-repeat bg-[length:20px_20px] bg-[position:right_8px_center]"
            style={{ backgroundImage: dropdownArrowSvg }}
          >
            <option value="all" className="bg-gray-800 text-white">All Agents</option>
            {agents.map((agent) => (
              <option 
                key={agent.id} 
                value={agent.id}
                className="bg-gray-800 text-white hover:bg-cyberpunk-blue"
              >
                {agent.name} ({agent.accountCount})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex space-x-4">
        {['all', 'active', 'inactive', 'pph', 'legal'].map((filterOption) => (
          <button
            key={filterOption}
            onClick={() => setFilter(filterOption as any)}
            className={`px-4 py-2 rounded-lg transition-all duration-200 capitalize ${
              filter === filterOption
                ? 'bg-gradient-to-r from-cyberpunk-blue to-cyberpunk-pink text-white'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {filterOption}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12">
            <div className="text-gray-400">Loading accounts...</div>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">
              {searchTerm || filter !== 'all' || agentFilter !== 'all' 
                ? 'No accounts found matching your criteria.' 
                : 'No accounts found. Create your first account!'}
            </p>
          </div>
        ) : (
          filteredAccounts.map((account) => (
            <div
              key={account.id}
              className="bg-black/20 backdrop-blur-sm rounded-xl p-6 border border-cyberpunk-violet/20 hover:scale-105 transition-transform duration-200"
            >
              {editingAccount?.id === account.id ? (
                <form onSubmit={handleEditAccount} className="space-y-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <select
                      value={editingAccount.type}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                        setEditingAccount({ ...editingAccount, type: e.target.value as 'pph' | 'legal' })
                      }
                      className="appearance-none px-3 py-1 bg-white/5 border border-cyberpunk-violet/20 rounded text-white text-sm pr-8 bg-no-repeat bg-[length:20px_20px] bg-[position:right_2px_center]"
                      style={{ backgroundImage: dropdownArrowSvg }}
                    >
                      <option value="pph" className="bg-gray-800 text-white">PPH</option>
                      <option value="legal" className="bg-gray-800 text-white">Legal</option>
                    </select>
                    <select
                      value={editingAccount.status}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                        setEditingAccount({ ...editingAccount, status: e.target.value as 'active' | 'inactive' })
                      }
                      className="appearance-none px-3 py-1 bg-white/5 border border-cyberpunk-violet/20 rounded text-white text-sm pr-8 bg-no-repeat bg-[length:20px_20px] bg-[position:right_2px_center]"
                      style={{ backgroundImage: dropdownArrowSvg }}
                    >
                      <option value="active" className="bg-gray-800 text-white">Active</option>
                      <option value="inactive" className="bg-gray-800 text-white">Inactive</option>
                    </select>
                  </div>

                  {editingAccount.type === 'pph' ? (
                    <>
                      <input
                        type="text"
                        value={editingAccount.username || ''}
                        onChange={(e) => setEditingAccount({ ...editingAccount, username: e.target.value })}
                        placeholder="Username"
                        className="w-full px-3 py-2 bg-white/5 border border-cyberpunk-violet/20 rounded-lg text-white text-sm"
                      />
                      <input
                        type="url"
                        value={editingAccount.websiteURL || ''}
                        onChange={(e) => setEditingAccount({ ...editingAccount, websiteURL: e.target.value })}
                        placeholder="Website URL"
                        className="w-full px-3 py-2 bg-white/5 border border-cyberpunk-violet/20 rounded-lg text-white text-sm"
                      />
                      <input
                        type="text"
                        value={editingAccount.deal || ''}
                        onChange={(e) => setEditingAccount({ ...editingAccount, deal: e.target.value })}
                        placeholder="Deal"
                        className="w-full px-3 py-2 bg-white/5 border border-cyberpunk-violet/20 rounded-lg text-white text-sm"
                      />
                      <input
                        type="text"
                        value={editingAccount.ip || ''}
                        onChange={(e) => setEditingAccount({ ...editingAccount, ip: e.target.value })}
                        placeholder="IP Address"
                        className="w-full px-3 py-2 bg-white/5 border border-cyberpunk-violet/20 rounded-lg text-white text-sm"
                      />
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={editingAccount.name || ''}
                        onChange={(e) => setEditingAccount({ ...editingAccount, name: e.target.value })}
                        placeholder="Account Name"
                        className="w-full px-3 py-2 bg-white/5 border border-cyberpunk-violet/20 rounded-lg text-white text-sm"
                      />
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={editingAccount.sharePercentage || 0}
                          onChange={(e) => setEditingAccount({ ...editingAccount, sharePercentage: parseFloat(e.target.value) || 0 })}
                          placeholder="Share %"
                          className="w-full px-3 py-2 pr-8 bg-white/5 border border-cyberpunk-violet/20 rounded-lg text-white text-sm"
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        value={editingAccount.depositAmount || 0}
                        onChange={(e) => setEditingAccount({ ...editingAccount, depositAmount: parseFloat(e.target.value) || 0 })}
                        placeholder="Deposit Amount"
                        className="w-full px-3 py-2 bg-white/5 border border-cyberpunk-violet/20 rounded-lg text-white text-sm"
                      />
                    </>
                  )}

                  <select
                    value={editingAccount.agentId}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                      setEditingAccount({ ...editingAccount, agentId: e.target.value })
                    }
                    className="appearance-none w-full px-3 py-2 bg-white/5 border border-cyberpunk-violet/20 rounded-lg text-white text-sm pr-8 bg-no-repeat bg-[length:20px_20px] bg-[position:right_8px_center]"
                    style={{ backgroundImage: dropdownArrowSvg }}
                  >
                    <option value="" className="bg-gray-800 text-white">Select Agent</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id} className="bg-gray-800 text-white hover:bg-cyberpunk-blue">
                        {agent.name} ({agent.accountCount})
                      </option>
                    ))}
                  </select>

                  <div className="flex space-x-2">
                    <button
                      type="submit"
                      className="flex-1 bg-cyberpunk-green hover:bg-cyberpunk-green/60 text-white py-2 px-3 rounded-lg flex items-center justify-center"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingAccount(null)}
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
                      <div className={`p-3 rounded-lg ${account.type === 'pph' ? 'bg-gradient-to-r from-cyberpunk-green to-cyberpunk-emerald' : 'bg-gradient-to-r from-cyberpunk-orange to-cyberpunk-yellow'}`}>
                        <CreditCard className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-semibold text-white">
                            {account.type === 'pph' ? account.username : account.name}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            account.status === 'active' 
                              ? 'bg-cyberpunk-green/20 text-cyberpunk-green' 
                              : 'bg-cyberpunk-red/20 text-cyberpunk-red'
                          }`}>
                            {account.status}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            account.type === 'pph' 
                              ? 'bg-cyberpunk-violet/20 text-cyberpunk-violet' 
                              : 'bg-cyberpunk-orange/20 text-cyberpunk-orange'
                          }`}>
                            {(account.type || 'pph').toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400">Agent: {account.agentName}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setEditingAccount(account)}
                        className="p-2 text-gray-400 hover:text-cyberpunk-blue transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAccount(account.id)}
                        className="p-2 text-gray-400 hover:text-cyberpunk-red transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    {account.type === 'pph' ? (
                      <>
                        {account.websiteURL && (
                          <div className="flex items-center space-x-2">
                            <ExternalLink className="w-4 h-4 text-gray-400" />
                            <a
                              href={account.websiteURL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyberpunk-blue hover:text-cyberpunk-blue/30 transition-colors"
                            >
                              {account.websiteURL}
                            </a>
                          </div>
                        )}
                        {account.deal && (
                          <div className="text-gray-400">Deal: {account.deal}</div>
                        )}
                        {account.ip && (
                          <div className="text-gray-400">IP: {account.ip}</div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="text-gray-400">Share: {account.sharePercentage}%</div>
                        <div className="text-gray-400">Deposit: ${account.depositAmount?.toLocaleString()}</div>
                      </>
                    )}
                    <div className="text-gray-400">
                      Status: {account.assignedToPlayerName ? (
                        <span className="text-cyberpunk-green">Assigned to {account.assignedToPlayerName}</span>
                      ) : (
                        <span className="text-cyberpunk-yellow">Unassigned</span>
                      )}
                    </div>
                    <div className="text-gray-400">
                      Created: {account.createdAt.toLocaleDateString()}
                    </div>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-black/80 backdrop-blur-lg rounded-xl p-8 border border-cyberpunk-violet/20 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-6">Add New Account</h2>
            <form onSubmit={handleAddAccount} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Account Type
                </label>
                <select
                  value={newAccount.type}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                    setNewAccount({ ...newAccount, type: e.target.value as 'pph' | 'legal' })
                  }
                  className="appearance-none w-full px-4 py-3 bg-white/5 border border-cyberpunk-violet/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue pr-10 bg-no-repeat bg-[length:20px_20px] bg-[position:right_10px_center]"
                  style={{ backgroundImage: dropdownArrowSvg }}
                >
                  <option value="pph" className="bg-gray-800 text-white">PPH Account</option>
                  <option value="legal" className="bg-gray-800 text-white">Legal Account</option>
                </select>
              </div>

              {newAccount.type === 'pph' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      value={newAccount.username}
                      onChange={(e) => setNewAccount({ ...newAccount, username: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-cyberpunk-violet/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue"
                      placeholder="Enter account username"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Website URL
                    </label>
                    <input
                      type="url"
                      value={newAccount.websiteURL}
                      onChange={(e) => setNewAccount({ ...newAccount, websiteURL: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-cyberpunk-violet/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue"
                      placeholder="https://example.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      value={newAccount.password}
                      onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-cyberpunk-violet/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue"
                      placeholder="Enter password"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Deal
                    </label>
                    <input
                      type="text"
                      value={newAccount.deal}
                      onChange={(e) => setNewAccount({ ...newAccount, deal: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-cyberpunk-violet/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue"
                      placeholder="Enter deal details"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      IP Address
                    </label>
                    <input
                      type="text"
                      value={newAccount.ip}
                      onChange={(e) => setNewAccount({ ...newAccount, ip: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-cyberpunk-violet/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue"
                      placeholder="Enter IP address"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Account Name
                    </label>
                    <input
                      type="text"
                      value={newAccount.name}
                      onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-cyberpunk-violet/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue"
                      placeholder="Enter account name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Share Percentage (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={newAccount.sharePercentage}
                        onChange={(e) => setNewAccount({ ...newAccount, sharePercentage: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-3 pr-8 bg-white/5 border border-cyberpunk-violet/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue"
                        placeholder="Enter share percentage"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Deposit Amount
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newAccount.depositAmount}
                      onChange={(e) => setNewAccount({ ...newAccount, depositAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-3 bg-white/5 border border-cyberpunk-violet/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue"
                      placeholder="Enter deposit amount"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Agent
                </label>
                <select
                  value={newAccount.agentId}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                    setNewAccount({ ...newAccount, agentId: e.target.value })
                  }
                  className="appearance-none w-full px-4 py-3 bg-white/5 border border-cyberpunk-violet/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue pr-10 bg-no-repeat bg-[length:20px_20px] bg-[position:right_10px_center]"
                  style={{ backgroundImage: dropdownArrowSvg }}
                  required
                >
                  <option value="" className="bg-gray-800 text-white">Select an agent</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id} className="bg-gray-800 text-white hover:bg-cyberpunk-blue">
                      {agent.name} ({agent.accountCount})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={newAccount.status}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                    setNewAccount({ ...newAccount, status: e.target.value as 'active' | 'inactive' })
                  }
                  className="appearance-none w-full px-4 py-3 bg-white/5 border border-cyberpunk-violet/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue pr-10 bg-no-repeat bg-[length:20px_20px] bg-[position:right_10px_center]"
                  style={{ backgroundImage: dropdownArrowSvg }}
                >
                  <option value="active" className="bg-gray-800 text-white">Active</option>
                  <option value="inactive" className="bg-gray-800 text-white">Inactive</option>
                </select>
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
                  className="bg-gradient-to-r from-cyberpunk-blue to-cyberpunk-pink hover:from-cyberpunk-blue/60 hover:to-cyberpunk-pink/60 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200"
                >
                  Add Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}