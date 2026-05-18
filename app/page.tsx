'use client';

import React, { useState, useEffect } from 'react';
import { Activity, Settings2, Server, Globe2, Cpu, LineChart as LineChartIcon, CreditCard, Info, LogOut, LogIn } from 'lucide-react';
import { motion } from 'motion/react';
import { ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../components/AuthProvider';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';

const InfoTooltip = ({ content }: { content: string }) => (
  <div className="relative inline-flex items-center justify-center ml-1">
    <Info className="w-[10px] h-[10px] opacity-40 hover:opacity-100 cursor-help peer" />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-[#1A1A1A] text-white text-[10px] leading-relaxed hidden peer-hover:block hover:block z-50 rounded-sm font-sans normal-case tracking-normal shadow-xl">
      {content}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1A1A1A]" />
    </div>
  </div>
);

const generateSNData = (k: number, sd: number, nd: number) => {
  const data = [];
  // Generar puntos desde 1e3 hasta 1e8 ciclos
  for (let exp = 3; exp <= 8; exp += 0.2) {
    const N = Math.pow(10, exp);
    let S = sd;
    if (N < nd) {
      S = sd * Math.pow((nd / N), 1 / k);
    }
    data.push({ N: N, S: S, logN: exp });
  }
  return data;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#FAF9F6] border border-[#1A1A1A] p-3 text-xs shadow-xl rounded-none relative">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-[#1A1A1A]"></div>
        <p className="font-bold mb-2 opacity-60 uppercase text-[9px] tracking-widest">Data Point</p>
        <p className="mb-0.5"><span className="font-mono opacity-50 uppercase text-[9px]">Cycles (N):</span> <br/> <span className="font-serif italic">{Math.pow(10, label).toExponential(2)}</span></p>
        <p><span className="font-mono opacity-50 uppercase text-[9px]">Amplitude (S):</span> <br/> <span className="font-serif italic">{payload[0].value.toFixed(2)} MPa</span></p>
      </div>
    );
  }
  return null;
};

