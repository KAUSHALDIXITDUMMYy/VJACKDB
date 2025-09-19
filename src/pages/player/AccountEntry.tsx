import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, addDoc, getDocs, query, where, doc, getDoc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Save, Calendar, DollarSign, ToggleLeft, ToggleRight, Edit, Trash2, Plus, User, Briefcase } from 'lucide-react';
import { format } from 'date-fns';

interface Account {
  id: string;
  type: 'pph' | 'legal';
  username?: string;
  name?: string;
  websiteURL?: string;
  agentId: string;
  agentName: string;
  brokerId?: string;
  brokerName?: string;
  status: 'active' | 'inactive' | 'unused';
  depositAmount?: number;
  referralPercentage?: number;
  promoAmount?: number;
  brokeredById?: string;
  fundedById?: string;
  referredById?: string;
  brokeredByName?: string;
  fundedByName?: string;
  referredByName?: string;
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
  brokerSettled: string;
  brokerAmount: number;
  companySettled: string;
  companyAmount: number;
  taxableAmount: number;
  referralAmount: number;
  funderAmount: number;
  accountStatus: 'active' | 'inactive';
  notes: string;
  promoCode?: string;
  promoAmount?: number;
  refills?: { by: string; amount: number }[];
  payments?: { amount: number; method: string; date: string }[];
  withdrawalSubmitted?: string;
  settledAmount?: number;
  settledDate?: string;
  companyFunded?: number;
  funderWayAmount?: number;
  initialsReturnedOut?: string;
  accHolderPromo150?: number;
}

interface Broker {
  id: string;
  name: string;
  commissionType: 'percentage' | 'flat' | 'both';
  commissionPercentage?: number;
  flatCommission?: number;
  referralPercentage?: number;
  referralFlat?: number;
  specialScenarios: string[];
}

