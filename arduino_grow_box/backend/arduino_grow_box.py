from fastapi import APIRouter, HTTPException, Depends, Query
from app.dependencies import get_business_logic, get_mongo_client
from app.services.business_logic import BusinessLogic
from app.db.mongo_client import MongoClientWrapper
from typing import Optional, Dict, Any
from datetime import datetime, timedelta

router = APIRouter(prefix="/sensors/arduino-grow-box", tags=["arduino_grow_box"])

_led_state = {}  # {sensor_name: {"is_on": bool, "last_toggle": datetime}}

async def handle_growbox_automation(sensor_name: str, data: dict, phase: Optional[str]):
    await _handle_growbox_phase_logic(sensor_name, data, phase)

async def _save_actuator_state(sensor_name: str, actuator_name: str, state: bool, mongo_client: MongoClientWrapper):
    try:
        if mongo_client.db is None:
            print(f"⚠️ MongoDB non connesso per salvataggio stato attuatore {actuator_name}")
            return
        collection = mongo_client.db.sensor_configs
        field_name = f"actuator_{actuator_name}_state"
        result = await collection.update_one(
            {"name": sensor_name},
            {"$set": {field_name: bool(state)}},
            upsert=True
        )
        print(f"💾 Stato attuatore salvato: {sensor_name} -> {actuator_name} = {bool(state)} (matched: {result.matched_count}, modified: {result.modified_count})")
    except Exception as e:
        print(f"❌ Errore salvataggio stato attuatore {actuator_name} per {sensor_name}: {e}")
        import traceback; traceback.print_exc()

async def _get_actuator_states(sensor_name: str, mongo_client: MongoClientWrapper) -> Dict[str, bool]:
    try:
        if mongo_client.db is None:
            print(f"⚠️ MongoDB non connesso per lettura stati attuatori {sensor_name}")
            return {}
        config = await mongo_client.db.sensor_configs.find_one({"name": sensor_name})
        if not config:
            print(f"⚠️ Configurazione non trovata per sensore {sensor_name}")
            return {}
        actuators = {
            "luce_led": bool(config.get("actuator_luce_led_state", False)),
            "ventola": bool(config.get("actuator_ventola_state", False)),
            "resistenza": bool(config.get("actuator_resistenza_state", False)),
            "pompa_aspirazione": bool(config.get("actuator_pompa_aspirazione_state", False)),
            "pompa_acqua": bool(config.get("actuator_pompa_acqua_state", False))
        }
        print(f"🔌 Stati attuatori letti per {sensor_name}: {actuators}")
        return actuators
    except Exception as e:
        print(f"❌ Errore lettura stato attuatori per {sensor_name}: {e}")
        import traceback; traceback.print_exc()
        return {}

async def _get_targets_for_phase(phase: Optional[str], mongo_client: Optional[MongoClientWrapper], sensor_name: str) -> Dict[str, Any]:
    targets = {
        "temp_target_min": None,
        "temp_target_max": None,
        "hum_target_min": None,
        "hum_target_max": None,
        "min_hours_per_day": 18
    }
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
        targets["hum_target_min"] = 65
        targets["hum_target_max"] = 70
        if led_on:
            targets["temp_target_min"] = 20
            targets["temp_target_max"] = 25
        else:
            targets["temp_target_min"] = 15
            targets["temp_target_max"] = 21
        targets["min_hours_per_day"] = 18

    elif phase == "vegetativa":
        base_hum = 65
        hum_reduction = weeks_elapsed * 5
        targets["hum_target_min"] = max(40, base_hum - hum_reduction)
        targets["hum_target_max"] = max(45, base_hum - hum_reduction + 5)
        if led_on:
            targets["temp_target_min"] = 22
            targets["temp_target_max"] = 28
        else:
            targets["temp_target_min"] = 17
            targets["temp_target_max"] = 24
        targets["min_hours_per_day"] = 18

    elif phase == "fioritura":
        targets["hum_target_min"] = 40
        targets["hum_target_max"] = 50
        targets["temp_target_min"] = 20
        targets["temp_target_max"] = 26
        targets["min_hours_per_day"] = 18

    return targets