export default function PyLifeDashboard() {
  const { user, credits, loading: authLoading, signIn, logOut } = useAuth();
  
  const [fatigueModule, setFatigueModule] = useState<'stress_life'|'strain_life'|'data_fitting'|'reliability'>('stress_life');
  
  // Data Fitting State
  const [fittingType, setFittingType] = useState('sn_curve');
  const [testData, setTestData] = useState('300, 10000, 1\n280, 50000, 1\n250, 200000, 1\n210, 1000000, 1\n200, 2000000, 1\n200, 10000000, 0\n190, 5000000, 1\n190, 10000000, 0\n180, 10000000, 0');
  // S-N State
  const [stressAmplitude, setStressAmplitude] = useState(250);
  const [meanStress, setMeanStress] = useState(50);
  const [k1, setK1] = useState(5.0);
  const [nd, setNd] = useState(2000000);
  const [sd, setSd] = useState(200);
  const [correction, setCorrection] = useState('goodman');
  const [analysisType, setAnalysisType] = useState('single_load');
  const [loadSequence, setLoadSequence] = useState('100, 200, -50, 250, -100, 50');
  const [materialPreset, setMaterialPreset] = useState('steel');

  // Strain-Life State
  const [kPrime, setKPrime] = useState(1200);
  const [nPrime, setNPrime] = useState(0.15);
  const [sigmaF, setSigmaF] = useState(1000);
  const [bExp, setBExp] = useState(-0.08);
  const [epsilonF, setEpsilonF] = useState(0.5);
  const [cExp, setCExp] = useState(-0.6);
  const [kt, setKt] = useState(2.5); // Notch factor
  
  // Reliability State
  const [weibullBeta, setWeibullBeta] = useState(2.5);
  const [weibullEta, setWeibullEta] = useState(100000);
  const [targetReliability, setTargetReliability] = useState(0.95);

  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'result'|'chart'>('result');
  const [result, setResult] = useState<null | { status: string; estimated_life_cycles?: number; extracted_parameters?: Record<string, any> }>(null);
  const [notification, setNotification] = useState<{message: string, type: 'error' | 'success'} | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && user) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('payment') === 'success') {
        const addUserCredits = async () => {
          try {
             await updateDoc(doc(db, 'users', user.uid), { credits: increment(10) });
             setNotification({ message: 'Pago verificado como exitoso. Tienes nuevos créditos disponibles.', type: 'success' });
             window.history.replaceState(null, '', window.location.pathname);
          } catch (e) {
             console.error("Failed to add credits: ", e);
          }
        };
        addUserCredits();
      }
      if (urlParams.get('payment') === 'canceled') {
        setNotification({ message: 'El pago fue cancelado o no se completó.', type: 'error' });
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, [user]);

  const handlePurchase = async () => {
    try {
      const res = await fetch('/api/stripe-session', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        const newWindow = window.open(data.url, '_blank', 'noopener,noreferrer');
        if (!newWindow) {
          setNotification({ 
            message: 'To complete the purchase, please open this app in a new tab (click the "Open in new tab" icon in the top right of AI Studio), as Stripe does not allow rendering inside an iFrame.', 
            type: 'error' 
          });
        }
      } else {
        setNotification({ message: data.error || 'Unknown error configuring Stripe session.', type: 'error' });
      }
    } catch (e: any) {
      console.error(e);
      setNotification({ message: e.message === 'Failed to fetch' ? 'Failed to fetch (Adblocker might be blocking the request).' : 'Network error communicating with the checkout API.', type: 'error' });
    }
  };

  const snData = generateSNData(k1, sd, nd);
  const resultPoint = (result && result.estimated_life_cycles && analysisType === 'single_load') 
    ? [{ 
        logN: Math.log10(result.estimated_life_cycles), 
        S: stressAmplitude 
      }]
    : [];

  const handleMaterialChange = (mat: string) => {
    setMaterialPreset(mat);
    if (mat === 'steel') { setK1(5.0); setSd(200); setNd(2000000); setKPrime(1200); setNPrime(0.15); setSigmaF(1000); setBExp(-0.08); setEpsilonF(0.5); setCExp(-0.6); }
    if (mat === 'high_strength_steel') { setK1(6.0); setSd(400); setNd(2000000); setKPrime(1800); setNPrime(0.12); setSigmaF(1500); setBExp(-0.07); setEpsilonF(0.3); setCExp(-0.5); }
    if (mat === 'aluminum') { setK1(7.0); setSd(100); setNd(10000000); setKPrime(600); setNPrime(0.11); setSigmaF(800); setBExp(-0.1); setEpsilonF(0.3); setCExp(-0.7); }
    if (mat === 'cast_iron') { setK1(4.5); setSd(150); setNd(2000000); setKPrime(1000); setNPrime(0.2); setSigmaF(600); setBExp(-0.12); setEpsilonF(0.1); setCExp(-0.8); }
    if (mat === 'titanium') { setK1(8.0); setSd(350); setNd(5000000); setKPrime(1500); setNPrime(0.12); setSigmaF(1200); setBExp(-0.09); setEpsilonF(0.4); setCExp(-0.5); }
    if (mat === 'copper') { setK1(6.5); setSd(80); setNd(10000000); setKPrime(500); setNPrime(0.15); setSigmaF(400); setBExp(-0.1); setEpsilonF(0.4); setCExp(-0.6); }
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setNotification({ message: "Por favor, inicia sesión primero.", type: 'error' });
      return;
    }
    if (credits <= 0) {
      setNotification({ message: "You don't have enough credits. Please click 'Purchase' to buy more.", type: 'error' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const payload: any = {
        fatigue_module: fatigueModule,
        analysis_type: analysisType,
      };

      if (fatigueModule === 'stress_life') {
        payload.material_k1 = k1;
        payload.material_nd = nd;
        payload.material_sd = sd;
        payload.correction_method = correction;
        if (analysisType === 'single_load') {
          payload.stress_amplitude = stressAmplitude;
          payload.mean_stress = meanStress;
        } else {
          const parsedSequence = loadSequence.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
          payload.load_sequence = parsedSequence;
        }
      } else if (fatigueModule === 'strain_life') {
        payload.k_prime = kPrime;
        payload.n_prime = nPrime;
        payload.sigma_f = sigmaF;
        payload.b_exp = bExp;
        payload.epsilon_f = epsilonF;
        payload.c_exp = cExp;
        payload.notch_kt = kt;
      } else if (fatigueModule === 'data_fitting') {
        payload.module = fittingType === 'sn_curve' ? 'fit_sn' : 'fit_en';
        payload.test_data = testData;
      } else if (fatigueModule === 'reliability') {
        payload.weibull_beta = weibullBeta;
        payload.weibull_eta = weibullEta;
        payload.target_reliability = targetReliability;
      }

      const idToken = await user.getIdToken(true);
      const response = await fetch('/api/hf-compute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      if (!response.ok) {
         throw new Error(data.error || `Server Error HTTP ${response.status}`);
      }
      
      setResult(data);
    } catch (error) {
      console.error(error);
      
      let errorMessage = "Unknown connection error.";
      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message.includes("Failed to fetch") || error.name === 'TypeError') {
            errorMessage = "Network Error (Failed to fetch). Maybe an adblocker is blocking the request, or the connection dropped.";
        } else if (error.message.includes("SD_50") || error.message.includes("KeyError")) {
            errorMessage = "Data Fitting Error: 'SD_50' missing. Ensure your Python backend uses pylife's maximum likelihood and your data includes Runouts (fracture=0) so the endurance limit can be calculated.";
        }
      }
      
      setResult({
        status: 'Error',
        estimated_life_cycles: undefined,
        // @ts-ignore - para propósitos de mostrar el error
        error_details: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] text-[#1A1A1A] flex items-center justify-center">
        <Activity className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] text-[#1A1A1A] flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full border border-[#1A1A1A] p-8 bg-white shadow-2xl flex flex-col items-center">
           <Activity className="w-12 h-12 mb-6" />
           <h1 className="font-serif italic text-4xl tracking-tight mb-2 text-center">Life Calculator.</h1>
           <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-60 mb-10 text-center">Structural Integrity Framework</p>
           
           <p className="text-sm text-center mb-8 opacity-80">Log in to track your fatigue analysis credits and synchronize your models across sessions.</p>
           
           <button 
             onClick={signIn}
             className="w-full bg-[#1A1A1A] text-white py-4 uppercase text-[11px] font-bold tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-black/80 transition-colors"
           >
             <LogIn className="w-4 h-4" />
             Sign In with Google
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#1A1A1A] font-sans flex flex-col selection:bg-[#1A1A1A] selection:text-white">
      {notification && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 border flex items-center gap-4 shadow-xl ${notification.type === 'error' ? 'bg-red-50 text-red-900 border-red-200' : 'bg-green-50 text-green-900 border-green-200'}`}>
          <span className="text-sm font-medium">{notification.message}</span>
          <button type="button" onClick={() => setNotification(null)} className="opacity-50 hover:opacity-100 uppercase text-[10px] tracking-widest font-bold">Close</button>
        </div>
      )}
      {/* Header Navigation */}
      <nav className="border-b border-[#1A1A1A] px-6 md:px-12 py-6 flex justify-between items-baseline shrink-0">
        <div className="flex items-baseline gap-4 md:gap-8">
          <span className="font-serif italic text-2xl tracking-tight">Life Calculator.</span>
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-60 hidden md:inline">Structural Integrity Framework</span>
        </div>
        <div className="flex gap-4 md:gap-8 text-[10px] md:text-[11px] uppercase tracking-widest font-medium items-center">
          <div className="flex items-center gap-2 font-mono">
            <span className="opacity-60">Credits:</span>
            <span className="font-bold text-[#1A1A1A]">{credits}</span>
          </div>
          <button 
            onClick={handlePurchase}
            className="flex items-center gap-2 border border-[#1A1A1A] px-4 py-2 hover:bg-black/5 transition-colors"
          >
            <CreditCard className="w-3 h-3" />
            Purchase
          </button>
          <button 
            onClick={logOut}
            className="flex items-center gap-2 border border-[#1A1A1A] bg-[#1A1A1A] text-[#FAF9F6] px-4 py-2 hover:bg-black/90 transition-colors"
          >
            <LogOut className="w-3 h-3" />
            Sign Out
          </button>
        </div>
      </nav>


      {/* Main Hero Section */}
      <main className="flex-1 flex flex-col px-6 md:px-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 border-b border-[#1A1A1A] flex-1">
          
          {/* Left: Input & Parameters */}
          <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-[#1A1A1A] pt-4 pb-6 md:pr-8 flex flex-col">
            <form onSubmit={handleSimulate} className="space-y-4 flex-1 flex flex-col">
              
              <div className="flex border-b border-black/10 gap-4 overflow-x-auto whitespace-nowrap">
                <button type="button" onClick={() => setFatigueModule('stress_life')} className={`pb-2 text-[10px] uppercase font-bold tracking-widest ${fatigueModule === 'stress_life' ? 'border-b-2 border-[#1A1A1A] opacity-100' : 'opacity-40 hover:opacity-100'}`}>Stress-Life (S-N)</button>
                <button type="button" onClick={() => setFatigueModule('strain_life')} className={`pb-2 text-[10px] uppercase font-bold tracking-widest ${fatigueModule === 'strain_life' ? 'border-b-2 border-[#1A1A1A] opacity-100' : 'opacity-40 hover:opacity-100'}`}>Strain-Life (ε-N)</button>
                <button type="button" onClick={() => setFatigueModule('data_fitting')} className={`pb-2 text-[10px] uppercase font-bold tracking-widest ${fatigueModule === 'data_fitting' ? 'border-b-2 border-[#1A1A1A] opacity-100' : 'opacity-40 hover:opacity-100'}`}>Data Fitting</button>
                <button type="button" onClick={() => setFatigueModule('reliability')} className={`pb-2 text-[10px] uppercase font-bold tracking-widest ${fatigueModule === 'reliability' ? 'border-b-2 border-[#1A1A1A] opacity-100' : 'opacity-40 hover:opacity-100'}`}>Reliability STATS</button>
              </div>

              {/* Parameters */}
              <div className="group pt-2">
                <label className="block text-[9px] uppercase tracking-tighter font-bold mb-3 flex items-center gap-2">
                  <Settings2 className="w-3 h-3" /> {fatigueModule === 'stress_life' ? 'S-N Parameters' : fatigueModule === 'strain_life' ? 'Local Strain parameters' : fatigueModule === 'data_fitting' ? 'Data Extraction' : 'Weibull & Stats'}
                </label>
                
                <div className="space-y-3 mt-4">
                  {fatigueModule === 'stress_life' && (
                    <>
                      {/* Analysis Type */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium">Analysis Type</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            type="button"
                            onClick={() => setAnalysisType('single_load')}
                            className={`py-2 text-[10px] uppercase font-bold border transition-colors ${analysisType === 'single_load' ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'bg-transparent border-black/20 hover:bg-black/5'}`}
                          >
                            Single Load
                          </button>
                          <button 
                            type="button"
                            onClick={() => setAnalysisType('rainflow')}
                            className={`py-2 text-[10px] uppercase font-bold border transition-colors ${analysisType === 'rainflow' ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'bg-transparent border-black/20 hover:bg-black/5'}`}
                          >
                            Rainflow Counting
                          </button>
                        </div>
                      </div>

                      {/* Material Parameters (Wöhler Curve) */}
                      <div className="border-t border-black/5 pt-4 space-y-3">
                        <div className="flex justify-between items-end">
                          <label className="text-xs font-medium flex items-center">
                            Material Properties
                            <InfoTooltip content="You can select a material preset or manually define the parameters. These parameters define the Wöhler (S-N) curve of the material." />
                          </label>
                          <select 
                            value={materialPreset}
                            className="bg-black/5 border border-black/10 px-2 py-1 text-[9px] uppercase font-bold outline-none cursor-pointer hover:bg-black/10 transition-colors"
                            onChange={(e) => handleMaterialChange(e.target.value)}
                          >
                            <option value="custom">Preset...</option>
                            <option value="steel">Structural Steel (S235/S355)</option>
                            <option value="high_strength_steel">High Strength Steel</option>
                            <option value="aluminum">Generic Aluminum</option>
                            <option value="cast_iron">Cast Iron</option>
                            <option value="titanium">Titanium Alloy</option>
                            <option value="copper">Copper Alloy</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-tighter font-bold flex items-center opacity-70">
                              k (Slope)
                              <InfoTooltip content="The slope of the Wöhler curve on a log-log scale. Higher value indicates more life degradation per stress drop." />
                            </label>
                            <input 
                              type="number" step="0.1" value={k1} onChange={e => setK1(Number(e.target.value))}
                              className="w-full bg-white/50 border border-black/20 px-2 py-1.5 text-xs outline-none focus:border-[#1A1A1A] font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-tighter font-bold flex items-center opacity-70">
                              SD (Endurance)
                              <InfoTooltip content="Endurance limit or fatigue limit. Below this stress amplitude, life is considered theoretically infinite." />
                            </label>
                            <input 
                              type="number" step="1" value={sd} onChange={e => setSd(Number(e.target.value))}
                              className="w-full bg-white/50 border border-black/20 px-2 py-1.5 text-xs outline-none focus:border-[#1A1A1A] font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-tighter font-bold flex items-center opacity-70">
                              ND (Cycles)
                              <InfoTooltip content="Transition point on the cycle axis indicating the start of the endurance limit." />
                            </label>
                            <input 
                              type="number" step="1000" value={nd} onChange={e => setNd(Number(e.target.value))}
                              className="w-full bg-white/50 border border-black/20 px-2 py-1.5 text-xs outline-none focus:border-[#1A1A1A] font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Mean Stress Correction */}
                      <div className="space-y-2 border-t border-black/5 pt-4">
                        <label className="text-xs font-medium flex items-center">
                          Mean Stress Correction
                          <InfoTooltip content="Goodman: brittle materials (conservative). Gerber: ductile metals. Morrow: steel alloys. Tensile mean stress cuts life, compressive increases it." />
                        </label>
                        <select 
                          value={correction}
                          onChange={(e) => setCorrection(e.target.value)}
                          className="w-full bg-white/50 border border-black/20 px-3 py-2 text-xs outline-none focus:border-[#1A1A1A]"
                        >
                          <option value="none">None</option>
                          <option value="goodman">Goodman</option>
                          <option value="gerber">Gerber</option>
                          <option value="morrow">Morrow</option>
                        </select>
                      </div>

                      {/* Load Input based on type */}
                      <div className="border-t border-black/5 pt-4">
                        {analysisType === 'single_load' ? (
                          <div className="space-y-6">
                            <div className="space-y-2">
                              <div className="flex justify-between items-end">
                                <label className="text-xs font-medium flex items-center">
                                  Stress Amplitude (Sa)
                                  <InfoTooltip content="The amplitude of the cyclic stress: (max - min) / 2" />
                                </label>
                                <span className="font-serif italic text-lg">{stressAmplitude} <span className="text-[10px] font-sans not-italic uppercase ml-1">MPa</span></span>
                              </div>
                              <input
                                type="range" min="10" max="1000" value={stressAmplitude} onChange={(e) => setStressAmplitude(Number(e.target.value))}
                                className="w-full h-1 bg-black/10 appearance-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#1A1A1A] [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
                              />
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between items-end">
                                <label className="text-xs font-medium flex items-center">
                                  Mean Stress (Sm)
                                  <InfoTooltip content="The average value of the cyclic stress: (max + min) / 2" />
                                </label>
                                <span className="font-serif italic text-lg">{meanStress} <span className="text-[10px] font-sans not-italic uppercase ml-1">MPa</span></span>
                              </div>
                              <input
                                type="range" min="-500" max="500" value={meanStress} onChange={(e) => setMeanStress(Number(e.target.value))}
                                className="w-full h-1 bg-black/10 appearance-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#1A1A1A] [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex justify-between items-end">
                              <label className="text-xs font-medium flex items-center">
                                Load Sequence (Peaks and Valleys)
                                <InfoTooltip content="A sequence of points over time representing your variable loading peaks and valleys. Rainflow counting extracts the exact cycles from this sequence." />
                              </label>
                            </div>
                            <textarea
                              value={loadSequence}
                              onChange={(e) => setLoadSequence(e.target.value)}
                              className="w-full bg-white/50 border border-black/20 px-3 py-2 text-sm outline-none focus:border-[#1A1A1A] font-mono whitespace-pre-wrap min-h-[80px]"
                              placeholder="Example: 100, 200, -50, 250"
                            />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  
                  {fatigueModule === 'strain_life' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <label className="text-xs font-medium flex items-center">
                          Material Properties
                          <InfoTooltip content="Local Strain Approach. You can select a material preset or manually define the Ramberg-Osgood and Manson-Coffin-Basquin parameters." />
                        </label>
                        <select 
                          value={materialPreset}
                          className="bg-black/5 border border-black/10 px-2 py-1 text-[9px] uppercase font-bold outline-none cursor-pointer hover:bg-black/10 transition-colors"
                          onChange={(e) => handleMaterialChange(e.target.value)}
                        >
                            <option value="custom">Preset...</option>
                            <option value="steel">Structural Steel (S235/S355)</option>
                            <option value="high_strength_steel">High Strength Steel</option>
                            <option value="aluminum">Generic Aluminum</option>
                            <option value="cast_iron">Cast Iron</option>
                            <option value="titanium">Titanium Alloy</option>
                            <option value="copper">Copper Alloy</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-tighter font-bold flex items-center opacity-70">
                            K' (Strength Coeff)
                            <InfoTooltip content="Cyclic strength coefficient, obtained from fully reversed strain-controlled tests." />
                          </label>
                          <input type="number" step="10" value={kPrime} onChange={e => setKPrime(Number(e.target.value))} className="w-full bg-white/50 border border-black/20 px-2 py-1.5 text-xs outline-none focus:border-[#1A1A1A] font-mono"/>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-tighter font-bold flex items-center opacity-70">
                            n' (Hardening Exp)
                            <InfoTooltip content="Cyclic strain hardening exponent." />
                          </label>
                          <input type="number" step="0.01" value={nPrime} onChange={e => setNPrime(Number(e.target.value))} className="w-full bg-white/50 border border-black/20 px-2 py-1.5 text-xs outline-none focus:border-[#1A1A1A] font-mono"/>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-tighter font-bold flex items-center opacity-70">
                            σ'f (Fatigue Strength)
                            <InfoTooltip content="Fatigue strength coefficient, intersects the elastic strain life line at 1 reversal." />
                          </label>
                          <input type="number" step="10" value={sigmaF} onChange={e => setSigmaF(Number(e.target.value))} className="w-full bg-white/50 border border-black/20 px-2 py-1.5 text-xs outline-none focus:border-[#1A1A1A] font-mono"/>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-tighter font-bold flex items-center opacity-70">
                            b (Strength Exp)
                            <InfoTooltip content="Fatigue strength exponent, slope of the elastic strain life line." />
                          </label>
                          <input type="number" step="0.01" value={bExp} onChange={e => setBExp(Number(e.target.value))} className="w-full bg-white/50 border border-black/20 px-2 py-1.5 text-xs outline-none focus:border-[#1A1A1A] font-mono"/>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-tighter font-bold flex items-center opacity-70">
                            ε'f (Ductility)
                            <InfoTooltip content="Fatigue ductility coefficient, intersects the plastic strain life line at 1 reversal." />
                          </label>
                          <input type="number" step="0.05" value={epsilonF} onChange={e => setEpsilonF(Number(e.target.value))} className="w-full bg-white/50 border border-black/20 px-2 py-1.5 text-xs outline-none focus:border-[#1A1A1A] font-mono"/>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-tighter font-bold flex items-center opacity-70">
                            c (Ductility Exp)
                            <InfoTooltip content="Fatigue ductility exponent, slope of the plastic strain life line." />
                          </label>
                          <input type="number" step="0.01" value={cExp} onChange={e => setCExp(Number(e.target.value))} className="w-full bg-white/50 border border-black/20 px-2 py-1.5 text-xs outline-none focus:border-[#1A1A1A] font-mono"/>
                        </div>
                      </div>

                      <div className="border-t border-black/5 pt-4 mt-4 space-y-2">
                         <div className="flex justify-between items-end">
                            <label className="text-xs font-medium flex items-center">
                              Notch Factor (Kt)
                              <InfoTooltip content="Geometry factor: 1.0 = Smooth/No notch, 1.5-2.5 = Mild notch (hole, fillet, groove), >3.0 = Sharp notch/crack." />
                            </label>
                            <span className="font-serif italic text-lg">{kt}</span>
                         </div>
                         <input
                            type="range" min="1.0" max="5.0" step="0.1" value={kt} onChange={(e) => setKt(Number(e.target.value))}
                            className="w-full h-1 bg-black/10 appearance-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#1A1A1A] [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
                         />
                      </div>
                    </div>
                  )}

                  {fatigueModule === 'data_fitting' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <label className="text-xs font-medium flex items-center">
                          Data Fitting Options
                          <InfoTooltip content="Fit Wöhler (S-N) curve parameters from experimental fatigue data points." />
                        </label>
                        <select 
                          value={fittingType}
                          className="bg-black/5 border border-black/10 px-2 py-1 text-[9px] uppercase font-bold outline-none cursor-pointer hover:bg-black/10 transition-colors"
                          onChange={(e) => setFittingType(e.target.value)}
                        >
                            <option value="sn_curve">S-N Curve (Stress-Life)</option>
                            <option value="en_curve">ε-N Curve (Strain-Life)</option>
                        </select>
                      </div>
                      <p className="text-[9px] opacity-60 mt-1 leading-relaxed">
                        Paste your raw fatigue experimental data. Format: <b>Stress Amplitude, Cycles, Fracture (1=Yes, 0=No runout)</b> per line.
                        We will evaluate this dataset to extract the material parameters using statistical fitting.
                      </p>
                      <div className="space-y-2">
                        <textarea
                          value={testData}
                          onChange={(e) => setTestData(e.target.value)}
                          className="w-full bg-white/50 border border-black/20 p-2 text-xs font-mono h-[140px] outline-none focus:border-[#1A1A1A]"
                          placeholder="300, 10000, 1&#10;280, 50000, 1&#10;190, 500000, 0"
                        />
                      </div>
                    </div>
                  )}

                  {fatigueModule === 'reliability' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <label className="text-xs font-medium flex items-center">
                          Failure Mode Presets
                          <InfoTooltip content="Assess fatigue failure probability. Shape (β) dictates failure type (infant, random, wear-out). Scale (η) is characteristic life from physical tests." />
                        </label>
                        <select 
                          defaultValue="fatigue"
                          className="bg-black/5 border border-black/10 px-2 py-1 text-[9px] uppercase font-bold outline-none cursor-pointer hover:bg-black/10 transition-colors"
                          onChange={(e) => {
                            if (e.target.value === 'fatigue') { setWeibullBeta(3.0); setWeibullEta(500000); }
                            if (e.target.value === 'bearing') { setWeibullBeta(1.5); setWeibullEta(1000000); }
                            if (e.target.value === 'wearout') { setWeibullBeta(4.0); setWeibullEta(300000); }
                            if (e.target.value === 'corrosion') { setWeibullBeta(2.0); setWeibullEta(200000); }
                            if (e.target.value === 'random') { setWeibullBeta(1.0); setWeibullEta(100000); }
                            if (e.target.value === 'infant') { setWeibullBeta(0.5); setWeibullEta(50000); }
                          }}
                        >
                          <option value="custom">Preset...</option>
                          <option value="fatigue">Mechanical Fatigue (β=3)</option>
                          <option value="wearout">General Wear-out (β=4)</option>
                          <option value="bearing">Ball Bearings (β=1.5)</option>
                          <option value="corrosion">Corrosion Fatigue (β=2)</option>
                          <option value="random">Random Failures (β=1)</option>
                          <option value="infant">Infant Mortality (β=0.5)</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-tighter font-bold flex items-center opacity-70">
                            Weibull Shape (β)
                            <InfoTooltip content="Shape parameter (β). Determines failure rate. β<1: early failures, β=1: random/constant rate, β>1: wear-out/fatigue (typically 2-4 for steel)." />
                          </label>
                          <input type="number" step="0.1" value={weibullBeta} onChange={e => setWeibullBeta(Number(e.target.value))} className="w-full bg-white/50 border border-black/20 px-2 py-1.5 text-xs outline-none focus:border-[#1A1A1A] font-mono"/>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-tighter font-bold flex items-center opacity-70">
                            Weibull Scale (η)
                            <InfoTooltip content="Scale parameter (η). The characteristic life where 63.2% of population fails. Usually obtained from historical data or physical testing." />
                          </label>
                          <input type="number" step="1000" value={weibullEta} onChange={e => setWeibullEta(Number(e.target.value))} className="w-full bg-white/50 border border-black/20 px-2 py-1.5 text-xs outline-none focus:border-[#1A1A1A] font-mono"/>
                        </div>
                      </div>
                      
                      <div className="border-t border-black/5 pt-4 mt-4 space-y-2">
                         <div className="flex justify-between items-end">
                            <label className="text-xs font-medium flex items-center">
                              Target Reliability Goal
                              <InfoTooltip content="The desired probability of survival." />
                            </label>
                            <span className="font-serif italic text-lg">{(targetReliability*100).toFixed(1)}%</span>
                         </div>
                         <input
                            type="range" min="0.5" max="0.999" step="0.001" value={targetReliability} onChange={(e) => setTargetReliability(Number(e.target.value))}
                            className="w-full h-1 bg-black/10 appearance-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#1A1A1A] [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
                         />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1"></div>

              <button
                type="submit"
                disabled={loading}
                className="mt-10 w-full bg-[#1A1A1A] text-white py-4 text-[11px] uppercase tracking-[0.3em] font-bold hover:bg-black/80 disabled:opacity-50 transition-all flex items-center justify-center gap-3 shrink-0"
              >
                {loading ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, ease: "linear", duration: 1 }}>
                      <Activity className="w-4 h-4 text-white" />
                    </motion.div>
                     Computing...
                  </>
                ) : (
                  fatigueModule === 'data_fitting' ? 'Extract Parameters' : 'Execute Computation'
                )}
              </button>
            </form>
          </div>

          {/* Right: Visualization */}
          <div className="md:col-span-8 pt-4 pb-6 md:pl-8 flex flex-col">
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-[10px] uppercase tracking-widest block mb-1 opacity-50">Visualization</span>
                <h2 className="font-serif text-3xl italic">Estimated Life Results</h2>
              </div>
              <div className="text-right flex items-center gap-4">
                {result && (
                  <div className="flex bg-black/5 rounded-none p-1">
                    <button 
                      onClick={() => setViewMode('result')}
                      className={`px-3 py-1 text-[10px] uppercase font-bold tracking-wider transition-colors ${viewMode === 'result' ? 'bg-[#1A1A1A] text-white' : 'hover:bg-black/10'}`}
                    >
                      Score
                    </button>
                    <button 
                      onClick={() => setViewMode('chart')}
                      className={`px-3 py-1 text-[10px] uppercase font-bold tracking-wider transition-colors flex gap-2 items-center ${viewMode === 'chart' ? 'bg-[#1A1A1A] text-white' : 'hover:bg-black/10'}`}
                    >
                      <LineChartIcon className="w-3 h-3" /> Wöhler S-N
                    </button>
                  </div>
                )}
                <div className="text-right ml-4">
                  <span className="text-[10px] uppercase tracking-widest block mb-1 opacity-60">Status</span>
                  <span className="text-sm font-medium uppercase tracking-widest">{loading ? 'Processing' : result ? 'Completed' : 'Awaiting Input'}</span>
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="relative flex-1 border border-black/10 bg-white/50 p-8 flex flex-col items-center justify-center overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
                <div className="w-full h-full" style={{ backgroundImage: "radial-gradient(#000 1px, transparent 1px)", backgroundSize: "20px 20px" }}></div>
              </div>
              
              {!result && !loading && (
                <div className="text-center z-10 flex flex-col items-center">
                  <Server className="w-8 h-8 opacity-40 mb-4" />
                  <span className="font-serif italic text-xl opacity-60">Awaiting Computation</span>
                  <p className="text-[10px] uppercase tracking-widest mt-2 opacity-50">Start the analysis by sending the parameters to the API.</p>
                </div>
              )}

              {loading && (
                <div className="text-center z-10 flex flex-col items-center">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                  >
                    <div className="w-16 h-16 border border-[#1A1A1A] border-t-transparent rounded-full animate-spin mb-6" />
                  </motion.div>
                  <span className="font-serif italic text-xl">Processing via Inference Endpoint</span>
                  <p className="text-[10px] uppercase tracking-widest mt-2 opacity-50 font-mono">AWAITING_FASTAPI_RESPONSE</p>
                </div>
              )}

              {result && !loading && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="z-10 w-full flex flex-col h-full"
                >
                  {/* @ts-ignore */}
                  {result.error_details ? (
                    <div className="flex-1 flex flex-col justify-center items-center mb-8">
                       <span className="text-[10px] uppercase tracking-widest block mb-4 opacity-60">Connection Error</span>
                       <div className="text-center font-mono text-[11px] bg-red-50 text-red-900 border border-red-200 p-4 w-full">
                         {/* @ts-ignore */}
                         {result.error_details}
                       </div>
                    </div>
                  ) : fatigueModule === 'data_fitting' && result && result.extracted_parameters ? (
                    <div className="flex-1 flex flex-col justify-center py-6 px-4">
                      <span className="text-[10px] uppercase tracking-widest block mb-6 opacity-60">Fitted Parameters</span>
                      <div className="grid grid-cols-2 gap-4">
                        {Object.entries(result.extracted_parameters).map(([key, val]) => (
                          <div key={key} className="border border-black/10 p-4">
                            <span className="text-[10px] uppercase font-bold opacity-60 block mb-2">{key.replace(/_/g, ' ')}</span>
                            <span className="font-mono text-lg">{typeof val === 'number' ? val.toPrecision(5) : String(val)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : viewMode === 'result' ? (
                    <div className="flex-1 flex flex-col justify-center items-center py-10">
                       <span className="text-[10px] uppercase tracking-widest block mb-4 opacity-60">Estimated Cycles (N)</span>
                       <div className="text-6xl md:text-8xl font-light tracking-tighter flex items-center justify-center gap-4 text-[#1A1A1A]">
                         {result.estimated_life_cycles?.toLocaleString() || "N/A"}
                       </div>
                    </div>
                  ) : fatigueModule === 'data_fitting' ? (
                    <div className="flex-1 flex flex-col justify-center items-center py-10 opacity-50">
                       <span className="text-[10px] uppercase tracking-widest block mb-4">Awaiting Extraction</span>
                       <div className="text-sm tracking-tighter text-[#1A1A1A]">
                         Provide test data and simulate to extract parameters.
                       </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col h-full min-h-[300px] w-full pt-4">
                      <span className="text-[10px] uppercase tracking-widest block mb-6 opacity-60 text-center">
                        <span className="font-semibold text-black">Wöhler S-N Curve</span> — Slope: k={k1}, SD={sd}MPa, ND={nd.toExponential(1)}
                      </span>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={snData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={true} stroke="#000000" strokeOpacity={0.1} />
                          <XAxis 
                            dataKey="logN" 
                            type="number" 
                            domain={[3, 8]} 
                            ticks={[3, 4, 5, 6, 7, 8]}
                            tickFormatter={(val) => `10^${val}`}
                            axisLine={{ stroke: '#1A1A1A', strokeWidth: 1 }}
                            tickLine={false}
                            tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#1A1A1A', opacity: 0.6 }}
                            label={{ value: 'Number of Cycles (N)', position: 'insideBottom', offset: -15, fontSize: 10, textAnchor: 'middle', fontWeight: 'bold', fill: '#1A1A1A', opacity: 0.5 }}
                          />
                          <YAxis 
                            type="number"
                            domain={[0, 'auto']}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#1A1A1A', opacity: 0.6 }}
                            label={{ value: 'Stress Amplitude (MPa)', angle: -90, position: 'insideLeft', offset: 0, fontSize: 10, fontWeight: 'bold', fill: '#1A1A1A', opacity: 0.5 }}
                          />
                          <RechartsTooltip content={<CustomTooltip />} />
                          <Line 
                            type="monotone" 
                            dataKey="S" 
                            stroke="#1A1A1A" 
                            strokeWidth={2} 
                            dot={false}
                            activeDot={{ r: 6, fill: '#1A1A1A', stroke: '#FAF9F6', strokeWidth: 2 }}
                            animationDuration={1000}
                          />
                          {resultPoint.length > 0 && (
                            <Scatter 
                              data={resultPoint} 
                              fill="#ef4444" 
                              shape="circle" 
                              name="Analysis Point"
                              // @ts-ignore
                              r={6}
                            />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                </motion.div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 shrink-0">
              <div className="border-t border-black/10 pt-4">
                <span className="text-[9px] uppercase font-bold block mb-1 opacity-50">Active Module</span>
                <div className="font-serif text-lg italic">{fatigueModule === 'stress_life' ? 'S-N Curve' : fatigueModule === 'strain_life' ? 'ε-N Curve' : fatigueModule === 'data_fitting' ? 'Data Extraction' : 'Weibull'}</div>
              </div>
              <div className="border-t border-black/10 pt-4">
                <span className="text-[9px] uppercase font-bold block mb-1 opacity-50">Key Metric</span>
                <div className="font-serif text-lg italic capitalize">{fatigueModule === 'stress_life' ? `k=${k1}` : fatigueModule === 'strain_life' ? `Kt=${kt}` : fatigueModule === 'data_fitting' ? 'N/A' : `β=${weibullBeta}`}</div>
              </div>
              <div className="border-t border-black/10 pt-4">
                <span className="text-[9px] uppercase font-bold block mb-1 opacity-50">Analysis type</span>
                <div className="font-serif text-lg italic">{fatigueModule === 'stress_life' ? (analysisType === 'single_load' ? 'Single Load' : 'Rainflow') : 'Custom'}</div>
              </div>
              <div className="border-t border-black/10 pt-4">
                <span className="text-[9px] uppercase font-bold block mb-1 opacity-50">API Status</span>
                <div className="font-serif text-lg italic">{result ? 'Success' : 'Idle'} </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Details */}
      <footer className="border-t border-[#1A1A1A] px-6 md:px-12 py-4 flex flex-col md:flex-row justify-between items-center gap-4 text-[9px] uppercase tracking-[0.2em] font-medium shrink-0">
        <div>© 2026 Project Life Calculator</div>
        
        <div className="flex flex-col md:flex-row items-center gap-4 text-center md:text-left opacity-80">
          <span className="leading-relaxed">Uses the open-source calculation engine <a href="https://pylife.readthedocs.io/en/stable/README.html#purpose-of-the-project" target="_blank" rel="noopener noreferrer" className="font-bold underline hover:opacity-100">"pylife"</a></span>
          <a href="https://pylife.readthedocs.io/en/stable/README.html#purpose-of-the-project" target="_blank" rel="noopener noreferrer" className="transition-opacity hover:opacity-100 flex items-center justify-center">
            <img src="/pylife-logo-16x9_res_800x450.webp" alt="pyLife Logo" className="h-8 object-contain" />
          </a>
          
          <span className="leading-relaxed">developed by</span>
          <a href="https://www.bosch.com/stories/bringing-open-source-to-mechanical-engineering/" target="_blank" rel="noopener noreferrer" className="transition-opacity hover:opacity-100 flex items-center">
            <img src="/bosch-logo.png" alt="Bosch Logo" className="h-8 object-contain" />
          </a>
        </div>
      </footer>
    </div>
  );
}
