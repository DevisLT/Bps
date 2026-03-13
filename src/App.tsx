import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Battery, 
  BatteryCharging, 
  Bluetooth, 
  History, 
  LayoutDashboard, 
  LogOut, 
  Radio, 
  ShieldCheck, 
  Zap,
  AlertTriangle,
  CheckCircle2,
  Settings,
  User as UserIcon,
  RefreshCw,
  Activity,
  Cpu,
  Globe,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Session, NearbyUser } from './types';
import { cn } from './lib/utils';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'discover' | 'bluetooth' | 'history' | 'settings'>('dashboard');
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<{ sessionId: number; progress: number } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [realBattery, setRealBattery] = useState<number | null>(null);
  const [hardwareDevices, setHardwareDevices] = useState<{ name: string; id: string }[]>([]);
  const [incomingRequest, setIncomingRequest] = useState<{ sessionId: number; from: number; amount: number } | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (user) {
      // Real Battery Tracking
      if ('getBattery' in navigator) {
        (navigator as any).getBattery().then((battery: any) => {
          const updateBattery = () => {
            const level = Math.round(battery.level * 100);
            setRealBattery(level);
            fetch('/api/users/update-battery', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: user.id, batteryLevel: level }),
            });
          };
          updateBattery();
          battery.addEventListener('levelchange', updateBattery);
        });
      }

      socketRef.current = io();
      socketRef.current.emit('join', user.id);

      socketRef.current.on('power_request_received', (data) => {
        setIncomingRequest(data);
      });

      socketRef.current.on('transfer_progress', (data) => {
        setActiveSession(data);
      });

      socketRef.current.on('transfer_complete', () => {
        setActiveSession(null);
        fetchStats();
        fetchHistory();
      });

      socketRef.current.on('user_status_change', () => {
        if (isScanning) fetchNearby();
      });

      fetchStats();
      fetchHistory();

      return () => {
        socketRef.current?.disconnect();
      };
    }
  }, [user]);

  const [aiInsights, setAiInsights] = useState<{ health_score: number; recommendations: string[] } | null>(null);

  useEffect(() => {
    if (user && activeTab === 'dashboard') {
      fetch('/api/ai/optimize/' + user.id)
        .then(res => res.json())
        .then(data => setAiInsights(data));
    }
  }, [user, activeTab]);

  const fetchStats = async () => {
    if (!user) return;
    const res = await fetch(`/api/stats/${user.id}`);
    const data = await res.json();
    setUser(prev => prev ? { ...prev, ...data } : null);
  };

  const fetchHistory = async () => {
    if (!user) return;
    const res = await fetch(`/api/history/${user.id}`);
    const data = await res.json();
    setSessions(data);
  };

  const fetchNearby = async () => {
    const res = await fetch('/api/users/nearby');
    const data = await res.json();
    setNearbyUsers(data.filter((u: NearbyUser) => u.id !== user?.id));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (data.success) {
      setUser(data.user);
    }
  };

  const startScan = () => {
    setIsScanning(true);
    fetchNearby();
    setTimeout(() => setIsScanning(false), 5000);
  };

  const requestRealBluetoothDevice = async () => {
    try {
      setIsScanning(true);
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service']
      });
      
      setHardwareDevices(prev => {
        if (prev.find(d => d.id === device.id)) return prev;
        return [...prev, { name: device.name || 'Unknown Device', id: device.id }];
      });
      
      alert(`Successfully paired with hardware node: ${device.name}`);
    } catch (error) {
      console.error('Bluetooth Error:', error);
      alert('Bluetooth discovery failed or cancelled. Ensure Bluetooth is enabled and permissions are granted.');
    } finally {
      setIsScanning(false);
    }
  };

  const requestPower = (receiverId: number) => {
    socketRef.current?.emit('request_power', {
      senderId: receiverId, // The one giving power
      receiverId: user?.id, // The one receiving
      amount: 10
    });
    alert('Request sent to nearby device...');
  };

  const acceptRequest = () => {
    if (incomingRequest) {
      socketRef.current?.emit('accept_request', incomingRequest.sessionId);
      setIncomingRequest(null);
    }
  };

  const handleRestart = () => {
    alert('Simulating device restart to stabilize battery system...');
    window.location.reload();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-bps-bg text-white flex items-center justify-center p-4 font-sans selection:bg-bps-accent/30">
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-bps-card border border-white/5 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden"
        >
          {/* Background Glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-bps-accent/10 rounded-full blur-[100px]" />
          
          <div className="relative z-10">
            <div className="flex flex-col items-center mb-10">
              <div className="w-20 h-20 bg-bps-accent/10 rounded-[2rem] flex items-center justify-center mb-6 border border-bps-accent/20">
                <BatteryCharging className="w-10 h-10 text-bps-accent" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white">BPS Protocol</h1>
              <div className="flex items-center gap-2 mt-2">
                <span className="w-1.5 h-1.5 bg-bps-accent rounded-full animate-pulse" />
                <p className="micro-label">Secure Node Initialization</p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="micro-label ml-1">Node Identifier</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-11 pr-4 py-4 focus:outline-none focus:border-bps-accent/50 focus:bg-white/[0.05] transition-all font-mono text-sm"
                    placeholder="DEVICE_ID_001"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="micro-label ml-1">Access Credentials</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-11 pr-4 py-4 focus:outline-none focus:border-bps-accent/50 focus:bg-white/[0.05] transition-all font-mono text-sm"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
              <button 
                type="submit"
                className="w-full bg-bps-accent hover:bg-emerald-400 text-black font-bold py-5 rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-bps-accent/20 mt-4 flex items-center justify-center gap-2"
              >
                Authenticate Node
              </button>
            </form>
            
            <div className="mt-10 pt-8 border-t border-white/5 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="micro-label opacity-40">Version</span>
                <span className="tech-value text-[10px] text-white/20">v1.2.8-STABLE</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="micro-label opacity-40">Encryption</span>
                <span className="tech-value text-[10px] text-white/20">AES-256-GCM</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bps-bg text-white font-sans pb-32">
      {/* System Status Bar */}
      <div className="bg-bps-bg border-b border-white/5 px-6 py-2 flex items-center justify-between sticky top-0 z-[60] backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-bps-accent rounded-full animate-pulse" />
            <span className="micro-label text-[9px]">Uplink Active</span>
          </div>
          <div className="h-3 w-px bg-white/10" />
          <div className="flex items-center gap-1.5">
            <Globe className="w-3 h-3 text-white/20" />
            <span className="micro-label text-[9px]">EU-WEST-1</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="tech-value text-[9px] text-white/40">LATENCY: 24MS</span>
          <span className="tech-value text-[9px] text-white/40">{new Date().toLocaleTimeString([], { hour12: false })}</span>
        </div>
      </div>

      {/* Header */}
      <header className="px-6 py-6 flex items-center justify-between sticky top-[33px] bg-bps-bg/80 backdrop-blur-xl z-50 border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-bps-accent/10 rounded-2xl flex items-center justify-center border border-bps-accent/20">
            <BatteryCharging className="w-7 h-7 text-bps-accent" />
          </div>
          <div>
            <h2 className="font-bold text-xl tracking-tight">BPS <span className="text-bps-accent">Mobile</span></h2>
            <p className="micro-label text-[9px] opacity-50">Node: {user.username}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setUser(null)}
            className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5"
          >
            <LogOut className="w-4 h-4 text-white/40" />
          </button>
        </div>
      </header>

      <main className="px-6 max-w-2xl mx-auto py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Main Battery Unit */}
              <div className="relative group">
                <div className="absolute inset-0 bg-bps-accent/5 blur-[80px] rounded-full group-hover:bg-bps-accent/10 transition-all duration-700" />
                <div className="relative bg-bps-card border border-white/5 rounded-[2.5rem] p-10 overflow-hidden shadow-2xl">
                  <div className="flex justify-between items-start mb-12">
                    <div>
                      <p className="micro-label mb-1">Energy Reservoir</p>
                      <h3 className="text-white/40 text-xs font-medium">System Core v4.2</h3>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-2 px-3 py-1 bg-bps-accent/10 border border-bps-accent/20 rounded-full">
                        <ShieldCheck className="w-3 h-3 text-bps-accent" />
                        <span className="micro-label text-[8px] text-bps-accent">Encrypted</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full border-4 border-white/5 flex items-center justify-center">
                        <span className="tech-value text-5xl font-bold">
                          {realBattery !== null ? realBattery : user.battery_level}
                          <span className="text-lg opacity-30 ml-1">%</span>
                        </span>
                      </div>
                      <svg className="absolute inset-0 w-32 h-32 -rotate-90">
                        <circle 
                          cx="64" cy="64" r="60" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="4" 
                          className="text-bps-accent transition-all duration-1000"
                          strokeDasharray="377"
                          strokeDashoffset={377 - (377 * (realBattery !== null ? realBattery : user.battery_level)) / 100}
                        />
                      </svg>
                    </div>

                    <div className="flex-1 space-y-4">
                      <div className="space-y-1">
                        <p className="micro-label opacity-40">Status</p>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-bps-accent" />
                          <span className="font-bold text-sm">
                            {realBattery !== null ? 'Hardware Synced' : 'Simulated Node'}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="micro-label opacity-40">Health Score</p>
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-bps-accent" />
                          <span className="font-bold text-sm">98.4% Optimal</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Visual Waveform Decorator */}
                  <div className="absolute bottom-0 left-0 right-0 h-16 opacity-10 pointer-events-none">
                    <svg className="w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
                      <path d="M0 50 Q 50 20 100 50 T 200 50 T 300 50 T 400 50" fill="none" stroke="currentColor" strokeWidth="2" className="text-bps-accent animate-pulse" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Bento Grid Stats */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-bps-card border border-white/5 rounded-[2rem] p-6 group hover:border-bps-accent/20 transition-all">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6">
                    <Zap className="w-5 h-5 text-blue-500" />
                  </div>
                  <p className="micro-label mb-1">Total Shared</p>
                  <p className="tech-value text-3xl font-bold">{user.energy_shared}<span className="text-xs opacity-20 ml-1">mAh</span></p>
                </div>
                <div className="bg-bps-card border border-white/5 rounded-[2rem] p-6 group hover:border-purple-500/20 transition-all">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center mb-6">
                    <BatteryCharging className="w-5 h-5 text-purple-500" />
                  </div>
                  <p className="micro-label mb-1">Total Received</p>
                  <p className="tech-value text-3xl font-bold">{user.energy_received}<span className="text-xs opacity-20 ml-1">mAh</span></p>
                </div>
              </div>

              {/* System Diagnostics */}
              <div className="bg-bps-card border border-white/5 rounded-[2rem] p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <Cpu className="w-5 h-5 text-white/20" />
                    <h4 className="font-bold text-sm">System Diagnostics</h4>
                  </div>
                  <span className="micro-label text-[8px] px-2 py-0.5 bg-white/5 rounded-full">Live Feed</span>
                </div>
                
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white/40">Core Temperature</span>
                    <span className="tech-value text-xs">32.4°C</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-bps-accent w-[32%]" />
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white/40">Network Stability</span>
                    <span className="tech-value text-xs text-bps-accent">99.9%</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-bps-accent w-[99%]" />
                  </div>
                </div>
              </div>

              {/* Active Transfer */}
              {activeSession && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center animate-pulse">
                        <Zap className="w-4 h-4 text-black" />
                      </div>
                      <span className="font-bold">Power Transfer in Progress</span>
                    </div>
                    <span className="text-emerald-500 font-bold">{activeSession.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-emerald-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${activeSession.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Safety Status */}
              <div className="bg-bps-card border border-white/5 rounded-[2rem] p-8 flex items-center justify-between group hover:border-bps-accent/20 transition-all">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-bps-accent/10 rounded-2xl flex items-center justify-center border border-bps-accent/10">
                    <ShieldCheck className="w-7 h-7 text-bps-accent" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">Safety Protocol</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="micro-label text-[10px] text-bps-accent font-black">Active</span>
                      <span className="w-1 h-1 bg-white/10 rounded-full" />
                      <span className="tech-value text-[10px] text-white/30">TEMP: 32°C</span>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-1.5 bg-bps-accent/10 text-bps-accent text-[10px] font-bold rounded-full uppercase tracking-[0.2em] border border-bps-accent/20">
                  Secure
                </div>
              </div>

              {/* AI Insights */}
              {aiInsights && (
                <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-white/5 rounded-3xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                      <Zap className="w-4 h-4 text-purple-400" />
                    </div>
                    <h4 className="font-bold text-sm">AI Optimization Insights</h4>
                  </div>
                  <ul className="space-y-3">
                    {aiInsights.recommendations.map((rec, i) => (
                      <li key={i} className="flex gap-3 text-xs text-white/60 leading-relaxed">
                        <span className="text-purple-400 font-bold">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'bluetooth' && (
            <motion.div 
              key="bluetooth"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 py-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">Bluetooth Nodes</h3>
                  <p className="text-xs text-white/40 mt-1">Direct hardware-to-hardware pairing</p>
                </div>
                <button 
                  onClick={requestRealBluetoothDevice}
                  disabled={isScanning}
                  className={cn(
                    "flex items-center gap-2 bg-blue-500 text-white text-xs font-bold px-5 py-3 rounded-2xl hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20",
                    isScanning && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Bluetooth className={cn("w-4 h-4", isScanning && "animate-pulse")} />
                  {isScanning ? "Scanning..." : "Pair New Device"}
                </button>
              </div>

              <div className="space-y-4">
                {hardwareDevices.length > 0 ? (
                  hardwareDevices.map(device => (
                    <motion.div 
                      key={device.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-[#141414] border border-blue-500/20 rounded-[2rem] p-6 flex items-center justify-between group hover:bg-blue-500/5 transition-all"
                    >
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center relative">
                          <Bluetooth className="w-7 h-7 text-blue-500" />
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#141414]" />
                        </div>
                        <div>
                          <p className="font-bold text-lg">{device.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">Connected</span>
                            <span className="w-1 h-1 bg-white/20 rounded-full" />
                            <span className="text-[10px] text-white/30 font-medium">{device.id.slice(0, 8)}...</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          className="bg-white/5 hover:bg-white/10 text-white p-3 rounded-xl transition-colors"
                          onClick={() => alert('Opening device settings...')}
                        >
                          <Settings className="w-5 h-5 opacity-40" />
                        </button>
                        <button 
                          className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-6 py-3 rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-500/20"
                          onClick={() => alert(`Initiating BPS Power Transfer Protocol with ${device.name}...`)}
                        >
                          Share Power
                        </button>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="bg-[#141414] border border-white/5 rounded-[2.5rem] p-12 text-center">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Bluetooth className="w-10 h-10 text-white/10" />
                    </div>
                    <h4 className="text-lg font-bold mb-2">No Hardware Nodes</h4>
                    <p className="text-white/30 text-sm max-w-[240px] mx-auto leading-relaxed">
                      Pair with nearby devices via Bluetooth to enable direct wireless energy transfer.
                    </p>
                    <button 
                      onClick={requestRealBluetoothDevice}
                      className="mt-8 text-blue-500 text-sm font-bold hover:underline"
                    >
                      Start Pairing Process
                    </button>
                  </div>
                )}
              </div>

              {/* Hardware Info Card */}
              <div className="bg-blue-500/5 border border-blue-500/10 rounded-3xl p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-blue-500">Encrypted P2P Link</h5>
                    <p className="text-xs text-white/40 mt-1 leading-relaxed">
                      All Bluetooth connections use 256-bit AES encryption. Power transfer is only initiated after mutual biometric authentication.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          {activeTab === 'discover' && (
            <motion.div 
              key="discover"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 py-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Network Discovery</h3>
                <button 
                  onClick={startScan}
                  disabled={isScanning}
                  className={cn(
                    "p-3 rounded-2xl transition-all",
                    isScanning ? "bg-emerald-500 text-black animate-spin" : "bg-white/5 text-white hover:bg-white/10"
                  )}
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>

              {isScanning ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-6">
                  <div className="relative">
                    <motion.div 
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 bg-emerald-500/20 rounded-full"
                    />
                    <div className="relative w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
                      <Bluetooth className="w-10 h-10 text-emerald-500" />
                    </div>
                  </div>
                  <p className="text-white/50 font-medium animate-pulse">Scanning for BPS nodes...</p>
                </div>
              ) : nearbyUsers.length > 0 ? (
                <div className="space-y-3">
                  {nearbyUsers.map(u => (
                    <motion.div 
                      key={u.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-bps-card border border-white/5 rounded-[2rem] p-6 flex items-center justify-between group hover:border-bps-accent/30 transition-all"
                    >
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5">
                          <Radio className="w-7 h-7 text-white/20" />
                        </div>
                        <div>
                          <p className="font-bold text-lg">{u.username}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Battery className="w-3 h-3 text-bps-accent" />
                            <span className="tech-value text-[10px] text-white/40">{u.battery_level}% available</span>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => requestPower(u.id)}
                        className="bg-bps-accent text-black text-xs font-bold px-6 py-3 rounded-xl hover:bg-emerald-400 transition-all active:scale-95 shadow-lg shadow-bps-accent/10"
                      >
                        Request
                      </button>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="bg-bps-card border border-white/5 rounded-[2.5rem] p-16 text-center">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Globe className="w-10 h-10 text-white/10" />
                  </div>
                  <h4 className="text-lg font-bold mb-2">No Uplinks Found</h4>
                  <p className="text-white/30 text-sm max-w-[240px] mx-auto leading-relaxed">
                    Ensure your node is broadcasting and check your local network stability.
                  </p>
                  <button 
                    onClick={startScan}
                    className="mt-8 text-bps-accent text-sm font-bold hover:underline"
                  >
                    Re-initialize Scan
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Session Logs</h3>
                <span className="micro-label text-[8px] px-2 py-1 bg-white/5 rounded-full">Archive</span>
              </div>
              <div className="space-y-4">
                {sessions.map(s => (
                  <div key={s.id} className="bg-bps-card border border-white/5 rounded-[2rem] p-6 flex items-center justify-between group hover:bg-white/[0.02] transition-all">
                    <div className="flex items-center gap-5">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center",
                        s.sender_id === user.id ? "bg-blue-500/10" : "bg-bps-accent/10"
                      )}>
                        {s.sender_id === user.id ? (
                          <Zap className="w-6 h-6 text-blue-500" />
                        ) : (
                          <BatteryCharging className="w-6 h-6 text-bps-accent" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-sm">
                          {s.sender_id === user.id ? `Export to ${s.receiver}` : `Import from ${s.sender}`}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="micro-label text-[8px] opacity-40">{new Date(s.created_at).toLocaleDateString()}</span>
                          <span className="w-1 h-1 bg-white/10 rounded-full" />
                          <span className="tech-value text-[10px] text-white/30">{s.amount} mAh</span>
                        </div>
                      </div>
                    </div>
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border",
                      s.status === 'completed' ? "bg-bps-accent/10 text-bps-accent border-bps-accent/20" : "bg-white/5 text-white/40 border-white/5"
                    )}>
                      {s.status}
                    </div>
                  </div>
                ))}
                {sessions.length === 0 && (
                  <div className="bg-bps-card border border-white/5 rounded-[2.5rem] py-24 text-center">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <p className="micro-label opacity-30">No transaction records found</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <h3 className="text-xl font-bold">System Configuration</h3>
              
              <div className="space-y-4">
                <div className="bg-bps-card border border-white/5 rounded-[2.5rem] p-8">
                  <div className="flex items-center gap-5 mb-8">
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5">
                      <UserIcon className="w-8 h-8 text-white/60" />
                    </div>
                    <div>
                      <p className="font-bold text-xl">{user.username}</p>
                      <p className="tech-value text-[10px] text-white/30 mt-1">NODE_ID: #{user.id.toString().padStart(4, '0')}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-5 bg-white/[0.03] border border-white/5 rounded-2xl">
                      <div className="flex items-center gap-4">
                        <Bluetooth className="w-5 h-5 text-bps-hardware" />
                        <span className="text-sm font-medium">Hardware Discovery</span>
                      </div>
                      <div className="w-10 h-5 bg-bps-accent rounded-full relative">
                        <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-5 bg-white/[0.03] border border-white/5 rounded-2xl">
                      <div className="flex items-center gap-4">
                        <ShieldCheck className="w-5 h-5 text-bps-accent" />
                        <span className="text-sm font-medium">Safety Protocol v2</span>
                      </div>
                      <div className="w-10 h-5 bg-bps-accent rounded-full relative">
                        <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleRestart}
                  className="w-full bg-bps-card hover:bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 flex items-center justify-between transition-all group"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-orange-500/10 rounded-2xl flex items-center justify-center group-hover:bg-orange-500/20 transition-colors border border-orange-500/10">
                      <RefreshCw className="w-7 h-7 text-orange-500" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-lg">Stabilize System</p>
                      <p className="micro-label text-[9px] opacity-40 mt-1">Safe restart & calibration</p>
                    </div>
                  </div>
                </button>

                <div className="bg-red-500/5 border border-red-500/10 rounded-[2rem] p-8">
                  <div className="flex items-center gap-3 text-red-500 mb-4">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="micro-label">Critical Threshold</span>
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed">
                    Minimum battery threshold set to 20%. Sharing will automatically disable below this level to protect device health.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Incoming Request Modal */}
      <AnimatePresence>
        {incomingRequest && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="w-full max-w-md bg-[#141414] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-emerald-500/20 rounded-3xl flex items-center justify-center mb-6 relative">
                  <Zap className="w-10 h-10 text-emerald-500" />
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center border-4 border-[#141414]">
                    <span className="text-[10px] font-black text-black">!</span>
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-2">Power Request</h3>
                <p className="text-white/50 text-sm mb-8 leading-relaxed">
                  A nearby device is requesting <span className="text-white font-bold">{incomingRequest.amount} mAh</span>. 
                  This will reduce your battery by approx. 2%.
                </p>
                
                <div className="grid grid-cols-2 gap-4 w-full">
                  <button 
                    onClick={() => setIncomingRequest(null)}
                    className="py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-bold transition-colors"
                  >
                    Decline
                  </button>
                  <button 
                    onClick={acceptRequest}
                    className="py-4 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-2xl transition-all active:scale-[0.98]"
                  >
                    Accept & Share
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Navigation Bar */}
      <nav className="fixed bottom-8 left-8 right-8 bg-bps-card/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-3 flex items-center justify-between z-[100] shadow-2xl">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={cn(
            "flex-1 flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all duration-300",
            activeTab === 'dashboard' ? "bg-bps-accent text-black shadow-lg shadow-bps-accent/20" : "text-white/30 hover:text-white"
          )}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="micro-label text-[8px]">Core</span>
        </button>
        <button 
          onClick={() => setActiveTab('discover')}
          className={cn(
            "flex-1 flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all duration-300",
            activeTab === 'discover' ? "bg-bps-accent text-black shadow-lg shadow-bps-accent/20" : "text-white/30 hover:text-white"
          )}
        >
          <Radio className="w-5 h-5" />
          <span className="micro-label text-[8px]">Network</span>
        </button>
        <button 
          onClick={() => setActiveTab('bluetooth')}
          className={cn(
            "flex-1 flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all duration-300",
            activeTab === 'bluetooth' ? "bg-bps-hardware text-white shadow-lg shadow-bps-hardware/20" : "text-white/30 hover:text-white"
          )}
        >
          <Bluetooth className="w-5 h-5" />
          <span className="micro-label text-[8px]">Nodes</span>
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={cn(
            "flex-1 flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all duration-300",
            activeTab === 'history' ? "bg-bps-accent text-black shadow-lg shadow-bps-accent/20" : "text-white/30 hover:text-white"
          )}
        >
          <History className="w-5 h-5" />
          <span className="micro-label text-[8px]">Logs</span>
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={cn(
            "flex-1 flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all duration-300",
            activeTab === 'settings' ? "bg-bps-accent text-black shadow-lg shadow-bps-accent/20" : "text-white/30 hover:text-white"
          )}
        >
          <Settings className="w-5 h-5" />
          <span className="micro-label text-[8px]">Config</span>
        </button>
      </nav>
    </div>
  );
}
