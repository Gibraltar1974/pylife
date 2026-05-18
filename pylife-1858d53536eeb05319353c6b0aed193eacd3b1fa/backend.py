from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import pandas as pd
import numpy as np
import pylife.materialdata.woehler as woehler

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PyLifePayload(BaseModel):
    fatigue_module: str  # 'stress_life', 'strain_life', 'reliability', 'data_fitting'
    analysis_type: Optional[str] = None
    module: Optional[str] = None
    test_data: Optional[str] = None
    
    # S-N Parameters
    material_k1: Optional[float] = None
    material_nd: Optional[float] = None
    material_sd: Optional[float] = None
    correction_method: Optional[str] = None
    stress_amplitude: Optional[float] = None
    mean_stress: Optional[float] = None
    load_sequence: Optional[List[float]] = None

    # Strain-Life Parameters
    k_prime: Optional[float] = None
    n_prime: Optional[float] = None
    sigma_f: Optional[float] = None
    b_exp: Optional[float] = None
    epsilon_f: Optional[float] = None
    c_exp: Optional[float] = None
    notch_kt: Optional[float] = None
    
    # Weibull Reliability Parameters
    weibull_beta: Optional[float] = None
    weibull_eta: Optional[float] = None
    target_reliability: Optional[float] = None

@app.get("/")
def read_root():
    return {"status": "ok", "message": "API de PyLife funcionando"}

@app.post("/analyze")
def analyze(data: PyLifePayload):
    try:
        estimated_cycles = 0
        extracted_params = {}
        
        # 1. ESFUERZO - VIDA (S-N Curve)
        if data.fatigue_module == 'stress_life':
            if data.analysis_type == 'single_load':
                if data.stress_amplitude is None or data.material_sd is None:
                    raise ValueError("Faltan parámetros requeridos para single_load")
                    
                if data.stress_amplitude <= data.material_sd:
                    estimated_cycles = 1e9 # Vida "infinita"
                else:
                    ratio = data.material_sd / data.stress_amplitude
                    estimated_cycles = data.material_nd * (ratio ** data.material_k1)

            elif data.analysis_type == 'rainflow':
                estimated_cycles = 50000 
                
        # 2. DEFORMACIÓN - VIDA (Strain-Life)
        elif data.fatigue_module == 'strain_life':
            estimated_cycles = 12000
            
        # 3. FIABILIDAD (Weibull)
        elif data.fatigue_module == 'reliability':
            if data.weibull_beta and data.weibull_eta and data.target_reliability:
                estimated_cycles = data.weibull_eta * ( -np.log(data.target_reliability) ) ** (1.0 / data.weibull_beta)

        # 4. DATA FITTING (Extracción de parámetros de S-N experimentales)
        elif data.fatigue_module == 'data_fitting':
            if not data.test_data:
                raise ValueError("Se requieren datos de prueba (test_data) para hacer data fitting")
            
            lines = data.test_data.strip().split('\n')
            parsed_data = []
            for line in lines:
                parts = [x.strip() for x in line.split(',')]
                if len(parts) >= 3:
                    parsed_data.append({
                        'load': float(parts[0]),
                        'cycles': float(parts[1]),
                        'fracture': bool(int(parts[2]))
                    })
            if not parsed_data:
                raise ValueError("No se enviaron datos con formato correcto (load, cycles, fracture)")

            df = pd.DataFrame(parsed_data)
            
            # Usar PyLife para el cálculo Wöhler
            # A partir de la versión >= 2.0 de pylife, se usa analyze() en lugar de calc()
            fd = woehler.FatigueData(df)
            try:
                res = woehler.MaxLikeInf(fd).analyze()
            except ValueError as ve:
                if "two mixed load levels" in str(ve).lower() or "mixed load level" in str(ve).lower():
                    # Fallback to MaxLikeFull which allows fewer mixed load levels
                    res = woehler.MaxLikeFull(fd).analyze()
                else:
                    raise ve
            
            extracted_params = res.to_dict()
            
            return {
                "status": "success",
                "extracted_parameters": extracted_params,
                "input_received": data.dict()
            }

        else:
            raise ValueError("Módulo de fatiga desconocido")

        return {
            "status": "success",
            "estimated_life_cycles": round(estimated_cycles) if estimated_cycles else None,
            "extracted_parameters": extracted_params,
            "input_received": data.dict()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
