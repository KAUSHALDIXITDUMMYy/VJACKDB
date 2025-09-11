
import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Plus, CreditCard, Trash2, Edit, ExternalLink, Save, X, BarChart3, Search, Filter, User, Briefcase } from 'lucide-react';

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
  brokerId?: string;
  brokerName?: string;
  assignedToPlayerUid?: string;
  assignedToPlayerName?: string;
  status: 'active' | 'inactive' | 'unused';
  createdAt: Date;
  referralPercentage?: number;
  promoAmount?: number;
  brokeredById?: string;
  fundedById?: string;
  referredById?: string;
  brokeredOverrideType?: 'gross' | 'net' | '';
  brokeredOverridePct?: number;
  fundedOverrideType?: 'gross' | 'net' | '';
  fundedOverridePct?: number;
  referredOverrideType?: 'gross' | 'net' | '';
  referredOverridePct?: number;
}

interface Agent {
  id: string;
  name: string;
  accountCount: number;
}

interface Broker {
  id: string;
  name: string;
  accountCount: number;
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
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
    brokerId: '',
    brokeredById: '',
    fundedById: '',
    referredById: '',
    status: 'active' as 'active' | 'inactive' | 'unused',
    promoAmount: '',
    brokeredOverrideType: '' as '' | 'gross' | 'net',
    brokeredOverridePct: '',
    fundedOverrideType: '' as '' | 'gross' | 'net',
    fundedOverridePct: '',
    referredOverrideType: '' as '' | 'gross' | 'net',
    referredOverridePct: ''
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'unused' | 'pph' | 'legal'>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [brokerFilter, setBrokerFilter] = useState<string>('all');

  useEffect(() => {
    fetchAccounts();
    fetchAgents();
    fetchBrokers();
  }, []);

  useEffect(() => {
    let filtered = accounts;
    
    if (searchTerm) {
      filtered = filtered.filter(account => {
        const searchableText = `${account.type === 'pph' ? account.username : account.name} ${account.agentName} ${account.brokerName || ''}`.toLowerCase();
        return searchableText.includes(searchTerm.toLowerCase());
      });
    }
    
    if (filter !== 'all') {
      if (filter === 'active' || filter === 'inactive' || filter === 'unused') {
        filtered = filtered.filter(account => account.status === filter);
      } else if (filter === 'pph' || filter === 'legal') {
        filtered = filtered.filter(account => account.type === filter);
      }
    }
    
    if (agentFilter !== 'all') {
      filtered = filtered.filter(account => account.agentId === agentFilter);
    }
    
    if (brokerFilter !== 'all') {
      filtered = filtered.filter(account => account.brokerId === brokerFilter);
    }
    
    setFilteredAccounts(filtered);
  }, [accounts, searchTerm, filter, agentFilter, brokerFilter]);