@router.post("/{sensor_name}/fase")
async def set_fase(
    sensor_name: str,
    fase: str = Query(..., description="Fase da impostare: 'piantina', 'vegetativa' o 'fioritura'", regex="^(piantina|vegetativa|fioritura)$"),
    mongo_client: MongoClientWrapper = Depends(get_mongo_client)
):
    try:
        if mongo_client.db is None:
            raise HTTPException(status_code=500, detail="Database non connesso")
        collection = mongo_client.db.sensor_configs
        await collection.update_one(
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
    try:
        if mongo_client.db is None:
            raise HTTPException(status_code=500, detail="Database non connesso")
        collection = mongo_client.db.sensor_configs
        now = datetime.now()
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
        _led_state[sensor_name] = {"is_on": False, "last_toggle": now}
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
    try:
        if mongo_client.db is None:
            raise HTTPException(status_code=500, detail="Database non connesso")
        collection = mongo_client.db.sensor_configs
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
        if sensor_name in _led_state:
            del _led_state[sensor_name]
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
                    pass
        except:
            pass
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
    try:
        if mongo_client.db is None:
            raise HTTPException(status_code=500, detail="Database non connesso")

        config = await mongo_client.db.sensor_configs.find_one({"name": sensor_name})
        phase = config.get("growth_phase") if config else None

        actuator_states = {}
        try:
            actuator_states = await _get_actuator_states(sensor_name, mongo_client)
        except Exception as e:
            print(f"⚠️ Errore recupero stati attuatori: {e}")
            import traceback; traceback.print_exc()

        targets = {}
        try:
            targets = await _get_targets_for_phase(phase, mongo_client, sensor_name)
        except Exception as e:
            print(f"⚠️ Errore calcolo target: {e}")
            import traceback; traceback.print_exc()

        sensor_data_dict = {}
        avg_temp = None
        avg_hum = None
        try:
            sensor_data = await business_logic.read_sensor_data(sensor_name)
            if sensor_data and sensor_data.data:
                sensor_data_dict = sensor_data.data
            elif mongo_client is not None and mongo_client.db is not None:
                latest = await mongo_client.db.sensor_data.find_one(
                    {"sensor_name": sensor_name},
                    sort=[("timestamp", -1)]
                )
                if latest and latest.get("data"):
                    sensor_data_dict = latest["data"]
        except Exception as e:
            print(f"⚠️ Errore recupero dati sensore: {e}")
            import traceback; traceback.print_exc()

        try:
            temps = [
                sensor_data_dict.get("temperature_1"),
                sensor_data_dict.get("temperature_2"),
                sensor_data_dict.get("temperature_3"),
                sensor_data_dict.get("temperature_4"),
            ]
            hums = [
                sensor_data_dict.get("humidity_1"),
                sensor_data_dict.get("humidity_2"),
                sensor_data_dict.get("humidity_3"),
                sensor_data_dict.get("humidity_4"),
            ]
            valid_temps = [t for t in temps if t is not None]
            valid_hums = [h for h in hums if h is not None]
            avg_temp = sum(valid_temps) / len(valid_temps) if valid_temps else None
            avg_hum = sum(valid_hums) / len(valid_hums) if valid_hums else None
        except Exception:
            pass

        response = {
            "success": True,
            "cultivation_active": config.get("cultivation_active", False) if config else False,
            "growth_phase": phase,
            "cultivation_start_date": config.get("cultivation_start_date") if config else None,
            "vegetative_start_date": config.get("vegetative_start_date") if config else None,
            "flowering_start_date": config.get("flowering_start_date") if config else None,
            "actuator_states": actuator_states,
            "targets": targets,
            "current_values": {
                "avg_temperature": avg_temp,
                "avg_humidity": avg_hum
            },
            "sensor_data": sensor_data_dict,
            "sensor_name": sensor_name
        }
        print(f"📤 Risposta stato-coltivazione per {sensor_name}: actuator_states={bool(actuator_states)}, targets={bool(targets)}, sensor_data={bool(sensor_data_dict)}")
        return response
    except Exception as e:
        print(f"❌ Errore endpoint stato-coltivazione: {e}")
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Errore: {str(e)}")

@router.post("/{sensor_name}/pompa-aspirazione")
async def control_pompa_aspirazione(
    sensor_name: str,
    action: str = Query(..., description="Azione da eseguire: 'on' o 'off'", regex="^(on|off)$"),
    business_logic: BusinessLogic = Depends(get_business_logic),
    mongo_client: MongoClientWrapper = Depends(get_mongo_client)
):
    action_name = f"pompa_aspirazione_{action}"
    result = await business_logic.execute_sensor_action(sensor_name, action_name)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    await _save_actuator_state(sensor_name, "pompa_aspirazione", action == "on", mongo_client)
    return result

@router.post("/{sensor_name}/pompa-acqua")
async def control_pompa_acqua(
    sensor_name: str,
    action: str = Query(..., description="Azione da eseguire: 'on' o 'off'", regex="^(on|off)$"),
    business_logic: BusinessLogic = Depends(get_business_logic),
    mongo_client: MongoClientWrapper = Depends(get_mongo_client)
):
    action_name = f"pompa_acqua_{action}"
    result = await business_logic.execute_sensor_action(sensor_name, action_name)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    await _save_actuator_state(sensor_name, "pompa_acqua", action == "on", mongo_client)
    return result

@router.post("/{sensor_name}/resistenza")
async def control_resistenza(
    sensor_name: str,
    action: str = Query(..., description="Azione da eseguire: 'on' o 'off'", regex="^(on|off)$"),
    business_logic: BusinessLogic = Depends(get_business_logic),
    mongo_client: MongoClientWrapper = Depends(get_mongo_client)
):
    action_name = f"resistenza_{action}"
    result = await business_logic.execute_sensor_action(sensor_name, action_name)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    await _save_actuator_state(sensor_name, "resistenza", action == "on", mongo_client)
    return result

@router.post("/{sensor_name}/luce-led")
async def control_luce_led(
    sensor_name: str,
    action: str = Query(..., description="Azione da eseguire: 'on' o 'off'", regex="^(on|off)$"),
    business_logic: BusinessLogic = Depends(get_business_logic),
    mongo_client: MongoClientWrapper = Depends(get_mongo_client)
):
    action_name = f"luce_led_{action}"
    result = await business_logic.execute_sensor_action(sensor_name, action_name)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    if result.success:
        if sensor_name not in _led_state:
            _led_state[sensor_name] = {"is_on": False, "last_toggle": datetime.now()}
        _led_state[sensor_name]["is_on"] = (action == "on")
        _led_state[sensor_name]["last_toggle"] = datetime.now()
        await _save_actuator_state(sensor_name, "luce_led", action == "on", mongo_client)
    return result

@router.post("/{sensor_name}/ventola")
async def control_ventola(
    sensor_name: str,
    action: str = Query(..., description="Azione da eseguire: 'on' o 'off'", regex="^(on|off)$"),
    business_logic: BusinessLogic = Depends(get_business_logic),
    mongo_client: MongoClientWrapper = Depends(get_mongo_client)
):
    action_name = f"ventola_{action}"
    result = await business_logic.execute_sensor_action(sensor_name, action_name)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    await _save_actuator_state(sensor_name, "ventola", action == "on", mongo_client)
    return result

async def _handle_growbox_phase_logic(sensor_name: str, data: dict, phase: Optional[str]):
    if not phase:
        print(f"GROWBOX {sensor_name}: Nessuna fase impostata, automazione disabilitata")
        return

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
    print(f"  → FASE PIANTINA: Logica automazione attiva")
    target_hum_min = 65
    target_hum_max = 70
    target_temp_led_on_min = 20
    target_temp_led_on_max = 25
    target_temp_led_off_min = 15
    target_temp_led_off_max = 21

    led_on = await _check_led_state(sensor_name)
    target_temp_min = target_temp_led_on_min if led_on else target_temp_led_off_min
    target_temp_max = target_temp_led_on_max if led_on else target_temp_led_off_max

    if avg_temp is not None:
        if avg_temp < target_temp_min:
            await _execute_action_safe(sensor_name, "resistenza_on")
            print(f"    → Temperatura bassa ({avg_temp:.1f}°C < {target_temp_min}°C): Accesa resistenza")
        elif avg_temp > target_temp_max:
            await _execute_action_safe(sensor_name, "resistenza_off")
            await _execute_action_safe(sensor_name, "ventola_on")
            print(f"    → Temperatura alta ({avg_temp:.1f}°C > {target_temp_max}°C): Spenta resistenza, accesa ventola")
        else:
            await _execute_action_safe(sensor_name, "resistenza_off")

    if avg_hum is not None:
        if avg_hum < target_hum_min:
            await _execute_action_safe(sensor_name, "pompa_aspirazione_on")
            print(f"    → Umidità bassa ({avg_hum:.1f}% < {target_hum_min}%): Accesa pompa aspirazione")
        elif avg_hum > target_hum_max:
            await _execute_action_safe(sensor_name, "ventola_on")
            await _execute_action_safe(sensor_name, "pompa_aspirazione_off")
            print(f"    → Umidità alta ({avg_hum:.1f}% > {target_hum_max}%): Accesa ventola")
        else:
            await _execute_action_safe(sensor_name, "pompa_aspirazione_off")

    await _manage_led_schedule(sensor_name, min_hours_per_day=18)

async def _handle_vegetativa_phase(sensor_name: str, data: dict, avg_temp: Optional[float], avg_hum: Optional[float]):
    print(f"  → FASE VEGETATIVA: Logica automazione attiva")

    mongo_client = None
    try:
        from app.dependencies import mongo_client as mc
        mongo_client = mc
    except:
        pass

    weeks_elapsed = 0
    if mongo_client is not None and mongo_client.db is not None:
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
                    elif isinstance(start_date, datetime):
                        pass
                    else:
                        start_date = datetime.now()
                    weeks_elapsed = (datetime.now() - start_date).days // 7
        except:
            pass

    base_hum = 65
    hum_reduction = weeks_elapsed * 5
    target_hum_min = max(40, base_hum - hum_reduction)
    target_hum_max = max(45, base_hum - hum_reduction + 5)

    target_temp_led_on_min = 22
    target_temp_led_on_max = 28
    target_temp_led_off_min = 17
    target_temp_led_off_max = 24

    led_on = await _check_led_state(sensor_name)
    target_temp_min = target_temp_led_on_min if led_on else target_temp_led_off_min
    target_temp_max = target_temp_led_on_max if led_on else target_temp_led_off_max

    print(f"    → Settimane trascorse: {weeks_elapsed}, Umidità target: {target_hum_min}-{target_hum_max}%")

    if avg_temp is not None:
        if avg_temp < target_temp_min:
            await _execute_action_safe(sensor_name, "resistenza_on")
            print(f"    → Temperatura bassa ({avg_temp:.1f}°C < {target_temp_min}°C): Accesa resistenza")
        elif avg_temp > target_temp_max:
            await _execute_action_safe(sensor_name, "resistenza_off")
            await _execute_action_safe(sensor_name, "ventola_on")
            print(f"    → Temperatura alta ({avg_temp:.1f}°C > {target_temp_max}°C): Spenta resistenza, accesa ventola")
        else:
            await _execute_action_safe(sensor_name, "resistenza_off")

    if avg_hum is not None:
        if avg_hum < target_hum_min:
            await _execute_action_safe(sensor_name, "pompa_aspirazione_on")
            print(f"    → Umidità bassa ({avg_hum:.1f}% < {target_hum_min}%): Accesa pompa aspirazione")
        elif avg_hum > target_hum_max:
            await _execute_action_safe(sensor_name, "ventola_on")
            await _execute_action_safe(sensor_name, "pompa_aspirazione_off")
            print(f"    → Umidità alta ({avg_hum:.1f}% > {target_hum_max}%): Accesa ventola")
        else:
            await _execute_action_safe(sensor_name, "pompa_aspirazione_off")

    await _manage_led_schedule(sensor_name, min_hours_per_day=18)

async def _handle_fioritura_phase(sensor_name: str, data: dict, avg_temp: Optional[float], avg_hum: Optional[float]):
    print(f"  → FASE FIORITURA: Logica automazione attiva")

    target_hum_min = 40
    target_hum_max = 50
    target_temp_led_on_min = 20
    target_temp_led_on_max = 26

    led_on = await _check_led_state(sensor_name)
    target_temp_min = target_temp_led_on_min
    target_temp_max = target_temp_led_on_max

    if avg_temp is not None:
        if avg_temp < target_temp_min:
            await _execute_action_safe(sensor_name, "resistenza_on")
            print(f"    → Temperatura bassa ({avg_temp:.1f}°C < {target_temp_min}°C): Accesa resistenza")
        elif avg_temp > target_temp_max:
            await _execute_action_safe(sensor_name, "resistenza_off")
            await _execute_action_safe(sensor_name, "ventola_on")
            print(f"    → Temperatura alta ({avg_temp:.1f}°C > {target_temp_max}°C): Spenta resistenza, accesa ventola")
        else:
            await _execute_action_safe(sensor_name, "resistenza_off")

    if avg_hum is not None:
        if avg_hum < target_hum_min:
            await _execute_action_safe(sensor_name, "pompa_aspirazione_on")
            print(f"    → Umidità bassa ({avg_hum:.1f}% < {target_hum_min}%): Accesa pompa aspirazione")
        elif avg_hum > target_hum_max:
            await _execute_action_safe(sensor_name, "ventola_on")
            await _execute_action_safe(sensor_name, "pompa_aspirazione_off")
            print(f"    → Umidità alta ({avg_hum:.1f}% > {target_hum_max}%): Accesa ventola")
        else:
            await _execute_action_safe(sensor_name, "pompa_aspirazione_off")

    await _manage_led_schedule(sensor_name, min_hours_per_day=18)

async def _check_led_state(sensor_name: str) -> bool:
    if sensor_name not in _led_state:
        return False
    return _led_state[sensor_name].get("is_on", False)

async def _manage_led_schedule(sensor_name: str, min_hours_per_day: int = 18):
    now = datetime.now()

    if sensor_name not in _led_state:
        _led_state[sensor_name] = {"is_on": True, "last_toggle": now}
        await _execute_action_safe(sensor_name, "luce_led_on")
        print(f"    → Luce LED accesa all'avvio per garantire {min_hours_per_day}h/giorno")
        return

    state = _led_state[sensor_name]
    last_toggle = state.get("last_toggle", now)
    hours_since_toggle = (now - last_toggle).total_seconds() / 3600

    if not state.get("is_on", False):
        if hours_since_toggle >= (24 - min_hours_per_day):
            await _execute_action_safe(sensor_name, "luce_led_on")
            state.update({"is_on": True, "last_toggle": now})
            print(f"    → Luce LED accesa (minimo {min_hours_per_day}h/giorno)")
    else:
        if hours_since_toggle >= min_hours_per_day:
            await _execute_action_safe(sensor_name, "luce_led_off")
            state.update({"is_on": False, "last_toggle": now})
            print(f"    → Luce LED spenta (raggiunto minimo {min_hours_per_day}h)")

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

# Il gestore viene impostato da automation_service quando necessario