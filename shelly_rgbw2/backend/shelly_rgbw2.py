"""
Route custom per il sensore Shelly RGBW2

Questo modulo fornisce endpoint HTTP dedicati per controllare
un dispositivo Shelly RGBW2 tramite comandi specifici.
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Body
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from app.services.business_logic import BusinessLogic
from app.dependencies import get_business_logic
import aiohttp
from urllib.parse import urlencode


router = APIRouter(prefix="/sensors/shelly-rgbw2", tags=["shelly-rgbw2"])


# ========== MODELLI PYDANTIC ==========

class ColorRequest(BaseModel):
    """Richiesta per controllo modalità COLOR"""
    sensor_name: str = Field(..., description="Nome del sensore Shelly RGBW2")
    red: int = Field(255, ge=0, le=255, description="Valore rosso (0-255)")
    green: int = Field(255, ge=0, le=255, description="Valore verde (0-255)")
    blue: int = Field(255, ge=0, le=255, description="Valore blu (0-255)")
    white: int = Field(0, ge=0, le=255, description="Valore bianco (0-255)")
    gain: Optional[int] = Field(None, ge=0, le=100, description="Gain/luminosità globale in percentuale (0-100)")
    timer: Optional[int] = Field(None, ge=0, description="Timer di spegnimento in secondi")


class WhiteChannelRequest(BaseModel):
    """Richiesta per controllo modalità WHITE"""
    sensor_name: str = Field(..., description="Nome del sensore Shelly RGBW2")
    channel: int = Field(..., ge=0, le=3, description="Numero canale (0=R, 1=G, 2=B, 3=W)")
    brightness: Optional[int] = Field(None, ge=0, le=100, description="Luminosità in percentuale (0-100)")
    timer: Optional[int] = Field(None, ge=0, description="Timer di spegnimento in secondi")


class TurnRequest(BaseModel):
    """Richiesta generica per accendere/spegnere"""
    sensor_name: str = Field(..., description="Nome del sensore Shelly RGBW2")
    timer: Optional[int] = Field(None, ge=0, description="Timer di spegnimento in secondi")


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


# ========== ROUTE MODALITÀ COLOR ==========

@router.post("/color/turn-on")
async def color_turn_on(
    request: ColorRequest,
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """
    Accende il LED in modalità COLOR con i valori RGBW specificati.
    
    Esempio:
    ```json
    {
        "sensor_name": "shelly_rgbw2_01",
        "red": 255,
        "green": 100,
        "blue": 50,
        "white": 0,
        "gain": 30,
        "timer": null
    }
    ```
    """
    base_url = await _get_sensor_base_url(request.sensor_name, business_logic)
    
    params = {
        "turn": "on",
        "red": request.red,
        "green": request.green,
        "blue": request.blue,
        "white": request.white
    }
    
    if request.gain is not None:
        params["gain"] = request.gain
    if request.timer is not None:
        params["timer"] = request.timer
    
    result = await _execute_shelly_command(base_url, "/color/0", params)
    
    if not result["success"]:
        raise HTTPException(
            status_code=result.get("status_code", 500),
            detail=result.get("error", "Errore nell'esecuzione del comando")
        )
    
    return {
        "sensor_name": request.sensor_name,
        "action": "color_turn_on",
        **result
    }


@router.post("/color/turn-off")
async def color_turn_off(
    request: TurnRequest,
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """
    Spegne il LED in modalità COLOR.
    
    Esempio:
    ```json
    {
        "sensor_name": "shelly_rgbw2_01",
        "timer": null
    }
    ```
    """
    base_url = await _get_sensor_base_url(request.sensor_name, business_logic)
    
    params = {"turn": "off"}
    if request.timer is not None:
        params["timer"] = request.timer
    
    result = await _execute_shelly_command(base_url, "/color/0", params)
    
    if not result["success"]:
        raise HTTPException(
            status_code=result.get("status_code", 500),
            detail=result.get("error", "Errore nell'esecuzione del comando")
        )
    
    return {
        "sensor_name": request.sensor_name,
        "action": "color_turn_off",
        **result
    }


@router.post("/color/toggle")
async def color_toggle(
    request: TurnRequest,
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """
    Alterna lo stato on/off in modalità COLOR.
    """
    base_url = await _get_sensor_base_url(request.sensor_name, business_logic)
    
    params = {"turn": "toggle"}
    if request.timer is not None:
        params["timer"] = request.timer
    
    result = await _execute_shelly_command(base_url, "/color/0", params)
    
    if not result["success"]:
        raise HTTPException(
            status_code=result.get("status_code", 500),
            detail=result.get("error", "Errore nell'esecuzione del comando")
        )
    
    return {
        "sensor_name": request.sensor_name,
        "action": "color_toggle",
        **result
    }


# ========== ROUTE MODALITÀ WHITE ==========

@router.post("/white/turn-on")
async def white_turn_on(
    request: WhiteChannelRequest,
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """
    Accende un canale specifico in modalità WHITE.
    
    Canali:
    - 0: Rosso (R)
    - 1: Verde (G)
    - 2: Blu (B)
    - 3: Bianco (W)
    
    Esempio:
    ```json
    {
        "sensor_name": "shelly_rgbw2_01",
        "channel": 3,
        "brightness": 70,
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
    
    result = await _execute_shelly_command(base_url, f"/white/{request.channel}", params)
    
    if not result["success"]:
        raise HTTPException(
            status_code=result.get("status_code", 500),
            detail=result.get("error", "Errore nell'esecuzione del comando")
        )
    
    return {
        "sensor_name": request.sensor_name,
        "action": "white_turn_on",
        "channel": request.channel,
        **result
    }


@router.post("/white/turn-off")
async def white_turn_off(
    request: WhiteChannelRequest,
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """
    Spegne un canale specifico in modalità WHITE.
    """
    base_url = await _get_sensor_base_url(request.sensor_name, business_logic)
    
    params = {"turn": "off"}
    if request.timer is not None:
        params["timer"] = request.timer
    
    result = await _execute_shelly_command(base_url, f"/white/{request.channel}", params)
    
    if not result["success"]:
        raise HTTPException(
            status_code=result.get("status_code", 500),
            detail=result.get("error", "Errore nell'esecuzione del comando")
        )
    
    return {
        "sensor_name": request.sensor_name,
        "action": "white_turn_off",
        "channel": request.channel,
        **result
    }


@router.post("/white/set-brightness")
async def white_set_brightness(
    request: WhiteChannelRequest,
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """
    Imposta la luminosità di un canale specifico in modalità WHITE.
    
    Esempio:
    ```json
    {
        "sensor_name": "shelly_rgbw2_01",
        "channel": 3,
        "brightness": 50
    }
    ```
    """
    if request.brightness is None:
        raise HTTPException(status_code=400, detail="Il parametro 'brightness' è obbligatorio")
    
    base_url = await _get_sensor_base_url(request.sensor_name, business_logic)
    
    params = {"brightness": request.brightness}
    
    result = await _execute_shelly_command(base_url, f"/white/{request.channel}", params)
    
    if not result["success"]:
        raise HTTPException(
            status_code=result.get("status_code", 500),
            detail=result.get("error", "Errore nell'esecuzione del comando")
        )
    
    return {
        "sensor_name": request.sensor_name,
        "action": "white_set_brightness",
        "channel": request.channel,
        "brightness": request.brightness,
        **result
    }


@router.post("/white/toggle")
async def white_toggle(
    request: WhiteChannelRequest,
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """
    Alterna lo stato on/off di un canale in modalità WHITE.
    """
    base_url = await _get_sensor_base_url(request.sensor_name, business_logic)
    
    params = {"turn": "toggle"}
    if request.timer is not None:
        params["timer"] = request.timer
    
    result = await _execute_shelly_command(base_url, f"/white/{request.channel}", params)
    
    if not result["success"]:
        raise HTTPException(
            status_code=result.get("status_code", 500),
            detail=result.get("error", "Errore nell'esecuzione del comando")
        )
    
    return {
        "sensor_name": request.sensor_name,
        "action": "white_toggle",
        "channel": request.channel,
        **result
    }

