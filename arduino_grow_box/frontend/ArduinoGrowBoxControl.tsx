from fastapi import APIRouter, HTTPException, Depends, Query
from app.dependencies import get_business_logic, get_mongo_client, mongo_client as dep_mongo_client
from app.services.business_logic import BusinessLogic
from app.db.mongo_client import MongoClientWrapper
from typing import Optional, Dict, Any
from datetime import datetime, timedelta

router = APIRouter(prefix="/sensors/arduino-grow-box", tags=["arduino_grow_box"])

_led_state = {}  # {sensor_name: {"is_on": bool, "last_toggle": datetime, "daily_on_seconds": float, "last_reset": datetime}}

async def handle_growbox_automation(sensor_name: str, data: dict, phase: Optional[str]):
    await _handle_growbox_phase_logic(sensor_name, data, phase)

async def _save_actuator_state(sensor_name: str, actuator_name: str, state: bool, mongo_client: MongoClientWrapper):
    try:
        if mongo_client.db is None:
            return
        collection = mongo_client.db.sensor_configs
        field_name = f"actuator_{actuator_name}_state"
        await collection.update_one(
            {"name": sensor_name},
            {"$set": {field_name: bool(state)}},
            upsert=True
        )
    except Exception as e:
        print(f"❌ Errore salvataggio stato attuatore {actuator_name} per {sensor_name}: {e}")

async def _get_actuator_states(sensor_name: str, mongo_client: MongoClientWrapper) -> Dict[str, bool]:
    try:
        if mongo_client.db is None:
            return {}
        config = await mongo_client.db.sensor_configs.find_one({"name": sensor_name})
        if not config:
            return {}
        return {
            "luce_led": bool(config.get("actuator_luce_led_state", False)),
            "ventola": bool(config.get("actuator_ventola_state", False)),
            "resistenza": bool(config.get("actuator_resistenza_state", False)),
            "pompa_aspirazione": bool(config.get("actuator_pompa_aspirazione_state", False)),
            "pompa_acqua": bool(config.get("actuator_pompa_acqua_state", False))
        }
    except Exception as e:
        print(f"❌ Errore lettura stato attuatori per {sensor_name}: {e}")
        return {}

async def _get_targets_for_phase(phase: Optional[str], mongo_client: Optional[MongoClientWrapper], sensor_name: str) -> Dict[str, Any]:
    targets = {"temp_target_min": None, "temp_target_max": None, "hum_target_min": None, "hum_target_max": None, "min_hours_per_day": 18}
    if not phase:
        return targets
    weeks_elapsed = 0
    if mongo_client is not None and mongo_client.db is not None:
        try:
            config = await mongo_client.db.sensor_configs.find_one({"name": sensor_name})
            if config:
                start_date_str = config.get("vegetative_start_date") or config.get("cultivation_start_date")
                if start_date_str:
                    if isinstance(start_date_str, str):
                        try:
                            start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
                        except ValueError:
                            try:
                                start_date = datetime.strptime(start_date_str, "%Y-%m-%dT%H:%M:%S.%f")
                            except ValueError:
                                start_date = datetime.now()
                    elif isinstance(start_date_str, datetime):
                        start_date = start_date_str
                    else:
                        start_date = datetime.now()
                    weeks_elapsed = (datetime.now() - start_date).days // 7
        except Exception as e:
            print(f"Errore calcolo settimane trascorse: {e}")
    led_on = await _check_led_state(sensor_name)
    if phase == "piantina":
        targets.update({"hum_target_min": 65, "hum_target_max": 70})
        targets.update({"temp_target_min": 20, "temp_target_max": 25} if led_on else {"temp_target_min": 15, "temp_target_max": 21})
    elif phase == "vegetativa":
        base_hum = 65
        hum_reduction = weeks_elapsed * 5
        targets.update({"hum_target_min": max(40, base_hum - hum_reduction), "hum_target_max": max(45, base_hum - hum_reduction + 5)})
        targets.update({"temp_target_min": 22, "temp_target_max": 28} if led_on else {"temp_target_min": 17, "temp_target_max": 24})
    elif phase == "fioritura":
        targets.update({"hum_target_min": 40, "hum_target_max": 50, "temp_target_min": 20, "temp_target_max": 26})
    return targets

