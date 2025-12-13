"""
Plugin backend per Shelly H&T
Nota: Shelly H&T è read-only via MQTT, quindi questo plugin serve solo
per eventuali route di lettura dati aggregati o statistiche
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from app import dependencies

router = APIRouter(prefix="/sensors/shelly-ht", tags=["shelly-ht"])


@router.get("/{sensor_name}/status")
async def get_sensor_status(sensor_name: str):
    """
    Restituisce lo stato corrente del sensore Shelly H&T
    I dati vengono letti dal protocollo MQTT che li riceve in tempo reale
    """
    business_logic = dependencies.business_logic
    if not business_logic:
        raise HTTPException(status_code=503, detail="Business logic non disponibile")
    
    sensor = business_logic.get_sensor(sensor_name)
    if not sensor:
        raise HTTPException(status_code=404, detail=f"Sensore {sensor_name} non trovato")
    
    # Leggi i dati più recenti dal protocollo MQTT
    try:
        sensor_data = await sensor.protocol.read_data()
        return {
            "sensor_name": sensor_name,
            "status": "ok",
            "data": sensor_data.data if sensor_data.data else {},
            "last_update": sensor_data.timestamp.isoformat() if sensor_data.timestamp else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore lettura dati: {str(e)}")


@router.get("/{sensor_name}/temperature")
async def get_temperature(sensor_name: str):
    """Restituisce solo la temperatura corrente"""
    status = await get_sensor_status(sensor_name)
    temp = status.get("data", {}).get("temperature")
    if temp is None:
        raise HTTPException(status_code=404, detail="Temperatura non disponibile")
    return {"temperature": temp, "unit": "°C"}


@router.get("/{sensor_name}/humidity")
async def get_humidity(sensor_name: str):
    """Restituisce solo l'umidità corrente"""
    status = await get_sensor_status(sensor_name)
    humidity = status.get("data", {}).get("humidity")
    if humidity is None:
        raise HTTPException(status_code=404, detail="Umidità non disponibile")
    return {"humidity": humidity, "unit": "%"}


@router.get("/{sensor_name}/battery")
async def get_battery(sensor_name: str):
    """Restituisce lo stato della batteria"""
    status = await get_sensor_status(sensor_name)
    battery = status.get("data", {}).get("battery")
    battery_status = status.get("data", {}).get("battery_status", "unknown")
    if battery is None:
        raise HTTPException(status_code=404, detail="Stato batteria non disponibile")
    return {
        "battery": battery,
        "battery_status": battery_status,
        "unit": "%"
    }