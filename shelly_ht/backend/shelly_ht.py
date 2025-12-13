"""
Plugin backend per Shelly H&T
Nota: Shelly H&T è read-only via MQTT, quindi questo plugin serve solo
per eventuali route di lettura dati aggregati o statistiche
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
from app.services.business_logic import BusinessLogic
from app.dependencies import get_business_logic

router = APIRouter(prefix="/sensors/shelly-ht", tags=["shelly-ht"])


@router.get("/{sensor_name}/temperature")
async def get_temperature(
    sensor_name: str,
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """Restituisce solo la temperatura corrente"""
    sensor_data = await business_logic.read_sensor_data(sensor_name)
    if sensor_data is None:
        raise HTTPException(status_code=404, detail=f"Sensore '{sensor_name}' non trovato")
    
    temp = sensor_data.data.get("temperature")
    if temp is None:
        raise HTTPException(status_code=404, detail="Temperatura non disponibile")
    return {"temperature": temp, "unit": "°C"}


@router.get("/{sensor_name}/humidity")
async def get_humidity(
    sensor_name: str,
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """Restituisce solo l'umidità corrente"""
    sensor_data = await business_logic.read_sensor_data(sensor_name)
    if sensor_data is None:
        raise HTTPException(status_code=404, detail=f"Sensore '{sensor_name}' non trovato")
    
    humidity = sensor_data.data.get("humidity")
    if humidity is None:
        raise HTTPException(status_code=404, detail="Umidità non disponibile")
    return {"humidity": humidity, "unit": "%"}


@router.get("/{sensor_name}/battery")
async def get_battery(
    sensor_name: str,
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """Restituisce lo stato della batteria"""
    sensor_data = await business_logic.read_sensor_data(sensor_name)
    if sensor_data is None:
        raise HTTPException(status_code=404, detail=f"Sensore '{sensor_name}' non trovato")
    
    battery = sensor_data.data.get("battery")
    battery_status = sensor_data.data.get("battery_status", "unknown")
    if battery is None:
        raise HTTPException(status_code=404, detail="Stato batteria non disponibile")
    return {
        "battery": battery,
        "battery_status": battery_status,
        "unit": "%"
    }
