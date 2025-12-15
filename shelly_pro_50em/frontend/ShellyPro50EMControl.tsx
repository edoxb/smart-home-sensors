import { useState, useEffect } from 'react'

interface ShellyPro50EMControlProps {
  sensorName: string
}

interface EnergyMeterData {
  id?: number
  act_power?: number
  voltage?: number
  current?: number
  power_factor?: number
  total_act_energy?: number
  total_act_energy_returned?: number
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

interface StatusData {
  em1?: {
    "0"?: EnergyMeterData
    "1"?: EnergyMeterData
  }
  device?: DeviceInfo
  sys?: {
    available_updates?: any
    mac?: string
    restart_required?: boolean
  }
  wifi?: {
    ssid?: string
    rssi?: number
    ip?: string
    connected?: boolean
  }
}

export default function ShellyPro50EMControl({ sensorName }: ShellyPro50EMControlProps) {
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [status, setStatus] = useState<StatusData>({})
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
        ? `http://localhost:8000/sensors/shelly-pro-50em${endpoint}`
        : `http://localhost:8000/sensors/shelly-pro-50em${endpoint}?sensor_name=${encodeURIComponent(sensorName)}`
      
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
      
      if (actionName === 'fetch_status' && result.data) {
        setStatus(result.data)
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
      await callAPI('/status', null, 'fetch_status')
    } catch (error) {
      console.error('Errore fetch status:', error)
    }
  }

  const sendRPCCommand = async (method: string, params: any = {}) => {
    try {
      await callAPI('/rpc', { method, params }, 'rpc_command')
      // Aggiorna lo stato dopo il comando
      setTimeout(() => fetchStatus(), 1000)
    } catch (error) {
      console.error('Errore comando RPC:', error)
    }
  }

  useEffect(() => {
    fetchStatus()
    
    // Aggiorna ogni 5 secondi
    const interval = setInterval(() => {
      fetchStatus()
    }, 5000)
    
    return () => clearInterval(interval)
  }, [sensorName])

  const getPowerColor = (power?: number) => {
    if (!power) return '#757575'
    if (power > 5000) return '#F44336'
    if (power > 2000) return '#FF9800'
    return '#4CAF50'
  }

  const getRSSIStrength = (rssi?: number) => {
    if (rssi === undefined) return 'N/A'
    if (rssi > -50) return 'Eccellente'
    if (rssi > -60) return 'Buono'
    if (rssi > -70) return 'Discreto'
    return 'Debole'
  }

  const channel0 = status.em1?.["0"] || {}
  const channel1 = status.em1?.["1"] || {}

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

