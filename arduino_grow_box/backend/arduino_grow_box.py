# Codice da aggiungere al file backend/arduino_grow_box.py nel repository GitHub
# https://github.com/edoxb/smart-home-sensors/tree/main/arduino_grow_box

from fastapi import APIRouter, HTTPException, Depends, Query
from app.dependencies import get_business_logic, get_mongo_client
from app.services.business_logic import BusinessLogic
from app.db.mongo_client import MongoClientWrapper
from typing import Optional

router = APIRouter(prefix="/sensors/arduino-grow-box", tags=["arduino_grow_box"])

async def handle_growbox_automation(sensor_name: str, data: dict, phase: Optional[str]):
    """
    Gestisce la logica di automazione per il growbox in base alla fase
    Chiamata da automation_service quando arrivano dati dal sensore growbox
    
    Args:
        sensor_name: Nome del sensore
        data: Dati del sensore (temperature, humidity, etc.)
        phase: Fase corrente (piantina, vegetativa, fioritura) o None
    """
    await _handle_growbox_phase_logic(sensor_name, data, phase)

@router.post("/{sensor_name}/fase")
async def set_fase(
    sensor_name: str,
    fase: str = Query(..., description="Fase da impostare: 'piantina', 'vegetativa' o 'fioritura'", regex="^(piantina|vegetativa|fioritura)$"),
    mongo_client: MongoClientWrapper = Depends(get_mongo_client)
):
    """Salva la fase di crescita nel database (sovrascrive il valore precedente)"""
    try:
        if mongo_client.db is None:  # CORRETTO: usa is None invece di if not
            raise HTTPException(status_code=500, detail="Database non connesso")
        
        collection = mongo_client.db.sensor_configs
        
        # Usa upsert per creare o aggiornare il documento
        result = await collection.update_one(
            {"name": sensor_name},
            {"$set": {"growth_phase": fase}},
            upsert=True
        )
        
        return {"success": True, "fase": fase, "sensor_name": sensor_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore: {str(e)}")

@router.get("/{sensor_name}/fase")
async def get_fase(
    sensor_name: str,
    mongo_client: MongoClientWrapper = Depends(get_mongo_client)
):
    """Recupera la fase di crescita corrente dal database"""
    try:
        if mongo_client.db is None:  # CORRETTO: usa is None invece di if
            raise HTTPException(status_code=500, detail="Database non connesso")
        
        config = await mongo_client.db.sensor_configs.find_one({"name": sensor_name})
        if config:
            fase = config.get("growth_phase", None)
            return {"success": True, "fase": fase, "sensor_name": sensor_name}
        else:
            return {"success": True, "fase": None, "sensor_name": sensor_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore: {str(e)}")
@router.post("/{sensor_name}/pompa-aspirazione")
async def control_pompa_aspirazione(
    sensor_name: str,
    action: str = Query(..., description="Azione da eseguire: 'on' o 'off'", regex="^(on|off)$"),
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """Controlla la pompa di aspirazione"""
    action_name = f"pompa_aspirazione_{action}"
    result = await business_logic.execute_sensor_action(sensor_name, action_name)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result

@router.post("/{sensor_name}/pompa-acqua")
async def control_pompa_acqua(
    sensor_name: str,
    action: str = Query(..., description="Azione da eseguire: 'on' o 'off'", regex="^(on|off)$"),
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """Controlla la pompa dell'acqua"""
    action_name = f"pompa_acqua_{action}"
    result = await business_logic.execute_sensor_action(sensor_name, action_name)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result

@router.post("/{sensor_name}/resistenza")
async def control_resistenza(
    sensor_name: str,
    action: str = Query(..., description="Azione da eseguire: 'on' o 'off'", regex="^(on|off)$"),
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """Controlla la resistenza scaldante"""
    action_name = f"resistenza_{action}"
    result = await business_logic.execute_sensor_action(sensor_name, action_name)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result

@router.post("/{sensor_name}/luce-led")
async def control_luce_led(
    sensor_name: str,
    action: str = Query(..., description="Azione da eseguire: 'on' o 'off'", regex="^(on|off)$"),
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """Controlla la luce LED"""
    action_name = f"luce_led_{action}"
    result = await business_logic.execute_sensor_action(sensor_name, action_name)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result

@router.post("/{sensor_name}/ventola")
async def control_ventola(
    sensor_name: str,
    action: str = Query(..., description="Azione da eseguire: 'on' o 'off'", regex="^(on|off)$"),
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """Controlla la ventola"""
    action_name = f"ventola_{action}"
    result = await business_logic.execute_sensor_action(sensor_name, action_name)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result

# Funzione per la logica di automazione delle 3 fasi
async def _handle_growbox_phase_logic(sensor_name: str, data: dict, phase: Optional[str]):
    """
    Logica di automazione specifica per ogni fase di crescita
    
    Args:
        sensor_name: Nome del sensore
        data: Dati del sensore (temperature, humidity, etc.)
        phase: Fase corrente (piantina, vegetativa, fioritura) o None
    """
    if not phase:
        print(f"GROWBOX {sensor_name}: Nessuna fase impostata, automazione disabilitata")
        return
    
    # Estrai valori dai dati
    temps = [
        data.get("temperature_1"),
        data.get("temperature_2"),
        data.get("temperature_3"),
        data.get("temperature_4")
    ]
    hums = [
        data.get("humidity_1"),
        data.get("humidity_2"),
        data.get("humidity_3"),
        data.get("humidity_4")
    ]
    
    # Calcola medie (ignora None)
    valid_temps = [t for t in temps if t is not None]
    valid_hums = [h for h in hums if h is not None]
    avg_temp = sum(valid_temps) / len(valid_temps) if valid_temps else None
    avg_hum = sum(valid_hums) / len(valid_hums) if valid_hums else None
    
    print(f"GROWBOX {sensor_name} - Fase: {phase}")
    print(f"  Temperatura media: {avg_temp:.1f}°C" if avg_temp else "  Temperatura: N/A")
    print(f"  Umidità media: {avg_hum:.1f}%" if avg_hum else "  Umidità: N/A")
    
    # Logica specifica per fase
    if phase == "piantina":
        await _handle_piantina_phase(sensor_name, data, avg_temp, avg_hum)
    elif phase == "vegetativa":
        await _handle_vegetativa_phase(sensor_name, data, avg_temp, avg_hum)
    elif phase == "fioritura":
        await _handle_fioritura_phase(sensor_name, data, avg_temp, avg_hum)

async def _handle_piantina_phase(sensor_name: str, data: dict, avg_temp: Optional[float], avg_hum: Optional[float]):
    """Logica automazione fase piantina"""
    print(f"  → FASE PIANTINA: Logica automazione attiva")
    # TODO: Implementa la logica specifica per la fase piantina
    # Esempio:
    # - Temperatura target: 22-24°C
    # - Umidità target: 65-70%
    # - Luce LED: 18/6 (18h on, 6h off)
    # - Ventola: controllo basato su temperatura/umidità
    
async def _handle_vegetativa_phase(sensor_name: str, data: dict, avg_temp: Optional[float], avg_hum: Optional[float]):
    """Logica automazione fase vegetativa"""
    print(f"  → FASE VEGETATIVA: Logica automazione attiva")
    # TODO: Implementa la logica specifica per la fase vegetativa
    # Esempio:
    # - Temperatura target: 24-26°C
    # - Umidità target: 50-60%
    # - Luce LED: 18/6 o 20/4
    # - Ventola: più attiva per controllo umidità
    
async def _handle_fioritura_phase(sensor_name: str, data: dict, avg_temp: Optional[float], avg_hum: Optional[float]):
    """Logica automazione fase fioritura"""
    print(f"  → FASE FIORITURA: Logica automazione attiva")
    # TODO: Implementa la logica specifica per la fase fioritura
    # Esempio:
    # - Temperatura target: 22-24°C
    # - Umidità target: 40-50%
    # - Luce LED: 12/12 (12h on, 12h off)
    # - Ventola: massima per controllo umidità

# Il gestore viene impostato da automation_service quando necessario

