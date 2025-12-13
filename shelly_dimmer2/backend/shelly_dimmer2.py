"""
Route custom per il sensore Shelly Dimmer 2

Questo modulo fornisce endpoint HTTP dedicati per controllare
un dispositivo Shelly Dimmer 2 tramite comandi specifici.
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Body
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from app.services.business_logic import BusinessLogic
from app.dependencies import get_business_logic
import aiohttp
from urllib.parse import urlencode


router = APIRouter(prefix="/sensors/shelly-dimmer2", tags=["shelly-dimmer2"])


# ========== MODELLI PYDANTIC ==========

class DimmerTurnRequest(BaseModel):
    """Richiesta per accendere/spegnere/toggle"""
    sensor_name: str = Field(..., description="Nome del sensore Shelly Dimmer 2")
    timer: Optional[int] = Field(None, ge=0, description="Timer automatico in secondi (opzionale)")


class DimmerBrightnessRequest(BaseModel):
    """Richiesta per impostare la luminosità"""
    sensor_name: str = Field(..., description="Nome del sensore Shelly Dimmer 2")
    brightness: int = Field(..., ge=1, le=100, description="Luminosità in percentuale (1-100)")


class DimmerTurnOnRequest(BaseModel):
    """Richiesta per accendere con luminosità"""
    sensor_name: str = Field(..., description="Nome del sensore Shelly Dimmer 2")
    brightness: Optional[int] = Field(None, ge=1, le=100, description="Luminosità in percentuale (1-100)")
    timer: Optional[int] = Field(None, ge=0, description="Timer automatico in secondi (opzionale)")


class DimmerDimRequest(BaseModel):
    """Richiesta per dimming progressivo"""
    sensor_name: str = Field(..., description="Nome del sensore Shelly Dimmer 2")
    direction: str = Field(..., description="Direzione: 'up', 'down', o 'stop'")
    step: Optional[int] = Field(None, ge=1, le=100, description="Step in percentuale per up/down (1-100)")


# ========== FUNZIONI HELPER ==========

async def _get_sensor_base_url(sensor_name: str, business_logic: BusinessLogic) -> str:
    """Ottiene l'URL base del sensore"""
    if sensor_name not in business_logic.sensors:
        raise HTTPException(status_code=404, detail=f"Sensore '{sensor_name}' non trovato")
    
    sensor = business_logic.sensors[sensor_name]
    if not sensor.config.ip:
        raise HTTPException(status_code=400, detail=f"Sensore '{sensor_name}' non ha un IP configurato")
    
    protocol = sensor.config.protocol or "http"
    port = f":{sensor.config.port}" if sensor.config.port else ""
    return f"{protocol}://{sensor.config.ip}{port}"


async def _execute_shelly_command(
    base_url: str,
    endpoint: str,
    params: Dict[str, Any]
) -> Dict[str, Any]:
    """Esegue un comando HTTP GET sul dispositivo Shelly"""
    url = f"{base_url}{endpoint}?{urlencode(params)}"
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                status_code = response.status
                
                # Prova a leggere come JSON, altrimenti come testo
                try:
                    data = await response.json()
                except:
                    data = {"response": await response.text()}
                
                return {
                    "success": status_code == 200,
                    "status_code": status_code,
                    "data": data,
                    "url": url,
                    "error": None if status_code == 200 else f"HTTP {status_code}"
                }
    except Exception as e:
        return {
            "success": False,
            "status_code": None,
            "data": None,
            "url": url,
            "error": str(e)
        }


# ========== ROUTE CONTROLLO BASE ==========