async def _load_led_state(sensor_name: str, mongo_client: MongoClientWrapper):
    if sensor_name in _led_state:
        return _led_state[sensor_name]
    now = datetime.now()
    if mongo_client is None or mongo_client.db is None:
        _led_state[sensor_name] = {"is_on": False, "last_toggle": now, "daily_on_seconds": 0.0, "last_reset": now}
        return _led_state[sensor_name]
    doc = await mongo_client.db.sensor_configs.find_one(
        {"name": sensor_name},
        {"led_is_on": 1, "led_last_toggle": 1, "led_daily_on_seconds": 1, "led_last_reset": 1},
    )
    _led_state[sensor_name] = {
        "is_on": bool(doc.get("led_is_on", False)) if doc else False,
        "last_toggle": doc.get("led_last_toggle", now) if doc else now,
        "daily_on_seconds": float(doc.get("led_daily_on_seconds", 0)) if doc else 0.0,
        "last_reset": doc.get("led_last_reset", now) if doc else now,
    }
    return _led_state[sensor_name]

async def _save_led_state(sensor_name: str, state: dict, mongo_client: MongoClientWrapper):
    _led_state[sensor_name] = state
    if mongo_client and mongo_client.db:
        await mongo_client.db.sensor_configs.update_one(
            {"name": sensor_name},
            {"$set": {
                "led_is_on": state["is_on"],
                "led_last_toggle": state["last_toggle"],
                "led_daily_on_seconds": state["daily_on_seconds"],
                "led_last_reset": state["last_reset"],
            }},
            upsert=True,
        )

