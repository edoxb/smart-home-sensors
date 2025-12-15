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

  const fetchStatus = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `http://localhost:8000/sensors/shelly-pro-50em/status?sensor_name=${encodeURIComponent(sensorName)}`
      )
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Errore nella richiesta')
      }
      
      const result = await response.json()
      console.log('📊 Dati Shelly Pro 50EM:', result)
      
      if (result.success && result.data) {
        setStatus(result.data)
      }
    } catch (error) {
      console.error('Errore fetch status:', error)
      setError(error instanceof Error ? error.message : 'Errore sconosciuto')
    } finally {
      setLoading(false)
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

  const channel0 = status.channels["0"]
  const channel1 = status.channels["1"]
  const energy0 = status.energy_data["0"]
  const energy1 = status.energy_data["1"]

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
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: getPowerColor(channel0.act_power) }}>
                  {channel0.act_power.toFixed(1)} W
                </div>
                <div style={{ fontSize: '0.9rem', color: '#F4B342', marginTop: '0.5rem' }}>
                  Potenza Attiva
                </div>
              </div>

              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#F4B342' }}>Tensione:</span>
                  <strong>{channel0.voltage.toFixed(1)} V</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#F4B342' }}>Corrente:</span>
                  <strong>{channel0.current.toFixed(3)} A</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#F4B342' }}>Potenza Apparente:</span>
                  <strong>{channel0.aprt_power.toFixed(1)} VA</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#F4B342' }}>Power Factor:</span>
                  <strong>{channel0.pf.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#F4B342' }}>Frequenza:</span>
                  <strong>{channel0.freq.toFixed(1)} Hz</strong>
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
                      {formatEnergy(energy0.total_act_energy)}
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
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: getPowerColor(channel1.act_power) }}>
                  {channel1.act_power.toFixed(1)} W
                </div>
                <div style={{ fontSize: '0.9rem', color: '#F4B342', marginTop: '0.5rem' }}>
                  Potenza Attiva
                </div>
              </div>

              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#F4B342' }}>Tensione:</span>
                  <strong>{channel1.voltage.toFixed(1)} V</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#F4B342' }}>Corrente:</span>
                  <strong>{channel1.current.toFixed(3)} A</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#F4B342' }}>Potenza Apparente:</span>
                  <strong>{channel1.aprt_power.toFixed(1)} VA</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#F4B342' }}>Power Factor:</span>
                  <strong>{channel1.pf.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#F4B342' }}>Frequenza:</span>
                  <strong>{channel1.freq.toFixed(1)} Hz</strong>
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
                      {formatEnergy(energy1.total_act_energy)}
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