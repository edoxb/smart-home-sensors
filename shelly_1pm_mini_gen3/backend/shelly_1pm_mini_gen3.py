"""
Route custom per il sensore Shelly 1 PM Mini Gen 3

Questo modulo fornisce endpoint HTTP dedicati per controllare
un dispositivo Shelly 1 PM Mini Gen 3 tramite comandi RPC.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, Dict, Any, Tuple
from pydantic import BaseModel, Field
from app.services.business_logic import BusinessLogic
from app.dependencies import get_business_logic
import aiohttp
from urllib.parse import urlencode
import base64


router = APIRouter(prefix="/sensors/shelly-1pm-mini-gen3", tags=["shelly-1pm-mini-gen3"])


# ========== MODELLI PYDANTIC ==========

class SwitchSetRequest(BaseModel):
    """Richiesta per accendere/spegnere il relè"""
    sensor_name: str = Field(..., description="Nome del sensore Shelly 1 PM Mini Gen 3")
    on: bool = Field(..., description="True per accendere, False per spegnere")
    auto_off: Optional[int] = Field(None, ge=0, description="Timer di spegnimento automatico in secondi (opzionale)")
    auto_on: Optional[int] = Field(None, ge=0, description="Timer di accensione automatica in secondi (opzionale)")


class SwitchToggleRequest(BaseModel):
    """Richiesta per toggle del relè"""
    sensor_name: str = Field(..., description="Nome del sensore Shelly 1 PM Mini Gen 3")


class TimerRequest(BaseModel):
    """Richiesta per impostare timer automatici"""
    sensor_name: str = Field(..., description="Nome del sensore Shelly 1 PM Mini Gen 3")
    auto_off: Optional[int] = Field(None, ge=0, description="Timer di spegnimento automatico in secondi")
    auto_on: Optional[int] = Field(None, ge=0, description="Timer di accensione automatica in secondi")


# ========== FUNZIONI HELPER ==========

async def _get_sensor_base_url(sensor_name: str, business_logic: BusinessLogic) -> Tuple[str, Optional[str], Optional[str]]:
    """Ottiene l'URL base del sensore e le credenziali"""
    if sensor_name not in business_logic.sensors:
        raise HTTPException(status_code=404, detail=f"Sensore '{sensor_name}' non trovato")
    
    sensor = business_logic.sensors[sensor_name]
    if not sensor.config.ip:
        raise HTTPException(status_code=400, detail=f"Sensore '{sensor_name}' non ha un IP configurato")
    
    protocol = sensor.config.protocol or "http"
    port = f":{sensor.config.port}" if sensor.config.port else ""
    base_url = f"{protocol}://{sensor.config.ip}{port}"
    
    # Estrai username e password dalla config se presenti
    username = getattr(sensor.config, 'username', None)
    password = getattr(sensor.config, 'password', None)
    
    return base_url, username, password


def _get_auth_headers(username: Optional[str], password: Optional[str]) -> Dict[str, str]:
    """Crea le intestazioni di autenticazione HTTP Basic"""
    if username and password:
        credentials = f"{username}:{password}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return {"Authorization": f"Basic {encoded}"}
    return {}


async def _execute_shelly_rpc(
    base_url: str,
    method: str,
    params: Dict[str, Any],
    username: Optional[str] = None,
    password: Optional[str] = None
) -> Dict[str, Any]:
    """Esegue un comando RPC sul dispositivo Shelly Gen 3"""
    # Costruisci l'URL con i parametri come query string
    query_params = urlencode(params)
    url = f"{base_url}/rpc/{method}?{query_params}"
    
    headers = _get_auth_headers(username, password)
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as response:
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


# ========== ROUTE CONTROLLO RELÈ ==========

