import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  UserPlus, 
  Settings, 
  LogOut,
  Zap,
  Menu,
  X,
  Briefcase
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { userData, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const adminNavItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/agents', icon: Users, label: 'Account Holders' },
    { path: '/admin/brokers', icon: Briefcase, label: 'Brokers' },
    { path: '/admin/accounts', icon: CreditCard, label: 'Accounts' },
    { path: '/admin/players', icon: UserPlus, label: 'Clickers' },
    { path: '/admin/assignments', icon: Settings, label: 'Assignments' },
  ];

  const playerNavItems = [
    { path: '/player/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  ];

  const navItems = userData?.role === 'admin' ? adminNavItems : playerNavItems;

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyberpunk-black via-cyberpunk-violet to-cyberpunk-black">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyberpunk-pink rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyberpunk-blue rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse animation-delay-2000"></div>
      </div>

      <div className="relative z-10 flex">
        {/* Mobile Menu Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-cyberpunk-black/20 backdrop-blur-lg rounded-lg border border-cyberpunk-pink/20 text-white"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        {/* Sidebar */}
        <div className={`w-64 bg-cyberpunk-black/20 backdrop-blur-lg border-r border-cyberpunk-pink/20 h-screen fixed left-0 top-0 transform transition-transform duration-300 ease-in-out z-40 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}>
          <div className="p-6">
            <div className="flex items-center space-x-2 mb-8">
              <Zap className="w-8 h-8 text-cyberpunk-blue" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyberpunk-blue to-cyberpunk-pink bg-clip-text text-transparent">
                vjac.co
              </h1>
            </div>
            
            <nav className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-cyberpunk-blue/20 to-cyberpunk-pink/20 text-cyberpunk-blue border border-cyberpunk-blue/30'
                        : 'text-gray-300 hover:text-cyberpunk-blue hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          
          <div className="absolute bottom-6 left-6 right-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-300">Logged in as</p>
              <p className="text-cyberpunk-blue font-medium truncate">{userData?.name || userData?.email}</p>
              <p className="text-xs text-cyberpunk-pink capitalize">{userData?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 w-full px-4 py-2 text-gray-300 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-30"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 lg:ml-64">
          <div className="p-4 lg:p-8 pt-16 lg:pt-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}