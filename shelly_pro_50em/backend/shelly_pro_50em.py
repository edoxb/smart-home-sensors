from fastapi import APIRouter, HTTPException, Depends, Query, Body
from fastapi.responses import StreamingResponse
from typing import Optional, Dict, Any
from datetime import datetime
import asyncio
import json
from app.services.business_logic import BusinessLogic
from app.dependencies import get_business_logic
from app.protocols.mqtt_protocol import MQTTProtocol


def _extract_shelly_pro_50em_data(raw_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Estrae e formatta i dati dai messaggi RPC Shelly Pro 50EM.
    
    I messaggi arrivano in formato:
    {
        "src": "...",
        "dst": "...",
        "method": "NotifyStatus" o "NotifyFullStatus",
        "params": {
            "em1:0": {...},
            "em1:1": {...},
            "em1data:0": {...},
            "em1data:1": {...},
            "wifi": {...},
            "sys": {...},
            ...
        }
    }
    
    Restituisce una struttura formattata per il frontend.
    """
    if not isinstance(raw_data, dict):
        return {}
    
    # Se il dato è già un messaggio RPC Shelly, estrai i params
    if "method" in raw_data and "params" in raw_data:
        params = raw_data.get("params", {})
    elif "em1:0" in raw_data or "em1:1" in raw_data:
        # Se i dati sono già estratti (solo params)
        params = raw_data
    else:
        # Altrimenti usa i dati così come sono
        params = raw_data
    
    # Estrai i dati dei due canali di misurazione
    formatted_data = {
        "channels": {},
        "energy_data": {},
        "wifi": params.get("wifi", {}),
        "sys": params.get("sys", {}),
        "device": params.get("device", {}),
        "mqtt": params.get("mqtt", {}),
        "ts": params.get("ts")
    }
    
    # Canale 0 (em1:0)
    if "em1:0" in params:
        em1_0 = params["em1:0"]
        formatted_data["channels"]["0"] = {
            "id": em1_0.get("id", 0),
            "act_power": em1_0.get("act_power", 0),  # Potenza attiva (W)
            "aprt_power": em1_0.get("aprt_power", 0),  # Potenza apparente (VA)
            "voltage": em1_0.get("voltage", 0),  # Tensione (V)
            "current": em1_0.get("current", 0),  # Corrente (A)
            "pf": em1_0.get("pf", 0),  # Power factor
            "freq": em1_0.get("freq", 0),  # Frequenza (Hz)
            "calibration": em1_0.get("calibration", "")
        }
    
    # Canale 1 (em1:1)
    if "em1:1" in params:
        em1_1 = params["em1:1"]
        formatted_data["channels"]["1"] = {
            "id": em1_1.get("id", 1),
            "act_power": em1_1.get("act_power", 0),
            "aprt_power": em1_1.get("aprt_power", 0),
            "voltage": em1_1.get("voltage", 0),
            "current": em1_1.get("current", 0),
            "pf": em1_1.get("pf", 0),
            "freq": em1_1.get("freq", 0),
            "calibration": em1_1.get("calibration", "")
        }
    
    # Dati energia accumulata (em1data:0 e em1data:1)
    if "em1data:0" in params:
        em1data_0 = params["em1data:0"]
        formatted_data["energy_data"]["0"] = {
            "id": em1data_0.get("id", 0),
            "total_act_energy": em1data_0.get("total_act_energy", 0),  # Energia totale (Wh)
            "total_act_ret_energy": em1data_0.get("total_act_ret_energy", 0)  # Energia restituita (Wh)
        }
    
    if "em1data:1" in params:
        em1data_1 = params["em1data:1"]
        formatted_data["energy_data"]["1"] = {
            "id": em1data_1.get("id", 1),
            "total_act_energy": em1data_1.get("total_act_energy", 0),
            "total_act_ret_energy": em1data_1.get("total_act_ret_energy", 0)
        }
    
    return formatted_data


router = APIRouter(prefix="/sensors/shelly-pro-50em", tags=["shelly-pro-50em"])


# Cache per aggregare i dati nel tempo (per gestire messaggi parziali)
_sensor_data_cache: Dict[str, Dict[str, Any]] = {}

# Dizionario per gestire le connessioni SSE per sensore
_sse_connections: Dict[str, list] = {}

@router.get("/status")
async def get_status(
    sensor_name: str = Query(..., description="Nome del sensore"),
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """
    Ottiene lo stato completo del dispositivo Shelly Pro 50EM con dati formattati.
    Estrae i dati dai messaggi RPC Shelly e li formatta per il frontend.
    Aggrega i dati nel tempo per gestire messaggi MQTT parziali.
    """
    if sensor_name not in business_logic.sensors:
        raise HTTPException(status_code=404, detail=f"Sensore '{sensor_name}' non trovato")
    
    sensor = business_logic.sensors[sensor_name]
    
    # Se il sensore usa MQTT, ottieni i dati dall'ultimo messaggio ricevuto
    if isinstance(sensor.protocol, MQTTProtocol):
        data = await business_logic.read_sensor_data(sensor_name)
        if data and data.data:
            # Estrai e formatta i dati dai messaggi RPC Shelly
            new_formatted_data = _extract_shelly_pro_50em_data(data.data)
            
            # Aggrega con i dati precedenti (mantieni i dati vecchi se non arrivano nel nuovo messaggio)
            if sensor_name not in _sensor_data_cache:
                _sensor_data_cache[sensor_name] = {
                    "channels": {},
                    "energy_data": {},
                    "wifi": {},
                    "sys": {},
                    "device": {},
                    "mqtt": {},
                    "ts": None
                }
            
            cached_data = _sensor_data_cache[sensor_name]
            
            # Aggiorna i canali solo se presenti nel nuovo messaggio
            if new_formatted_data.get("channels"):
                for channel_id, channel_data in new_formatted_data["channels"].items():
                    cached_data["channels"][channel_id] = channel_data
            
            # Aggiorna i dati energia solo se presenti nel nuovo messaggio
            if new_formatted_data.get("energy_data"):
                for energy_id, energy_data in new_formatted_data["energy_data"].items():
                    cached_data["energy_data"][energy_id] = energy_data
            
            # Aggiorna le altre informazioni se presenti
            if new_formatted_data.get("wifi"):
                cached_data["wifi"] = new_formatted_data["wifi"]
            if new_formatted_data.get("sys"):
                cached_data["sys"] = new_formatted_data["sys"]
            if new_formatted_data.get("device"):
                cached_data["device"] = new_formatted_data["device"]
            if new_formatted_data.get("mqtt"):
                cached_data["mqtt"] = new_formatted_data["mqtt"]
            if new_formatted_data.get("ts"):
                cached_data["ts"] = new_formatted_data["ts"]
            
            return {
                "success": True,
                "data": cached_data.copy(),
                "raw_data": data.data,  # Mantieni anche i dati grezzi per debug
                "timestamp": data.timestamp.isoformat() if data.timestamp else None
            }
        else:
            # Se non ci sono dati nuovi, restituisci i dati cached se disponibili
            if sensor_name in _sensor_data_cache:
                return {
                    "success": True,
                    "data": _sensor_data_cache[sensor_name].copy(),
                    "message": "Dati dalla cache (nessun nuovo messaggio)"
                }
            else:
                return {
                    "success": True,
                    "data": {
                        "channels": {},
                        "energy_data": {},
                        "wifi": {},
                        "sys": {},
                        "device": {},
                        "mqtt": {}
                    },
                    "message": "Nessun dato disponibile ancora"
                }
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Il sensore '{sensor_name}' non usa il protocollo MQTT"
        )


@router.post("/rpc")
async def send_rpc_command(
    request: Dict[str, Any] = Body(...),
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """
    Invia un comando RPC al dispositivo Shelly Pro 50EM via MQTT
    
    Body example:
    {
        "sensor_name": "shelly-pro-50em-1",
        "method": "Shelly.GetStatus",
        "params": {}
    }
    """
    sensor_name = request.get("sensor_name")
    if not sensor_name:
        raise HTTPException(status_code=400, detail="sensor_name è obbligatorio")
    
    if sensor_name not in business_logic.sensors:
        raise HTTPException(status_code=404, detail=f"Sensore '{sensor_name}' non trovato")
    
    sensor = business_logic.sensors[sensor_name]
    
    if not isinstance(sensor.protocol, MQTTProtocol):
        raise HTTPException(
            status_code=400,
            detail=f"Il sensore '{sensor_name}' non usa il protocollo MQTT"
        )
    
    # Costruisci il messaggio RPC
    method = request.get("method", "Shelly.GetStatus")
    params = request.get("params", {})
    
    # Ottieni il topic_prefix dalla configurazione del sensore
    config = sensor.config
    device_id = config.device_id or sensor_name
    topic_prefix = config.mqtt_topic_status or f"shellyproem50-{device_id}"
    # Rimuovi eventuali wildcard o path dal topic
    if "/" in topic_prefix:
        topic_prefix = topic_prefix.split("/")[0]
    
    rpc_topic = f"{topic_prefix}/rpc"
    
    # Costruisci il payload RPC
    rpc_payload = {
        "id": 1,
        "method": method,
        "params": params
    }
    
    try:
        # Invia il comando MQTT
        mqtt_protocol = sensor.protocol
        if not mqtt_protocol._mqtt_client:
            raise HTTPException(status_code=500, detail="Client MQTT non disponibile")
        
        # Pubblica il messaggio
        await mqtt_protocol._mqtt_client.publish(
            rpc_topic,
            json.dumps(rpc_payload).encode(),
            qos=1
        )
        
        return {
            "success": True,
            "message": f"Comando RPC '{method}' inviato",
            "topic": rpc_topic,
            "payload": rpc_payload
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Errore nell'invio del comando RPC: {str(e)}"
        )


@router.get("/device-info")
async def get_device_info(
    sensor_name: str = Query(..., description="Nome del sensore"),
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """
    Ottiene le informazioni del dispositivo
    """
    # Invia comando RPC per ottenere le info del dispositivo
    request_data = {
        "sensor_name": sensor_name,
        "method": "Shelly.GetDeviceInfo",
        "params": {}
    }
    
    # Usa la funzione send_rpc_command internamente
    # Per semplicità, restituiamo i dati dallo stato
    status_response = await get_status(sensor_name, business_logic)
    
    if status_response.get("data"):
        device_info = status_response["data"].get("device", {})
        return {
            "success": True,
            "data": device_info
        }
    
    return {
        "success": True,
        "data": {},
        "message": "Informazioni dispositivo non disponibili"
    }


@router.get("/events")
async def stream_events(
    sensor_name: str = Query(..., description="Nome del sensore"),
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """
    Endpoint SSE per ricevere aggiornamenti in tempo reale dal sensore Shelly Pro 50EM.
    Invia i dati ogni volta che arrivano nuovi messaggi MQTT.
    """
    if sensor_name not in business_logic.sensors:
        raise HTTPException(status_code=404, detail=f"Sensore '{sensor_name}' non trovato")
    
    sensor = business_logic.sensors[sensor_name]
    
    if not isinstance(sensor.protocol, MQTTProtocol):
        raise HTTPException(
            status_code=400,
            detail=f"Il sensore '{sensor_name}' non usa il protocollo MQTT"
        )
    
    async def event_generator():
        # Inizializza la lista di connessioni per questo sensore
        if sensor_name not in _sse_connections:
            _sse_connections[sensor_name] = []
        
        # Coda per i messaggi da inviare
        message_queue = asyncio.Queue()
        _sse_connections[sensor_name].append(message_queue)
        
        try:
            # Invia i dati iniziali dalla cache se disponibili
            if sensor_name in _sensor_data_cache:
                cached_data = _sensor_data_cache[sensor_name]
                await message_queue.put({
                    "success": True,
                    "data": cached_data.copy(),
                    "timestamp": datetime.now().isoformat()
                })
            else:
                # Prova a leggere i dati attuali
                data = await business_logic.read_sensor_data(sensor_name)
                if data and data.data:
                    new_formatted_data = _extract_shelly_pro_50em_data(data.data)
                    
                    # Aggrega con la cache
                    if sensor_name not in _sensor_data_cache:
                        _sensor_data_cache[sensor_name] = {
                            "channels": {},
                            "energy_data": {},
                            "wifi": {},
                            "sys": {},
                            "device": {},
                            "mqtt": {},
                            "ts": None
                        }
                    
                    cached_data = _sensor_data_cache[sensor_name]
                    
                    if new_formatted_data.get("channels"):
                        for channel_id, channel_data in new_formatted_data["channels"].items():
                            cached_data["channels"][channel_id] = channel_data
                    
                    if new_formatted_data.get("energy_data"):
                        for energy_id, energy_data in new_formatted_data["energy_data"].items():
                            cached_data["energy_data"][energy_id] = energy_data
                    
                    if new_formatted_data.get("wifi"):
                        cached_data["wifi"] = new_formatted_data["wifi"]
                    if new_formatted_data.get("sys"):
                        cached_data["sys"] = new_formatted_data["sys"]
                    if new_formatted_data.get("device"):
                        cached_data["device"] = new_formatted_data["device"]
                    if new_formatted_data.get("mqtt"):
                        cached_data["mqtt"] = new_formatted_data["mqtt"]
                    if new_formatted_data.get("ts"):
                        cached_data["ts"] = new_formatted_data["ts"]
                    
                    # Invia dati iniziali
                    await message_queue.put({
                        "success": True,
                        "data": cached_data.copy(),
                        "timestamp": data.timestamp.isoformat() if data.timestamp else None
                    })
            
            # Loop per inviare messaggi
            while True:
                try:
                    # Attendi un messaggio con timeout per inviare heartbeat
                    try:
                        message = await asyncio.wait_for(message_queue.get(), timeout=30.0)
                    except asyncio.TimeoutError:
                        # Invia heartbeat per mantenere la connessione viva
                        yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
                        continue
                    
                    # Invia il messaggio
                    yield f"data: {json.dumps(message)}\n\n"
                    
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    print(f"Errore nella generazione eventi SSE per {sensor_name}: {e}")
                    break
                    
        finally:
            # Rimuovi la connessione quando il client si disconnette
            if sensor_name in _sse_connections:
                try:
                    _sse_connections[sensor_name].remove(message_queue)
                except ValueError:
                    pass
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disabilita buffering nginx
        }
    )


async def notify_sse_clients(sensor_name: str, formatted_data: Dict[str, Any]):
    """Notifica tutti i client SSE connessi per un sensore quando arrivano nuovi dati MQTT"""
    if sensor_name not in _sse_connections:
        return
    
    # Aggrega i nuovi dati con la cache esistente
    if sensor_name not in _sensor_data_cache:
        _sensor_data_cache[sensor_name] = {
            "channels": {},
            "energy_data": {},
            "wifi": {},
            "sys": {},
            "device": {},
            "mqtt": {},
            "ts": None
        }
    
    cached_data = _sensor_data_cache[sensor_name]
    
    # Aggiorna i canali solo se presenti nel nuovo messaggio
    if formatted_data.get("channels"):
        for channel_id, channel_data in formatted_data["channels"].items():
            cached_data["channels"][channel_id] = channel_data
    
    # Aggiorna i dati energia solo se presenti nel nuovo messaggio
    if formatted_data.get("energy_data"):
        for energy_id, energy_data in formatted_data["energy_data"].items():
            cached_data["energy_data"][energy_id] = energy_data
    
    # Aggiorna le altre informazioni se presenti
    if formatted_data.get("wifi"):
        cached_data["wifi"] = formatted_data["wifi"]
    if formatted_data.get("sys"):
        cached_data["sys"] = formatted_data["sys"]
    if formatted_data.get("device"):
        cached_data["device"] = formatted_data["device"]
    if formatted_data.get("mqtt"):
        cached_data["mqtt"] = formatted_data["mqtt"]
    if formatted_data.get("ts"):
        cached_data["ts"] = formatted_data["ts"]
    
    # Prepara il messaggio da inviare
    message = {
        "success": True,
        "data": cached_data.copy(),
        "timestamp": datetime.now().isoformat()
    }
    
    # Notifica tutti i client connessi
    for queue in _sse_connections[sensor_name]:
        try:
            await queue.put(message)
        except Exception as e:
            print(f"Errore notifica SSE per {sensor_name}: {e}")