export default function AccountEntry() {
  const { id } = useParams<{ id: string }>();
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [broker, setBroker] = useState<Broker | null>(null);
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
    brokerSettled: 'No',
    brokerAmount: 0,
    companySettled: 'No',
    companyAmount: 0,
    taxableAmount: 0,
    referralAmount: 0,
    funderAmount: 0,
    accountStatus: 'active',
    notes: '',
    promoCode: '',
    promoAmount: 0,
    refills: [],
    payments: [],
    withdrawalSubmitted: '',
    settledAmount: 0,
    settledDate: '',
    companyFunded: 0,
    funderWayAmount: 0,
    initialsReturnedOut: '',
    accHolderPromo150: 0
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [taxRate, setTaxRate] = useState(10); // Default tax rate

  useEffect(() => {
    if (id && userData?.uid) {
      fetchAccountData();
      fetchTaxRate();
    }
  }, [id, userData]);

  const fetchTaxRate = async () => {
    try {
      const taxDoc = await getDoc(doc(db, 'settings', 'taxRate'));
      if (taxDoc.exists()) {
        setTaxRate(taxDoc.data().value);
      }
    } catch (error) {
      console.error('Error fetching tax rate:', error);
    }
  };

  const fetchBrokerData = async (brokerId: string) => {
    try {
      const brokerDoc = await getDoc(doc(db, 'brokers', brokerId));
      if (brokerDoc.exists()) {
        setBroker({
          id: brokerDoc.id,
          ...brokerDoc.data()
        } as Broker);
      }
    } catch (error) {
      console.error('Error fetching broker data:', error);
    }
  };

  // Promo amount is account-level now; no per-entry promo codes

  // Calculate all amounts whenever relevant fields change
  useEffect(() => {
    const calculateAmounts = async () => {
      const effectiveStarting = (currentEntry.startingBalance || 0) + (account?.promoAmount || 0);
      const profitLoss = 
        (currentEntry.endingBalance || 0) - 
        effectiveStarting + 
        (currentEntry.withdrawal || 0) - 
        (currentEntry.refillAmount || 0);
      
      if (!account || !userData) {
        setCurrentEntry(prev => ({
          ...prev,
          profitLoss
        }));
        return;
      }

      try {
        // Calculate Clicker Amount
        const clickerAmount = (profitLoss * (userData.percentage || 0)) / 100;
        
        // Get agent data for commission calculation
        const agent = await getDoc(doc(db, 'agents', account.agentId));
        const agentData = agent.data();
        
        // Calculate Account Holder Amount
        const accHolderAmount = agentData ? 
          ((profitLoss * (agentData.commissionPercentage || 0)) / 100) + 
          (agentData.flatCommission || 0) : 0;
        
        // Calculate Broker Amount if broker exists
        let brokerAmount = 0;
        if (broker && account.brokerId) {
          if (broker.commissionType === 'percentage') {
            brokerAmount = (profitLoss * (broker.commissionPercentage || 0)) / 100;
          } else if (broker.commissionType === 'flat') {
            brokerAmount = broker.flatCommission || 0;
          } else if (broker.commissionType === 'both') {
            brokerAmount = ((profitLoss * (broker.commissionPercentage || 0)) / 100) + 
                          (broker.flatCommission || 0);
          }
        }
        
        // Calculate Tax Amount using the fetched tax rate (gross basis)
        const taxAmount = (profitLoss * taxRate) / 100;
        
        // Calculate Referral Amount only if referralPercentage exists
        const referralAmount = account.referralPercentage ? 
          (profitLoss * account.referralPercentage) / 100 : 0;
        
        // Calculate Company Amount
        const companyAmount = profitLoss - clickerAmount - accHolderAmount - brokerAmount - taxAmount - referralAmount;
        
        // Update all calculated amounts
        setCurrentEntry(prev => ({
          ...prev,
          profitLoss,
          clickerAmount,
          accHolderAmount,
          brokerAmount,
          companyAmount,
          taxableAmount: taxAmount,
          referralAmount
        }));
      } catch (error) {
        console.error('Error calculating amounts:', error);
      }
    };

    calculateAmounts();
  }, [
    currentEntry.startingBalance,
    currentEntry.endingBalance,
    currentEntry.withdrawal,
    currentEntry.refillAmount,
    currentEntry.promoAmount,
    account,
    userData,
    taxRate,
    broker
  ]);

  // Similar calculation for editing mode
  useEffect(() => {
    if (!editingEntry || !account || !userData) return;
    
    const calculateEditingAmounts = async () => {
      const effectiveStarting = (editingEntry.startingBalance || 0) + (account?.promoAmount || 0);
      const profitLoss = 
        (editingEntry.endingBalance || 0) - 
        effectiveStarting + 
        (editingEntry.withdrawal || 0) - 
        (editingEntry.refillAmount || 0);
      
      try {
        // Calculate Clicker Amount
        const clickerAmount = (profitLoss * (userData.percentage || 0)) / 100;
        
        // Get agent data for commission calculation
        const agent = await getDoc(doc(db, 'agents', account.agentId));
        const agentData = agent.data();
        
        // Calculate Account Holder Amount
        const accHolderAmount = agentData ? 
          ((profitLoss * (agentData.commissionPercentage || 0)) / 100) + 
          (agentData.flatCommission || 0) : 0;
        
        // Calculate Broker Amount if broker exists
        let brokerAmount = 0;
        if (broker && account.brokerId) {
          if (broker.commissionType === 'percentage') {
            brokerAmount = (profitLoss * (broker.commissionPercentage || 0)) / 100;
          } else if (broker.commissionType === 'flat') {
            brokerAmount = broker.flatCommission || 0;
          } else if (broker.commissionType === 'both') {
            brokerAmount = ((profitLoss * (broker.commissionPercentage || 0)) / 100) + 
                          (broker.flatCommission || 0);
          }
        }
        
        // Calculate Tax Amount using the fetched tax rate
        const taxAmount = (profitLoss * taxRate) / 100;
        
        // Calculate Referral Amount only if referralPercentage exists
        const referralAmount = account.referralPercentage ? 
          (profitLoss * account.referralPercentage) / 100 : 0;
        
        // Calculate Company Amount
        const companyAmount = profitLoss - clickerAmount - accHolderAmount - brokerAmount - taxAmount - referralAmount;
        
        // Update all calculated amounts
        setEditingEntry(prev => prev ? ({
          ...prev,
          profitLoss,
          clickerAmount,
          accHolderAmount,
          brokerAmount,
          companyAmount,
          taxableAmount: taxAmount,
          referralAmount
        }) : null);
      } catch (error) {
        console.error('Error calculating amounts:', error);
      }
    };

    calculateEditingAmounts();
  }, [
    editingEntry?.startingBalance,
    editingEntry?.endingBalance,
    editingEntry?.withdrawal,
    editingEntry?.refillAmount,
    editingEntry?.promoAmount,
    account,
    userData,
    taxRate,
    broker
  ]);

  const fetchAccountData = async () => {
    try {
      if (!id) return;
      
      const accountDoc = await getDoc(doc(db, 'accounts', id));
      if (accountDoc.exists()) {
        const accountData = accountDoc.data();
        
        const agentDoc = await getDoc(doc(db, 'agents', accountData.agentId));
        const agentName = agentDoc.exists() ? agentDoc.data().name : 'Unknown Agent';
        
        // Fetch broker data if exists
        let brokerName = '';
        let brokeredByName = '';
        let fundedByName = '';
        let referredByName = '';
        if (accountData.brokerId) {
          const brokerDoc = await getDoc(doc(db, 'brokers', accountData.brokerId));
          brokerName = brokerDoc.exists() ? brokerDoc.data().name : 'Unknown Broker';
          // Fetch detailed broker data for calculations
          await fetchBrokerData(accountData.brokerId);
        }
        if (accountData.brokeredById) {
          const b = await getDoc(doc(db, 'brokers', accountData.brokeredById));
          brokeredByName = b.exists() ? b.data().name : '';
        }
        if (accountData.fundedById) {
          const b = await getDoc(doc(db, 'brokers', accountData.fundedById));
          fundedByName = b.exists() ? b.data().name : '';
        }
        if (accountData.referredById) {
          const b = await getDoc(doc(db, 'brokers', accountData.referredById));
          referredByName = b.exists() ? b.data().name : '';
        }
        
        // Check if account has any entries to determine status
        let status = accountData.status || 'unused';
        const entriesQuery = query(
          collection(db, 'entries'),
          where('accountId', '==', id),
          where('playerUid', '==', userData?.uid)
        );
        const entriesSnapshot = await getDocs(entriesQuery);
        
        if (entriesSnapshot.size > 0) {
          status = 'active'; // Account has entries, set to active
        } else if (status !== 'inactive') {
          status = 'unused'; // No entries and not manually set to inactive
        }
        
        setAccount({
          id: accountDoc.id,
          type: accountData.type || 'pph',
          username: accountData.username,
          name: accountData.name,
          websiteURL: accountData.websiteURL,
          agentId: accountData.agentId,
          agentName,
          brokerId: accountData.brokerId,
          brokerName,
          status,
          depositAmount: accountData.depositAmount,
          referralPercentage: accountData.referralPercentage,
          promoAmount: accountData.promoAmount,
          brokeredById: accountData.brokeredById,
          fundedById: accountData.fundedById,
          referredById: accountData.referredById,
          brokeredByName,
          fundedByName,
          referredByName
        });
        
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
          // For PPH accounts, prefill starting balance with previous entry's ending
          let prefillStarting = 0;
          if ((accountData.type || 'pph') === 'pph') {
            const sorted = [...entriesData].sort((a, b) => (b.date > a.date ? 1 : -1));
            if (sorted.length > 0) {
              prefillStarting = sorted[0].endingBalance || 0;
            }
          }
          setCurrentEntry(prev => ({
            ...prev,
            accountStatus: status === 'unused' ? 'active' : status,
            startingBalance: accountData.type === 'legal' ? (accountData.depositAmount || 0) : prefillStarting
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
      [field]: field === 'startingBalance' || field === 'endingBalance' || field === 'refillAmount' || field === 'withdrawal' || field === 'profitLoss' || field === 'clickerAmount' || field === 'accHolderAmount' || field === 'brokerAmount' || field === 'companyAmount' || field === 'taxableAmount' || field === 'referralAmount' || field === 'promoAmount'
        ? (value === '' ? '' : Number(value))
        : value
    }));
  };

  const handleEditInputChange = (field: keyof Entry, value: string) => {
    setEditingEntry(prev => prev ? ({
      ...prev,
      [field]: field === 'startingBalance' || field === 'endingBalance' || field === 'refillAmount' || field === 'withdrawal' || field === 'profitLoss' || field === 'clickerAmount' || field === 'accHolderAmount' || field === 'brokerAmount' || field === 'companyAmount' || field === 'taxableAmount' || field === 'referralAmount'
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
        brokerAmount: currentEntry.brokerAmount || 0,
        companyAmount: currentEntry.companyAmount || 0,
        taxableAmount: currentEntry.taxableAmount || 0,
        referralAmount: currentEntry.referralAmount || 0,
        promoCode: currentEntry.promoCode || '',
        promoAmount: currentEntry.promoAmount || 0
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
        
        // If account was unused, update to active
        if (account?.status === 'unused') {
          await updateDoc(doc(db, 'accounts', id!), {
            status: 'active',
            updatedAt: new Date()
          });
        }
      }
      
      if (account && currentEntry.accountStatus !== account.status) {
        await updateDoc(doc(db, 'accounts', id!), {
          status: currentEntry.accountStatus,
          updatedAt: new Date()
        });
      }
      
      fetchAccountData(); // Refresh data to reflect changes
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
        brokerAmount: editingEntry.brokerAmount || 0,
        companyAmount: editingEntry.companyAmount || 0,
        taxableAmount: editingEntry.taxableAmount || 0,
        referralAmount: editingEntry.referralAmount || 0,
        promoCode: editingEntry.promoCode || '',
        promoAmount: editingEntry.promoAmount || 0
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
        
        // Check if this was the last entry
        const entriesQuery = query(
          collection(db, 'entries'),
          where('accountId', '==', id),
          where('playerUid', '==', userData?.uid)
        );
        const entriesSnapshot = await getDocs(entriesQuery);
        
        if (entriesSnapshot.size === 0) {
          // No entries left, set account status to 'unused' if not manually set to inactive
          if (account?.status !== 'inactive') {
            await updateDoc(doc(db, 'accounts', id!), {
              status: 'unused',
              updatedAt: new Date()
            });
          }
        }
        
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
          className="mt-4 text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // Helper function to render auto-calculated amount fields
  const renderAmountInput = (
    label: string,
    value: number,
    isAuto: boolean = true,
    isPositive: boolean = true
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {label} {isAuto && '(Auto-calculated)'}
      </label>
      <input
        type="number"
        step="0.01"
        value={value === 0 ? '' : value}
        className={`w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none ${
          isAuto ? 'cursor-not-allowed' : 'focus:ring-2 focus:ring-cyan-400'
        } ${isPositive ? 'text-green-400' : 'text-red-400'}`}
        disabled={isAuto}
        readOnly={isAuto}
      />
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/player/dashboard')}
            className="p-2 text-gray-400 hover:text-cyan-400 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                {account.type === 'pph' ? account.username : account.name}
              </h1>
              <span className={`px-3 py-1 rounded-full text-sm ${
                account.type === 'pph' 
                  ? 'bg-purple-500/20 text-purple-400' 
                  : 'bg-orange-500/20 text-orange-400'
              }`}>
                {(account.type || 'pph').toUpperCase()}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm ${
                currentEntry.accountStatus === 'active' 
                  ? 'bg-green-500/20 text-green-400' 
                  : currentEntry.accountStatus === 'inactive'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                {currentEntry.accountStatus.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center space-x-4 mt-1">
              <p className="text-gray-400 flex items-center">
                <User className="w-4 h-4 mr-1" />
                Agent: {account.agentName}
              </p>
              {account.brokerName && (
                <p className="text-amber-400 flex items-center">
                  <Briefcase className="w-4 h-4 mr-1" />
                  Broker: {account.brokerName}
                </p>
              )}
            </div>
            {account.type === 'legal' && account.depositAmount && (
              <p className="text-sm text-cyan-400">Starting Balance: ${account.depositAmount.toLocaleString()}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <span className="text-gray-300">{format(new Date(), 'MMMM dd, yyyy')}</span>
        </div>
      </div>

      <div className="bg-black/20 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20">
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
                className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
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
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
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
                className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                required
                readOnly={account?.type === 'legal'}
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
                className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
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
                className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>

            {/* Refill breakdown list */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">Refills (By / Amount)</label>
              <div className="space-y-2">
                {(currentEntry.refills || []).map((r, idx) => (
                  <div key={idx} className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={r.by}
                      onChange={(e) => {
                        const next = [...(currentEntry.refills || [])];
                        next[idx] = { ...next[idx], by: e.target.value };
                        setCurrentEntry(prev => ({ ...prev, refills: next }));
                      }}
                      className="px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white"
                      placeholder="Refill By"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={r.amount}
                      onChange={(e) => {
                        const next = [...(currentEntry.refills || [])];
                        next[idx] = { ...next[idx], amount: Number(e.target.value) || 0 };
                        setCurrentEntry(prev => ({ ...prev, refills: next }));
                      }}
                      className="px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white"
                      placeholder="Amount"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setCurrentEntry(prev => ({ ...prev, refills: [...(prev.refills || []), { by: '', amount: 0 }] }))}
                  className="px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white hover:bg-white/10"
                >
                  + Add Refill
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Promo Amount (Account Level)
              </label>
              <input
                type="number"
                step="0.01"
                value={account?.promoAmount || 0}
                className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none cursor-not-allowed"
                readOnly
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
                className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Withdrawal Submitted</label>
              <input
                type="date"
                value={currentEntry.withdrawalSubmitted || ''}
                onChange={(e) => setCurrentEntry(prev => ({ ...prev, withdrawalSubmitted: e.target.value }))}
                className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Compliance Review
              </label>
              <select
                value={currentEntry.complianceReview}
                onChange={(e) => handleInputChange('complianceReview', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:bg-gray-800"
                required
              >
                <option className="bg-gray-800 text-white" value="Requested Document">Requested Document</option>
                <option className="bg-gray-800 text-white" value="Document Submitted">Document Submitted</option>
                <option className="bg-gray-800 text-white" value="Review Completed">Review Completed</option>
                <option className="bg-gray-800 text-white" value="N/A">N/A</option>
              </select>
            </div>
            
            {renderAmountInput('Profit/Loss', currentEntry.profitLoss, true, currentEntry.profitLoss >= 0)}
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Clicker Settled
              </label>
              <select
                value={currentEntry.clickerSettled}
                onChange={(e) => handleInputChange('clickerSettled', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:bg-gray-800"
              >
                <option className="bg-gray-800 text-white" value="No">No</option>
                <option className="bg-gray-800 text-white" value="Yes">Yes</option>
              </select>
            </div>
            
            {renderAmountInput('Clicker Amount', currentEntry.clickerAmount)}
            {renderAmountInput('Account Holder Amount', currentEntry.accHolderAmount)}
            
            {account.brokerId && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Broker Settled
                  </label>
                  <select
                    value={currentEntry.brokerSettled}
                    onChange={(e) => handleInputChange('brokerSettled', e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:bg-gray-800"
                  >
                    <option className="bg-gray-800 text-white" value="No">No</option>
                    <option className="bg-gray-800 text-white" value="Yes">Yes</option>
                  </select>
                </div>
                {renderAmountInput('Broker Amount', currentEntry.brokerAmount)}
              </>
            )}
            
            {renderAmountInput('Company Amount', currentEntry.companyAmount, true, currentEntry.companyAmount >= 0)}
            {renderAmountInput('Taxable Amount', currentEntry.taxableAmount, true, false)}
            {account?.referralPercentage && renderAmountInput('Referral Amount', currentEntry.referralAmount)}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Notes
            </label>
            <textarea
              value={currentEntry.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
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
              className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 flex items-center space-x-2 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              <span>{saving ? 'Saving...' : 'Save Entry'}</span>
            </button>
          </div>
        </form>
      </div>

      <div className="bg-black/20 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20">
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
                className="bg-white/5 rounded-lg p-4 border border-purple-500/20"
              >
                {editingEntry?.id === entry.id ? (
                  <form onSubmit={handleEditEntry} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Date</label>
                        <input
                          type="date"
                          value={editingEntry?.date || ''}
                          onChange={(e) => handleEditInputChange('date', e.target.value)}
                          className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Starting Balance</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editingEntry && editingEntry.startingBalance === 0 ? '' : (editingEntry?.startingBalance || '')}
                          onChange={(e) => handleEditInputChange('startingBalance', e.target.value)}
                          className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Ending Balance</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editingEntry && editingEntry.endingBalance === 0 ? '' : (editingEntry?.endingBalance || '')}
                          onChange={(e) => handleEditInputChange('endingBalance', e.target.value)}
                          className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Refill Amount</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editingEntry && editingEntry.refillAmount === 0 ? '' : (editingEntry?.refillAmount || '')}
                          onChange={(e) => handleEditInputChange('refillAmount', e.target.value)}
                          className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Withdrawal</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editingEntry && editingEntry.withdrawal === 0 ? '' : (editingEntry?.withdrawal || '')}
                          onChange={(e) => handleEditInputChange('withdrawal', e.target.value)}
                          className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Compliance Review</label>
                        <select
                          value={editingEntry?.complianceReview || 'Requested Document'}
                          onChange={(e) => handleEditInputChange('complianceReview', e.target.value)}
                          className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded text-white text-sm focus:bg-gray-800"
                          required
                        >
                          <option className="bg-gray-800 text-white" value="Requested Document">Requested Document</option>
                          <option className="bg-gray-800 text-white" value="Document Submitted">Document Submitted</option>
                          <option className="bg-gray-800 text-white" value="Review Completed">Review Completed</option>
                          <option className="bg-gray-800 text-white" value="N/A">N/A</option>
                        </select>
                      </div>
                      {renderAmountInput('Profit/Loss', editingEntry?.profitLoss || 0, true, (editingEntry?.profitLoss || 0) >= 0)}
                      {renderAmountInput('Clicker Amount', editingEntry?.clickerAmount || 0)}
                      {renderAmountInput('Account Holder Amount', editingEntry?.accHolderAmount || 0)}
                      {account.brokerId && renderAmountInput('Broker Amount', editingEntry?.brokerAmount || 0)}
                      {renderAmountInput('Company Amount', editingEntry?.companyAmount || 0, true, (editingEntry?.companyAmount || 0) >= 0)}
                      {renderAmountInput('Taxable Amount', editingEntry?.taxableAmount || 0, true, false)}
                      {account?.referralPercentage && renderAmountInput('Referral Amount', editingEntry?.referralAmount || 0)}
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Notes</label>
                      <textarea
                        value={editingEntry?.notes || ''}
                        onChange={(e) => handleEditInputChange('notes', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded text-white text-sm"
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
                        <p className={`font-bold ${entry.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${entry.profitLoss.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => setEditingEntry(entry)}
                        className="p-2 text-gray-400 hover:text-cyan-400 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => entry?.id && handleDeleteEntry(entry.id)}
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