@router.post("/switch/set")
async def switch_set(
    request: SwitchSetRequest,
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """
    Accende o spegne il relè del dispositivo.
    
    Esempio:
    ```json
    {
        "sensor_name": "shelly_1pm_mini_01",
        "on": true,
        "auto_off": 30,
        "auto_on": null
    }
    ```
    """
    base_url, username, password = await _get_sensor_base_url(request.sensor_name, business_logic)
    
    params = {"id": "0", "on": str(request.on).lower()}
    
    if request.auto_off is not None:
        params["auto_off"] = str(request.auto_off)
    if request.auto_on is not None:
        params["auto_on"] = str(request.auto_on)
    
    result = await _execute_shelly_rpc(base_url, "Switch.Set", params, username, password)
    
    if not result["success"]:
        raise HTTPException(
            status_code=result.get("status_code", 500),
            detail=result.get("error", "Errore nell'esecuzione del comando")
        )
    
    return {
        "sensor_name": request.sensor_name,
        "action": "switch_set",
        "on": request.on,
        **result
    }


@router.post("/switch/toggle")
async def switch_toggle(
    request: SwitchToggleRequest,
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """
    Alterna lo stato on/off del relè.
    
    Esempio:
    ```json
    {
        "sensor_name": "shelly_1pm_mini_01"
    }
    ```
    """
    base_url, username, password = await _get_sensor_base_url(request.sensor_name, business_logic)
    
    params = {"id": "0"}
    
    result = await _execute_shelly_rpc(base_url, "Switch.Toggle", params, username, password)
    
    if not result["success"]:
        raise HTTPException(
            status_code=result.get("status_code", 500),
            detail=result.get("error", "Errore nell'esecuzione del comando")
        )
    
    return {
        "sensor_name": request.sensor_name,
        "action": "switch_toggle",
        **result
    }


@router.get("/switch/status")
async def switch_status(
    sensor_name: str = Query(..., description="Nome del sensore Shelly 1 PM Mini Gen 3"),
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """
    Legge lo stato corrente del relè.
    """
    base_url, username, password = await _get_sensor_base_url(sensor_name, business_logic)
    
    params = {"id": "0"}
    
    result = await _execute_shelly_rpc(base_url, "Switch.Get", params, username, password)
    
    if not result["success"]:
        raise HTTPException(
            status_code=result.get("status_code", 500),
            detail=result.get("error", "Errore nella lettura dello stato")
        )
    
    return {
        "sensor_name": sensor_name,
        "action": "switch_status",
        **result
    }


# ========== ROUTE MISURE ELETTRICHE ==========

@router.get("/status")
async def get_status(
    sensor_name: str = Query(..., description="Nome del sensore Shelly 1 PM Mini Gen 3"),
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """
    Legge lo stato completo del dispositivo, incluse le misure elettriche
    (potenza, energia, corrente, tensione).
    """
    base_url, username, password = await _get_sensor_base_url(sensor_name, business_logic)
    
    result = await _execute_shelly_rpc(base_url, "Shelly.GetStatus", {}, username, password)
    
    if not result["success"]:
        raise HTTPException(
            status_code=result.get("status_code", 500),
            detail=result.get("error", "Errore nella lettura dello stato")
        )
    
    return {
        "sensor_name": sensor_name,
        "action": "get_status",
        **result
    }


# ========== ROUTE INFORMAZIONI DISPOSITIVO ==========

@router.get("/device-info")
async def get_device_info(
    sensor_name: str = Query(..., description="Nome del sensore Shelly 1 PM Mini Gen 3"),
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """
    Legge le informazioni generali del dispositivo (modello, firmware, MAC, ecc.).
    """
    base_url, username, password = await _get_sensor_base_url(sensor_name, business_logic)
    
    result = await _execute_shelly_rpc(base_url, "Shelly.GetDeviceInfo", {}, username, password)
    
    if not result["success"]:
        raise HTTPException(
            status_code=result.get("status_code", 500),
            detail=result.get("error", "Errore nella lettura delle informazioni dispositivo")
        )
    
    return {
        "sensor_name": sensor_name,
        "action": "get_device_info",
        **result
    }


@router.get("/wifi-status")
async def get_wifi_status(
    sensor_name: str = Query(..., description="Nome del sensore Shelly 1 PM Mini Gen 3"),
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """
    Legge lo stato della connessione Wi-Fi (SSID, livello segnale, IP, ecc.).
    """
    base_url, username, password = await _get_sensor_base_url(sensor_name, business_logic)
    
    result = await _execute_shelly_rpc(base_url, "Shelly.GetWiFiStatus", {}, username, password)
    
    if not result["success"]:
        raise HTTPException(
            status_code=result.get("status_code", 500),
            detail=result.get("error", "Errore nella lettura dello stato Wi-Fi")
        )
    
    return {
        "sensor_name": sensor_name,
        "action": "get_wifi_status",
        **result
    }


@router.get("/sys-info")
async def get_sys_info(
    sensor_name: str = Query(..., description="Nome del sensore Shelly 1 PM Mini Gen 3"),
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """
    Legge le informazioni di sistema del dispositivo.
    """
    base_url, username, password = await _get_sensor_base_url(sensor_name, business_logic)
    
    result = await _execute_shelly_rpc(base_url, "Shelly.GetSysInfo", {}, username, password)
    
    if not result["success"]:
        raise HTTPException(
            status_code=result.get("status_code", 500),
            detail=result.get("error", "Errore nella lettura delle informazioni di sistema")
        )
    
    return {
        "sensor_name": sensor_name,
        "action": "get_sys_info",
        **result
    }


# ========== ROUTE TIMER AUTOMATICI ==========

@router.post("/switch/set-timer")
async def switch_set_timer(
    request: TimerRequest,
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """
    Imposta i timer automatici per il relè.
    
    Esempio:
    ```json
    {
        "sensor_name": "shelly_1pm_mini_01",
        "auto_off": 30,
        "auto_on": 120
    }
    ```
    """
    base_url, username, password = await _get_sensor_base_url(request.sensor_name, business_logic)
    
    params = {"id": "0"}
    
    if request.auto_off is not None:
        params["auto_off"] = str(request.auto_off)
    if request.auto_on is not None:
        params["auto_on"] = str(request.auto_on)
    
    result = await _execute_shelly_rpc(base_url, "Switch.Set", params, username, password)
    
    if not result["success"]:
        raise HTTPException(
            status_code=result.get("status_code", 500),
            detail=result.get("error", "Errore nell'impostazione del timer")
        )
    
    return {
        "sensor_name": request.sensor_name,
        "action": "switch_set_timer",
        "auto_off": request.auto_off,
        "auto_on": request.auto_on,
        **result
    }

