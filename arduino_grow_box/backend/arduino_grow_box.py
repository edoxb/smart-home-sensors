from fastapi import APIRouter, HTTPException, Depends, Query
from app.dependencies import get_business_logic, get_mongo_client
from app.services.business_logic import BusinessLogic
from app.db.mongo_client import MongoClientWrapper
from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from pathlib import Path
import json

router = APIRouter(prefix="/sensors/arduino-grow-box", tags=["arduino_grow_box"])

# Variabile globale per tracciare lo stato della luce LED
_led_state = {}  # {sensor_name: {"is_on": bool, "last_toggle": datetime, "cycle_start": datetime, "hours_on_today": float, "last_state_check": datetime}}

# Variabile globale per tracciare lo stato degli attuatori (per isteresi)
_actuator_hysteresis_state = {}  # {sensor_name: {"resistenza_was_low": bool, "pompa_acqua_was_low": bool}}

# Variabile globale per tracciare lo stato degli attuatori (per isteresi)
_actuator_hysteresis_state = {}  # {sensor_name: {"resistenza_was_low": bool, "pompa_acqua_was_low": bool}}

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

async def _save_actuator_state(sensor_name: str, actuator_name: str, state: bool, mongo_client: MongoClientWrapper):
    """Salva lo stato di un attuatore nel database"""
    try:
        if mongo_client.db is None:
            return
        
        collection = mongo_client.db.sensor_configs
        field_name = f"actuator_{actuator_name}_state"
        
        await collection.update_one(
            {"name": sensor_name},
            {"$set": {field_name: state}},
            upsert=True
        )
    except Exception as e:
        print(f"Errore salvataggio stato attuatore {actuator_name} per {sensor_name}: {e}")

async def _get_actuator_states(sensor_name: str, mongo_client: MongoClientWrapper) -> Dict[str, bool]:
    """Recupera lo stato di tutti gli attuatori dal database"""
    try:
        if mongo_client.db is None:
            return {}
        
        config = await mongo_client.db.sensor_configs.find_one({"name": sensor_name})
        if not config:
            return {}
        
        actuators = {
            "luce_led": config.get("actuator_luce_led_state", False),
            "ventola": config.get("actuator_ventola_state", False),
            "resistenza": config.get("actuator_resistenza_state", False),
            "pompa_aspirazione": config.get("actuator_pompa_aspirazione_state", False),
            "pompa_acqua": config.get("actuator_pompa_acqua_state", False)
        }
        return actuators
    except Exception as e:
        print(f"Errore lettura stato attuatori per {sensor_name}: {e}")
        return {}

async def _get_targets_for_phase(phase: Optional[str], mongo_client: Optional[MongoClientWrapper], sensor_name: str, data: dict = None) -> Dict[str, Any]:
    """Calcola i target temperatura e umidità in base alla fase"""
    if not phase:
        return {
            "temp_target_min": None,
            "temp_target_max": None,
            "hum_target_min": None,
            "hum_target_max": None
        }
    
    if phase == "piantina":
        # Target: 65-70% umidità, 20-25°C con luci accese, 4-5°C in meno con luci spente
        led_on = await _check_led_state(sensor_name, data)
        if led_on:
            return {
                "temp_target_min": 20,
                "temp_target_max": 25,
                "hum_target_min": 65,
                "hum_target_max": 70
            }
        else:
            return {
                "temp_target_min": 15,  # 20-5
                "temp_target_max": 21,  # 25-4
                "hum_target_min": 65,
                "hum_target_max": 70
            }
    
    elif phase == "vegetativa":
        # Umidità che diminuisce del 5% ogni settimana, 22-28°C con luci accese, 4-5°C in meno con luci spente
        # Nota: il calcolo delle settimane viene fatto in _handle_vegetativa_phase
        # Qui usiamo valori di default (settimana 0)
        weeks_elapsed = 0
        
        base_hum = 65
        hum_reduction = weeks_elapsed * 5
        hum_min = max(40, base_hum - hum_reduction)
        hum_max = max(45, base_hum - hum_reduction + 5)
        
        led_on = await _check_led_state(sensor_name, data)
        if led_on:
            return {
                "temp_target_min": 22,
                "temp_target_max": 28,
                "hum_target_min": hum_min,
                "hum_target_max": hum_max
            }
        else:
            return {
                "temp_target_min": 17,  # 22-5
                "temp_target_max": 24,  # 28-4
                "hum_target_min": hum_min,
                "hum_target_max": hum_max
            }
    
    elif phase == "fioritura":
        # Target: 40-50% umidità, 20-26°C con luci accese
        return {
            "temp_target_min": 20,
            "temp_target_max": 26,
            "hum_target_min": 40,
            "hum_target_max": 50
        }
    
    return {
        "temp_target_min": None,
        "temp_target_max": None,
        "hum_target_min": None,
        "hum_target_max": None
    }

