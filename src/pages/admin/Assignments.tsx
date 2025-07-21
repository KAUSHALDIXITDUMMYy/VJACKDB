import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Settings, User, CreditCard, CheckCircle, XCircle } from 'lucide-react';

interface Account {
  id: string;
  username: string;
  websiteURL: string;
  agentName: string;
  assignedToPlayerUid?: string;
  assignedToPlayerName?: string;
}

interface Player {
  id: string;
  uid: string;
  name: string;
  email: string;
}

export default function Assignments() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch accounts
      const accountsSnapshot = await getDocs(collection(db, 'accounts'));
      const accountsData = await Promise.all(
        accountsSnapshot.docs.map(async (accountDoc) => {
          const accountData = accountDoc.data();

          // Get agent name
          const agentDoc = await getDocs(query(collection(db, 'agents'), where('__name__', '==', accountData.agentId)));
          const agentName = agentDoc.docs[0]?.data().name || 'Unknown Agent';

          // Get assigned player name if exists
          let assignedToPlayerName = '';
          if (accountData.assignedToPlayerUid) {
            const playerDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', accountData.assignedToPlayerUid)));
            assignedToPlayerName = playerDoc.docs[0]?.data().name || 'Unknown Player';
          }

          return {
            id: accountDoc.id,
            username: accountData.username,
            websiteURL: accountData.websiteURL,
            agentName,
            assignedToPlayerUid: accountData.assignedToPlayerUid,
            assignedToPlayerName
          };
        })
      );
      setAccounts(accountsData);

      // Fetch players
      const playersQuery = query(collection(db, 'users'), where('role', '==', 'player'));
      const playersSnapshot = await getDocs(playersQuery);
      const playersData = playersSnapshot.docs.map(doc => ({
        id: doc.id,
        uid: doc.data().uid,
        name: doc.data().name,
        email: doc.data().email
      })) as Player[];
      setPlayers(playersData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignAccount = async () => {
    if (!selectedAccount || !selectedPlayer) return;

    try {
      await updateDoc(doc(db, 'accounts', selectedAccount), {
        assignedToPlayerUid: selectedPlayer
      });
      setSelectedAccount('');
      setSelectedPlayer('');
      fetchData();
    } catch (error) {
      console.error('Error assigning account:', error);
    }
  };

  const handleUnassignAccount = async (accountId: string) => {
    if (window.confirm('Are you sure you want to unassign this account?')) {
      try {
        await updateDoc(doc(db, 'accounts', accountId), {
          assignedToPlayerUid: null
        });
        fetchData();
      } catch (error) {
        console.error('Error unassigning account:', error);
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Account Assignments
          </h1>
          <p className="text-gray-400 mt-1">Assign accounts to players for management</p>
        </div>
      </div>

      {/* Assignment Form */}
      <div className="bg-black/20 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center">
          <Settings className="w-6 h-6 mr-2" />
          New Assignment
        </h2>

        <div>
          {/* Account Dropdown */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Account
            </label>
            <select
              value={selectedAccount}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedAccount(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 appearance-none pr-10 bg-[length:20px_20px] bg-[position:right_10px_center] bg-no-repeat"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23ffffff'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`
              }}
            >
              <option value="" className="bg-gray-800 text-white">
                Choose an account
              </option>
              {accounts.filter(account => !account.assignedToPlayerUid).map((account) => (
                <option
                  key={account.id}
                  value={account.id}
                  className="bg-gray-800 text-white hover:bg-cyan-500"
                >
                  {account.username} ({account.agentName})
                </option>
              ))}
            </select>
          </div>

          {/* Player Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Choose a Clicker
            </label>
            <select
              value={selectedPlayer}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedPlayer(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 appearance-none pr-10 bg-[length:20px_20px] bg-[position:right_10px_center] bg-no-repeat"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23ffffff'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`
              }}
            >
              <option value="" className="bg-gray-800 text-white">
                Choose a clicker
              </option>
              {players.map((player) => (
                <option
                  key={player.id}
                  value={player.uid}
                  className="bg-gray-800 text-white hover:bg-cyan-500"
                >
                  {player.name} ({player.email})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleAssignAccount}
            disabled={!selectedAccount || !selectedPlayer}
            className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            Assign Account
          </button>
        </div>
      </div>

      {/* Current Assignments */}
      <div className="bg-black/20 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20">
        <h2 className="text-xl font-bold text-white mb-6">Current Assignments</h2>

        {loading ? (
          <div className="text-center py-8">
            <div className="text-gray-400">Loading assignments...</div>
          </div>
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => (
              <div
                key={account.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${account.assignedToPlayerUid
                    ? 'bg-green-500/10 border-green-500/20'
                    : 'bg-yellow-500/10 border-yellow-500/20'
                  }`}
              >
                <div className="flex items-center space-x-4">
                  <div className={`p-2 rounded-lg ${account.assignedToPlayerUid
                      ? 'bg-green-500/20'
                      : 'bg-yellow-500/20'
                    }`}>
                    <CreditCard className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{account.username}</h3>
                    <p className="text-sm text-gray-400">Agent: {account.agentName}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  {account.assignedToPlayerUid ? (
                    <>
                      <div className="text-right">
                        <p className="text-sm font-medium text-green-400">
                          Assigned to {account.assignedToPlayerName}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          <span className="text-xs text-green-400">Active</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleUnassignAccount(account.id)}
                        className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                      >
                        Unassign
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <XCircle className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm text-yellow-400">Unassigned</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}