  const fetchAccounts = async () => {
    try {
      const accountsSnapshot = await getDocs(collection(db, 'accounts'));
      const accountsData = await Promise.all(
        accountsSnapshot.docs.map(async (accountDoc) => {
          const accountData = accountDoc.data();
          
          // Fetch agent name
          const agentDoc = await getDocs(query(collection(db, 'agents'), where('__name__', '==', accountData.agentId)));
          const agentName = agentDoc.docs[0]?.data().name || 'Unknown Agent';
          
          // Fetch broker name if exists
          let brokerName = '';
          if (accountData.brokerId) {
            const brokerDoc = await getDocs(query(collection(db, 'brokers'), where('__name__', '==', accountData.brokerId)));
            brokerName = brokerDoc.docs[0]?.data().name || 'Unknown Broker';
          }
          
          let assignedToPlayerName = '';
          if (accountData.assignedToPlayerUid) {
            const playerDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', accountData.assignedToPlayerUid)));
            assignedToPlayerName = playerDoc.docs[0]?.data().name || 'Unknown Player';
          }
          
          // Determine status: assigned accounts are active; otherwise unused unless explicitly inactive
          const entriesQuery = query(collection(db, 'entries'), where('accountId', '==', accountDoc.id));
          const entriesSnapshot = await getDocs(entriesQuery);
          
          let status = accountData.status || 'unused';
          if (accountData.assignedToPlayerUid) {
            status = 'active';
            if (accountData.status !== 'active') {
              await updateDoc(doc(db, 'accounts', accountDoc.id), {
                status: 'active',
                updatedAt: new Date()
              });
            }
          } else if (entriesSnapshot.size === 0) {
            status = 'unused';
          }
          
          return {
            id: accountDoc.id,
            ...accountData,
            type: accountData.type || 'pph',
            status,
            agentName,
            brokerName,
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

  const fetchBrokers = async () => {
    try {
      const accountsSnapshot = await getDocs(collection(db, 'accounts'));
      const accountCounts: Record<string, number> = {};
      
      accountsSnapshot.forEach(doc => {
        const brokerId = doc.data().brokerId;
        if (brokerId) {
          accountCounts[brokerId] = (accountCounts[brokerId] || 0) + 1;
        }
      });

      const brokersSnapshot = await getDocs(collection(db, 'brokers'));
      const brokersData = brokersSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        accountCount: accountCounts[doc.id] || 0
      })).sort((a, b) => b.accountCount - a.accountCount);
      
      setBrokers(brokersData);
    } catch (error) {
      console.error('Error fetching brokers:', error);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.agentId) return;

    const accountData: any = {
      type: newAccount.type,
      agentId: newAccount.agentId,
      status: 'unused', // Always set new accounts as unused
      createdAt: new Date()
    };

    // Add broker if selected
    if (newAccount.brokerId) {
      accountData.brokerId = newAccount.brokerId;
    }
    if ((newAccount as any).brokeredById) accountData.brokeredById = (newAccount as any).brokeredById;
    if ((newAccount as any).fundedById) accountData.fundedById = (newAccount as any).fundedById;
    if ((newAccount as any).referredById) accountData.referredById = (newAccount as any).referredById;

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
      accountData.sharePercentage = parseFloat(newAccount.sharePercentage) || 0;
      accountData.depositAmount = parseFloat(newAccount.depositAmount) || 0;
    }

    // Promo amount (optional)
    accountData.promoAmount = parseFloat((newAccount as any).promoAmount) || 0;

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
        sharePercentage: '',
        depositAmount: '',
        agentId: '',
        brokerId: '',
        brokeredById: '',
        fundedById: '',
        referredById: '',
        status: 'active',
        promoAmount: ''
      });
      setShowModal(false);
      fetchAccounts();
      fetchAgents();
      fetchBrokers();
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
      brokerId: editingAccount.brokerId || null,
      brokeredById: (editingAccount as any).brokeredById || null,
      fundedById: (editingAccount as any).fundedById || null,
      referredById: (editingAccount as any).referredById || null,
      status: editingAccount.status,
      updatedAt: new Date(),
      referralPercentage: editingAccount.referralPercentage ? Number(editingAccount.referralPercentage) : undefined,
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
        fetchBrokers();
      } catch (error) {
        console.error('Error deleting account:', error);
      }
    }
  };

  const accountStats = {
    total: accounts.length,
    active: accounts.filter(a => a.status === 'active').length,
    inactive: accounts.filter(a => a.status === 'inactive').length,
    unused: accounts.filter(a => a.status === 'unused').length,
    pph: accounts.filter(a => a.type === 'pph').length,
    legal: accounts.filter(a => a.type === 'legal').length
  };

  const dropdownArrowSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23ffffff'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Accounts Management
          </h1>
          <p className="text-gray-400 mt-1">Manage trading accounts and credentials</p>
        </div>
        
        <button
          onClick={() => setShowModal(true)}
          className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Add New Account</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 backdrop-blur-sm rounded-xl p-4 border border-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total</p>
              <p className="text-2xl font-bold text-blue-400">{accountStats.total}</p>
            </div>
            <BarChart3 className="w-6 h-6 text-blue-400" />
          </div>
        </div>
        <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 backdrop-blur-sm rounded-xl p-4 border border-green-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Active</p>
              <p className="text-2xl font-bold text-green-400">{accountStats.active}</p>
            </div>
            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
          </div>
        </div>
        <div className="bg-gradient-to-r from-red-500/10 to-pink-500/10 backdrop-blur-sm rounded-xl p-4 border border-red-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Inactive</p>
              <p className="text-2xl font-bold text-red-400">{accountStats.inactive}</p>
            </div>
            <div className="w-3 h-3 bg-red-400 rounded-full"></div>
          </div>
        </div>
        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur-sm rounded-xl p-4 border border-purple-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">PPH</p>
              <p className="text-2xl font-bold text-purple-400">{accountStats.pph}</p>
            </div>
            <CreditCard className="w-6 h-6 text-purple-400" />
          </div>
        </div>
        <div className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 backdrop-blur-sm rounded-xl p-4 border border-orange-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Legal</p>
              <p className="text-2xl font-bold text-orange-400">{accountStats.legal}</p>
            </div>
            <div className="w-6 h-6 bg-gradient-to-r from-orange-400 to-yellow-400 rounded"></div>
          </div>
        </div>
        <div className="bg-gradient-to-r from-yellow-500/10 to-amber-500/10 backdrop-blur-sm rounded-xl p-4 border border-yellow-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Unused</p>
              <p className="text-2xl font-bold text-yellow-400">{accountStats.unused}</p>
            </div>
            <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
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
            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />
        </div>

        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <User className="h-5 w-5 text-gray-400" />
          </div>
          <select
            value={agentFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAgentFilter(e.target.value)}
            className="appearance-none w-full pl-10 pr-8 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 bg-no-repeat bg-[length:20px_20px] bg-[position:right_8px_center]"
            style={{ backgroundImage: dropdownArrowSvg }}
          >
            <option value="all" className="bg-gray-800 text-white">All Account Holders</option>
            {agents.map((agent) => (
              <option 
                key={agent.id} 
                value={agent.id}
                className="bg-gray-800 text-white hover:bg-cyan-500"
              >
                {agent.name} ({agent.accountCount})
              </option>
            ))}
          </select>
        </div>

        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Briefcase className="h-5 w-5 text-gray-400" />
          </div>
          <select
            value={brokerFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBrokerFilter(e.target.value)}
            className="appearance-none w-full pl-10 pr-8 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 bg-no-repeat bg-[length:20px_20px] bg-[position:right_8px_center]"
            style={{ backgroundImage: dropdownArrowSvg }}
          >
            <option value="all" className="bg-gray-800 text-white">All Brokers</option>
            <option value="none" className="bg-gray-800 text-white">No Broker</option>
            {brokers.map((broker) => (
              <option 
                key={broker.id} 
                value={broker.id}
                className="bg-gray-800 text-white hover:bg-amber-500"
              >
                {broker.name} ({broker.accountCount})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex space-x-4 flex-wrap gap-2">
        {['all', 'active', 'inactive', 'unused', 'pph', 'legal'].map((filterOption) => (
          <button
            key={filterOption}
            onClick={() => setFilter(filterOption as any)}
            className={`px-4 py-2 rounded-lg transition-all duration-200 capitalize ${
              filter === filterOption
                ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white'
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
              {searchTerm || filter !== 'all' || agentFilter !== 'all' || brokerFilter !== 'all' 
                ? 'No accounts found matching your criteria.' 
                : 'No accounts found. Create your first account!'}
            </p>
          </div>
        ) : (
          filteredAccounts.map((account) => (
            <div
              key={account.id}
              className="bg-black/20 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20 hover:scale-105 transition-transform duration-200"
            >
              {editingAccount?.id === account.id ? (
                <form onSubmit={handleEditAccount} className="space-y-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <select
                      value={editingAccount.type}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                        setEditingAccount({ ...editingAccount, type: e.target.value as 'pph' | 'legal' })
                      }
                      className="appearance-none px-3 py-1 bg-white/5 border border-purple-500/20 rounded text-white text-sm pr-8 bg-no-repeat bg-[length:20px_20px] bg-[position:right_2px_center]"
                      style={{ backgroundImage: dropdownArrowSvg }}
                    >
                      <option value="pph" className="bg-gray-800 text-white">PPH</option>
                      <option value="legal" className="bg-gray-800 text-white">Legal</option>
                    </select>
                    <select
                      value={editingAccount.status}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                        setEditingAccount({ ...editingAccount, status: e.target.value as 'active' | 'inactive' | 'unused' })
                      }
                      className="appearance-none px-3 py-1 bg-white/5 border border-purple-500/20 rounded text-white text-sm pr-8 bg-no-repeat bg-[length:20px_20px] bg-[position:right_2px_center]"
                      style={{ backgroundImage: dropdownArrowSvg }}
                    >
                      <option value="active" className="bg-gray-800 text-white">Active</option>
                      <option value="inactive" className="bg-gray-800 text-white">Inactive</option>
                      <option value="unused" className="bg-gray-800 text-white">Unused</option>
                    </select>
                  </div>

                  {editingAccount.type === 'pph' ? (
                    <>
                      <input
                        type="text"
                        value={editingAccount.username || ''}
                        onChange={(e) => setEditingAccount({ ...editingAccount, username: e.target.value })}
                        placeholder="Username"
                        className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white text-sm"
                      />
                      <input
                        type="url"
                        value={editingAccount.websiteURL || ''}
                        onChange={(e) => setEditingAccount({ ...editingAccount, websiteURL: e.target.value })}
                        placeholder="Website URL"
                        className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white text-sm"
                      />
                      <input
                        type="text"
                        value={editingAccount.deal || ''}
                        onChange={(e) => setEditingAccount({ ...editingAccount, deal: e.target.value })}
                        placeholder="Deal"
                        className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white text-sm"
                      />
                      <input
                        type="text"
                        value={editingAccount.ip || ''}
                        onChange={(e) => setEditingAccount({ ...editingAccount, ip: e.target.value })}
                        placeholder="IP Address"
                        className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white text-sm"
                      />
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={editingAccount.name || ''}
                        onChange={(e) => setEditingAccount({ ...editingAccount, name: e.target.value })}
                        placeholder="Account Name"
                        className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white text-sm"
                      />
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={editingAccount.sharePercentage || 0}
                          onChange={(e) => setEditingAccount({ ...editingAccount, sharePercentage: parseFloat(e.target.value) || 0 })}
                          placeholder="Share %"
                          className="w-full px-3 py-2 pr-8 bg-white/5 border border-purple-500/20 rounded-lg text-white text-sm"
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        value={editingAccount.depositAmount || 0}
                        onChange={(e) => setEditingAccount({ ...editingAccount, depositAmount: parseFloat(e.target.value) || 0 })}
                        placeholder="Deposit Amount"
                        className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white text-sm"
                      />
                    </>
                  )}

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Account Holder</label>
                    <select
                      value={editingAccount.agentId}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                        setEditingAccount({ ...editingAccount, agentId: e.target.value })
                      }
                      className="appearance-none w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white text-sm pr-8 bg-no-repeat bg-[length:20px_20px] bg-[position:right_8px_center]"
                      style={{ backgroundImage: dropdownArrowSvg }}
                    >
                      <option value="" className="bg-gray-800 text-white">Select Account Holder</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id} className="bg-gray-800 text-white hover:bg-cyan-500">
                          {agent.name} ({agent.accountCount})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Broker (Optional)</label>
                    <select
                      value={editingAccount.brokerId || ''}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                        setEditingAccount({ ...editingAccount, brokerId: e.target.value || undefined })
                      }
                      className="appearance-none w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white text-sm pr-8 bg-no-repeat bg-[length:20px_20px] bg-[position:right_8px_center]"
                      style={{ backgroundImage: dropdownArrowSvg }}
                    >
                      <option value="" className="bg-gray-800 text-white">No Broker</option>
                      {brokers.map((broker) => (
                        <option key={broker.id} value={broker.id} className="bg-gray-800 text-white hover:bg-amber-500">
                          {broker.name} ({broker.accountCount})
                        </option>
                      ))}
                    </select>
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
                      <div className={`p-3 rounded-lg ${account.type === 'pph' ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-orange-500 to-yellow-500'}`}>
                        <CreditCard className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-semibold text-white">
                            {account.type === 'pph' ? account.username : account.name}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            account.status === 'active' 
                              ? 'bg-green-500/20 text-green-400' 
                              : account.status === 'inactive'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {account.status.toUpperCase()}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            account.assignedToPlayerName 
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {account.assignedToPlayerName ? 'ASSIGNED' : 'UNASSIGNED'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400">Agent: {account.agentName}</p>
                        {account.brokerName && (
                          <p className="text-sm text-amber-400">Broker: {account.brokerName}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setEditingAccount(account)}
                        className="p-2 text-gray-400 hover:text-cyan-400 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAccount(account.id)}
                        className="p-2 text-gray-400 hover:text-red-400 transition-colors"
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
                              className="text-cyan-400 hover:text-cyan-300 transition-colors"
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
                        {account.referralPercentage && (
                          <div className="text-gray-400">Referral: {account.referralPercentage}%</div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="text-gray-400">Share: {account.sharePercentage}%</div>
                        <div className="text-gray-400">Deposit: ${account.depositAmount?.toLocaleString()}</div>
                        {account.referralPercentage && (
                          <div className="text-gray-400">Referral: {account.referralPercentage}%</div>
                        )}
                      </>
                    )}
                    <div className="text-gray-400">
                      Status: {account.assignedToPlayerName ? (
                        <span className="text-green-400">Assigned to {account.assignedToPlayerName}</span>
                      ) : (
                        <span className="text-yellow-400">Unassigned</span>
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
          <div className="bg-black/80 backdrop-blur-lg rounded-xl p-8 border border-purple-500/20 w-full max-w-md max-h-[90vh] overflow-y-auto">
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
                  className="appearance-none w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 pr-10 bg-no-repeat bg-[length:20px_20px] bg-[position:right_10px_center]"
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
                      className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
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
                      className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
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
                      className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      placeholder="Enter password"
                      required
                    />
                  </div>
                  {/* Deal text removed; scenario-based or overrides below */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      IP Address
                    </label>
                    <input
                      type="text"
                      value={newAccount.ip}
                      onChange={(e) => setNewAccount({ ...newAccount, ip: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      placeholder="Enter IP address"
                    />
                  </div>
                  {false && <div></div>}
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
                      className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
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
                        onChange={(e) => setNewAccount({ ...newAccount, sharePercentage: e.target.value })}
                        className="w-full px-4 py-3 pr-8 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
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
                      onChange={(e) => setNewAccount({ ...newAccount, depositAmount: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      placeholder="Enter deposit amount"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Promo Amount (optional)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={(newAccount as any).promoAmount}
                      onChange={(e) => setNewAccount({ ...newAccount, promoAmount: e.target.value } as any)}
                      className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      placeholder="Enter promo $"
                    />
                  </div>

                  {false && <div></div>}
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Account Holder
                </label>
                <select
                  value={newAccount.agentId}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                    setNewAccount({ ...newAccount, agentId: e.target.value })
                  }
                  className="appearance-none w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 pr-10 bg-no-repeat bg-[length:20px_20px] bg-[position:right_10px_center]"
                  style={{ backgroundImage: dropdownArrowSvg }}
                  required
                >
                  <option value="" className="bg-gray-800 text-white">Select Account Holder</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id} className="bg-gray-800 text-white hover:bg-cyan-500">
                      {agent.name} ({agent.accountCount})
                    </option>
                  ))}
                </select>
              </div>

              {/* Scenario Entities */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Brokered By</label>
                <select
                  value={(newAccount as any).brokeredById}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewAccount({ ...newAccount, brokeredById: e.target.value } as any)}
                  className="appearance-none w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 pr-10 bg-no-repeat bg-[length:20px_20px] bg-[position:right_10px_center]"
                  style={{ backgroundImage: dropdownArrowSvg }}
                >
                  <option value="" className="bg-gray-800 text-white">None</option>
                  {brokers.map((broker) => (
                    <option key={broker.id} value={broker.id} className="bg-gray-800 text-white hover:bg-amber-500">
                      {broker.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Funded By</label>
                <select
                  value={(newAccount as any).fundedById}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewAccount({ ...newAccount, fundedById: e.target.value } as any)}
                  className="appearance-none w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 pr-10 bg-no-repeat bg-[length:20px_20px] bg-[position:right_10px_center]"
                  style={{ backgroundImage: dropdownArrowSvg }}
                >
                  <option value="" className="bg-gray-800 text-white">None</option>
                  {brokers.map((broker) => (
                    <option key={broker.id} value={broker.id} className="bg-gray-800 text-white hover:bg-amber-500">
                      {broker.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Referred By</label>
                <select
                  value={(newAccount as any).referredById}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewAccount({ ...newAccount, referredById: e.target.value } as any)}
                  className="appearance-none w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 pr-10 bg-no-repeat bg-[length:20px_20px] bg-[position:right_10px_center]"
                  style={{ backgroundImage: dropdownArrowSvg }}
                >
                  <option value="" className="bg-gray-800 text-white">None</option>
                  {brokers.map((broker) => (
                    <option key={broker.id} value={broker.id} className="bg-gray-800 text-white hover:bg-amber-500">
                      {broker.name}
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
                    setNewAccount({ ...newAccount, status: e.target.value as 'active' | 'inactive' | 'unused' })
                  }
                  className="appearance-none w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 pr-10 bg-no-repeat bg-[length:20px_20px] bg-[position:right_10px_center]"
                  style={{ backgroundImage: dropdownArrowSvg }}
                >
                  <option value="active" className="bg-gray-800 text-white">Active</option>
                  <option value="inactive" className="bg-gray-800 text-white">Inactive</option>
                  <option value="unused" className="bg-gray-800 text-white">Unused</option>
                </select>
              </div>

              {/* Optional overrides if scenario matrix does not match */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Brokered Override Type
                  </label>
                  <select
                    value={(newAccount as any).brokeredOverrideType}
                    onChange={(e) => setNewAccount({ ...newAccount, brokeredOverrideType: e.target.value } as any)}
                    className="appearance-none w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 pr-10 bg-no-repeat bg-[length:20px_20px] bg-[position:right_10px_center]"
                    style={{ backgroundImage: dropdownArrowSvg }}
                  >
                    <option value="" className="bg-gray-800 text-white">Auto</option>
                    <option value="gross" className="bg-gray-800 text-white">Gross %</option>
                    <option value="net" className="bg-gray-800 text-white">Net-after-tax %</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Brokered Override %</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={(newAccount as any).brokeredOverridePct}
                    onChange={(e) => setNewAccount({ ...newAccount, brokeredOverridePct: e.target.value } as any)}
                    className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    placeholder="e.g. 10"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Funded Override Type
                  </label>
                  <select
                    value={(newAccount as any).fundedOverrideType}
                    onChange={(e) => setNewAccount({ ...newAccount, fundedOverrideType: e.target.value } as any)}
                    className="appearance-none w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 pr-10 bg-no-repeat bg-[length:20px_20px] bg-[position:right_10px_center]"
                    style={{ backgroundImage: dropdownArrowSvg }}
                  >
                    <option value="" className="bg-gray-800 text-white">Auto</option>
                    <option value="gross" className="bg-gray-800 text-white">Gross %</option>
                    <option value="net" className="bg-gray-800 text-white">Net-after-tax %</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Funded Override %</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={(newAccount as any).fundedOverridePct}
                    onChange={(e) => setNewAccount({ ...newAccount, fundedOverridePct: e.target.value } as any)}
                    className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    placeholder="e.g. 25"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Referred Override Type
                  </label>
                  <select
                    value={(newAccount as any).referredOverrideType}
                    onChange={(e) => setNewAccount({ ...newAccount, referredOverrideType: e.target.value } as any)}
                    className="appearance-none w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 pr-10 bg-no-repeat bg-[length:20px_20px] bg-[position:right_10px_center]"
                    style={{ backgroundImage: dropdownArrowSvg }}
                  >
                    <option value="" className="bg-gray-800 text-white">Auto</option>
                    <option value="gross" className="bg-gray-800 text-white">Gross %</option>
                    <option value="net" className="bg-gray-800 text-white">Net-after-tax %</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Referred Override %</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={(newAccount as any).referredOverridePct}
                    onChange={(e) => setNewAccount({ ...newAccount, referredOverridePct: e.target.value } as any)}
                    className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    placeholder="e.g. 5"
                  />
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
                  className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200"
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