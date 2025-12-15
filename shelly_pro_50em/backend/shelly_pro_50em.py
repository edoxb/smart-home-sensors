from fastapi import APIRouter, HTTPException, Depends, Query, Body
from typing import Optional, Dict, Any
from app.services.business_logic import BusinessLogic
from app.dependencies import get_business_logic
from app.protocols.mqtt_protocol import MQTTProtocol
import json

router = APIRouter(prefix="/sensors/shelly-pro-50em", tags=["shelly-pro-50em"])


@router.get("/status")
async def get_status(
    sensor_name: str = Query(..., description="Nome del sensore"),
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """
    Ottiene lo stato completo del dispositivo Shelly Pro 50EM
    """
    if sensor_name not in business_logic.sensors:
        raise HTTPException(status_code=404, detail=f"Sensore '{sensor_name}' non trovato")
    
    sensor = business_logic.sensors[sensor_name]
    
    # Se il sensore usa MQTT, ottieni i dati dall'ultimo messaggio ricevuto
    if isinstance(sensor.protocol, MQTTProtocol):
        data = await business_logic.read_sensor_data(sensor_name)
        if data:
            return {
                "success": True,
                "data": data.data,
                "timestamp": data.timestamp.isoformat() if data.timestamp else None
            }
        else:
            return {
                "success": True,
                "data": {},
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