      {/* Layout a griglia */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '2rem'
      }}>
        {/* Canale 1 - Misure Elettriche */}
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
            Canale 1 - Misure Elettriche
          </h2>
          
          <div style={{ display: 'grid', gap: '1rem' }}>
            {/* Potenza */}
            <div style={{
              padding: '1rem',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              border: `2px solid ${getPowerColor(channel0.act_power)}`
            }}>
              <div style={{ fontSize: '0.9rem', color: '#F4B342', marginBottom: '0.5rem' }}>
                Potenza Attiva
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: getPowerColor(channel0.act_power) }}>
                {channel0.act_power !== undefined ? `${channel0.act_power.toFixed(1)} W` : 'N/A'}
              </div>
            </div>

            {/* Energia Totale */}
            {channel0.total_act_energy !== undefined && (
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
                  {(channel0.total_act_energy / 1000).toFixed(2)} kWh
                </div>
              </div>
            )}

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
                  {channel0.current !== undefined ? `${channel0.current.toFixed(2)} A` : 'N/A'}
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
                  {channel0.voltage !== undefined ? `${channel0.voltage.toFixed(1)} V` : 'N/A'}
                </div>
              </div>
            </div>

            {/* Power Factor */}
            {channel0.power_factor !== undefined && (
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
                  {channel0.power_factor.toFixed(2)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Canale 2 - Misure Elettriche */}
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
            Canale 2 - Misure Elettriche
          </h2>
          
          <div style={{ display: 'grid', gap: '1rem' }}>
            {/* Potenza */}
            <div style={{
              padding: '1rem',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              border: `2px solid ${getPowerColor(channel1.act_power)}`
            }}>
              <div style={{ fontSize: '0.9rem', color: '#F4B342', marginBottom: '0.5rem' }}>
                Potenza Attiva
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: getPowerColor(channel1.act_power) }}>
                {channel1.act_power !== undefined ? `${channel1.act_power.toFixed(1)} W` : 'N/A'}
              </div>
            </div>

            {/* Energia Totale */}
            {channel1.total_act_energy !== undefined && (
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
                  {(channel1.total_act_energy / 1000).toFixed(2)} kWh
                </div>
              </div>
            )}

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
                  {channel1.current !== undefined ? `${channel1.current.toFixed(2)} A` : 'N/A'}
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
                  {channel1.voltage !== undefined ? `${channel1.voltage.toFixed(1)} V` : 'N/A'}
                </div>
              </div>
            </div>

            {/* Power Factor */}
            {channel1.power_factor !== undefined && (
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
                  {channel1.power_factor.toFixed(2)}
                </div>
              </div>
            )}
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
            {status.device?.name && (
              <div>
                <span style={{ color: '#F4B342', fontWeight: 'bold' }}>Nome: </span>
                <span style={{ color: '#FFFFFF' }}>{status.device.name}</span>
              </div>
            )}
            {status.device?.model && (
              <div>
                <span style={{ color: '#F4B342', fontWeight: 'bold' }}>Modello: </span>
                <span style={{ color: '#FFFFFF' }}>{status.device.model}</span>
              </div>
            )}
            {status.sys?.mac && (
              <div>
                <span style={{ color: '#F4B342', fontWeight: 'bold' }}>MAC: </span>
                <span style={{ color: '#FFFFFF' }}>{status.sys.mac}</span>
              </div>
            )}
            {status.device?.ver && (
              <div>
                <span style={{ color: '#F4B342', fontWeight: 'bold' }}>Firmware: </span>
                <span style={{ color: '#FFFFFF' }}>{status.device.ver}</span>
              </div>
            )}
            {status.device?.id && (
              <div>
                <span style={{ color: '#F4B342', fontWeight: 'bold' }}>ID: </span>
                <span style={{ color: '#FFFFFF' }}>{status.device.id}</span>
              </div>
            )}
          </div>

          <button
            onClick={() => sendRPCCommand('Shelly.GetStatus', {})}
            disabled={loading.rpc_command}
            style={{
              marginTop: '1rem',
              width: '100%',
              padding: '0.75rem',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              borderRadius: '8px',
              border: 'none',
              cursor: loading.rpc_command ? 'not-allowed' : 'pointer',
              background: loading.rpc_command 
                ? 'linear-gradient(135deg, #8F0177, #360185)' 
                : 'linear-gradient(135deg, #2196F3, #1976D2)',
              color: '#FFFFFF',
              opacity: loading.rpc_command ? 0.7 : 1
            }}
          >
            {loading.rpc_command ? '...' : 'Aggiorna Stato'}
          </button>
        </div>

        {/* Sezione Wi-Fi Status */}
        {status.wifi && (
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
              {status.wifi.ssid && (
                <div>
                  <span style={{ color: '#F4B342', fontWeight: 'bold' }}>SSID: </span>
                  <span style={{ color: '#FFFFFF' }}>{status.wifi.ssid}</span>
                </div>
              )}
              {status.wifi.ip && (
                <div>
                  <span style={{ color: '#F4B342', fontWeight: 'bold' }}>IP: </span>
                  <span style={{ color: '#FFFFFF' }}>{status.wifi.ip}</span>
                </div>
              )}
              {status.wifi.rssi !== undefined && (
                <div>
                  <span style={{ color: '#F4B342', fontWeight: 'bold' }}>RSSI: </span>
                  <span style={{ color: '#FFFFFF' }}>{status.wifi.rssi} dBm</span>
                  <span style={{ color: '#F4B342', marginLeft: '0.5rem' }}>
                    ({getRSSIStrength(status.wifi.rssi)})
                  </span>
                </div>
              )}
              {status.wifi.connected !== undefined && (
                <div>
                  <span style={{ color: '#F4B342', fontWeight: 'bold' }}>Connesso: </span>
                  <span style={{ 
                    color: status.wifi.connected ? '#4CAF50' : '#F44336',
                    fontWeight: 'bold'
                  }}>
                    {status.wifi.connected ? 'Sì' : 'No'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}