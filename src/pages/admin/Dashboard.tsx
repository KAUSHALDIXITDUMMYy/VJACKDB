import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, doc, getDoc, setDoc, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Users, CreditCard, UserPlus, Calendar, Filter, BarChart3, Settings, Download } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';

interface DashboardStats {
  totalAgents: number;
  totalAccounts: number;
  totalPlayers: number;
  totalTransactions: number;
  totalProfit: number;
  activeAccounts: number;
  inactiveAccounts: number;
  pphAccounts: number;
  legalAccounts: number;
  taxRate: number;
}

interface AgentStats {
  id: string;
  name: string;
  accountCount: number;
  playerCount: number;
  totalProfit: number;
  commissionPercentage: number;
  flatCommission?: number;
}

interface PlayerStats {
  uid: string;
  name: string;
  email: string;
  accountCount: number;
  totalProfit: number;
  totalEntries: number;
  percentage?: number;
  totalClickerCommission: number;
}

interface AccountStats {
  id: string;
  name: string;
  type: 'pph' | 'legal';
  status: 'active' | 'inactive';
  agentName: string;
  assignedToPlayerName?: string;
  totalProfit: number;
  totalEntries: number;
}

interface EntryData {
  id: string;
  date: string;
  accountId: string;
  accountName: string;
  accountType: string;
  accHolderName?: string;
  accNumber?: string;
  brokerName?: string;
  playerName: string;
  playerUid: string;
  startingBalance: number;
  endingBalance: number;
  refillAmount: number;
  withdrawal: number;
  profitLoss: number;
  clickerAmount: number;
  accHolderAmount: number;
  companyAmount: number;
  taxableAmount: number;
  referralAmount: number;
  accountStatus: string;
  complianceReview: string;
  notes: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalAgents: 0,
    totalAccounts: 0,
    totalPlayers: 0,
    totalTransactions: 0,
    totalProfit: 0,
    activeAccounts: 0,
    inactiveAccounts: 0,
    pphAccounts: 0,
    legalAccounts: 0,
    taxRate: 10
  });
  const [agentStats, setAgentStats] = useState<AgentStats[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [accountStats, setAccountStats] = useState<AccountStats[]>([]);
  const [allEntries, setAllEntries] = useState<EntryData[]>([]);
  const [dateFilter, setDateFilter] = useState('today');
  const [customDateRange, setCustomDateRange] = useState({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [viewMode, setViewMode] = useState<'overview' | 'agents' | 'players' | 'accounts'>('overview');
  const [overviewFilter, setOverviewFilter] = useState<'total' | 'active' | 'inactive'>('total');
  const [loading, setLoading] = useState(true);
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [newTaxRate, setNewTaxRate] = useState(10);
  const [isUpdatingTax, setIsUpdatingTax] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');

  useEffect(() => {
    fetchStats();
    fetchTaxRate();
  }, [dateFilter, customDateRange]);

  const fetchTaxRate = async () => {
    try {
      const taxDoc = await getDoc(doc(db, 'settings', 'taxRate'));
      if (taxDoc.exists()) {
        const rate = taxDoc.data().value;
        setStats(prev => ({ ...prev, taxRate: rate }));
        setNewTaxRate(rate);
      }
    } catch (error) {
      console.error('Error fetching tax rate:', error);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus('Reading file...');
    try {
      const text = await file.text();
      const lines = text.replace(/\uFEFF/g, '').split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) {
        setImportStatus('No data rows found.');
        setIsImporting(false);
        return;
      }

      const header = lines[0].split(/\t/).map(h => h.trim());
      const rows = lines.slice(1).map(line => line.split(/\t/));

      // Helpers
      const money = (val: any): number => {
        if (val === undefined || val === null) return 0;
        if (typeof val === 'number') return val;
        const s = String(val).trim();
        if (!s) return 0;
        const sign = s.includes('(') && s.includes(')') ? -1 : 1;
        const cleaned = s.replace(/[^0-9\.-]/g, '');
        const num = parseFloat(cleaned || '0');
        return sign * (isNaN(num) ? 0 : num);
      };

      const parseDate = (raw: any): string => {
        if (!raw) return format(new Date(), 'yyyy-MM-dd');
        let s = String(raw).trim();
        if (!s) return format(new Date(), 'yyyy-MM-dd');
        s = s.replace(/(st|nd|rd|th)/gi, '');
        const parts = s.split(/\s+/).filter(Boolean);
        const monthMap: Record<string, number> = {
          jan: 0, january: 0,
          feb: 1, february: 1,
          mar: 2, march: 2,
          apr: 3, april: 3,
          may: 4,
          jun: 5, june: 5,
          jul: 6, july: 6,
          aug: 7, august: 7,
          sep: 8, sept: 8, september: 8,
          oct: 9, october: 9,
          nov: 10, november: 10,
          dec: 11, december: 11
        };
        let day = new Date().getDate();
        let month = new Date().getMonth();
        let year = new Date().getFullYear();
        if (parts.length >= 2) {
          const maybeDay = parseInt(parts[0], 10);
          const maybeMonth = monthMap[parts[1].toLowerCase()] ?? monthMap[parts[1].slice(0,3).toLowerCase()];
          if (!isNaN(maybeDay)) day = maybeDay;
          if (typeof maybeMonth === 'number') month = maybeMonth;
          if (parts[2]) {
            const maybeYear = parseInt(parts[2], 10);
            if (!isNaN(maybeYear) && maybeYear > 1990 && maybeYear < 2100) year = maybeYear;
          }
        }
        const d = new Date(year, month, day);
        return format(d, 'yyyy-MM-dd');
      };

      const getVal = (obj: Record<string, any>, keys: string[], fallback: any = ''): any => {
        for (const k of keys) {
          if (k in obj && obj[k] !== '' && obj[k] !== undefined) return obj[k];
        }
        return fallback;
      };

      const toObj = (arr: string[]) => {
        const obj: Record<string, any> = {};
        header.forEach((h, i) => { obj[h] = (arr[i] ?? '').trim(); });
        return obj;
      };

      const toEmail = (name: string): string => {
        const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 64);
        return `${base}@vjack.com`;
      };

      setImportStatus('Fetching existing agents/brokers/players cache...');
      const agentsSnapshot = await getDocs(collection(db, 'agents'));
      const brokersSnapshot = await getDocs(collection(db, 'brokers'));
      const usersSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'player')));

      const agentNameToId = new Map<string, string>();
      agentsSnapshot.forEach(d => agentNameToId.set((d.data().name || '').toString().trim().toLowerCase(), d.id));
      const brokerNameToId = new Map<string, string>();
      brokersSnapshot.forEach(d => brokerNameToId.set((d.data().name || '').toString().trim().toLowerCase(), d.id));
      const playerNameToUid = new Map<string, string>();
      usersSnapshot.forEach(d => playerNameToUid.set((d.data().name || '').toString().trim().toLowerCase(), (d.data() as any).uid));

      const safeId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      let processed = 0;
      for (const row of rows) {
        const obj = toObj(row);
        const accHolderName = (getVal(obj, ['Acc holder name', 'Acc holder', 'Account Holder', 'Accs Holder name']) || '').toString().trim();
        if (!accHolderName) continue;
        const agentKey = accHolderName.toLowerCase();

        // Ensure agent
        let agentId = agentNameToId.get(agentKey);
        if (!agentId) {
          const agentDoc = await addDoc(collection(db, 'agents'), {
            name: accHolderName,
            commissionPercentage: 0,
            flatCommission: 0,
            createdAt: new Date(),
            phone: (obj['Number'] || '').toString().trim()
          });
          agentId = agentDoc.id;
          agentNameToId.set(agentKey, agentId);
        }

        // Ensure broker (optional)
        const brokerNameRaw = (getVal(obj, ['Brokered By', 'Broker', 'Brokered']) || '').toString().trim();
        let brokerId: string | undefined = undefined;
        if (brokerNameRaw) {
          const brokerKey = brokerNameRaw.toLowerCase();
          brokerId = brokerNameToId.get(brokerKey);
          if (!brokerId) {
            const brokerDoc = await addDoc(collection(db, 'brokers'), {
              name: brokerNameRaw,
              commissionType: 'both',
              commissionPercentage: 0,
              flatCommission: 0,
              createdAt: new Date(),
              specialScenarios: []
            });
            brokerId = brokerDoc.id;
            brokerNameToId.set(brokerKey, brokerId);
          }
        }

        // Build account id and upsert account
        const accNumber = (obj['Number'] || '').toString().trim();
        const startDate = parseDate(getVal(obj, ['Start date', 'Start Date', 'Start']));
        const accountDocId = `import-${safeId(accHolderName)}-${safeId(accNumber || 'na')}-${startDate}`;
        const startingBalance = money(getVal(obj, ['Starting balance', 'Accs Holder existing balance']));

        // Determine clicker/player by name (no stub creation)
        const clickerNameRaw = (getVal(obj, ['Clicker Name', 'Clicker', 'Clicker Name ']) || '').toString().trim();
        let assignedToPlayerUid = clickerNameRaw ? (playerNameToUid.get(clickerNameRaw.toLowerCase()) || null) : null;

        // Ensure an inactive player record exists if user not found (no stub uid creation)
        if (clickerNameRaw && !assignedToPlayerUid) {
          try {
            const existingPlayersSnap = await getDocs(query(collection(db, 'players'), where('name', '==', clickerNameRaw)));
            if (existingPlayersSnap.empty) {
              await addDoc(collection(db, 'players'), {
                name: clickerNameRaw,
                email: toEmail(clickerNameRaw),
                password: 'vjack@123',
                role: 'player',
                status: 'pending',
                percentage: 50,
                createdAt: new Date()
              });
            }
          } catch (e) {
            console.error('Error ensuring inactive player:', e);
          }
        }

        await setDoc(doc(db, 'accounts', accountDocId), {
          type: 'legal',
          name: accNumber ? `${accHolderName} (${accNumber})` : accHolderName,
          agentId,
          brokerId: brokerId || null,
          status: assignedToPlayerUid ? 'active' : 'unused',
          depositAmount: startingBalance,
          assignedToPlayerUid,
          createdAt: new Date()
        }, { merge: true });

        // Ensure clicker percentage = 50% if we have an assigned user
        if (assignedToPlayerUid) {
          try {
            const uSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', assignedToPlayerUid)));
            if (!uSnap.empty) {
              const userDocRef = doc(db, 'users', uSnap.docs[0].id);
              const existing = uSnap.docs[0].data() as any;
              if (typeof existing.percentage !== 'number' || existing.percentage <= 0) {
                await updateDoc(userDocRef, { percentage: 50, updatedAt: new Date() });
              }
            }
          } catch (e) {
            console.error('Error setting player percentage:', e);
          }
        }

        // Prepare entry
        const endDate = parseDate(getVal(obj, ['Settled Date', 'End Date', 'End date', 'End Date ' , 'End']));
        const endingBalance = money(getVal(obj, ['Ending Balance', 'Ending balance']));
        const refillAmountsKeys = header.filter(h => /refill \$/i.test(h));
        const refillAmount = refillAmountsKeys.reduce((sum, k) => sum + money(obj[k]), 0);
        const grossProfit = money(getVal(obj, ['Gross Profit', 'Gross']));
        const taxAmount = money(getVal(obj, ['30% tax', 'Tax']));
        const companyAmount = money(getVal(obj, ['JACK', 'Company Way']));
        const clickerAmount = money(getVal(obj, ['Clicker Way 50% Fix', 'Clicker Way']));
        const accHolderAmount = money(getVal(obj, ['Accs Holder Way']));
        const referralAmount = money(getVal(obj, ['Referral Way']));
        const brokerAmount = money(getVal(obj, ['Broker Way']));
        const notes = (getVal(obj, ['Notes , in between settlement', 'Notes']) || '').toString();

        const entryDocId = `import-${accountDocId}-${endDate}`;
        await setDoc(doc(db, 'entries', entryDocId), {
          accountId: accountDocId,
          playerUid: assignedToPlayerUid || 'import',
          date: endDate,
          startingBalance,
          endingBalance,
          refillAmount,
          withdrawal: 0,
          profitLoss: grossProfit || (endingBalance - startingBalance - refillAmount),
          clickerAmount,
          accHolderAmount,
          companyAmount,
          taxableAmount: taxAmount,
          referralAmount,
          brokerAmount,
          accountStatus: assignedToPlayerUid ? 'active' : 'unused',
          complianceReview: 'N/A',
          notes,
          createdAt: new Date()
        }, { merge: true });

        processed += 1;
        if (processed % 10 === 0) setImportStatus(`Imported ${processed} rows...`);
      }

      setImportStatus(`Import complete. Processed ${processed} rows.`);
      fetchStats();
    } catch (err) {
      console.error(err);
      setImportStatus('Import failed. See console for details.');
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };
  const updateTaxRate = async () => {
    if (!newTaxRate || isNaN(Number(newTaxRate))) {
      return;
    }

    const rate = Number(newTaxRate);
    if (rate < 0 || rate > 100) {
      return;
    }

    setIsUpdatingTax(true);
    try {
      await setDoc(doc(db, 'settings', 'taxRate'), {
        value: rate,
        updatedAt: new Date()
      }, { merge: true });
      
      setStats(prev => ({ ...prev, taxRate: rate }));
      setShowTaxModal(false);
    } catch (error) {
      console.error('Error updating tax rate:', error);
    } finally {
      setIsUpdatingTax(false);
    }
  };

  const handleTaxRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || (/^\d*$/.test(value) && Number(value) >= 0 && Number(value) <= 100)) {
      setNewTaxRate(Number(value));
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();

      // Fetch agents
      const agentsSnapshot = await getDocs(collection(db, 'agents'));
      const totalAgents = agentsSnapshot.size;
      const agents = agentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      })) as any[];

      // Fetch accounts
      const accountsSnapshot = await getDocs(collection(db, 'accounts'));
      const totalAccounts = accountsSnapshot.size;
      const accounts = accountsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      })) as any[];
      const activeAccounts = accounts.filter(acc => acc.status === 'active').length;
      const inactiveAccounts = accounts.filter(acc => acc.status === 'inactive').length;
      const pphAccounts = accounts.filter(acc => acc.type === 'pph').length;
      const legalAccounts = accounts.filter(acc => acc.type === 'legal').length;

      // Fetch players
      const playersQuery = query(collection(db, 'users'), where('role', '==', 'player'));
      const playersSnapshot = await getDocs(playersQuery);
      const totalPlayers = playersSnapshot.size;
      const players = playersSnapshot.docs.map(doc => ({
        uid: (doc.data() as any).uid,
        ...(doc.data() as any)
      })) as any[];

      // Fetch brokers for name lookup
      const brokersSnapshot = await getDocs(collection(db, 'brokers'));
      const brokers = brokersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      })) as any[];

      // Fetch entries for the selected date range
      const entriesQuery = query(
        collection(db, 'entries'),
        where('date', '>=', format(startDate, 'yyyy-MM-dd')),
        where('date', '<=', format(endDate, 'yyyy-MM-dd')),
        orderBy('date', 'desc')
      );
      const entriesSnapshot = await getDocs(entriesQuery);
      const totalTransactions = entriesSnapshot.size;
      const entries = entriesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      })) as any[];

      // Calculate total profit
      let totalProfit = 0;
      entries.forEach((entry) => {
        totalProfit += entry.profitLoss || 0;
      });

      // Prepare entry data for export
      const entriesData: EntryData[] = await Promise.all(
        entries.map(async (entry: any) => {
          const account = accounts.find((acc: any) => acc.id === entry.accountId);
          const player = players.find((p: any) => p.uid === entry.playerUid);
          let accHolderName = 'Unknown Account Holder';
          let accNumber = '';
          let brokerName = '';
          if (account) {
            const agent = agents.find((a: any) => a.id === account.agentId);
            accHolderName = agent?.name || accHolderName;
            if (account.type === 'legal' && typeof account.name === 'string') {
              const m = account.name.match(/\(([^)]+)\)/);
              accNumber = m ? m[1] : '';
            }
            if (account.brokerId) {
              const broker = brokers.find((b: any) => b.id === account.brokerId);
              brokerName = broker?.name || '';
            }
          }
          
          return {
            id: entry.id,
            date: entry.date,
            accountId: entry.accountId,
            accountName: account ? (account.type === 'pph' ? account.username : account.name) : 'Unknown Account',
            accountType: account?.type || 'pph',
            accHolderName,
            accNumber,
            brokerName,
            playerName: player?.name || 'Unknown Player',
            playerUid: entry.playerUid,
            startingBalance: entry.startingBalance || 0,
            endingBalance: entry.endingBalance || 0,
            refillAmount: entry.refillAmount || 0,
            withdrawal: entry.withdrawal || 0,
            profitLoss: entry.profitLoss || 0,
            clickerAmount: entry.clickerAmount || 0,
            accHolderAmount: entry.accHolderAmount || 0,
            companyAmount: entry.companyAmount || 0,
            taxableAmount: entry.taxableAmount || 0,
            referralAmount: entry.referralAmount || 0,
            accountStatus: entry.accountStatus || 'active',
            complianceReview: entry.complianceReview || 'N/A',
            notes: entry.notes || ''
          };
        })
      );
      setAllEntries(entriesData);

      // Calculate agent stats
      const agentStatsData: AgentStats[] = await Promise.all(
        agents.map(async (agent: any) => {
          const agentAccounts = accounts.filter((acc: any) => acc.agentId === agent.id);
          const assignedPlayerUids = [...new Set(agentAccounts.map(acc => acc.assignedToPlayerUid).filter(Boolean))];

          const agentEntries = entries.filter(entry =>
            agentAccounts.some(acc => acc.id === entry.accountId)
          );
          const agentProfit = agentEntries.reduce((sum, entry) => sum + (entry.profitLoss || 0), 0);

          return {
            id: agent.id,
            name: agent.name,
            accountCount: agentAccounts.length,
            playerCount: assignedPlayerUids.length,
            totalProfit: agentProfit,
            commissionPercentage: (agent as any).commissionPercentage || 0,
            flatCommission: (agent as any).flatCommission || 0
          };
        })
      );

      // Calculate player stats
      const playerStatsData: PlayerStats[] = await Promise.all(
        players.map(async (player: any) => {
          const playerAccounts = accounts.filter((acc: any) => acc.assignedToPlayerUid === player.uid);
          const playerEntries = entries.filter((entry: any) => entry.playerUid === player.uid);
          const playerProfit = playerEntries.reduce((sum, entry) => sum + (entry.profitLoss || 0), 0);
          const pct = typeof player.percentage === 'number' ? player.percentage : 0;
          const totalClickerCommission = playerEntries.reduce((sum, entry) => {
            const clickerAmt = typeof entry.clickerAmount === 'number'
              ? entry.clickerAmount
              : ((entry.profitLoss || 0) * (pct / 100));
            return sum + (clickerAmt || 0);
          }, 0);

          return {
            uid: player.uid,
            name: player.name,
            email: player.email,
            accountCount: playerAccounts.length,
            totalProfit: playerProfit,
            totalEntries: playerEntries.length,
            percentage: pct,
            totalClickerCommission
          };
        })
      );

      // Calculate account stats
      const accountStatsData: AccountStats[] = await Promise.all(
        accounts.map(async (account: any) => {
          const agent = agents.find((a: any) => a.id === account.agentId);
          const agentName = agent?.name || 'Unknown Agent';

          let assignedToPlayerName = '';
          if (account.assignedToPlayerUid) {
            const player = players.find((p: any) => p.uid === account.assignedToPlayerUid);
            assignedToPlayerName = player?.name || 'Unknown Player';
          }

          const accountEntries = entries.filter((entry: any) => entry.accountId === account.id);
          const accountProfit = accountEntries.reduce((sum, entry) => sum + (entry.profitLoss || 0), 0);

          return {
            id: account.id,
            name: account.type === 'pph' ? account.username : account.name,
            type: account.type || 'pph',
            status: account.status || 'active',
            agentName,
            assignedToPlayerName,
            totalProfit: accountProfit,
            totalEntries: accountEntries.length
          };
        })
      );

      setStats({
        totalAgents,
        totalAccounts,
        totalPlayers,
        totalTransactions,
        totalProfit,
        activeAccounts,
        inactiveAccounts,
        pphAccounts,
        legalAccounts,
        taxRate: stats.taxRate
      });
      setAgentStats(agentStatsData);
      setPlayerStats(playerStatsData);
      setAccountStats(accountStatsData);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = () => {
    const now = new Date();
    switch (dateFilter) {
      case 'today':
        return { startDate: startOfDay(now), endDate: endOfDay(now) };
      case 'week':
        return { startDate: startOfDay(subDays(now, 7)), endDate: endOfDay(now) };
      case 'month':
        return { startDate: startOfDay(subDays(now, 30)), endDate: endOfDay(now) };
      case 'custom':
        return {
          startDate: startOfDay(parseISO(customDateRange.startDate)),
          endDate: endOfDay(parseISO(customDateRange.endDate))
        };
      default:
        return { startDate: startOfDay(now), endDate: endOfDay(now) };
    }
  };

  const getFilteredStats = () => {
    switch (overviewFilter) {
      case 'active':
        return {
          accounts: stats.activeAccounts,
          agents: agentStats.filter(agent =>
            accountStats.some(acc => acc.agentName === agent.name && acc.status === 'active')
          ).length,
          players: playerStats.filter(player =>
            accountStats.some(acc => acc.assignedToPlayerName === player.name && acc.status === 'active')
          ).length
        };
      case 'inactive':
        return {
          accounts: stats.inactiveAccounts,
          agents: agentStats.filter(agent =>
            accountStats.some(acc => acc.agentName === agent.name && acc.status === 'inactive')
          ).length,
          players: playerStats.filter(player =>
            accountStats.some(acc => acc.assignedToPlayerName === player.name && acc.status === 'inactive')
          ).length
        };
      default:
        return {
          accounts: stats.totalAccounts,
          agents: stats.totalAgents,
          players: stats.totalPlayers
        };
    }
  };

  const exportToExcel = () => {
    // Prepare data based on current view mode
    let dataToExport: any[] = [];
    let fileName = '';

    switch (viewMode) {
      case 'overview':
        // Export with the exact format/columns of the provided TXT file
        dataToExport = allEntries.map((entry, idx) => {
          const endDate = entry.date || '';
          const startDate = '';
          const netProfit = (entry.profitLoss || 0) - (entry.taxableAmount || 0);
          return {
            'Sr No': idx + 1,
            'Acc holder name': entry.accHolderName || '',
            'Number': entry.accNumber || '',
            'Funded By': '',
            'Brokered By': entry.brokerName || '',
            'Referred By': '',
            'Start date': startDate,
            'End Date': endDate,
            'Withdrawal submitted': '',
            'Starting balance': entry.startingBalance || 0,
            'Refill By 1': '',
            'Refill $': entry.refillAmount || 0,
            'Refill By 2': '',
            'Refill $ ': '',
            'Refill By 2 ': '',
            'Refill $  ': '',
            'Promo $': '',
            'Accs Holder existing balance': entry.startingBalance || 0,
            'Ending Balance': entry.endingBalance || 0,
            'Gross Profit': entry.profitLoss || 0,
            '30% tax': entry.taxableAmount || 0,
            'JACK': entry.companyAmount || 0,
            'Net Profit': netProfit,
            'Settled $': '',
            'Settled Date': endDate,
            'Company Way': entry.companyAmount || 0,
            'Clicker Name': entry.playerName || '',
            'Clicker Way 50% Fix': entry.clickerAmount || 0,
            'Accs Holder Way': entry.accHolderAmount || 0,
            'Accs Holder promo $150': '',
            'Referral Way': entry.referralAmount || 0,
            'Broker Way': (entry as any).brokerAmount || 0,
            'Funder Way': '',
            'Company Funded': '',
            'initials Returned Out ': '',
            'Payment $': '',
            'Payment Methods ': '',
            'Payment $  ': '',
            'Payment Methods  ': '',
            'Payment $   ': '',
            'Payment Methods   ': '',
            'Payment $    ': '',
            'Payment Methods    ': '',
            'Date ': endDate,
            'Total Recived': '',
            'Total Paid': '',
            'ALL clear': '',
            'Notes , in between settlement ': entry.notes || ''
          };
        });
        fileName = `VJACK_Export_${format(new Date(), 'yyyyMMdd_HHmmss')}`;
        break;
      case 'agents':
        dataToExport = agentStats.map(agent => ({
          'Agent Name': agent.name,
          'Total Accounts': agent.accountCount,
          'Assigned Players': agent.playerCount,
          'Total Profit': agent.totalProfit,
          'Commission Percentage': agent.commissionPercentage,
          'Flat Commission': agent.flatCommission || 0,
          'Commission Expense': (agent.totalProfit * agent.commissionPercentage) / 100 + (agent.flatCommission || 0)
        }));
        fileName = `Agents_${format(new Date(), 'yyyyMMdd_HHmmss')}`;
        break;
      case 'players':
        dataToExport = playerStats.map(player => ({
          'Player Name': player.name,
          Email: player.email,
          'Assigned Accounts': player.accountCount,
          'Total Entries': player.totalEntries,
          'Total Profit': player.totalProfit
        }));
        fileName = `Players_${format(new Date(), 'yyyyMMdd_HHmmss')}`;
        break;
      case 'accounts':
        dataToExport = accountStats.map(account => ({
          'Account Name': account.name,
          'Account Type': account.type.toUpperCase(),
          Status: account.status.toUpperCase(),
          'Agent Name': account.agentName,
          'Assigned Player': account.assignedToPlayerName || 'N/A',
          'Total Entries': account.totalEntries,
          'Total Profit': account.totalProfit
        }));
        fileName = `Accounts_${format(new Date(), 'yyyyMMdd_HHmmss')}`;
        break;
    }

    // Create worksheet and workbook
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

    // Export the file
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  const filteredStats = getFilteredStats();

  const statCards = [
    {
      title: 'Total Account Holders',
      value: filteredStats.agents,
      icon: Users,
      color: 'from-cyan-500 to-blue-500',
      bgColor: 'bg-cyan-500/10'
    },
    {
      title: 'Total Accounts',
      value: filteredStats.accounts,
      icon: CreditCard,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-500/10'
    },
    {
      title: 'Active Accounts',
      value: stats.activeAccounts,
      icon: BarChart3,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-500/10'
    },
    {
      title: 'Total Clickers',
      value: filteredStats.players,
      icon: UserPlus,
      color: 'from-orange-500 to-red-500',
      bgColor: 'bg-orange-500/10'
    }
  ];

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Admin Dashboard
          </h1>
          <p className="text-gray-400 mt-1">Monitor your business platform performance</p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
          <button
            onClick={() => setShowTaxModal(true)}
            className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 border border-purple-500/20 px-3 py-2 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-white">Tax Rate: <span className="text-gray-400">{stats.taxRate}%</span></span>
          </button>
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={dateFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDateFilter(e.target.value)}
                className="appearance-none bg-white/5 border border-purple-500/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 pr-8 bg-[length:20px_20px] bg-[position:right_8px_center] bg-no-repeat"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23ffffff'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`
                }}
              >
                <option value="today" className="bg-gray-800 text-white hover:bg-cyan-500">
                  Today
                </option>
                <option value="week" className="bg-gray-800 text-white hover:bg-cyan-500">
                  This Week
                </option>
                <option value="month" className="bg-gray-800 text-white hover:bg-cyan-500">
                  This Month
                </option>
                <option value="custom" className="bg-gray-800 text-white hover:bg-cyan-500">
                  Custom Range
                </option>
              </select>
            </div>
          </div>

          {dateFilter === 'custom' && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
              <input
                type="date"
                value={customDateRange.startDate}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="bg-white/5 border border-purple-500/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
              <span className="text-gray-400 hidden sm:block">to</span>
              <input
                type="date"
                value={customDateRange.endDate}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="bg-white/5 border border-purple-500/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>
          )}
        </div>
      </div>
      
      {/* Tax Rate Modal */}
      {showTaxModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 backdrop-blur-lg rounded-xl p-6 border border-cyan-500/20 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Update Tax Rate</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  value={newTaxRate}
                  onChange={handleTaxRateChange}
                  min="0"
                  max="100"
                  className="w-full px-4 py-3 bg-gray-800 border border-cyan-500/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  placeholder="Enter tax rate (0-100)"
                />
              </div>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => {
                    setNewTaxRate(stats.taxRate);
                    setShowTaxModal(false);
                  }}
                  className="px-6 py-3 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={updateTaxRate}
                  disabled={isUpdatingTax}
                  className={`px-6 py-3 rounded-lg transition-all duration-200 ${
                    isUpdatingTax
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white'
                  }`}
                >
                  {isUpdatingTax ? 'Saving...' : 'Save Tax Rate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* View Mode Selector */}
      <div className="flex flex-wrap gap-2 items-center">
        {[
          { key: 'overview', label: 'Overview', icon: BarChart3 },
          { key: 'agents', label: 'Account Holder Dashboard', icon: Users },
          { key: 'players', label: 'Clicker Dashboard', icon: UserPlus },
          { key: 'accounts', label: 'Account Dashboard', icon: CreditCard }
        ].map((mode) => {
          const Icon = mode.icon;
          return (
            <button
              key={mode.key}
              onClick={() => setViewMode(mode.key as any)}
              className={`flex items-center space-x-2 px-3 lg:px-4 py-2 rounded-lg transition-all duration-200 ${
                viewMode === mode.key
                  ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon className="w-4 h-4 lg:w-5 lg:h-5" />
              <span className="text-sm lg:text-base">{mode.label}</span>
            </button>
          );
        })}
        
        {/* Export Button */}
        <button
          onClick={exportToExcel}
          className="flex items-center space-x-2 px-3 lg:px-4 py-2 rounded-lg transition-all duration-200 bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:text-green-300"
        >
          <Download className="w-4 h-4 lg:w-5 lg:h-5" />
          <span className="text-sm lg:text-base">Export to Excel</span>
        </button>
        {/* Import Button */}
        <label className="flex items-center space-x-2 px-3 lg:px-4 py-2 rounded-lg transition-all duration-200 bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:text-green-300 cursor-pointer">
          <input type="file" accept=".txt,.tsv,.csv" className="hidden" onChange={handleImportFile} />
          <Download className="w-4 h-4 lg:w-5 lg:h-5" />
          <span className="text-sm lg:text-base">Import TSV</span>
        </label>
        {importStatus && (
          <span className="text-xs text-gray-400">{isImporting ? importStatus : importStatus}</span>
        )}
      </div>

      {viewMode === 'overview' && (
        <>
          {/* Overview Filter */}
          <div className="flex items-center space-x-4">
            <span className="text-gray-400 text-sm">Show:</span>
            <div className="flex space-x-2">
              {[
                { key: 'total', label: 'Total Summary' },
                { key: 'active', label: 'Active Only' },
                { key: 'inactive', label: 'Inactive Only' }
              ].map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setOverviewFilter(filter.key as any)}
                  className={`px-3 py-1 rounded-lg transition-all duration-200 text-sm ${
                    overviewFilter === filter.key
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white'
                      : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className={`${card.bgColor} backdrop-blur-sm rounded-xl p-4 lg:p-6 border border-purple-500/20 hover:scale-105 transition-transform duration-200`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-2 lg:p-3 rounded-lg bg-gradient-to-r ${card.color}`}>
                      <Icon className="w-4 h-4 lg:w-6 lg:h-6 text-white" />
                    </div>
                    <div className="text-right">
                      <p className="text-xl lg:text-2xl font-bold text-white">
                        {loading ? '...' : card.value.toLocaleString()}
                      </p>
                      <p className="text-xs lg:text-sm text-gray-400">{card.title}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Account Summary */}
          <div className="bg-black/20 backdrop-blur-sm rounded-xl p-4 lg:p-6 border border-purple-500/20">
            <h2 className="text-lg lg:text-xl font-bold text-white mb-4 lg:mb-6 flex items-center">
              <CreditCard className="w-5 h-5 lg:w-6 lg:h-6 mr-2" />
              Account Summary
            </h2>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-lg p-4 border border-blue-500/20">
                <p className="text-sm text-gray-400">Total Accounts</p>
                <p className="text-xl lg:text-2xl font-bold text-blue-400">{stats.totalAccounts}</p>
              </div>

              <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg p-4 border border-green-500/20">
                <p className="text-sm text-gray-400">Active Accounts</p>
                <p className="text-xl lg:text-2xl font-bold text-green-400">{stats.activeAccounts}</p>
              </div>

              <div className="bg-gradient-to-r from-red-500/10 to-pink-500/10 rounded-lg p-4 border border-red-500/20">
                <p className="text-sm text-gray-400">Inactive Accounts</p>
                <p className="text-xl lg:text-2xl font-bold text-red-400">{stats.inactiveAccounts}</p>
              </div>

              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg p-4 border border-purple-500/20">
                <p className="text-sm text-gray-400">Account Utilization</p>
                <p className="text-xl lg:text-2xl font-bold text-purple-400">
                  {stats.totalAccounts > 0 ? ((stats.activeAccounts / stats.totalAccounts) * 100).toFixed(1) : '0'}%
                </p>
              </div>
            </div>
          </div>

          {/* Profit/Loss Summary */}
          <div className="bg-black/20 backdrop-blur-sm rounded-xl p-4 lg:p-6 border border-purple-500/20">
            <div className="flex items-center justify-between mb-4 lg:mb-6">
              <h2 className="text-lg lg:text-xl font-bold text-white">Profit/Loss Summary</h2>
              <Calendar className="w-5 h-5 text-gray-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
              <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg p-4 border border-green-500/20">
                <p className="text-sm text-gray-400">Total Profit/Loss</p>
                <p className={`text-xl lg:text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {loading ? '...' : `$${stats.totalProfit.toLocaleString()}`}
                </p>
              </div>

              <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-lg p-4 border border-blue-500/20">
                <p className="text-sm text-gray-400">Avg Per Transaction</p>
                <p className="text-xl lg:text-2xl font-bold text-cyan-400">
                  {loading ? '...' : `$${stats.totalTransactions > 0 ? (stats.totalProfit / stats.totalTransactions).toFixed(2) : '0.00'}`}
                </p>
              </div>

              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg p-4 border border-purple-500/20">
                <p className="text-sm text-gray-400">Total Transactions</p>
                <p className="text-xl lg:text-2xl font-bold text-purple-400">
                  {loading ? '...' : stats.totalTransactions.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {viewMode === 'agents' && (
        <div className="bg-black/20 backdrop-blur-sm rounded-xl p-4 lg:p-6 border border-purple-500/20">
          <div className="flex items-center justify-between mb-4 lg:mb-6">
            <h2 className="text-lg lg:text-xl font-bold text-white flex items-center">
              <Users className="w-5 h-5 lg:w-6 lg:h-6 mr-2" />
              Account Holder Performance Dashboard
            </h2>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="text-gray-400">Loading agent data...</div>
            </div>
          ) : (
            <div className="space-y-4">
              {agentStats.map((agent) => (
                <div
                  key={agent.id}
                  className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-lg p-4 border border-cyan-500/20"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{agent.name}</h3>
                      <p className="text-sm text-gray-400">Commission: {agent.commissionPercentage}% + ${agent.flatCommission || 0} flat</p>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 text-center">
                      <div>
                        <p className="text-sm text-gray-400">Accounts</p>
                        <p className="text-lg lg:text-xl font-bold text-cyan-400">{agent.accountCount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Players</p>
                        <p className="text-lg lg:text-xl font-bold text-purple-400">{agent.playerCount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Total Profit</p>
                        <p className={`text-lg lg:text-xl font-bold ${agent.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${agent.totalProfit.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Commission Expense</p>
                        <p className="text-lg lg:text-xl font-bold text-yellow-400">
                          ${((agent.totalProfit * agent.commissionPercentage) / 100 + (agent.flatCommission || 0)).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewMode === 'players' && (
        <div className="bg-black/20 backdrop-blur-sm rounded-xl p-4 lg:p-6 border border-purple-500/20">
          <div className="flex items-center justify-between mb-4 lg:mb-6">
            <h2 className="text-lg lg:text-xl font-bold text-white flex items-center">
              <UserPlus className="w-5 h-5 lg:w-6 lg:h-6 mr-2" />
              Clicker Performance Dashboard
            </h2>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="text-gray-400">Loading player data...</div>
            </div>
          ) : (
            <div className="space-y-4">
              {playerStats.map((player) => (
                <div
                  key={player.uid}
                  className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg p-4 border border-green-500/20"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{player.name}</h3>
                      <p className="text-sm text-gray-400">{player.email}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-4 lg:gap-6 text-center">
                      <div>
                        <p className="text-sm text-gray-400">Assigned Accounts</p>
                        <p className="text-lg lg:text-xl font-bold text-cyan-400">{player.accountCount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Total Entries</p>
                        <p className="text-lg lg:text-xl font-bold text-purple-400">{player.totalEntries}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Clicker Commission</p>
                        <p className="text-lg lg:text-xl font-bold text-yellow-400">
                          ${player.totalClickerCommission.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewMode === 'accounts' && (
        <div className="bg-black/20 backdrop-blur-sm rounded-xl p-4 lg:p-6 border border-purple-500/20">
          <div className="flex items-center justify-between mb-4 lg:mb-6">
            <h2 className="text-lg lg:text-xl font-bold text-white flex items-center">
              <CreditCard className="w-5 h-5 lg:w-6 lg:h-6 mr-2" />
              Account Performance Dashboard
            </h2>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="text-gray-400">Loading account data...</div>
            </div>
          ) : (
            <div className="space-y-4">
              {accountStats.map((account) => (
                <div
                  key={account.id}
                  className={`rounded-lg p-4 border ${
                    account.status === 'active'
                      ? 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20'
                      : 'bg-gradient-to-r from-red-500/10 to-pink-500/10 border-red-500/20'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 space-y-2 sm:space-y-0">
                        <h3 className="text-lg font-semibold text-white">{account.name}</h3>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            account.type === 'pph'
                              ? 'bg-purple-500/20 text-purple-400'
                              : 'bg-orange-500/20 text-orange-400'
                          }`}>
                            {account.type.toUpperCase()}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            account.status === 'active'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {account.status}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-400">Agent: {account.agentName}</p>
                      {account.assignedToPlayerName && (
                        <p className="text-sm text-gray-400">Player: {account.assignedToPlayerName}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 lg:gap-6 text-center">
                      <div>
                        <p className="text-sm text-gray-400">Total Entries</p>
                        <p className="text-lg lg:text-xl font-bold text-cyan-400">{account.totalEntries}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Total Profit</p>
                        <p className={`text-lg lg:text-xl font-bold ${account.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${account.totalProfit.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}