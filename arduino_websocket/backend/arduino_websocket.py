from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import asyncio
import websockets
import struct

router = APIRouter(prefix="/sensors/arduino-websocket", tags=["arduino"])

# Stato globale per ogni sensore
servers = {}  # Server WebSocket attivi
tasks = {}    # Task asyncio per i server
clients = {}  # Client connessi per sensore
data = {}     # Dati ricevuti (temperatura/umidità)

# Range porte plugin (10000-10099)
BASE_PORT = 10000


async def handle_client(websocket, path, sensor_name):
    """Gestisce un client WebSocket connesso"""
    clients[sensor_name].add(websocket)
    try:
        async for message in websocket:
            # Messaggio binario: [char][float(4 bytes)]
            if isinstance(message, bytes) and len(message) >= 5:
                data_type = chr(message[0])
                value = struct.unpack('<f', message[1:5])[0]
                
                # Aggiorna dati
                if data_type == 'T':
                    data[sensor_name]["temperature"] = value
                elif data_type == 'U':
                    data[sensor_name]["humidity"] = value
    except:
        pass
    finally:
        clients[sensor_name].discard(websocket)


async def run_server(sensor_name: str, port: int):
    """Avvia il server WebSocket"""
    async with websockets.serve(
        lambda ws, p: handle_client(ws, p, sensor_name),
        "0.0.0.0",
        port
    ):
        await asyncio.Future()  # Mantiene il server attivo


@router.post("/start/{sensor_name}")
async def start_server(sensor_name: str):
    """Avvia il server WebSocket per un sensore"""
    # Se già avviato, restituisci la porta
    if sensor_name in servers:
        return {"port": servers[sensor_name]}
    
    # Calcola porta fissa basata sul nome
    port = BASE_PORT + (hash(sensor_name) % 100)
    
    # Inizializza strutture dati
    clients[sensor_name] = set()
    data[sensor_name] = {"temperature": None, "humidity": None}
    servers[sensor_name] = port
    
    # Avvia server in background
    tasks[sensor_name] = asyncio.create_task(run_server(sensor_name, port))
    await asyncio.sleep(0.2)  # Attendi avvio
    
    return {"port": port}


@router.post("/command")
async def send_command(sensor_name: str, pin: int, state: bool):
    """Invia comando a Arduino (pin ON/OFF)"""
    # Verifica che ci sia almeno un client connesso
    if sensor_name not in clients or not clients[sensor_name]:
        raise HTTPException(status_code=404, detail="Arduino non connesso")
    
    # Costruisci comando binario: [char 'C'][uint16 pin][bool state]
    command = bytearray([ord('C')])
    command.extend(struct.pack('<H', pin))  # uint16 little-endian
    command.append(1 if state else 0)        # bool
    
    # Invia a tutti i client connessi
    await asyncio.gather(
        *[client.send(bytes(command)) for client in clients[sensor_name]],
        return_exceptions=True
    )
    
    return {"success": True, "pin": pin, "state": state}


@router.get("/data/{sensor_name}")
async def get_sensor_data(sensor_name: str):
    """Ottiene i dati attuali del sensore (temperatura/umidità)"""
    return data.get(sensor_name, {"temperature": None, "humidity": None})