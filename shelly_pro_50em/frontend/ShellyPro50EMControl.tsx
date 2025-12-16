import { useState, useEffect } from 'react'

interface ShellyPro50EMControlProps {
  sensorName: string
}

interface ChannelData {
  id: number
  act_power: number
  aprt_power: number
  voltage: number
  current: number
  pf: number
  freq: number
  calibration?: string
}

interface EnergyData {
  id: number
  total_act_energy: number
  total_act_ret_energy: number
}

interface StatusData {
  channels: {
    "0"?: ChannelData
    "1"?: ChannelData
  }
  energy_data: {
    "0"?: EnergyData
    "1"?: EnergyData
  }
  wifi?: {
    ssid?: string
    rssi?: number
    sta_ip?: string
    status?: string
  }
  sys?: {
    mac?: string
    time?: string
    uptime?: number
  }
  device?: any
  mqtt?: {
    connected?: boolean
  }
  ts?: number
}

export default function ShellyPro50EMControl({ sensorName }: ShellyPro50EMControlProps) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<StatusData>({
    channels: {},
    energy_data: {}
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null
    let isMounted = true
    
    const fetchStatus = async () => {
      try {
        const response = await fetch(
          `http://localhost:8000/sensors/shelly-pro-50em/status?sensor_name=${encodeURIComponent(sensorName)}`
        )
        
        if (!response.ok) {
          throw new Error(`Errore HTTP! status: ${response.status}`)
        }
        
        const result = await response.json()
        
        if (!isMounted) return
        
        console.log('📊 Dati Shelly Pro 50EM (HTTP):', result)
        
        if (result.success && result.data) {
          // Estrai i dati formattati
          const newData = extractShellyData(result.data)
          
          // Aggiorna lo stato con i nuovi dati
          setStatus(prevStatus => {
            const merged: StatusData = {
              channels: {
                "0": newData.channels?.["0"] || prevStatus.channels?.["0"],
                "1": newData.channels?.["1"] || prevStatus.channels?.["1"]
              },
              energy_data: {
                "0": newData.energy_data?.["0"] || prevStatus.energy_data?.["0"],
                "1": newData.energy_data?.["1"] || prevStatus.energy_data?.["1"]
              },
              wifi: newData.wifi || prevStatus.wifi || {},
              sys: newData.sys || prevStatus.sys || {},
              device: newData.device || prevStatus.device || {},
              mqtt: newData.mqtt || prevStatus.mqtt || {},
              ts: newData.ts !== undefined ? newData.ts : prevStatus.ts
            }
            
            return merged
          })
          
          setError(null)
          setLoading(false)
        }
      } catch (error) {
        if (!isMounted) return
        
        console.error('Errore nel fetch dei dati:', error)
        setError(error instanceof Error ? error.message : 'Errore nel caricamento dei dati')
        setLoading(false)
      }
    }
    
    // Carica i dati immediatamente
    setLoading(true)
    fetchStatus()
    
    // Polling ogni 2 secondi
    intervalId = setInterval(fetchStatus, 2000)
    
    // Cleanup
    return () => {
      isMounted = false
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [sensorName])

  const getPowerColor = (power?: number) => {
    if (!power) return '#757575'
    if (power > 2000) return '#F44336'
    if (power > 1000) return '#FF9800'
    return '#4CAF50'
  }

  const formatEnergy = (wh: number) => {
    if (wh >= 1000) {
      return `${(wh / 1000).toFixed(2)} kWh`
    }
    return `${wh.toFixed(0)} Wh`
  }

  // Funzione per estrarre i dati dal formato RPC Shelly se necessario
  // Restituisce solo i dati estratti (parziali), non una struttura completa
  const extractShellyData = (data: any): Partial<StatusData> => {
    const extracted: Partial<StatusData> = {}

    // Se i dati sono già nel formato corretto (hanno channels e energy_data)
    if (data.channels && data.energy_data) {
      return {
        channels: data.channels || {},
        energy_data: data.energy_data || {},
        wifi: data.wifi,
        sys: data.sys,
        device: data.device,
        mqtt: data.mqtt,
        ts: data.ts
      }
    }

    // Se i dati sono nel formato RPC grezzo (hanno method e params)
    if (data.method && data.params) {
      const params = data.params

      // Gestisci NotifyEvent con events array
      if (data.method === "NotifyEvent" && params.events && Array.isArray(params.events)) {
        for (const event of params.events) {
          if (event.component && event.data) {
            // Gestisci em1data:0 o em1data:1
            if (event.component.startsWith("em1data:")) {
              const channelId = event.component.split(":")[1] as "0" | "1" // "0" o "1"
              const eventData = event.data
              
              if (eventData.values && Array.isArray(eventData.values) && eventData.values.length > 0) {
                const values = eventData.values[0] // Prendi il primo array di valori
                // Formato values: [total_act_energy, total_act_ret_energy, ..., act_power, ..., voltage, ..., current, ...]
                // Secondo la documentazione Shelly, per em1data:
                // [0] = total_act_energy (kWh, da convertire in Wh)
                // [1] = total_act_ret_energy (kWh, da convertire in Wh)
                // [4] = act_power (W)
                // [6] = aprt_power (VA)
                // [7] = voltage (V)
                // [11] = current (A)
                
                if (!extracted.energy_data) extracted.energy_data = {}
                extracted.energy_data[channelId] = {
                  id: event.id || parseInt(channelId),
                  total_act_energy: values[0] ? values[0] * 1000 : 0, // Converti da kWh a Wh
                  total_act_ret_energy: values[1] ? values[1] * 1000 : 0
                }

                // Aggiorna anche i dati del canale se disponibili
                if (!extracted.channels) extracted.channels = {}
                if (!extracted.channels[channelId]) {
                  extracted.channels[channelId] = {
                    id: event.id || parseInt(channelId),
                    act_power: 0,
                    aprt_power: 0,
                    voltage: 0,
                    current: 0,
                    pf: 0,
                    freq: 0
                  }
                }
                if (values[4] !== undefined) extracted.channels[channelId]!.act_power = values[4]
                if (values[6] !== undefined) extracted.channels[channelId]!.aprt_power = values[6]
                if (values[7] !== undefined) extracted.channels[channelId]!.voltage = values[7]
                if (values[11] !== undefined) extracted.channels[channelId]!.current = values[11]
              }
            }
            // Gestisci em1:0 o em1:1 (se presenti negli eventi)
            else if (event.component.startsWith("em1:")) {
              const channelId = event.component.split(":")[1] as "0" | "1"
              if (event.data && typeof event.data === 'object') {
                if (!extracted.channels) extracted.channels = {}
                extracted.channels[channelId] = {
                  id: event.id || parseInt(channelId),
                  act_power: event.data.act_power || 0,
                  aprt_power: event.data.aprt_power || 0,
                  voltage: event.data.voltage || 0,
                  current: event.data.current || 0,
                  pf: event.data.pf || 0,
                  freq: event.data.freq || 0,
                  calibration: event.data.calibration
                }
              }
            }
          }
        }
        
        // Aggiungi altre informazioni se presenti
        if (params.wifi) extracted.wifi = params.wifi
        if (params.sys) extracted.sys = params.sys
        if (params.device) extracted.device = params.device
        if (params.mqtt) extracted.mqtt = params.mqtt
        if (params.ts) extracted.ts = params.ts
        
        return extracted
      }

      // Gestisci NotifyStatus o altri metodi
      // Estrai canale 0 (em1:0)
      if (params["em1:0"]) {
        const em1_0 = params["em1:0"]
        if (!extracted.channels) extracted.channels = {}
        extracted.channels["0"] = {
          id: em1_0.id || 0,
          act_power: em1_0.act_power || 0,
          aprt_power: em1_0.aprt_power || 0,
          voltage: em1_0.voltage || 0,
          current: em1_0.current || 0,
          pf: em1_0.pf || 0,
          freq: em1_0.freq || 0,
          calibration: em1_0.calibration
        }
      }

      // Estrai canale 1 (em1:1)
      if (params["em1:1"]) {
        const em1_1 = params["em1:1"]
        if (!extracted.channels) extracted.channels = {}
        extracted.channels["1"] = {
          id: em1_1.id || 1,
          act_power: em1_1.act_power || 0,
          aprt_power: em1_1.aprt_power || 0,
          voltage: em1_1.voltage || 0,
          current: em1_1.current || 0,
          pf: em1_1.pf || 0,
          freq: em1_1.freq || 0,
          calibration: em1_1.calibration
        }
      }

      // Estrai dati energia 0 (em1data:0)
      if (params["em1data:0"]) {
        const em1data_0 = params["em1data:0"]
        if (!extracted.energy_data) extracted.energy_data = {}
        extracted.energy_data["0"] = {
          id: em1data_0.id || 0,
          total_act_energy: em1data_0.total_act_energy || 0,
          total_act_ret_energy: em1data_0.total_act_ret_energy || 0
        }
      }

      // Estrai dati energia 1 (em1data:1)
      if (params["em1data:1"]) {
        const em1data_1 = params["em1data:1"]
        if (!extracted.energy_data) extracted.energy_data = {}
        extracted.energy_data["1"] = {
          id: em1data_1.id || 1,
          total_act_energy: em1data_1.total_act_energy || 0,
          total_act_ret_energy: em1data_1.total_act_ret_energy || 0
        }
      }

      // Aggiungi altre informazioni se presenti
      if (params.wifi) extracted.wifi = params.wifi
      if (params.sys) extracted.sys = params.sys
      if (params.device) extracted.device = params.device
      if (params.mqtt) extracted.mqtt = params.mqtt
      if (params.ts) extracted.ts = params.ts

      return extracted
    }

    // Se i dati sono già solo params (senza method)
    if (data["em1:0"] || data["em1:1"]) {
      const formatted: StatusData = {
        channels: {},
        energy_data: {},
        wifi: data.wifi || {},
        sys: data.sys || {},
        device: data.device || {},
        mqtt: data.mqtt || {},
        ts: data.ts
      }

      if (data["em1:0"]) {
        const em1_0 = data["em1:0"]
        formatted.channels["0"] = {
          id: em1_0.id || 0,
          act_power: em1_0.act_power || 0,
          aprt_power: em1_0.aprt_power || 0,
          voltage: em1_0.voltage || 0,
          current: em1_0.current || 0,
          pf: em1_0.pf || 0,
          freq: em1_0.freq || 0,
          calibration: em1_0.calibration
        }
      }

      if (data["em1:1"]) {
        const em1_1 = data["em1:1"]
        formatted.channels["1"] = {
          id: em1_1.id || 1,
          act_power: em1_1.act_power || 0,
          aprt_power: em1_1.aprt_power || 0,
          voltage: em1_1.voltage || 0,
          current: em1_1.current || 0,
          pf: em1_1.pf || 0,
          freq: em1_1.freq || 0,
          calibration: em1_1.calibration
        }
      }

      if (data["em1data:0"]) {
        const em1data_0 = data["em1data:0"]
        formatted.energy_data["0"] = {
          id: em1data_0.id || 0,
          total_act_energy: em1data_0.total_act_energy || 0,
          total_act_ret_energy: em1data_0.total_act_ret_energy || 0
        }
      }

      if (data["em1data:1"]) {
        const em1data_1 = data["em1data:1"]
        formatted.energy_data["1"] = {
          id: em1data_1.id || 1,
          total_act_energy: em1data_1.total_act_energy || 0,
          total_act_ret_energy: em1data_1.total_act_ret_energy || 0
        }
      }

      return formatted
    }

    // Fallback: restituisci struttura vuota
    return {
      channels: {},
      energy_data: {},
      wifi: {},
      sys: {},
      device: {},
      mqtt: {}
    }
  }

  // Estrai i dati con controlli di sicurezza
  const channel0 = status?.channels?.["0"]
  const channel1 = status?.channels?.["1"]
  const energy0 = status?.energy_data?.["0"]
  const energy1 = status?.energy_data?.["1"]

  // Gestione errori per evitare crash
  if (error) {
    return (
      <div style={{
        width: '100%',
        minHeight: '100vh',
        padding: '2rem',
        backgroundColor: '#360185',
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          padding: '2rem',
          backgroundColor: '#F44336',
          borderRadius: '12px',
          maxWidth: '600px',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#FFFFFF', marginBottom: '1rem' }}>Errore</h2>
          <p style={{ color: '#FFFFFF', marginBottom: '1rem' }}>{error}</p>
          <button
            onClick={() => window.history.back()}
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: '#DE1A58',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            ← Torna Indietro
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      padding: '2rem',
      backgroundColor: '#360185',
      color: '#FFFFFF'
    }}>
      {/* Header */}
      <div style={{ 
        marginBottom: '2rem', 
        borderBottom: '2px solid #F4B342', 
        paddingBottom: '1rem' 
      }}>
        <h1 style={{ color: '#F4B342', fontSize: '2rem', margin: 0 }}>
          Shelly Pro 50EM: {sensorName}
        </h1>
        {loading && (
          <div style={{ marginTop: '1rem', color: '#F4B342' }}>
            Caricamento...
          </div>
        )}
      </div>

      {/* Layout a griglia */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '2rem'
      }}>
        {/* Canale 0 */}
        <div style={{ 
          padding: '2rem',
          borderRadius: '12px',
          border: '2px solid #8F0177',
          background: 'linear-gradient(135deg, rgba(143, 1, 119, 0.3), rgba(54, 1, 133, 0.2))'
        }}>
          <h2 style={{ 
            color: '#F4B342', 
            marginTop: 0, 
            marginBottom: '1.5rem', 
            fontSize: '1.5rem' 
          }}>
            Canale 1
          </h2>
          
          {channel0 ? (
            <>
              <div style={{
                marginBottom: '1rem',
                padding: '1rem',
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: getPowerColor(channel0?.act_power) }}>
                  {channel0?.act_power?.toFixed(1) || '0.0'} W
                </div>
                <div style={{ fontSize: '0.9rem', color: '#F4B342', marginTop: '0.5rem' }}>
                  Potenza Attiva
                </div>
              </div>

              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#F4B342' }}>Tensione:</span>
                  <strong>{channel0?.voltage?.toFixed(1) || '0.0'} V</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#F4B342' }}>Corrente:</span>
                  <strong>{channel0?.current?.toFixed(3) || '0.000'} A</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#F4B342' }}>Potenza Apparente:</span>
                  <strong>{channel0?.aprt_power?.toFixed(1) || '0.0'} VA</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#F4B342' }}>Power Factor:</span>
                  <strong>{channel0?.pf?.toFixed(2) || '0.00'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#F4B342' }}>Frequenza:</span>
                  <strong>{channel0?.freq?.toFixed(1) || '0.0'} Hz</strong>
                </div>
                {energy0 && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    backgroundColor: 'rgba(244, 179, 66, 0.2)',
                    borderRadius: '8px',
                    borderTop: '2px solid #F4B342'
                  }}>
                    <div style={{ color: '#F4B342', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                      Energia Totale
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                      {formatEnergy(energy0?.total_act_energy || 0)}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
              Nessun dato disponibile per il canale 1
            </div>
          )}
        </div>

        {/* Canale 1 */}
        <div style={{ 
          padding: '2rem',
          borderRadius: '12px',
          border: '2px solid #8F0177',
          background: 'linear-gradient(135deg, rgba(143, 1, 119, 0.3), rgba(54, 1, 133, 0.2))'
        }}>
          <h2 style={{ 
            color: '#F4B342', 
            marginTop: 0, 
            marginBottom: '1.5rem', 
            fontSize: '1.5rem' 
          }}>
            Canale 2
          </h2>
          
          {channel1 ? (
            <>
              <div style={{
                marginBottom: '1rem',
                padding: '1rem',
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: getPowerColor(channel1?.act_power) }}>
                  {channel1?.act_power?.toFixed(1) || '0.0'} W
                </div>
                <div style={{ fontSize: '0.9rem', color: '#F4B342', marginTop: '0.5rem' }}>
                  Potenza Attiva
                </div>
              </div>

              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#F4B342' }}>Tensione:</span>
                  <strong>{channel1?.voltage?.toFixed(1) || '0.0'} V</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#F4B342' }}>Corrente:</span>
                  <strong>{channel1?.current?.toFixed(3) || '0.000'} A</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#F4B342' }}>Potenza Apparente:</span>
                  <strong>{channel1?.aprt_power?.toFixed(1) || '0.0'} VA</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#F4B342' }}>Power Factor:</span>
                  <strong>{channel1?.pf?.toFixed(2) || '0.00'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#F4B342' }}>Frequenza:</span>
                  <strong>{channel1?.freq?.toFixed(1) || '0.0'} Hz</strong>
                </div>
                {energy1 && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    backgroundColor: 'rgba(244, 179, 66, 0.2)',
                    borderRadius: '8px',
                    borderTop: '2px solid #F4B342'
                  }}>
                    <div style={{ color: '#F4B342', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                      Energia Totale
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                      {formatEnergy(energy1?.total_act_energy || 0)}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
              Nessun dato disponibile per il canale 2
            </div>
          )}
        </div>

        {/* Info Sistema */}
        {(status.wifi || status.sys) && (
          <div style={{ 
            padding: '2rem',
            borderRadius: '12px',
            border: '2px solid #8F0177',
            background: 'linear-gradient(135deg, rgba(143, 1, 119, 0.3), rgba(54, 1, 133, 0.2))'
          }}>
            <h2 style={{ 
              color: '#F4B342', 
              marginTop: 0, 
              marginBottom: '1.5rem', 
              fontSize: '1.5rem' 
            }}>
              Informazioni Sistema
            </h2>
            
            {status.wifi && (
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ color: '#F4B342', fontSize: '1.1rem', marginBottom: '0.5rem' }}>WiFi</h3>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {status.wifi.ssid && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>SSID:</span>
                      <strong>{status.wifi.ssid}</strong>
                    </div>
                  )}
                  {status.wifi.sta_ip && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>IP:</span>
                      <strong>{status.wifi.sta_ip}</strong>
                    </div>
                  )}
                  {status.wifi.rssi !== undefined && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>RSSI:</span>
                      <strong>{status.wifi.rssi} dBm</strong>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {status.sys && (
              <div>
                <h3 style={{ color: '#F4B342', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Sistema</h3>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {status.sys.mac && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>MAC:</span>
                      <strong style={{ fontFamily: 'monospace' }}>{status.sys.mac}</strong>
                    </div>
                  )}
                  {status.sys.uptime !== undefined && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Uptime:</span>
                      <strong>{status.sys.uptime} secondi</strong>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pulsante Chiudi */}
      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <button
          onClick={() => window.history.back()}
          style={{
            padding: '0.75rem 2rem',
            backgroundColor: '#DE1A58',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '1rem'
          }}
        >
          ← Torna Indietro
        </button>
      </div>
    </div>
  )
}