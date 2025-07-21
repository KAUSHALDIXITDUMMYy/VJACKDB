import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, addDoc, getDocs, query, where, doc, getDoc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Save, Calendar, DollarSign, ToggleLeft, ToggleRight, Edit, Trash2, Plus } from 'lucide-react';
import { format } from 'date-fns';

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
  id?: string;
  accountId: string;
  playerUid: string;
  date: string;
  startingBalance: number;
  endingBalance: number;
  refillAmount: number;
  withdrawal: number;
  complianceReview: string;
  profitLoss: number;
  clickerSettled: string;
  clickerAmount: number;
  accHolderSettled: string;
  accHolderAmount: number;
  companySettled: string;
  companyAmount: number;
  taxableAmount: number;
  referralAmount: number;
  accountStatus: 'active' | 'inactive';
  notes: string;
}

export default function AccountEntry() {
  const { id } = useParams<{ id: string }>();
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [currentEntry, setCurrentEntry] = useState<Entry>({
    accountId: id || '',
    playerUid: userData?.uid || '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startingBalance: 0,
    endingBalance: 0,
    refillAmount: 0,
    withdrawal: 0,
    complianceReview: 'Requested Document',
    profitLoss: 0,
    clickerSettled: 'No',
    clickerAmount: 0,
    accHolderSettled: 'No',
    accHolderAmount: 0,
    companySettled: 'No',
    companyAmount: 0,
    taxableAmount: 0,
    referralAmount: 0,
    accountStatus: 'active',
    notes: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id && userData?.uid) {
      fetchAccountData();
    }
  }, [id, userData]);

  useEffect(() => {
    const profitLoss = 
      (currentEntry.endingBalance || 0) - 
      (currentEntry.startingBalance || 0) + 
      (currentEntry.withdrawal || 0) - 
      (currentEntry.refillAmount || 0);
    if (profitLoss !== currentEntry.profitLoss) {
      setCurrentEntry(prev => ({ ...prev, profitLoss }));
    }
  }, [currentEntry.startingBalance, currentEntry.endingBalance, currentEntry.withdrawal, currentEntry.refillAmount]);

  useEffect(() => {
    if (editingEntry) {
      const profitLoss = 
        (editingEntry.endingBalance || 0) - 
        (editingEntry.startingBalance || 0) + 
        (editingEntry.withdrawal || 0) - 
        (editingEntry.refillAmount || 0);
      if (profitLoss !== editingEntry.profitLoss) {
        setEditingEntry(prev => prev ? ({ ...prev, profitLoss }) : null);
      }
    }
  }, [editingEntry?.startingBalance, editingEntry?.endingBalance, editingEntry?.withdrawal, editingEntry?.refillAmount]);

  const fetchAccountData = async () => {
    try {
      if (!id) return;
      
      const accountDoc = await getDoc(doc(db, 'accounts', id));
      if (accountDoc.exists()) {
        const accountData = accountDoc.data();
        
        const agentDoc = await getDoc(doc(db, 'agents', accountData.agentId));
        const agentName = agentDoc.exists() ? agentDoc.data().name : 'Unknown Agent';
        
        setAccount({
          id: accountDoc.id,
          type: accountData.type || 'pph',
          username: accountData.username,
          name: accountData.name,
          websiteURL: accountData.websiteURL,
          agentName,
          status: accountData.status || 'active',
          depositAmount: accountData.depositAmount
        });
        
        const entriesQuery = query(
          collection(db, 'entries'),
          where('accountId', '==', id),
          where('playerUid', '==', userData?.uid),
          orderBy('date', 'desc')
        );
        const entriesSnapshot = await getDocs(entriesQuery);
        const entriesData = entriesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Entry[];
        setEntries(entriesData);
        
        const today = format(new Date(), 'yyyy-MM-dd');
        const todayEntry = entriesData.find(entry => entry.date === today);
        if (todayEntry) {
          setCurrentEntry(todayEntry);
        } else {
          setCurrentEntry(prev => ({
            ...prev,
            accountStatus: accountData.status || 'active',
            startingBalance: accountData.type === 'legal' ? (accountData.depositAmount || 0) : 0
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching account data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof Entry, value: string) => {
    setCurrentEntry(prev => ({
      ...prev,
      [field]: field === 'startingBalance' || field === 'endingBalance' || field === 'refillAmount' || field === 'withdrawal' || field === 'profitLoss' || field === 'clickerAmount' || field === 'accHolderAmount' || field === 'companyAmount' || field === 'taxableAmount' || field === 'referralAmount'
        ? (value === '' ? '' : Number(value))
        : value
    }));
  };

  const handleEditInputChange = (field: keyof Entry, value: string) => {
    setEditingEntry(prev => prev ? ({
      ...prev,
      [field]: field === 'startingBalance' || field === 'endingBalance' || field === 'refillAmount' || field === 'withdrawal' || field === 'profitLoss' || field === 'clickerAmount' || field === 'accHolderAmount' || field === 'companyAmount' || field === 'taxableAmount' || field === 'referralAmount'
        ? (value === '' ? '' : Number(value))
        : value
    }) : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const entryToSave = {
        ...currentEntry,
        startingBalance: currentEntry.startingBalance || 0,
        endingBalance: currentEntry.endingBalance || 0,
        refillAmount: currentEntry.refillAmount || 0,
        withdrawal: currentEntry.withdrawal || 0,
        complianceReview: currentEntry.complianceReview || 'Requested Document',
        clickerAmount: currentEntry.clickerAmount || 0,
        accHolderAmount: currentEntry.accHolderAmount || 0,
        companyAmount: currentEntry.companyAmount || 0,
        taxableAmount: currentEntry.taxableAmount || 0,
        referralAmount: currentEntry.referralAmount || 0
      };

      if (currentEntry.id) {
        await updateDoc(doc(db, 'entries', currentEntry.id), {
          ...entryToSave,
          updatedAt: new Date()
        });
      } else {
        await addDoc(collection(db, 'entries'), {
          ...entryToSave,
          createdAt: new Date()
        });
      }
      
      if (account && currentEntry.accountStatus !== account.status) {
        await updateDoc(doc(db, 'accounts', id!), {
          status: currentEntry.accountStatus,
          updatedAt: new Date()
        });
      }
      
      navigate('/player/dashboard');
    } catch (error) {
      console.error('Error saving entry:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleEditEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    
    setSaving(true);
    try {
      const entryToSave = {
        ...editingEntry,
        startingBalance: editingEntry.startingBalance || 0,
        endingBalance: editingEntry.endingBalance || 0,
        refillAmount: editingEntry.refillAmount || 0,
        withdrawal: editingEntry.withdrawal || 0,
        complianceReview: editingEntry.complianceReview || 'Requested Document',
        clickerAmount: editingEntry.clickerAmount || 0,
        accHolderAmount: editingEntry.accHolderAmount || 0,
        companyAmount: editingEntry.companyAmount || 0,
        taxableAmount: editingEntry.taxableAmount || 0,
        referralAmount: editingEntry.referralAmount || 0
      };

      await updateDoc(doc(db, 'entries', editingEntry.id!), {
        ...entryToSave,
        updatedAt: new Date()
      });
      setEditingEntry(null);
      fetchAccountData();
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
        fetchAccountData();
      } catch (error) {
        console.error('Error deleting entry:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading account data...</div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Account not found or access denied.</p>
        <button
          onClick={() => navigate('/player/dashboard')}
          className="mt-4 text-cyberpunk-blue hover:text-cyberpunk-pink transition-colors"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/player/dashboard')}
            className="p-2 text-gray-400 hover:text-cyberpunk-blue transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-cyberpunk-blue to-cyberpunk-pink bg-clip-text text-transparent">
                {account.type === 'pph' ? account.username : account.name}
              </h1>
              <span className={`px-3 py-1 rounded-full text-sm ${
                account.type === 'pph' 
                  ? 'bg-cyberpunk-pink/20 text-cyberpunk-pink' 
                  : 'bg-cyberpunk-yellow/20 text-cyberpunk-yellow'
              }`}>
                {(account.type || 'pph').toUpperCase()}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm ${
                currentEntry.accountStatus === 'active' 
                  ? 'bg-cyberpunk-blue/20 text-cyberpunk-blue' 
                  : 'bg-cyberpunk-violet/20 text-cyberpunk-violet'
              }`}>
                {currentEntry.accountStatus}
              </span>
            </div>
            <p className="text-cyberpunk-yellow mt-1">Agent: {account.agentName}</p>
            {account.type === 'legal' && account.depositAmount && (
              <p className="text-sm text-cyberpunk-blue">Starting Balance: ${account.depositAmount.toLocaleString()}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <span className="text-gray-300">{format(new Date(), 'MMMM dd, yyyy')}</span>
        </div>
      </div>

      <div className="bg-black/20 backdrop-blur-sm rounded-xl p-6 border border-cyberpunk-pink/20">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center">
          <DollarSign className="w-6 h-6 mr-2" />
          Daily Performance Entry
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Date
              </label>
              <input
                type="date"
                value={currentEntry.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-cyberpunk-pink/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Account Status
              </label>
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={() => handleInputChange('accountStatus', currentEntry.accountStatus === 'active' ? 'inactive' : 'active')}
                  className={`flex items-center space-x-2 px-4 py-3 rounded-lg transition-all duration-200 ${
                    currentEntry.accountStatus === 'active'
                      ? 'bg-cyberpunk-blue/20 text-cyberpunk-blue border border-cyberpunk-blue/30'
                      : 'bg-cyberpunk-violet/20 text-cyberpunk-violet border border-cyberpunk-violet/30'
                  }`}
                >
                  {currentEntry.accountStatus === 'active' ? (
                    <ToggleRight className="w-5 h-5" />
                  ) : (
                    <ToggleLeft className="w-5 h-5" />
                  )}
                  <span className="capitalize">{currentEntry.accountStatus}</span>
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Starting Balance
              </label>
              <input
                type="number"
                step="0.01"
                value={currentEntry.startingBalance === 0 ? '' : currentEntry.startingBalance}
                onChange={(e) => handleInputChange('startingBalance', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-cyberpunk-pink/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Ending Balance
              </label>
              <input
                type="number"
                step="0.01"
                value={currentEntry.endingBalance === 0 ? '' : currentEntry.endingBalance}
                onChange={(e) => handleInputChange('endingBalance', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-cyberpunk-pink/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Refill Amount
              </label>
              <input
                type="number"
                step="0.01"
                value={currentEntry.refillAmount === 0 ? '' : currentEntry.refillAmount}
                onChange={(e) => handleInputChange('refillAmount', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-cyberpunk-pink/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Withdrawal
              </label>
              <input
                type="number"
                step="0.01"
                value={currentEntry.withdrawal === 0 ? '' : currentEntry.withdrawal}
                onChange={(e) => handleInputChange('withdrawal', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-cyberpunk-pink/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Compliance Review
              </label>
              <select
                value={currentEntry.complianceReview}
                onChange={(e) => handleInputChange('complianceReview', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-cyberpunk-pink/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue focus:bg-gray-800"
                required
              >
                <option className="bg-gray-800 text-white" value="Requested Document">Requested Document</option>
                <option className="bg-gray-800 text-white" value="Document Submitted">Document Submitted</option>
                <option className="bg-gray-800 text-white" value="Review Completed">Review Completed</option>
                <option className="bg-gray-800 text-white" value="N/A">N/A</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Profit/Loss (Auto-calculated)
              </label>
              <input
                type="number"
                step="0.01"
                value={currentEntry.profitLoss}
                className={`w-full px-4 py-3 bg-white/5 border border-cyberpunk-pink/20 rounded-lg text-white focus:outline-none cursor-not-allowed ${
                  currentEntry.profitLoss >= 0 ? 'text-cyberpunk-blue' : 'text-cyberpunk-violet'
                }`}
                disabled
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Clicker Settled
              </label>
              <select
                value={currentEntry.clickerSettled}
                onChange={(e) => handleInputChange('clickerSettled', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-cyberpunk-pink/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue focus:bg-gray-800"
              >
                <option className="bg-gray-800 text-white" value="No">No</option>
                <option className="bg-gray-800 text-white" value="Yes">Yes</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Clicker Amount
              </label>
              <input
                type="number"
                step="0.01"
                value={currentEntry.clickerAmount === 0 ? '' : currentEntry.clickerAmount}
                onChange={(e) => handleInputChange('clickerAmount', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-cyberpunk-pink/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Account Holder Settled
              </label>
              <select
                value={currentEntry.accHolderSettled}
                onChange={(e) => handleInputChange('accHolderSettled', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-cyberpunk-pink/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue focus:bg-gray-800"
              >
                <option className="bg-gray-800 text-white" value="No">No</option>
                <option className="bg-gray-800 text-white" value="Yes">Yes</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Account Holder Amount
              </label>
              <input
                type="number"
                step="0.01"
                value={currentEntry.accHolderAmount === 0 ? '' : currentEntry.accHolderAmount}
                onChange={(e) => handleInputChange('accHolderAmount', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-cyberpunk-pink/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Company Settled
              </label>
              <select
                value={currentEntry.companySettled}
                onChange={(e) => handleInputChange('companySettled', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-cyberpunk-pink/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue focus:bg-gray-800"
              >
                <option className="bg-gray-800 text-white" value="No">No</option>
                <option className="bg-gray-800 text-white" value="Yes">Yes</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Company Amount
              </label>
              <input
                type="number"
                step="0.01"
                value={currentEntry.companyAmount === 0 ? '' : currentEntry.companyAmount}
                onChange={(e) => handleInputChange('companyAmount', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-cyberpunk-pink/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Taxable Amount
              </label>
              <input
                type="number"
                step="0.01"
                value={currentEntry.taxableAmount === 0 ? '' : currentEntry.taxableAmount}
                onChange={(e) => handleInputChange('taxableAmount', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-cyberpunk-pink/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Referral Amount
              </label>
              <input
                type="number"
                step="0.01"
                value={currentEntry.referralAmount === 0 ? '' : currentEntry.referralAmount}
                onChange={(e) => handleInputChange('referralAmount', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-cyberpunk-pink/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Notes
            </label>
            <textarea
              value={currentEntry.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-white/5 border border-cyberpunk-pink/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyberpunk-blue"
              placeholder="Add any additional notes here..."
            />
          </div>
          
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate('/player/dashboard')}
              className="px-6 py-3 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-gradient-to-r from-cyberpunk-blue to-cyberpunk-pink hover:from-cyberpunk-blue/60 hover:to-cyberpunk-pink/60 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 flex items-center space-x-2 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              <span>{saving ? 'Saving...' : 'Save Entry'}</span>
            </button>
          </div>
        </form>
      </div>

      <div className="bg-black/20 backdrop-blur-sm rounded-xl p-6 border border-cyberpunk-pink/20">
        <h2 className="text-xl font-bold text-white mb-6">Previous Entries</h2>
        
        {entries.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">No previous entries found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="bg-white/5 rounded-lg p-4 border border-cyberpunk-pink/20"
              >
                {editingEntry?.id === entry.id ? (
                  <form onSubmit={handleEditEntry} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Date</label>
                        <input
                          type="date"
                          value={editingEntry.date}
                          onChange={(e) => handleEditInputChange('date', e.target.value)}
                          className="w-full px-3 py-2 bg-white/5 border border-cyberpunk-pink/20 rounded text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Starting Balance</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editingEntry.startingBalance === 0 ? '' : editingEntry.startingBalance}
                          onChange={(e) => handleEditInputChange('startingBalance', e.target.value)}
                          className="w-full px-3 py-2 bg-white/5 border border-cyberpunk-pink/20 rounded text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Ending Balance</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editingEntry.endingBalance === 0 ? '' : editingEntry.endingBalance}
                          onChange={(e) => handleEditInputChange('endingBalance', e.target.value)}
                          className="w-full px-3 py-2 bg-white/5 border border-cyberpunk-pink/20 rounded text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Refill Amount</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editingEntry.refillAmount === 0 ? '' : editingEntry.refillAmount}
                          onChange={(e) => handleEditInputChange('refillAmount', e.target.value)}
                          className="w-full px-3 py-2 bg-white/5 border border-cyberpunk-pink/20 rounded text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Withdrawal</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editingEntry.withdrawal === 0 ? '' : editingEntry.withdrawal}
                          onChange={(e) => handleEditInputChange('withdrawal', e.target.value)}
                          className="w-full px-3 py-2 bg-white/5 border border-cyberpunk-pink/20 rounded text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Compliance Review</label>
                        <select
                          value={editingEntry.complianceReview}
                          onChange={(e) => handleEditInputChange('complianceReview', e.target.value)}
                          className="w-full px-3 py-2 bg-white/5 border border-cyberpunk-pink/20 rounded text-white text-sm focus:bg-gray-800"
                          required
                        >
                          <option className="bg-gray-800 text-white" value="Requested Document">Requested Document</option>
                          <option className="bg-gray-800 text-white" value="Document Submitted">Document Submitted</option>
                          <option className="bg-gray-800 text-white" value="Review Completed">Review Completed</option>
                          <option className="bg-gray-800 text-white" value="N/A">N/A</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Profit/Loss</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editingEntry.profitLoss}
                          className={`w-full px-3 py-2 bg-white/5 border border-cyberpunk-pink/20 rounded text-sm cursor-not-allowed ${
                            editingEntry.profitLoss >= 0 ? 'text-cyberpunk-blue' : 'text-cyberpunk-violet'
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
                        className="w-full px-3 py-2 bg-white/5 border border-cyberpunk-pink/20 rounded text-white text-sm"
                      />
                    </div>
                    <div className="flex space-x-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg flex items-center space-x-2 disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        <span>{saving ? 'Saving...' : 'Save'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingEntry(null)}
                        className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
                      <div>
                        <p className="text-sm text-gray-400">Date</p>
                        <p className="text-white font-medium">{entry.date}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Starting Balance</p>
                        <p className="text-white">${entry.startingBalance.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Ending Balance</p>
                        <p className="text-white">${entry.endingBalance.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Profit/Loss</p>
                        <p className={`font-bold ${entry.profitLoss >= 0 ? 'text-cyberpunk-blue' : 'text-cyberpunk-violet'}`}>
                          ${entry.profitLoss.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => setEditingEntry(entry)}
                        className="p-2 text-gray-400 hover:text-cyberpunk-blue transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteEntry(entry.id!)}
                        className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}