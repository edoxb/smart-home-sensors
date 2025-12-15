import { useState, useEffect } from 'react'

interface Shelly1PMMiniGen3ControlProps {
  sensorName: string
}

interface SwitchStatus {
  output?: boolean
  source?: string
  temperature?: {
    tC?: number
    tF?: number
  }
}

interface MeterData {
  power?: number
  energy?: number
  current?: number
  voltage?: number
  pf?: number
}

interface DeviceInfo {
  name?: string
  id?: string
  mac?: string
  model?: string
  gen?: number
  fw_id?: string
  ver?: string
  app?: string
}

interface WiFiStatus {
  ssid?: string
  rssi?: number
  ip?: string
  connected?: boolean
}

interface StatusData {
  switch?: SwitchStatus
  meters?: MeterData[]
  device?: DeviceInfo
  wifi?: WiFiStatus
}

export default function Shelly1PMMiniGen3Control({ sensorName }: Shelly1PMMiniGen3ControlProps) {
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [status, setStatus] = useState<StatusData>({})
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({})
  const [wifiStatus, setWifiStatus] = useState<WiFiStatus>({})
  const [autoOff, setAutoOff] = useState<number>(0)
  const [autoOn, setAutoOn] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)

  const setLoadingState = (action: string, value: boolean) => {
    setLoading(prev => ({ ...prev, [action]: value }))
  }

  const callAPI = async (endpoint: string, body: any, actionName: string) => {
    setLoadingState(actionName, true)
    setError(null)
    try {
      const method = body ? 'POST' : 'GET'
      const url = body 
        ? `http://localhost:8000/sensors/shelly-1pm-mini-gen3${endpoint}`
        : `http://localhost:8000/sensors/shelly-1pm-mini-gen3${endpoint}?sensor_name=${encodeURIComponent(sensorName)}`
      
      const response = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify({ sensor_name: sensorName, ...body }) : undefined
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Errore nella richiesta')
      }
      
      const result = await response.json()
      console.log('Risultato:', result)
      
      // Aggiorna lo stato dopo ogni comando
      if (actionName.includes('switch') || actionName.includes('timer')) {
        await fetchStatus()
      }
      
      return result
    } catch (error) {
      console.error('Errore:', error)
      setError(error instanceof Error ? error.message : 'Errore sconosciuto')
      throw error
    } finally {
      setLoadingState(actionName, false)
    }
  }

  const fetchStatus = async () => {
    try {
      const result = await callAPI('/status', null, 'fetch_status')
      if (result.data) {
        setStatus(result.data)
        if (result.data.switch) {
          // Estrai timer se presenti
          const switchData = result.data.switch
          if (switchData.auto_off) setAutoOff(switchData.auto_off)
          if (switchData.auto_on) setAutoOn(switchData.auto_on)
        }
      }
    } catch (error) {
      console.error('Errore fetch status:', error)
    }
  }

  const fetchDeviceInfo = async () => {
    try {
      const result = await callAPI('/device-info', null, 'fetch_device_info')
      if (result.data) {
        setDeviceInfo(result.data)
      }
    } catch (error) {
      console.error('Errore fetch device info:', error)
    }
  }

  const fetchWiFiStatus = async () => {
    try {
      const result = await callAPI('/wifi-status', null, 'fetch_wifi_status')
      if (result.data) {
        setWifiStatus(result.data)
      }
    } catch (error) {
      console.error('Errore fetch wifi status:', error)
    }
  }

  useEffect(() => {
    fetchStatus()
    fetchDeviceInfo()
    fetchWiFiStatus()
    
    // Aggiorna ogni 5 secondi
    const interval = setInterval(() => {
      fetchStatus()
    }, 5000)
    
    return () => clearInterval(interval)
  }, [sensorName])

  const getPowerColor = (power?: number) => {
    if (!power) return '#757575'
    if (power > 1000) return '#F44336'
    if (power > 500) return '#FF9800'
    return '#4CAF50'
  }

  const getRSSIStrength = (rssi?: number) => {
    if (rssi === undefined) return 'N/A'
    if (rssi > -50) return 'Eccellente'
    if (rssi > -60) return 'Buono'
    if (rssi > -70) return 'Discreto'
    return 'Debole'
  }

  const meter = status.meters?.[0] || {}
  const switchData = status.switch || {}

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
          Shelly 1 PM Mini Gen 3: {sensorName}
        </h1>
        {error && (
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: '#F44336',
            borderRadius: '8px',
            color: '#FFFFFF'
          }}>
            Errore: {error}
          </div>
        )}
      </div>

      {/* Layout a griglia per fullscreen */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '2rem'
      }}>
        {/* Sezione Controllo Relè */}
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
            Controllo Relè
          </h2>
          
          {/* Stato attuale */}
          <div style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            backgroundColor: switchData.output ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
              Stato: <strong style={{ color: switchData.output ? '#4CAF50' : '#F44336' }}>
                {switchData.output ? 'ACCESO' : 'SPENTO'}
              </strong>
            </div>
            {switchData.temperature?.tC && (
              <div style={{ fontSize: '0.9rem', color: '#F4B342' }}>
                Temperatura: {switchData.temperature.tC.toFixed(1)}°C
              </div>
            )}
          </div>
          
          {/* Pulsanti controllo */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)', 
            gap: '1rem' 
          }}>
            <button
              onClick={() => callAPI('/switch/set', { on: true }, 'switch_on')}
              disabled={loading.switch_on}
              style={{
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: 'none',
                cursor: loading.switch_on ? 'not-allowed' : 'pointer',
                background: loading.switch_on 
                  ? 'linear-gradient(135deg, #8F0177, #360185)' 
                  : 'linear-gradient(135deg, #4CAF50, #45a049)',
                color: '#FFFFFF',
                opacity: loading.switch_on ? 0.7 : 1
              }}
            >
              {loading.switch_on ? '...' : 'Accendi'}
            </button>
            <button
              onClick={() => callAPI('/switch/set', { on: false }, 'switch_off')}
              disabled={loading.switch_off}
              style={{
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: 'none',
                cursor: loading.switch_off ? 'not-allowed' : 'pointer',
                background: loading.switch_off 
                  ? 'linear-gradient(135deg, #8F0177, #360185)' 
                  : 'linear-gradient(135deg, #DE1A58, #8F0177)',
                color: '#FFFFFF',
                opacity: loading.switch_off ? 0.7 : 1
              }}
            >
              {loading.switch_off ? '...' : 'Spegni'}
            </button>
            <button
              onClick={() => callAPI('/switch/toggle', {}, 'switch_toggle')}
              disabled={loading.switch_toggle}
              style={{
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: 'none',
                cursor: loading.switch_toggle ? 'not-allowed' : 'pointer',
                background: loading.switch_toggle 
                  ? 'linear-gradient(135deg, #8F0177, #360185)' 
                  : 'linear-gradient(135deg, #F4B342, #e6a63d)',
                color: '#FFFFFF',
                opacity: loading.switch_toggle ? 0.7 : 1
              }}
            >
              {loading.switch_toggle ? '...' : 'Toggle'}
            </button>
          </div>
        </div>

        {/* Sezione Misure Elettriche */}
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
            Misure Elettriche
          </h2>
          
          <div style={{ display: 'grid', gap: '1rem' }}>
            {/* Potenza */}
            <div style={{
              padding: '1rem',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              border: `2px solid ${getPowerColor(meter.power)}`
            }}>
              <div style={{ fontSize: '0.9rem', color: '#F4B342', marginBottom: '0.5rem' }}>
                Potenza
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: getPowerColor(meter.power) }}>
                {meter.power !== undefined ? `${meter.power.toFixed(1)} W` : 'N/A'}
              </div>
            </div>

            {/* Energia */}
            <div style={{
              padding: '1rem',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              border: '2px solid #4CAF50'
            }}>
              <div style={{ fontSize: '0.9rem', color: '#F4B342', marginBottom: '0.5rem' }}>
                Energia Totale
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4CAF50' }}>
                {meter.energy !== undefined ? `${(meter.energy / 1000).toFixed(2)} kWh` : 'N/A'}
              </div>
            </div>

            {/* Corrente e Tensione */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{
                padding: '1rem',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '8px',
                border: '2px solid #2196F3'
              }}>
                <div style={{ fontSize: '0.8rem', color: '#F4B342', marginBottom: '0.5rem' }}>
                  Corrente
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#2196F3' }}>
                  {meter.current !== undefined ? `${meter.current.toFixed(2)} A` : 'N/A'}
                </div>
              </div>
              <div style={{
                padding: '1rem',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '8px',
                border: '2px solid #FF9800'
              }}>
                <div style={{ fontSize: '0.8rem', color: '#F4B342', marginBottom: '0.5rem' }}>
                  Tensione
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#FF9800' }}>
                  {meter.voltage !== undefined ? `${meter.voltage.toFixed(1)} V` : 'N/A'}
                </div>
              </div>
            </div>

            {/* Power Factor */}
            {meter.pf !== undefined && (
              <div style={{
                padding: '1rem',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '8px',
                border: '2px solid #9C27B0'
              }}>
                <div style={{ fontSize: '0.8rem', color: '#F4B342', marginBottom: '0.5rem' }}>
                  Power Factor
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#9C27B0' }}>
                  {meter.pf.toFixed(2)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sezione Timer Automatici */}
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
            Timer Automatici
          </h2>
          
          {/* Auto Off */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              color: '#FFFFFF', 
              fontSize: '1rem',
              fontWeight: 'bold'
            }}>
              Auto Off (secondi)
            </label>
            <input
              type="number"
              min="0"
              value={autoOff}
              onChange={(e) => setAutoOff(parseInt(e.target.value) || 0)}
              style={{ 
                width: '100%', 
                padding: '0.5rem',
                borderRadius: '8px',
                border: '2px solid #8F0177',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                color: '#FFFFFF',
                fontSize: '1rem'
              }}
            />
            <button
              onClick={() => callAPI('/switch/set-timer', { auto_off: autoOff }, 'set_auto_off')}
              disabled={loading.set_auto_off}
              style={{
                marginTop: '0.5rem',
                width: '100%',
                padding: '0.75rem',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: 'none',
                cursor: loading.set_auto_off ? 'not-allowed' : 'pointer',
                background: loading.set_auto_off 
                  ? 'linear-gradient(135deg, #8F0177, #360185)' 
                  : 'linear-gradient(135deg, #F4B342, #e6a63d)',
                color: '#FFFFFF',
                opacity: loading.set_auto_off ? 0.7 : 1
              }}
            >
              {loading.set_auto_off ? '...' : `Imposta Auto Off (${autoOff}s)`}
            </button>
          </div>

          {/* Auto On */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              color: '#FFFFFF', 
              fontSize: '1rem',
              fontWeight: 'bold'
            }}>
              Auto On (secondi)
            </label>
            <input
              type="number"
              min="0"
              value={autoOn}
              onChange={(e) => setAutoOn(parseInt(e.target.value) || 0)}
              style={{ 
                width: '100%', 
                padding: '0.5rem',
                borderRadius: '8px',
                border: '2px solid #8F0177',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                color: '#FFFFFF',
                fontSize: '1rem'
              }}
            />
            <button
              onClick={() => callAPI('/switch/set-timer', { auto_on: autoOn }, 'set_auto_on')}
              disabled={loading.set_auto_on}
              style={{
                marginTop: '0.5rem',
                width: '100%',
                padding: '0.75rem',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: 'none',
                cursor: loading.set_auto_on ? 'not-allowed' : 'pointer',
                background: loading.set_auto_on 
                  ? 'linear-gradient(135deg, #8F0177, #360185)' 
                  : 'linear-gradient(135deg, #4CAF50, #45a049)',
                color: '#FFFFFF',
                opacity: loading.set_auto_on ? 0.7 : 1
              }}
            >
              {loading.set_auto_on ? '...' : `Imposta Auto On (${autoOn}s)`}
            </button>
          </div>
        </div>

        {/* Sezione Informazioni Dispositivo */}
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
            Informazioni Dispositivo
          </h2>
          
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {deviceInfo.name && (
              <div>
                <span style={{ color: '#F4B342', fontWeight: 'bold' }}>Nome: </span>
                <span style={{ color: '#FFFFFF' }}>{deviceInfo.name}</span>
              </div>
            )}
            {deviceInfo.model && (
              <div>
                <span style={{ color: '#F4B342', fontWeight: 'bold' }}>Modello: </span>
                <span style={{ color: '#FFFFFF' }}>{deviceInfo.model}</span>
              </div>
            )}
            {deviceInfo.mac && (
              <div>
                <span style={{ color: '#F4B342', fontWeight: 'bold' }}>MAC: </span>
                <span style={{ color: '#FFFFFF' }}>{deviceInfo.mac}</span>
              </div>
            )}
            {deviceInfo.ver && (
              <div>
                <span style={{ color: '#F4B342', fontWeight: 'bold' }}>Firmware: </span>
                <span style={{ color: '#FFFFFF' }}>{deviceInfo.ver}</span>
              </div>
            )}
            {deviceInfo.id && (
              <div>
                <span style={{ color: '#F4B342', fontWeight: 'bold' }}>ID: </span>
                <span style={{ color: '#FFFFFF' }}>{deviceInfo.id}</span>
              </div>
            )}
          </div>

          <button
            onClick={fetchDeviceInfo}
            disabled={loading.fetch_device_info}
            style={{
              marginTop: '1rem',
              width: '100%',
              padding: '0.75rem',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              borderRadius: '8px',
              border: 'none',
              cursor: loading.fetch_device_info ? 'not-allowed' : 'pointer',
              background: loading.fetch_device_info 
                ? 'linear-gradient(135deg, #8F0177, #360185)' 
                : 'linear-gradient(135deg, #2196F3, #1976D2)',
              color: '#FFFFFF',
              opacity: loading.fetch_device_info ? 0.7 : 1
            }}
          >
            {loading.fetch_device_info ? '...' : 'Aggiorna Info'}
          </button>
        </div>

        {/* Sezione Wi-Fi Status */}
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
            Stato Wi-Fi
          </h2>
          
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {wifiStatus.ssid && (
              <div>
                <span style={{ color: '#F4B342', fontWeight: 'bold' }}>SSID: </span>
                <span style={{ color: '#FFFFFF' }}>{wifiStatus.ssid}</span>
              </div>
            )}
            {wifiStatus.ip && (
              <div>
                <span style={{ color: '#F4B342', fontWeight: 'bold' }}>IP: </span>
                <span style={{ color: '#FFFFFF' }}>{wifiStatus.ip}</span>
              </div>
            )}
            {wifiStatus.rssi !== undefined && (
              <div>
                <span style={{ color: '#F4B342', fontWeight: 'bold' }}>RSSI: </span>
                <span style={{ color: '#FFFFFF' }}>{wifiStatus.rssi} dBm</span>
                <span style={{ color: '#F4B342', marginLeft: '0.5rem' }}>
                  ({getRSSIStrength(wifiStatus.rssi)})
                </span>
              </div>
            )}
            {wifiStatus.connected !== undefined && (
              <div>
                <span style={{ color: '#F4B342', fontWeight: 'bold' }}>Connesso: </span>
                <span style={{ 
                  color: wifiStatus.connected ? '#4CAF50' : '#F44336',
                  fontWeight: 'bold'
                }}>
                  {wifiStatus.connected ? 'Sì' : 'No'}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={fetchWiFiStatus}
            disabled={loading.fetch_wifi_status}
            style={{
              marginTop: '1rem',
              width: '100%',
              padding: '0.75rem',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              borderRadius: '8px',
              border: 'none',
              cursor: loading.fetch_wifi_status ? 'not-allowed' : 'pointer',
              background: loading.fetch_wifi_status 
                ? 'linear-gradient(135deg, #8F0177, #360185)' 
                : 'linear-gradient(135deg, #2196F3, #1976D2)',
              color: '#FFFFFF',
              opacity: loading.fetch_wifi_status ? 0.7 : 1
            }}
          >
            {loading.fetch_wifi_status ? '...' : 'Aggiorna Wi-Fi'}
          </button>
        </div>
      </div>
    </div>
  )
}

