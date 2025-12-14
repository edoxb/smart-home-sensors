from fastapi import APIRouter, HTTPException, Depends
from app.dependencies import get_business_logic
from app.services.business_logic import BusinessLogic

router = APIRouter(prefix="/sensors/arduino-grow-box", tags=["arduino_grow_box"])

@router.post("/{sensor_name}/pompa-aspirazione")
async def control_pompa_aspirazione(
    sensor_name: str,
    action: str,  # "on" o "off"
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """Controlla la pompa di aspirazione"""
    action_name = f"pompa_aspirazione_{action}"
    result = await business_logic.execute_sensor_action(sensor_name, action_name)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result

@router.post("/{sensor_name}/pompa-acqua")
async def control_pompa_acqua(
    sensor_name: str,
    action: str,
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """Controlla la pompa dell'acqua"""
    action_name = f"pompa_acqua_{action}"
    result = await business_logic.execute_sensor_action(sensor_name, action_name)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result

@router.post("/{sensor_name}/resistenza")
async def control_resistenza(
    sensor_name: str,
    action: str,
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """Controlla la resistenza scaldante"""
    action_name = f"resistenza_{action}"
    result = await business_logic.execute_sensor_action(sensor_name, action_name)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result

@router.post("/{sensor_name}/luce-led")
async def control_luce_led(
    sensor_name: str,
    action: str,
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """Controlla la luce LED"""
    action_name = f"luce_led_{action}"
    result = await business_logic.execute_sensor_action(sensor_name, action_name)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result

@router.post("/{sensor_name}/ventola")
async def control_ventola(
    sensor_name: str,
    action: str,
    business_logic: BusinessLogic = Depends(get_business_logic)
):
    """Controlla la ventola"""
    action_name = f"ventola_{action}"
    result = await business_logic.execute_sensor_action(sensor_name, action_name)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return result