@router.post("/{sensor_name}/fase")
async def set_fase(
    sensor_name: str,
    fase: str = Query(..., description="Fase da impostare: 'piantina', 'vegetativa' o 'fioritura'", regex="^(piantina|vegetativa|fioritura)$"),
    mongo_client: MongoClientWrapper = Depends(get_mongo_client)
):
    """Salva la fase di crescita nel database (sovrascrive il valore precedente)"""
    try:
        if mongo_client.db is None:
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
        if mongo_client.db is None:
            raise HTTPException(status_code=500, detail="Database non connesso")
        
        config = await mongo_client.db.sensor_configs.find_one({"name": sensor_name})
        if config:
            fase = config.get("growth_phase", None)
            return {"success": True, "fase": fase, "sensor_name": sensor_name}
        else:
            return {"success": True, "fase": None, "sensor_name": sensor_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore: {str(e)}")

@router.post("/{sensor_name}/inizia-coltivazione")
async def inizia_coltivazione(
    sensor_name: str,
    mongo_client: MongoClientWrapper = Depends(get_mongo_client),
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """Inizia un nuovo ciclo di coltivazione - imposta fase piantina e resetta dati"""
    try:
        if mongo_client.db is None:
            raise HTTPException(status_code=500, detail="Database non connesso")
        
        collection = mongo_client.db.sensor_configs
        
        # Imposta fase piantina e data inizio coltivazione
        now = datetime.now(timezone.utc)
        await collection.update_one(
            {"name": sensor_name},
            {
                "$set": {
                    "growth_phase": "piantina",
                    "cultivation_start_date": now,
                    "vegetative_start_date": None,
                    "flowering_start_date": None,
                    "cultivation_active": True
                }
            },
            upsert=True
        )
        
        # Resetta lo stato LED (nuovo ciclo)
        cycle_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        _led_state[sensor_name] = {
            "is_on": False,
            "last_toggle": now,
            "cycle_start": cycle_start,
            "hours_on_today": 0.0,
            "last_state_check": now
        }
        
        return {
            "success": True,
            "message": "Coltivazione iniziata",
            "fase": "piantina",
            "start_date": now.isoformat(),
            "sensor_name": sensor_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore: {str(e)}")

@router.post("/{sensor_name}/fine-coltivazione")
async def fine_coltivazione(
    sensor_name: str,
    mongo_client: MongoClientWrapper = Depends(get_mongo_client),
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """Termina il ciclo di coltivazione corrente - cancella tutti i dati del ciclo"""
    try:
        if mongo_client.db is None:
            raise HTTPException(status_code=500, detail="Database non connesso")
        
        collection = mongo_client.db.sensor_configs
        
        # Rimuovi tutti i dati relativi alla coltivazione
        await collection.update_one(
            {"name": sensor_name},
            {
                "$unset": {
                    "growth_phase": "",
                    "cultivation_start_date": "",
                    "vegetative_start_date": "",
                    "flowering_start_date": "",
                    "cultivation_active": "",
                    "actuator_luce_led_state": "",
                    "actuator_ventola_state": "",
                    "actuator_resistenza_state": "",
                    "actuator_pompa_aspirazione_state": "",
                    "actuator_pompa_acqua_state": ""
                }
            }
        )
        
        # Resetta lo stato LED
        if sensor_name in _led_state:
            del _led_state[sensor_name]
        
        # Spegni tutti gli attuatori
        try:
            actions_to_execute = [
                "luce_led_off",
                "ventola_off",
                "resistenza_off",
                "pompa_aspirazione_off",
                "pompa_acqua_off"
            ]
            for action in actions_to_execute:
                try:
                    await business_logic.execute_sensor_action(sensor_name, action)
                except:
                    pass  # Ignora errori se l'azione non è disponibile
        except:
            pass  # Ignora errori nella disattivazione degli attuatori
        
        return {
            "success": True,
            "message": "Coltivazione terminata - tutti i dati del ciclo sono stati cancellati",
            "sensor_name": sensor_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore: {str(e)}")

@router.get("/{sensor_name}/stato-coltivazione")
async def get_stato_coltivazione(
    sensor_name: str,
    mongo_client: MongoClientWrapper = Depends(get_mongo_client),
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """Recupera lo stato completo della coltivazione: fase, attuatori, target, valori medi e dati sensori completi"""
    try:
        if mongo_client.db is None:
            raise HTTPException(status_code=500, detail="Database non connesso")
        
        config = await mongo_client.db.sensor_configs.find_one({"name": sensor_name})
        phase = config.get("growth_phase") if config else None
        
        # Recupera stato attuatori
        actuator_states = await _get_actuator_states(sensor_name, mongo_client)
        
        # Recupera dati sensore completi
        sensor_data_dict = {}
        avg_temp = None
        avg_hum = None
        try:
            sensor_data = await business_logic.read_sensor_data(sensor_name)
            if sensor_data and sensor_data.data:
                # Includi tutti i dati del sensore
                sensor_data_dict = sensor_data.data
                
                # Calcola medie
                temps = [
                    sensor_data.data.get("temperature_1"),
                    sensor_data.data.get("temperature_2"),
                    sensor_data.data.get("temperature_3"),
                    sensor_data.data.get("temperature_4")
                ]
                hums = [
                    sensor_data.data.get("humidity_1"),
                    sensor_data.data.get("humidity_2"),
                    sensor_data.data.get("humidity_3"),
                    sensor_data.data.get("humidity_4")
                ]
                
                valid_temps = [t for t in temps if t is not None]
                valid_hums = [h for h in hums if h is not None]
                avg_temp = sum(valid_temps) / len(valid_temps) if valid_temps else None
                avg_hum = sum(valid_hums) / len(valid_hums) if valid_hums else None
        except:
            pass
        
        # Calcola target in base alla fase (usa i dati del sensore se disponibili)
        targets = await _get_targets_for_phase(phase, mongo_client, sensor_name, sensor_data_dict if sensor_data_dict else None)
        
        # Recupera stato LED per includere informazioni sul timestamp
        led_status_info = {}
        if sensor_name in _led_state:
            led_state = _led_state[sensor_name]
            last_toggle = led_state.get("last_toggle")
            hours_on_today = led_state.get("hours_on_today", 0.0)
            cycle_start = led_state.get("cycle_start")
            is_on = led_state.get("is_on", False)
            
            # Calcola minuti invece di ore per il frontend
            minutes_on_today = int(hours_on_today * 60)
            
            # Calcola minuti rimanenti
            now = datetime.now(timezone.utc)
            if cycle_start:
                hours_since_cycle_start = (now - cycle_start).total_seconds() / 3600
                if is_on:
                    # Se acceso, calcola quando si spegne (dopo 18 ore totali)
                    remaining_hours = 18 - hours_on_today
                    minutes_until_off = int(remaining_hours * 60) if remaining_hours > 0 else 0
                    minutes_until_on = None
                else:
                    # Se spento, calcola quando si accende (dopo 6 ore spente)
                    hours_off = hours_since_cycle_start - hours_on_today
                    max_off_hours = 24 - 18  # 6 ore
                    remaining_off_hours = max_off_hours - hours_off
                    minutes_until_on = int(remaining_off_hours * 60) if remaining_off_hours > 0 else 0
                    minutes_until_off = None
            else:
                minutes_until_on = None
                minutes_until_off = None
            
            # Serializza last_toggle con timezone (ISO format)
            last_toggle_iso = None
            if last_toggle:
                # Se last_toggle non ha timezone, aggiungilo (assumendo UTC)
                if last_toggle.tzinfo is None:
                    last_toggle = last_toggle.replace(tzinfo=timezone.utc)
                last_toggle_iso = last_toggle.isoformat()
            
            led_status_info = {
                "minutes_on_today": minutes_on_today,
                "minutes_until_on": minutes_until_on,
                "minutes_until_off": minutes_until_off,
                "last_toggle": last_toggle_iso
            }
        
        if config:
            return {
                "success": True,
                "cultivation_active": config.get("cultivation_active", False),
                "growth_phase": phase,
                "cultivation_start_date": config.get("cultivation_start_date"),
                "vegetative_start_date": config.get("vegetative_start_date"),
                "flowering_start_date": config.get("flowering_start_date"),
                "actuator_states": actuator_states,
                "targets": targets,
                "current_values": {
                    "avg_temperature": avg_temp,
                    "avg_humidity": avg_hum
                },
                "sensor_data": sensor_data_dict,  # Dati completi del sensore
                "led_status": led_status_info,  # Stato LED con timestamp
                "sensor_name": sensor_name
            }
        else:
            return {
                "success": True,
                "cultivation_active": False,
                "growth_phase": None,
                "actuator_states": actuator_states,
                "targets": targets,
                "current_values": {
                    "avg_temperature": avg_temp,
                    "avg_humidity": avg_hum
                },
                "sensor_data": sensor_data_dict,  # Dati completi del sensore
                "led_status": led_status_info,  # Stato LED con timestamp
                "sensor_name": sensor_name
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore: {str(e)}")

@router.post("/{sensor_name}/pompa-aspirazione")
async def control_pompa_aspirazione(
    sensor_name: str,
    action: str = Query(..., description="Azione da eseguire: 'on' o 'off'", regex="^(on|off)$"),
    business_logic: BusinessLogic = Depends(get_business_logic),
    mongo_client: MongoClientWrapper = Depends(get_mongo_client)
):
    """Controlla la pompa di aspirazione"""
    action_name = f"pompa_aspirazione_{action}"
    result = await business_logic.execute_sensor_action(sensor_name, action_name)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    # Salva stato nel DB
    await _save_actuator_state(sensor_name, "pompa_aspirazione", action == "on", mongo_client)
    return result

@router.post("/{sensor_name}/pompa-acqua")
async def control_pompa_acqua(
    sensor_name: str,
    action: str = Query(..., description="Azione da eseguire: 'on' o 'off'", regex="^(on|off)$"),
    business_logic: BusinessLogic = Depends(get_business_logic),
    mongo_client: MongoClientWrapper = Depends(get_mongo_client)
):
    """Controlla la pompa dell'acqua"""
    action_name = f"pompa_acqua_{action}"
    result = await business_logic.execute_sensor_action(sensor_name, action_name)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    # Salva stato nel DB
    await _save_actuator_state(sensor_name, "pompa_acqua", action == "on", mongo_client)
    return result

@router.post("/{sensor_name}/resistenza")
async def control_resistenza(
    sensor_name: str,
    action: str = Query(..., description="Azione da eseguire: 'on' o 'off'", regex="^(on|off)$"),
    business_logic: BusinessLogic = Depends(get_business_logic),
    mongo_client: MongoClientWrapper = Depends(get_mongo_client)
):
    """Controlla la resistenza scaldante"""
    action_name = f"resistenza_{action}"
    result = await business_logic.execute_sensor_action(sensor_name, action_name)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    # Salva stato nel DB
    await _save_actuator_state(sensor_name, "resistenza", action == "on", mongo_client)
    return result

@router.post("/{sensor_name}/luce-led")
async def control_luce_led(
    sensor_name: str,
    action: str = Query(..., description="Azione da eseguire: 'on' o 'off'", regex="^(on|off)$"),
    business_logic: BusinessLogic = Depends(get_business_logic),
    mongo_client: MongoClientWrapper = Depends(get_mongo_client)
):
    """Controlla la luce LED"""
    action_name = f"luce_led_{action}"
    result = await business_logic.execute_sensor_action(sensor_name, action_name)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    # Aggiorna stato LED locale e nel DB
    if result.success:
        now = datetime.now(timezone.utc)
        if sensor_name not in _led_state:
            cycle_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            _led_state[sensor_name] = {
                "is_on": False,
                "last_toggle": now,
                "cycle_start": cycle_start,
                "hours_on_today": 0.0,
                "last_state_check": now
            }
        _led_state[sensor_name]["is_on"] = (action == "on")
        _led_state[sensor_name]["last_toggle"] = now
        _led_state[sensor_name]["last_state_check"] = now
        await _save_actuator_state(sensor_name, "luce_led", action == "on", mongo_client)
    return result

@router.post("/{sensor_name}/ventola")
async def control_ventola(
    sensor_name: str,
    action: str = Query(..., description="Azione da eseguire: 'on' o 'off'", regex="^(on|off)$"),
    business_logic: BusinessLogic = Depends(get_business_logic),
    mongo_client: MongoClientWrapper = Depends(get_mongo_client)
):
    """Controlla la ventola"""
    action_name = f"ventola_{action}"
    result = await business_logic.execute_sensor_action(sensor_name, action_name)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    # Salva stato nel DB
    await _save_actuator_state(sensor_name, "ventola", action == "on", mongo_client)
    return result

@router.get("/{sensor_name}/stats")
async def get_backup_days(
    sensor_name: str,
    mongo_client: MongoClientWrapper = Depends(get_mongo_client)
):
    """Restituisce l'elenco delle cartelle di backup disponibili (giorni)"""
    try:
        # Ottieni il percorso della directory di backup
        backup_dir = mongo_client.backup_dir
        
        # Verifica che la directory esista
        if not backup_dir.exists():
            return {"days": []}
        
        # Lista tutte le cartelle (giorni) presenti
        days = []
        for item in backup_dir.iterdir():
            if item.is_dir():
                # Verifica che il nome della cartella sia nel formato YYYY-MM-DD
                try:
                    datetime.strptime(item.name, "%Y-%m-%d")
                    days.append(item.name)
                except ValueError:
                    # Ignora cartelle che non corrispondono al formato data
                    continue
        
        # Ordina le date in ordine decrescente (più recenti prima)
        days.sort(reverse=True)
        
        return {
            "backup_dir": str(backup_dir),
            "days": days
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore nel recupero statistiche: {str(e)}")

@router.get("/{sensor_name}/stats/{day}")
async def get_day_statistics(
    sensor_name: str,
    day: str,
    mongo_client: MongoClientWrapper = Depends(get_mongo_client)
):
    """Restituisce i dati statistici per un giorno specifico"""
    try:
        # Valida formato data (YYYY-MM-DD)
        try:
            datetime.strptime(day, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato data non valido. Usa YYYY-MM-DD")
        
        # Ottieni il percorso della directory di backup
        backup_dir = mongo_client.backup_dir
        day_dir = backup_dir / day
        
        # Verifica che la directory esista
        if not day_dir.exists():
            raise HTTPException(status_code=404, detail=f"Directory per il giorno {day} non trovata")
        
        # Cerca il file JSON che inizia con il nome del sensore (con spazio o underscore)
        json_files = list(day_dir.glob(f"{sensor_name}_*.json"))
        if not json_files:
            # Prova anche con spazio invece di underscore
            json_files = list(day_dir.glob(f"{sensor_name.replace(' ', '_')}_*.json"))
        if not json_files:
            # Prova anche con underscore invece di spazio
            json_files = list(day_dir.glob(f"{sensor_name.replace('_', ' ')}_*.json"))
        
        if not json_files:
            raise HTTPException(status_code=404, detail=f"File JSON per {sensor_name} del giorno {day} non trovato")
        
        # Leggi il primo file trovato
        json_file = json_files[0]
        with open(json_file, 'r', encoding='utf-8') as f:
            backup_data = json.load(f)
        
        # Estrai e processa i dati
        records = []
        for record in backup_data.get("data", []):
            timestamp = record.get("timestamp")
            data = record.get("data", {})
            
            # Calcola temperatura media
            temps = [
                data.get("temperature_1"),
                data.get("temperature_2"),
                data.get("temperature_3"),
                data.get("temperature_4")
            ]
            valid_temps = [t for t in temps if t is not None]
            avg_temp = sum(valid_temps) / len(valid_temps) if valid_temps else None
            
            # Calcola umidità media
            hums = [
                data.get("humidity_1"),
                data.get("humidity_2"),
                data.get("humidity_3"),
                data.get("humidity_4")
            ]
            valid_hums = [h for h in hums if h is not None]
            avg_hum = sum(valid_hums) / len(valid_hums) if valid_hums else None
            
            if timestamp and (avg_temp is not None or avg_hum is not None):
                records.append({
                    "timestamp": timestamp,
                    "avg_temperature": round(avg_temp, 2) if avg_temp is not None else None,
                    "avg_humidity": round(avg_hum, 2) if avg_hum is not None else None
                })
        
        # Ordina per timestamp
        records.sort(key=lambda x: x["timestamp"])
        
        return {
            "day": day,
            "sensor_name": sensor_name,
            "total_records": len(records),
            "data": records
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore nel recupero statistiche: {str(e)}")

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

async def _control_temperature_with_hysteresis(
    sensor_name: str,
    avg_temp: Optional[float],
    target_temp_min: float,
    target_temp_max: float
):
    """Controlla temperatura con isteresi: non spegne subito quando rientra nel range, ma solo al valore medio"""
    if avg_temp is None:
        return
    
    # Inizializza stato isteresi se non esiste
    if sensor_name not in _actuator_hysteresis_state:
        _actuator_hysteresis_state[sensor_name] = {"resistenza_was_low": False}
    
    hysteresis = _actuator_hysteresis_state[sensor_name]
    target_temp_mid = (target_temp_min + target_temp_max) / 2
    
    if avg_temp < target_temp_min:
        # Troppo freddo: accendi resistenza
        await _execute_action_safe(sensor_name, "resistenza_on")
        hysteresis["resistenza_was_low"] = True
        print(f"    → Temperatura bassa ({avg_temp:.1f}°C < {target_temp_min}°C): Accesa resistenza")
    elif avg_temp > target_temp_max:
        # Troppo caldo: spegni resistenza, accendi ventola
        await _execute_action_safe(sensor_name, "resistenza_off")
        await _execute_action_safe(sensor_name, "ventola_on")
        hysteresis["resistenza_was_low"] = False
        print(f"    → Temperatura alta ({avg_temp:.1f}°C > {target_temp_max}°C): Spenta resistenza, accesa ventola")
    else:
        # Temperatura nel range: applica isteresi
        if hysteresis["resistenza_was_low"]:
            # Era stata accesa perché bassa: spegni solo quando raggiunge il valore medio
            if avg_temp >= target_temp_mid:
                await _execute_action_safe(sensor_name, "resistenza_off")
                hysteresis["resistenza_was_low"] = False
                print(f"    → Temperatura OK ({avg_temp:.1f}°C >= {target_temp_mid:.1f}°C): Spenta resistenza (isteresi)")
            else:
                print(f"    → Temperatura in risalita ({avg_temp:.1f}°C < {target_temp_mid:.1f}°C): Resistenza ancora accesa (isteresi)")
        else:
            # Non era stata accesa per bassa temperatura: spegni subito se accesa
            await _execute_action_safe(sensor_name, "resistenza_off")

async def _control_humidity_with_hysteresis(
    sensor_name: str,
    avg_hum: Optional[float],
    target_hum_min: float,
    target_hum_max: float
):
    """Controlla umidità con isteresi: usa pompa_acqua per aumentare umidità, non spegne subito quando rientra nel range"""
    if avg_hum is None:
        return
    
    # Inizializza stato isteresi se non esiste
    if sensor_name not in _actuator_hysteresis_state:
        _actuator_hysteresis_state[sensor_name] = {"pompa_acqua_was_low": False}
    
    hysteresis = _actuator_hysteresis_state[sensor_name]
    target_hum_mid = (target_hum_min + target_hum_max) / 2
    
    if avg_hum < target_hum_min:
        # Umidità bassa: accendi pompa_acqua per aumentare umidità
        await _execute_action_safe(sensor_name, "pompa_acqua_on")
        await _execute_action_safe(sensor_name, "pompa_aspirazione_off")  # Assicurati che pompa_aspirazione sia spenta
        hysteresis["pompa_acqua_was_low"] = True
        print(f"    → Umidità bassa ({avg_hum:.1f}% < {target_hum_min}%): Accesa pompa acqua")
    elif avg_hum > target_hum_max:
        # Umidità alta: accendi ventola per ridurre umidità
        await _execute_action_safe(sensor_name, "ventola_on")
        await _execute_action_safe(sensor_name, "pompa_acqua_off")
        await _execute_action_safe(sensor_name, "pompa_aspirazione_off")
        hysteresis["pompa_acqua_was_low"] = False
        print(f"    → Umidità alta ({avg_hum:.1f}% > {target_hum_max}%): Accesa ventola, spente pompe")
    else:
        # Umidità nel range: applica isteresi
        if hysteresis["pompa_acqua_was_low"]:
            # Era stata accesa perché bassa: spegni solo quando raggiunge il valore medio
            if avg_hum >= target_hum_mid:
                await _execute_action_safe(sensor_name, "pompa_acqua_off")
                hysteresis["pompa_acqua_was_low"] = False
                print(f"    → Umidità OK ({avg_hum:.1f}% >= {target_hum_mid:.1f}%): Spenta pompa acqua (isteresi)")
            else:
                print(f"    → Umidità in risalita ({avg_hum:.1f}% < {target_hum_mid:.1f}%): Pompa acqua ancora accesa (isteresi)")
        else:
            # Non era stata accesa per bassa umidità: spegni subito se accesa
            await _execute_action_safe(sensor_name, "pompa_acqua_off")
            await _execute_action_safe(sensor_name, "pompa_aspirazione_off")

async def _handle_piantina_phase(sensor_name: str, data: dict, avg_temp: Optional[float], avg_hum: Optional[float]):
    """Logica automazione fase piantina: 65-70% umidità, 20-25°C con luci accese, 4-5°C in meno con luci spente"""
    print(f"  → FASE PIANTINA: Logica automazione attiva")
    
    # Target: 65-70% umidità, 20-25°C con luci accese, 4-5°C in meno con luci spente
    target_hum_min = 65
    target_hum_max = 70
    target_temp_led_on_min = 20
    target_temp_led_on_max = 25
    target_temp_led_off_min = 15  # 20-5
    target_temp_led_off_max = 21  # 25-4
    
    # Controlla stato LED
    led_on = await _check_led_state(sensor_name, data)
    
    if led_on:
        target_temp_min = target_temp_led_on_min
        target_temp_max = target_temp_led_on_max
    else:
        target_temp_min = target_temp_led_off_min
        target_temp_max = target_temp_led_off_max
    
    # Controllo temperatura con isteresi
    await _control_temperature_with_hysteresis(sensor_name, avg_temp, target_temp_min, target_temp_max)
    
    # Controllo umidità con isteresi (usa pompa_acqua per aumentare umidità)
    await _control_humidity_with_hysteresis(sensor_name, avg_hum, target_hum_min, target_hum_max)
    
    # Controllo luce LED: minimo 18 ore al giorno
    await _manage_led_schedule(sensor_name, min_hours_per_day=18, data=data)

async def _handle_vegetativa_phase(sensor_name: str, data: dict, avg_temp: Optional[float], avg_hum: Optional[float]):
    """Logica automazione fase vegetativa: umidità che diminuisce del 5% ogni settimana, 22-28°C con luci accese, 4-5°C in meno con luci spente"""
    print(f"  → FASE VEGETATIVA: Logica automazione attiva")
    
    # Recupera data inizio fase vegetativa o coltivazione
    mongo_client = None
    try:
        from app.dependencies import mongo_client as mc
        mongo_client = mc
    except:
        pass
    
    weeks_elapsed = 0
    if mongo_client and mongo_client.db is not None:
        try:
            config = await mongo_client.db.sensor_configs.find_one({"name": sensor_name})
            if config:
                start_date = config.get("vegetative_start_date") or config.get("cultivation_start_date")
                if start_date:
                    if isinstance(start_date, str):
                        # Prova a parsare la data ISO format
                        try:
                            start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                        except:
                            try:
                                # Fallback: formato datetime standard
                                start_date = datetime.strptime(start_date, "%Y-%m-%dT%H:%M:%S")
                            except:
                                # Se fallisce, usa datetime.now come fallback
                                start_date = datetime.now(timezone.utc)
                    elif isinstance(start_date, datetime):
                        pass  # Già un datetime
                    else:
                        start_date = datetime.now(timezone.utc)
                    weeks_elapsed = (datetime.now(timezone.utc) - start_date).days // 7
        except:
            pass
    
    # Umidità target: parte da 65% e diminuisce del 5% ogni settimana
    base_hum = 65
    hum_reduction = weeks_elapsed * 5
    target_hum_min = max(40, base_hum - hum_reduction)
    target_hum_max = max(45, base_hum - hum_reduction + 5)
    
    # Temperatura: 22-28°C con luci accese, 4-5°C in meno con luci spente
    target_temp_led_on_min = 22
    target_temp_led_on_max = 28
    target_temp_led_off_min = 17  # 22-5
    target_temp_led_off_max = 24  # 28-4
    
    # Controlla stato LED
    led_on = await _check_led_state(sensor_name, data)
    
    if led_on:
        target_temp_min = target_temp_led_on_min
        target_temp_max = target_temp_led_on_max
    else:
        target_temp_min = target_temp_led_off_min
        target_temp_max = target_temp_led_off_max
    
    print(f"    → Settimane trascorse: {weeks_elapsed}, Umidità target: {target_hum_min}-{target_hum_max}%")
    
    # Controllo temperatura con isteresi
    await _control_temperature_with_hysteresis(sensor_name, avg_temp, target_temp_min, target_temp_max)
    
    # Controllo umidità con isteresi (usa pompa_acqua per aumentare umidità)
    await _control_humidity_with_hysteresis(sensor_name, avg_hum, target_hum_min, target_hum_max)
    
    # Controllo luce LED: minimo 18 ore al giorno
    await _manage_led_schedule(sensor_name, min_hours_per_day=18, data=data)

async def _handle_fioritura_phase(sensor_name: str, data: dict, avg_temp: Optional[float], avg_hum: Optional[float]):
    """Logica automazione fase fioritura: 40-50% umidità, 20-26°C con luci accese"""
    print(f"  → FASE FIORITURA: Logica automazione attiva")
    
    # Target: 40-50% umidità, 20-26°C con luci accese
    target_hum_min = 40
    target_hum_max = 50
    target_temp_led_on_min = 20
    target_temp_led_on_max = 26
    
    # Controlla stato LED
    led_on = await _check_led_state(sensor_name, data)
    
    # In fioritura consideriamo solo temperatura con luci accese (non gestiamo luci spente)
    target_temp_min = target_temp_led_on_min
    target_temp_max = target_temp_led_on_max
    
    # Controllo temperatura con isteresi
    await _control_temperature_with_hysteresis(sensor_name, avg_temp, target_temp_min, target_temp_max)
    
    # Controllo umidità con isteresi (usa pompa_acqua per aumentare umidità)
    await _control_humidity_with_hysteresis(sensor_name, avg_hum, target_hum_min, target_hum_max)
    
    # Controllo luce LED: minimo 18 ore al giorno
    await _manage_led_schedule(sensor_name, min_hours_per_day=18, data=data)

async def _check_led_state(sensor_name: str, data: dict = None) -> bool:
    """Verifica se la luce LED è accesa (controlla prima actuator_states dai dati, poi stato locale)"""
    # Priorità 1: controlla actuator_states dai dati del sensore se disponibili
    if data is not None:
        actuator_states = data.get("actuator_states", {})
        if isinstance(actuator_states, dict):
            luce_led_state = actuator_states.get("luce_led")
            if luce_led_state is not None:
                return bool(luce_led_state)
    
    # Priorità 2: fallback allo stato locale
    if sensor_name not in _led_state:
        return False
    return _led_state[sensor_name].get("is_on", False)

async def _manage_led_schedule(sensor_name: str, min_hours_per_day: int = 18, data: dict = None):
    """Gestisce lo schedule della luce LED per garantire esattamente 18 ore al giorno"""
    now = datetime.now(timezone.utc)
    
    # Inizializza lo stato se non esiste
    if sensor_name not in _led_state:
        # Inizia un nuovo ciclo: accendi il LED all'inizio
        cycle_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        _led_state[sensor_name] = {
            "is_on": True,
            "last_toggle": now,
            "cycle_start": cycle_start,
            "hours_on_today": 0.0,
            "last_state_check": now
        }
        await _execute_action_safe(sensor_name, "luce_led_on")
        print(f"    → Luce LED inizializzata: accesa (nuovo ciclo giornaliero)")
        return
    
    state = _led_state[sensor_name]
    cycle_start = state.get("cycle_start", now.replace(hour=0, minute=0, second=0, microsecond=0))
    hours_on_today = state.get("hours_on_today", 0.0)
    last_state_check = state.get("last_state_check", now)
    
    # Calcola ore trascorse dall'inizio del ciclo corrente
    hours_since_cycle_start = (now - cycle_start).total_seconds() / 3600
    
    # Se sono passate più di 24 ore, resetta il ciclo
    if hours_since_cycle_start >= 24:
        # Nuovo ciclo: resetta il conteggio
        new_cycle_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        state["cycle_start"] = new_cycle_start
        state["hours_on_today"] = 0.0
        state["last_toggle"] = now
        state["is_on"] = True  # Inizia il nuovo ciclo con LED acceso
        hours_on_today = 0.0
        cycle_start = new_cycle_start
        await _execute_action_safe(sensor_name, "luce_led_on")
        print(f"    → Nuovo ciclo giornaliero: LED acceso (reset conteggio ore)")
    
    # Determina lo stato precedente e quello attuale del LED
    was_on_before = state.get("is_on", False)
    current_led_on = was_on_before  # Default: mantieni lo stato precedente
    
    # Priorità: controlla actuator_states dai dati del sensore se disponibili
    if data is not None:
        actuator_states = data.get("actuator_states", {})
        if isinstance(actuator_states, dict):
            luce_led_state = actuator_states.get("luce_led")
            if luce_led_state is not None:
                current_led_on = bool(luce_led_state)
    
    # Aggiorna il conteggio delle ore accese basandosi sullo stato precedente
    hours_since_last_check = (now - last_state_check).total_seconds() / 3600
    
    # Se il LED era acceso nell'ultimo controllo, aggiungi le ore trascorse
    if was_on_before and hours_since_last_check > 0:
        # Se è ancora acceso, aggiungi tutte le ore
        if current_led_on:
            hours_on_today += hours_since_last_check
        else:
            # Se è stato spento, aggiungi le ore fino all'ultimo toggle (quando è stato spento)
            last_toggle = state.get("last_toggle", last_state_check)
            if last_toggle >= last_state_check:
                hours_while_on = (last_toggle - last_state_check).total_seconds() / 3600
                hours_on_today += hours_while_on
        state["hours_on_today"] = hours_on_today
    
    # Aggiorna lo stato locale con lo stato reale
    state["is_on"] = current_led_on
    state["last_state_check"] = now
    
    # Logica di controllo: garantisci 18 ore accese al giorno
    if current_led_on:
        # LED è acceso: controlla se abbiamo raggiunto 18 ore
        if hours_on_today >= min_hours_per_day:
            # Abbiamo raggiunto le 18 ore: spegni il LED
            await _execute_action_safe(sensor_name, "luce_led_off")
            state["is_on"] = False
            state["last_toggle"] = now
            state["hours_on_today"] = hours_on_today  # Mantieni il conteggio
            print(f"    → Luce LED spenta: raggiunte {hours_on_today:.1f}h/{min_hours_per_day}h giornaliere")
        else:
            # Non abbiamo ancora raggiunto 18 ore: mantieni acceso
            remaining_hours = min_hours_per_day - hours_on_today
            print(f"    → Luce LED accesa: {hours_on_today:.1f}h/{min_hours_per_day}h (mancano {remaining_hours:.1f}h)")
    else:
        # LED è spento: controlla se dobbiamo accenderlo
        max_off_hours = 24 - min_hours_per_day  # Massimo 6 ore spente (24-18)
        hours_off = hours_since_cycle_start - hours_on_today
        
        if hours_off >= max_off_hours:
            # Abbiamo raggiunto il massimo di ore spente: accendi il LED
            await _execute_action_safe(sensor_name, "luce_led_on")
            state["is_on"] = True
            state["last_toggle"] = now
            print(f"    → Luce LED accesa: raggiunto massimo ore spente ({hours_off:.1f}h), ore accese: {hours_on_today:.1f}h/{min_hours_per_day}h")
        else:
            # Possiamo ancora stare spenti
            remaining_off_hours = max_off_hours - hours_off
            print(f"    → Luce LED spenta: {hours_on_today:.1f}h/{min_hours_per_day}h accese, {hours_off:.1f}h/{max_off_hours}h spente (max {remaining_off_hours:.1f}h rimanenti)")
    
    # Salva lo stato aggiornato
    _led_state[sensor_name] = state

async def _execute_action_safe(sensor_name: str, action_name: str):
    """Esegue un'azione in modo sicuro (ignora errori)"""
    try:
        from app.dependencies import business_logic, mongo_client
        if business_logic:
            result = await business_logic.execute_sensor_action(sensor_name, action_name)
            # Salva stato attuatore nel DB dopo l'esecuzione
            if result.success and mongo_client:
                # Estrai nome attuatore dall'action_name (es: "luce_led_on" -> "luce_led")
                actuator_name = action_name.replace("_on", "").replace("_off", "")
                state = action_name.endswith("_on")
                await _save_actuator_state(sensor_name, actuator_name, state, mongo_client)
    except Exception as e:
        print(f"    ⚠ Errore esecuzione azione {action_name} per {sensor_name}: {e}")

# Il gestore viene impostato da automation_service quando necessario