@router.post("/light/turn-on")
async def light_turn_on(
    request: DimmerTurnOnRequest,
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """
    Accende la luce del Dimmer 2.
    
    Esempio:
    ```json
    {
        "sensor_name": "shelly_dimmer2_01",
        "brightness": 50,
        "timer": null
    }
    ```
    """
    base_url = await _get_sensor_base_url(request.sensor_name, business_logic)
    
    params = {"turn": "on"}
    if request.brightness is not None:
        params["brightness"] = request.brightness
    if request.timer is not None:
        params["timer"] = request.timer
    
    result = await _execute_shelly_command(base_url, "/light/0", params)
    
    if not result["success"]:
        raise HTTPException(
            status_code=result.get("status_code", 500),
            detail=result.get("error", "Errore nell'esecuzione del comando")
        )
    
    return {
        "sensor_name": request.sensor_name,
        "action": "light_turn_on",
        **result
    }


@router.post("/light/turn-off")
async def light_turn_off(
    request: DimmerTurnRequest,
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """
    Spegne la luce del Dimmer 2.
    
    Esempio:
    ```json
    {
        "sensor_name": "shelly_dimmer2_01",
        "timer": null
    }
    ```
    """
    base_url = await _get_sensor_base_url(request.sensor_name, business_logic)
    
    params = {"turn": "off"}
    if request.timer is not None:
        params["timer"] = request.timer
    
    result = await _execute_shelly_command(base_url, "/light/0", params)
    
    if not result["success"]:
        raise HTTPException(
            status_code=result.get("status_code", 500),
            detail=result.get("error", "Errore nell'esecuzione del comando")
        )
    
    return {
        "sensor_name": request.sensor_name,
        "action": "light_turn_off",
        **result
    }


@router.post("/light/toggle")
async def light_toggle(
    request: DimmerTurnRequest,
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """
    Alterna lo stato on/off della luce.
    """
    base_url = await _get_sensor_base_url(request.sensor_name, business_logic)
    
    params = {"turn": "toggle"}
    if request.timer is not None:
        params["timer"] = request.timer
    
    result = await _execute_shelly_command(base_url, "/light/0", params)
    
    if not result["success"]:
        raise HTTPException(
            status_code=result.get("status_code", 500),
            detail=result.get("error", "Errore nell'esecuzione del comando")
        )
    
    return {
        "sensor_name": request.sensor_name,
        "action": "light_toggle",
        **result
    }


# ========== ROUTE LUMINOSITÀ ==========

@router.post("/light/set-brightness")
async def light_set_brightness(
    request: DimmerBrightnessRequest,
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """
    Imposta la luminosità della luce (1-100%).
    
    Esempio:
    ```json
    {
        "sensor_name": "shelly_dimmer2_01",
        "brightness": 75
    }
    ```
    """
    base_url = await _get_sensor_base_url(request.sensor_name, business_logic)
    
    params = {"brightness": request.brightness}
    
    result = await _execute_shelly_command(base_url, "/light/0", params)
    
    if not result["success"]:
        raise HTTPException(
            status_code=result.get("status_code", 500),
            detail=result.get("error", "Errore nell'esecuzione del comando")
        )
    
    return {
        "sensor_name": request.sensor_name,
        "action": "light_set_brightness",
        "brightness": request.brightness,
        **result
    }


# ========== ROUTE DIMMING PROGRESSIVO ==========

@router.post("/light/dim")
async def light_dim(
    request: DimmerDimRequest,
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """
    Controlla il dimming progressivo della luce.
    
    Direzioni:
    - "up": Incrementa la luminosità
    - "down": Decrementa la luminosità
    - "stop": Interrompe il dimming
    
    Esempio:
    ```json
    {
        "sensor_name": "shelly_dimmer2_01",
        "direction": "up",
        "step": 10
    }
    ```
    """
    if request.direction not in ["up", "down", "stop"]:
        raise HTTPException(
            status_code=400,
            detail="Direzione deve essere 'up', 'down' o 'stop'"
        )
    
    base_url = await _get_sensor_base_url(request.sensor_name, business_logic)
    
    params = {"dim": request.direction}
    if request.direction in ["up", "down"] and request.step is not None:
        params["step"] = request.step
    
    result = await _execute_shelly_command(base_url, "/light/0", params)
    
    if not result["success"]:
        raise HTTPException(
            status_code=result.get("status_code", 500),
            detail=result.get("error", "Errore nell'esecuzione del comando")
        )
    
    return {
        "sensor_name": request.sensor_name,
        "action": "light_dim",
        "direction": request.direction,
        "step": request.step,
        **result
    }


@router.get("/light/status")
async def light_status(
    sensor_name: str = Query(..., description="Nome del sensore Shelly Dimmer 2"),
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """
    Legge lo stato corrente della luce.
    """
    base_url = await _get_sensor_base_url(sensor_name, business_logic)
    
    result = await _execute_shelly_command(base_url, "/light/0", {})
    
    if not result["success"]:
        raise HTTPException(
            status_code=result.get("status_code", 500),
            detail=result.get("error", "Errore nella lettura dello stato")
        )
    
    return {
        "sensor_name": sensor_name,
        "action": "light_status",
        **result
    }

