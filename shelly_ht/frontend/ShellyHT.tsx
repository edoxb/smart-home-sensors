import React, { useState, useEffect } from 'react'

interface SensorControlProps {
  sensorName: string
}

interface ShellyHTData {
  temperature?: number
  humidity?: number
  battery?: number
  battery_status?: string
  rssi?: number
  online?: boolean
}

const ShellyHT: React.FC<SensorControlProps> = ({ sensorName }) => {
  const [data, setData] = useState<ShellyHTData>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/sensors/${sensorName}/data`)
      if (!response.ok) {
        throw new Error(`Errore ${response.status}`)
      }
      const result = await response.json()
      setData(result.data || {})
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // Aggiorna ogni 60 secondi (Shelly H&T pubblica ogni ~60 minuti, ma controlliamo più spesso per eventuali aggiornamenti)
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [sensorName])

  const getBatteryColor = (battery?: number, status?: string) => {
    if (status === 'low') return '#F44336'
    if (battery !== undefined) {
      if (battery > 50) return '#4CAF50'
      if (battery > 20) return '#FF9800'
      return '#F44336'
    }
    return '#757575'
  }

  const getRSSIStrength = (rssi?: number) => {
    if (rssi === undefined) return 'N/A'
    if (rssi > -50) return 'Eccellente'
    if (rssi > -60) return 'Buono'
    if (rssi > -70) return 'Discreto'
    return 'Debole'
  }

  if (loading && Object.keys(data).length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#F4B342' }}>
        <p>Caricamento dati...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#F44336' }}>
        <p>Errore: {error}</p>
        <button 
          onClick={fetchData}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#F4B342',
            color: '#1A1A1A',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Riprova
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ color: '#F4B342', marginBottom: '2rem' }}>
        Shelly H&T - {sensorName}
      </h2>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {/* Temperatura */}
        <div style={{
          backgroundColor: '#2A2A2A',
          padding: '1.5rem',
          borderRadius: '8px',
          border: '1px solid #3A3A3A'
        }}>
          <div style={{ color: '#888', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            Temperatura
          </div>
          <div style={{ 
            fontSize: '2.5rem', 
            fontWeight: 'bold', 
            color: data.temperature !== undefined ? '#4CAF50' : '#888'
          }}>
            {data.temperature !== undefined ? `${data.temperature.toFixed(1)}°C` : 'N/A'}
          </div>
        </div>

        {/* Umidità */}
        <div style={{
          backgroundColor: '#2A2A2A',
          padding: '1.5rem',
          borderRadius: '8px',
          border: '1px solid #3A3A3A'
        }}>
          <div style={{ color: '#888', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            Umidità
          </div>
          <div style={{ 
            fontSize: '2.5rem', 
            fontWeight: 'bold', 
            color: data.humidity !== undefined ? '#2196F3' : '#888'
          }}>
            {data.humidity !== undefined ? `${data.humidity}%` : 'N/A'}
          </div>
        </div>

        {/* Batteria */}
        <div style={{
          backgroundColor: '#2A2A2A',
          padding: '1.5rem',
          borderRadius: '8px',
          border: '1px solid #3A3A3A'
        }}>
          <div style={{ color: '#888', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            Batteria
          </div>
          <div style={{ 
            fontSize: '2.5rem', 
            fontWeight: 'bold', 
            color: getBatteryColor(data.battery, data.battery_status)
          }}>
            {data.battery !== undefined ? `${data.battery}%` : 'N/A'}
          </div>
          {data.battery_status && (
            <div style={{ 
              fontSize: '0.8rem', 
              color: '#888', 
              marginTop: '0.5rem',
              textTransform: 'capitalize'
            }}>
              {data.battery_status}
            </div>
          )}
        </div>

        {/* RSSI */}
        <div style={{
          backgroundColor: '#2A2A2A',
          padding: '1.5rem',
          borderRadius: '8px',
          border: '1px solid #3A3A3A'
        }}>
          <div style={{ color: '#888', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            Segnale Wi-Fi
          </div>
          <div style={{ 
            fontSize: '1.5rem', 
            fontWeight: 'bold', 
            color: '#F4B342'
          }}>
            {data.rssi !== undefined ? `${data.rssi} dBm` : 'N/A'}
          </div>
          {data.rssi !== undefined && (
            <div style={{ 
              fontSize: '0.8rem', 
              color: '#888', 
              marginTop: '0.5rem'
            }}>
              {getRSSIStrength(data.rssi)}
            </div>
          )}
        </div>
      </div>

      {/* Stato Online */}
      {data.online !== undefined && (
        <div style={{
          backgroundColor: '#2A2A2A',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid #3A3A3A',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: data.online ? '#4CAF50' : '#F44336'
          }} />
          <span style={{ color: '#888' }}>
            {data.online ? 'Dispositivo online' : 'Dispositivo offline'}
          </span>
        </div>
      )}

      {/* Note */}
      <div style={{
        backgroundColor: '#1A1A1A',
        padding: '1rem',
        borderRadius: '8px',
        border: '1px solid #3A3A3A',
        fontSize: '0.9rem',
        color: '#888'
      }}>
        <strong style={{ color: '#F4B342' }}>Nota:</strong> Shelly H&T pubblica dati ogni ~60 minuti 
        o quando temperatura varia {'>'}1°C o umidità varia {'>'}5%. I dati vengono aggiornati automaticamente via MQTT.
      </div>

      {/* Pulsante refresh manuale */}
      <button
        onClick={fetchData}
        disabled={loading}
        style={{
          marginTop: '1rem',
          padding: '0.75rem 1.5rem',
          backgroundColor: '#F4B342',
          color: '#1A1A1A',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
          fontWeight: 'bold'
        }}
      >
        {loading ? 'Aggiornamento...' : 'Aggiorna Dati'}
      </button>
    </div>
  )
}

export default ShellyHT