def _compute_led_metrics(state: dict, min_hours_per_day: int):
    now = datetime.now()
    elapsed = (now - state["last_toggle"]).total_seconds()
    daily_on = state["daily_on_seconds"] + (elapsed if state["is_on"] else 0)
    minutes_on = int(daily_on // 60)
    minutes_until_off = None
    minutes_until_on = None
    if state["is_on"]:
        remaining = max(0, min_hours_per_day * 3600 - daily_on)
        minutes_until_off = int(remaining // 60)
    else:
        off_required = max(0, 24 - min_hours_per_day) * 3600
        off_elapsed = elapsed
        remaining = max(0, off_required - off_elapsed)
        minutes_until_on = int(remaining // 60)
    return minutes_on, minutes_until_on, minutes_until_off

@router.post("/{sensor_name}/fase")
async def set_fase(sensor_name: str, fase: str = Query(..., regex="^(piantina|vegetativa|fioritura)$"), mongo_client: MongoClientWrapper = Depends(get_mongo_client)):
    try:
        if mongo_client.db is None:
            raise HTTPException(status_code=500, detail="Database non connesso")
        collection = mongo_client.db.sensor_configs
        updates = {"growth_phase": fase}
        now = datetime.now()
        if fase == "fioritura":
            updates["flowering_start_date"] = now
            updates["vegetative_start_date"] = None
        elif fase == "vegetativa":
            updates["vegetative_start_date"] = now
            updates["flowering_start_date"] = None
        await collection.update_one({"name": sensor_name}, {"$set": updates}, upsert=True)
        return {"success": True, "fase": fase, "sensor_name": sensor_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore: {str(e)}")

@router.get("/{sensor_name}/fase")
async def get_fase(sensor_name: str, mongo_client: MongoClientWrapper = Depends(get_mongo_client)):
    try:
        if mongo_client.db is None:
            raise HTTPException(status_code=500, detail="Database non connesso")
        config = await mongo_client.db.sensor_configs.find_one({"name": sensor_name})
        if config:
            return {"success": True, "fase": config.get("growth_phase"), "sensor_name": sensor_name}
        return {"success": True, "fase": None, "sensor_name": sensor_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore: {str(e)}")

@router.post("/{sensor_name}/inizia-coltivazione")
async def inizia_coltivazione(sensor_name: str, mongo_client: MongoClientWrapper = Depends(get_mongo_client), business_logic: BusinessLogic = Depends(get_business_logic)):
    try:
        if mongo_client.db is None:
            raise HTTPException(status_code=500, detail="Database non connesso")
        collection = mongo_client.db.sensor_configs
        now = datetime.now()
        await collection.update_one(
            {"name": sensor_name},
            {"$set": {
                "growth_phase": "piantina",
                "cultivation_start_date": now,
                "vegetative_start_date": None,
                "flowering_start_date": None,
                "cultivation_active": True
            }},
            upsert=True
        )
        _led_state[sensor_name] = {"is_on": False, "last_toggle": now, "daily_on_seconds": 0.0, "last_reset": now}
        return {"success": True, "message": "Coltivazione iniziata", "fase": "piantina", "start_date": now.isoformat(), "sensor_name": sensor_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore: {str(e)}")

@router.post("/{sensor_name}/fine-coltivazione")
async def fine_coltivazione(sensor_name: str, mongo_client: MongoClientWrapper = Depends(get_mongo_client), business_logic: BusinessLogic = Depends(get_business_logic)):
    try:
        if mongo_client.db is None:
            raise HTTPException(status_code=500, detail="Database non connesso")
        collection = mongo_client.db.sensor_configs
        await collection.update_one(
            {"name": sensor_name},
            {"$unset": {
                "growth_phase": "",
                "cultivation_start_date": "",
                "vegetative_start_date": "",
                "flowering_start_date": "",
                "cultivation_active": "",
                "actuator_luce_led_state": "",
                "actuator_ventola_state": "",
                "actuator_resistenza_state": "",
                "actuator_pompa_aspirazione_state": "",
                "actuator_pompa_acqua_state": "",
                "led_is_on": "",
                "led_last_toggle": "",
                "led_daily_on_seconds": "",
                "led_last_reset": "",
            }}
        )
        if sensor_name in _led_state:
            del _led_state[sensor_name]
        try:
            for action in ["luce_led_off", "ventola_off", "resistenza_off", "pompa_aspirazione_off", "pompa_acqua_off"]:
                try:
                    await business_logic.execute_sensor_action(sensor_name, action)
                except:
                    pass
        except:
            pass
        return {"success": True, "message": "Coltivazione terminata - dati ciclo cancellati", "sensor_name": sensor_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore: {str(e)}")

@router.get("/{sensor_name}/stato-coltivazione")
async def get_stato_coltivazione(sensor_name: str, mongo_client: MongoClientWrapper = Depends(get_mongo_client), business_logic: BusinessLogic = Depends(get_business_logic)):
    try:
        if mongo_client.db is None:
            raise HTTPException(status_code=500, detail="Database non connesso")
        config = await mongo_client.db.sensor_configs.find_one({"name": sensor_name})
        phase = config.get("growth_phase") if config else None

        actuator_states = await _get_actuator_states(sensor_name, mongo_client)
        targets = await _get_targets_for_phase(phase, mongo_client, sensor_name)

        sensor_data_dict = {}
        avg_temp = None
        avg_hum = None
        try:
            live_data = {}
            sensor_data = await business_logic.read_sensor_data(sensor_name)
            if sensor_data and sensor_data.data:
                live_data = sensor_data.data
            latest_data = {}
            if mongo_client and mongo_client.db:
                latest_doc = await mongo_client.db.sensor_data.find_one({"sensor_name": sensor_name}, sort=[("timestamp", -1)])
                if latest_doc and latest_doc.get("data"):
                    latest_data = latest_doc["data"]
            sensor_data_dict = dict(latest_data)
            sensor_data_dict.update({k: v for k, v in live_data.items() if v is not None})
            temps = [sensor_data_dict.get(f"temperature_{i}") for i in range(1,5)]
            hums = [sensor_data_dict.get(f"humidity_{i}") for i in range(1,5)]
            valid_temps = [t for t in temps if t is not None]
            valid_hums = [h for h in hums if h is not None]
            avg_temp = sum(valid_temps) / len(valid_temps) if valid_temps else None
            avg_hum = sum(valid_hums) / len(valid_hums) if valid_hums else None
        except Exception as e:
            print(f"⚠️ Errore recupero dati sensore: {e}")

        led_state = await _load_led_state(sensor_name, mongo_client)
        minutes_on, minutes_until_on, minutes_until_off = _compute_led_metrics(led_state, targets.get("min_hours_per_day", 18))

        return {
            "success": True,
            "cultivation_active": config.get("cultivation_active", False) if config else False,
            "growth_phase": phase,
            "cultivation_start_date": config.get("cultivation_start_date") if config else None,
            "vegetative_start_date": config.get("vegetative_start_date") if config else None,
            "flowering_start_date": config.get("flowering_start_date") if config else None,
            "actuator_states": actuator_states,
            "targets": targets,
            "current_values": {"avg_temperature": avg_temp, "avg_humidity": avg_hum},
            "sensor_data": sensor_data_dict,
            "led_status": {
                "is_on": led_state.get("is_on", False),
                "minutes_on_today": minutes_on,
                "minutes_until_on": minutes_until_on,
                "minutes_until_off": minutes_until_off,
                "last_toggle": led_state.get("last_toggle"),
            },
            "sensor_name": sensor_name
        }
    except Exception as e:
        print(f"❌ Errore endpoint stato-coltivazione: {e}")
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Errore: {str(e)}")

@router.post("/{sensor_name}/pompa-aspirazione")
async def control_pompa_aspirazione(sensor_name: str, action: str = Query(..., regex="^(on|off)$"), business_logic: BusinessLogic = Depends(get_business_logic), mongo_client: MongoClientWrapper = Depends(get_mongo_client)):
    result = await business_logic.execute_sensor_action(sensor_name, f"pompa_aspirazione_{action}")
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    await _save_actuator_state(sensor_name, "pompa_aspirazione", action == "on", mongo_client)
    return result

@router.post("/{sensor_name}/pompa-acqua")
async def control_pompa_acqua(sensor_name: str, action: str = Query(..., regex="^(on|off)$"), business_logic: BusinessLogic = Depends(get_business_logic), mongo_client: MongoClientWrapper = Depends(get_mongo_client)):
    result = await business_logic.execute_sensor_action(sensor_name, f"pompa_acqua_{action}")
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    await _save_actuator_state(sensor_name, "pompa_acqua", action == "on", mongo_client)
    return result

@router.post("/{sensor_name}/resistenza")
async def control_resistenza(sensor_name: str, action: str = Query(..., regex="^(on|off)$"), business_logic: BusinessLogic = Depends(get_business_logic), mongo_client: MongoClientWrapper = Depends(get_mongo_client)):
    result = await business_logic.execute_sensor_action(sensor_name, f"resistenza_{action}")
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    await _save_actuator_state(sensor_name, "resistenza", action == "on", mongo_client)
    return result

@router.post("/{sensor_name}/luce-led")
async def control_luce_led(sensor_name: str, action: str = Query(..., regex="^(on|off)$"), business_logic: BusinessLogic = Depends(get_business_logic), mongo_client: MongoClientWrapper = Depends(get_mongo_client)):
    result = await business_logic.execute_sensor_action(sensor_name, f"luce_led_{action}")
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    if result.success:
        state = await _load_led_state(sensor_name, mongo_client)
        now = datetime.now()
        if state.get("is_on", False) and action == "off":
            elapsed = (now - state["last_toggle"]).total_seconds()
            state["daily_on_seconds"] += elapsed
        state["is_on"] = (action == "on")
        state["last_toggle"] = now
        await _save_led_state(sensor_name, state, mongo_client)
        await _save_actuator_state(sensor_name, "luce_led", action == "on", mongo_client)
    return result

@router.post("/{sensor_name}/ventola")
async def control_ventola(sensor_name: str, action: str = Query(..., regex="^(on|off)$"), business_logic: BusinessLogic = Depends(get_business_logic), mongo_client: MongoClientWrapper = Depends(get_mongo_client)):
    result = await business_logic.execute_sensor_action(sensor_name, f"ventola_{action}")
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    await _save_actuator_state(sensor_name, "ventola", action == "on", mongo_client)
    return result

# --- Automazione per fase con isteresi su umidità (spegne pompe quando attraversa la media)
async def _handle_growbox_phase_logic(sensor_name: str, data: dict, phase: Optional[str]):
    if not phase:
        print(f"GROWBOX {sensor_name}: Nessuna fase impostata, automazione disabilitata")
        return

    temps = [data.get(f"temperature_{i}") for i in range(1,5)]
    hums = [data.get(f"humidity_{i}") for i in range(1,5)]
    valid_temps = [t for t in temps if t is not None]
    valid_hums = [h for h in hums if h is not None]
    avg_temp = sum(valid_temps) / len(valid_temps) if valid_temps else None
    avg_hum = sum(valid_hums) / len(valid_hums) if valid_hums else None

    print(f"GROWBOX {sensor_name} - Fase: {phase}")
    print(f"  Temperatura media: {avg_temp:.1f}°C" if avg_temp else "  Temperatura: N/A")
    print(f"  Umidità media: {avg_hum:.1f}%" if avg_hum else "  Umidità: N/A")

    if phase == "piantina":
        await _handle_piantina_phase(sensor_name, data, avg_temp, avg_hum)
    elif phase == "vegetativa":
        await _handle_vegetativa_phase(sensor_name, data, avg_temp, avg_hum)
    elif phase == "fioritura":
        await _handle_fioritura_phase(sensor_name, data, avg_temp, avg_hum)

async def _handle_piantina_phase(sensor_name: str, data: dict, avg_temp: Optional[float], avg_hum: Optional[float]):
    target_hum_min, target_hum_max = 65, 70
    hum_mid = (target_hum_min + target_hum_max) / 2
    target_temp_led_on_min, target_temp_led_on_max = 20, 25
    target_temp_led_off_min, target_temp_led_off_max = 15, 21

    led_on = await _check_led_state(sensor_name)
    target_temp_min = target_temp_led_on_min if led_on else target_temp_led_off_min
    target_temp_max = target_temp_led_on_max if led_on else target_temp_led_off_max

    if avg_temp is not None:
        if avg_temp < target_temp_min:
            await _execute_action_safe(sensor_name, "resistenza_on")
        elif avg_temp > target_temp_max:
            await _execute_action_safe(sensor_name, "resistenza_off")
            await _execute_action_safe(sensor_name, "ventola_on")
        else:
            await _execute_action_safe(sensor_name, "resistenza_off")

    if avg_hum is not None:
        if avg_hum < target_hum_min:
            await _execute_action_safe(sensor_name, "pompa_acqua_on")
            await _execute_action_safe(sensor_name, "ventola_on")
            await _execute_action_safe(sensor_name, "pompa_aspirazione_off")
        elif avg_hum > target_hum_max:
            await _execute_action_safe(sensor_name, "pompa_aspirazione_on")
            await _execute_action_safe(sensor_name, "ventola_on")
            await _execute_action_safe(sensor_name, "pompa_acqua_off")
        else:
            if (avg_hum >= hum_mid and avg_hum <= target_hum_max) or (avg_hum <= hum_mid and avg_hum >= target_hum_min):
                await _execute_action_safe(sensor_name, "pompa_aspirazione_off")
                await _execute_action_safe(sensor_name, "pompa_acqua_off")

    await _manage_led_schedule(sensor_name, min_hours_per_day=18)

async def _handle_vegetativa_phase(sensor_name: str, data: dict, avg_temp: Optional[float], avg_hum: Optional[float]):
    mongo_client = None
    try:
        from app.dependencies import mongo_client as mc
        mongo_client = mc
    except:
        pass

    weeks_elapsed = 0
    if mongo_client and mongo_client.db:
        try:
            config = await mongo_client.db.sensor_configs.find_one({"name": sensor_name})
            if config:
                start_date = config.get("vegetative_start_date") or config.get("cultivation_start_date")
                if start_date:
                    if isinstance(start_date, str):
                        try:
                            start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                        except:
                            try:
                                start_date = datetime.strptime(start_date, "%Y-%m-%dT%H:%M:%S")
                            except:
                                start_date = datetime.now()
                    elif not isinstance(start_date, datetime):
                        start_date = datetime.now()
                    weeks_elapsed = (datetime.now() - start_date).days // 7
        except:
            pass

    base_hum = 65
    hum_reduction = weeks_elapsed * 5
    target_hum_min = max(40, base_hum - hum_reduction)
    target_hum_max = max(45, base_hum - hum_reduction + 5)
    hum_mid = (target_hum_min + target_hum_max) / 2

    target_temp_led_on_min, target_temp_led_on_max = 22, 28
    target_temp_led_off_min, target_temp_led_off_max = 17, 24

    led_on = await _check_led_state(sensor_name)
    target_temp_min = target_temp_led_on_min if led_on else target_temp_led_off_min
    target_temp_max = target_temp_led_on_max if led_on else target_temp_led_off_max

    if avg_temp is not None:
        if avg_temp < target_temp_min:
            await _execute_action_safe(sensor_name, "resistenza_on")
        elif avg_temp > target_temp_max:
            await _execute_action_safe(sensor_name, "resistenza_off")
            await _execute_action_safe(sensor_name, "ventola_on")
        else:
            await _execute_action_safe(sensor_name, "resistenza_off")

    if avg_hum is not None:
        if avg_hum < target_hum_min:
            await _execute_action_safe(sensor_name, "pompa_acqua_on")
            await _execute_action_safe(sensor_name, "ventola_on")
            await _execute_action_safe(sensor_name, "pompa_aspirazione_off")
        elif avg_hum > target_hum_max:
            await _execute_action_safe(sensor_name, "pompa_aspirazione_on")
            await _execute_action_safe(sensor_name, "ventola_on")
            await _execute_action_safe(sensor_name, "pompa_acqua_off")
        else:
            if (avg_hum >= hum_mid and avg_hum <= target_hum_max) or (avg_hum <= hum_mid and avg_hum >= target_hum_min):
                await _execute_action_safe(sensor_name, "pompa_aspirazione_off")
                await _execute_action_safe(sensor_name, "pompa_acqua_off")

    await _manage_led_schedule(sensor_name, min_hours_per_day=18)

async def _handle_fioritura_phase(sensor_name: str, data: dict, avg_temp: Optional[float], avg_hum: Optional[float]):
    target_hum_min, target_hum_max = 40, 50
    hum_mid = (target_hum_min + target_hum_max) / 2
    target_temp_led_on_min, target_temp_led_on_max = 20, 26

    if avg_temp is not None:
        if avg_temp < target_temp_led_on_min:
            await _execute_action_safe(sensor_name, "resistenza_on")
        elif avg_temp > target_temp_led_on_max:
            await _execute_action_safe(sensor_name, "resistenza_off")
            await _execute_action_safe(sensor_name, "ventola_on")
        else:
            await _execute_action_safe(sensor_name, "resistenza_off")

    if avg_hum is not None:
        if avg_hum < target_hum_min:
            await _execute_action_safe(sensor_name, "pompa_acqua_on")
            await _execute_action_safe(sensor_name, "ventola_on")
            await _execute_action_safe(sensor_name, "pompa_aspirazione_off")
        elif avg_hum > target_hum_max:
            await _execute_action_safe(sensor_name, "pompa_aspirazione_on")
            await _execute_action_safe(sensor_name, "ventola_on")
            await _execute_action_safe(sensor_name, "pompa_acqua_off")
        else:
            if (avg_hum >= hum_mid and avg_hum <= target_hum_max) or (avg_hum <= hum_mid and avg_hum >= target_hum_min):
                await _execute_action_safe(sensor_name, "pompa_aspirazione_off")
                await _execute_action_safe(sensor_name, "pompa_acqua_off")

    await _manage_led_schedule(sensor_name, min_hours_per_day=18)

async def _check_led_state(sensor_name: str) -> bool:
    if sensor_name not in _led_state:
        return False
    return _led_state[sensor_name].get("is_on", False)

async def _manage_led_schedule(sensor_name: str, min_hours_per_day: int = 18):
    now = datetime.now()
    mc = dep_mongo_client
    state = await _load_led_state(sensor_name, mc)

    if state["last_reset"].date() != now.date():
        state["daily_on_seconds"] = 0.0
        state["last_reset"] = now
        state["last_toggle"] = now

    elapsed = (now - state["last_toggle"]).total_seconds()

    if state["is_on"]:
        on_seconds = state["daily_on_seconds"] + elapsed
        if on_seconds >= min_hours_per_day * 3600:
            await _execute_action_safe(sensor_name, "luce_led_off")
            state.update({"is_on": False, "last_toggle": now, "daily_on_seconds": min_hours_per_day * 3600})
        else:
            state["daily_on_seconds"] = on_seconds
    else:
        off_required = max(0, 24 - min_hours_per_day) * 3600
        off_elapsed = elapsed
        if off_elapsed >= off_required and state["daily_on_seconds"] < min_hours_per_day * 3600:
            await _execute_action_safe(sensor_name, "luce_led_on")
            state.update({"is_on": True, "last_toggle": now})

    await _save_led_state(sensor_name, state, mc)

async def _execute_action_safe(sensor_name: str, action_name: str):
    try:
        from app.dependencies import business_logic, mongo_client
        if business_logic:
            result = await business_logic.execute_sensor_action(sensor_name, action_name)
            if result.success and mongo_client:
                actuator_name = action_name.replace("_on", "").replace("_off", "")
                state = action_name.endswith("_on")
                await _save_actuator_state(sensor_name, actuator_name, state, mongo_client)
    except Exception as e:
        print(f"    ⚠ Errore esecuzione azione {action_name} per {sensor_name}: {e}")