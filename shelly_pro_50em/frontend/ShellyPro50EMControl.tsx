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
        // Estrai e formatta i dati (gestisce sia formato formattato che RPC grezzo)
        const formattedData = extractShellyData(result.data)
        setStatus(formattedData)
      } else {
        // Se non ci sono dati, mantieni la struttura vuota
        setStatus({
          channels: {},
          energy_data: {},
          wifi: {},
          sys: {},
          device: {},
          mqtt: {}
        })
      }
    } catch (error) {
      console.error('Errore fetch status:', error)
      setError(error instanceof Error ? error.message : 'Errore sconosciuto')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Esegui subito il fetch
    fetchStatus().catch(err => {
      console.error('Errore nel fetch iniziale:', err)
      setError('Errore nel caricamento dei dati')
    })
    
    // Aggiorna ogni 5 secondi
    const interval = setInterval(() => {
      fetchStatus().catch(err => {
        console.error('Errore nel fetch periodico:', err)
        // Non impostare error per i fetch periodici, solo log
      })
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

  // Funzione per estrarre i dati dal formato RPC Shelly se necessario
  const extractShellyData = (data: any): StatusData => {
    // Se i dati sono già nel formato corretto (hanno channels e energy_data)
    if (data.channels && data.energy_data) {
      return {
        channels: data.channels || {},
        energy_data: data.energy_data || {},
        wifi: data.wifi || {},
        sys: data.sys || {},
        device: data.device || {},
        mqtt: data.mqtt || {},
        ts: data.ts
      }
    }

    // Se i dati sono nel formato RPC grezzo (hanno method e params)
    if (data.method && data.params) {
      const params = data.params
      const formatted: StatusData = {
        channels: {},
        energy_data: {},
        wifi: params.wifi || {},
        sys: params.sys || {},
        device: params.device || {},
        mqtt: params.mqtt || {},
        ts: params.ts
      }

      // Estrai canale 0 (em1:0)
      if (params["em1:0"]) {
        const em1_0 = params["em1:0"]
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

      // Estrai canale 1 (em1:1)
      if (params["em1:1"]) {
        const em1_1 = params["em1:1"]
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

      // Estrai dati energia 0 (em1data:0)
      if (params["em1data:0"]) {
        const em1data_0 = params["em1data:0"]
        formatted.energy_data["0"] = {
          id: em1data_0.id || 0,
          total_act_energy: em1data_0.total_act_energy || 0,
          total_act_ret_energy: em1data_0.total_act_ret_energy || 0
        }
      }

      // Estrai dati energia 1 (em1data:1)
      if (params["em1data:1"]) {
        const em1data_1 = params["em1data:1"]
        formatted.energy_data["1"] = {
          id: em1data_1.id || 1,
          total_act_energy: em1data_1.total_act_energy || 0,
          total_act_ret_energy: em1data_1.total_act_ret_energy || 0
        }
      }

      return formatted
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