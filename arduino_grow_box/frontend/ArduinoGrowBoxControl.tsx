import React, { useState, useEffect } from 'react'

interface SensorControlProps {
  sensorName: string
}

interface ArduinoGrowBoxData {
  temperature_1?: number
  temperature_2?: number
  humidity_1?: number
  humidity_2?: number
  humidity_3?: number
}

const ArduinoGrowBoxControl: React.FC<SensorControlProps> = ({ sensorName }) => {
  const [data, setData] = useState<ArduinoGrowBoxData>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/sensors/${sensorName}/data`)
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
    const interval = setInterval(fetchData, 5000) // Aggiorna ogni 5 secondi
    return () => clearInterval(interval)
  }, [sensorName])

  const executeAction = async (actionName: string) => {
    setActionLoading(prev => ({ ...prev, [actionName]: true }))
    try {
      const response = await fetch(`/sensors/${sensorName}/actions/${actionName}`, {
        method: 'POST'
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Errore nella richiesta')
      }
      const result = await response.json()
      console.log('Azione eseguita:', result)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setActionLoading(prev => ({ ...prev, [actionName]: false }))
    }
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
    <div style={{ 
      width: '100%', 
      minHeight: '100vh', 
      padding: '2rem', 
      backgroundColor: '#360185', 
      color: '#FFFFFF' 
    }}>
      <h1 style={{ color: '#F4B342', fontSize: '2rem', marginBottom: '2rem' }}>
        Arduino Grow Box - {sensorName}
      </h1>

      {/* Sezione Sensori */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ color: '#F4B342', marginBottom: '1.5rem', fontSize: '1.5rem' }}>
          Sensori
        </h2>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '1.5rem' 
        }}>
          {/* Temperatura 1 */}
          <div style={{
            backgroundColor: 'rgba(143, 1, 119, 0.3)',
            padding: '1.5rem',
            borderRadius: '12px',
            border: '2px solid #8F0177'
          }}>
            <div style={{ color: '#F4B342', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              Temperatura 1
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#4CAF50' }}>
              {data.temperature_1 !== undefined ? `${data.temperature_1.toFixed(1)}°C` : 'N/A'}
            </div>
          </div>

          {/* Temperatura 2 */}
          <div style={{
            backgroundColor: 'rgba(143, 1, 119, 0.3)',
            padding: '1.5rem',
            borderRadius: '12px',
            border: '2px solid #8F0177'
          }}>
            <div style={{ color: '#F4B342', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              Temperatura 2
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#4CAF50' }}>
              {data.temperature_2 !== undefined ? `${data.temperature_2.toFixed(1)}°C` : 'N/A'}
            </div>
          </div>

          {/* Umidità 1 */}
          <div style={{
            backgroundColor: 'rgba(143, 1, 119, 0.3)',
            padding: '1.5rem',
            borderRadius: '12px',
            border: '2px solid #8F0177'
          }}>
            <div style={{ color: '#F4B342', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              Umidità 1
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#2196F3' }}>
              {data.humidity_1 !== undefined ? `${data.humidity_1}%` : 'N/A'}
            </div>
          </div>

          {/* Umidità 2 */}
          <div style={{
            backgroundColor: 'rgba(143, 1, 119, 0.3)',
            padding: '1.5rem',
            borderRadius: '12px',
            border: '2px solid #8F0177'
          }}>
            <div style={{ color: '#F4B342', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              Umidità 2
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#2196F3' }}>
              {data.humidity_2 !== undefined ? `${data.humidity_2}%` : 'N/A'}
            </div>
          </div>

          {/* Umidità 3 */}
          <div style={{
            backgroundColor: 'rgba(143, 1, 119, 0.3)',
            padding: '1.5rem',
            borderRadius: '12px',
            border: '2px solid #8F0177'
          }}>
            <div style={{ color: '#F4B342', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              Umidità 3
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#2196F3' }}>
              {data.humidity_3 !== undefined ? `${data.humidity_3}%` : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Sezione Attuatori */}
      <div>
        <h2 style={{ color: '#F4B342', marginBottom: '1.5rem', fontSize: '1.5rem' }}>
          Controllo Attuatori
        </h2>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '1.5rem' 
        }}>
          {/* Pompa Aspirazione */}
          <div style={{
            backgroundColor: 'rgba(143, 1, 119, 0.3)',
            padding: '1.5rem',
            borderRadius: '12px',
            border: '2px solid #8F0177'
          }}>
            <h3 style={{ color: '#F4B342', marginTop: 0, marginBottom: '1rem' }}>
              Pompa Aspirazione
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => executeAction('pompa_aspirazione_on')}
                disabled={actionLoading.pompa_aspirazione_on}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#4CAF50',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: actionLoading.pompa_aspirazione_on ? 'not-allowed' : 'pointer',
                  opacity: actionLoading.pompa_aspirazione_on ? 0.6 : 1,
                  fontWeight: 'bold'
                }}
              >
                {actionLoading.pompa_aspirazione_on ? '...' : 'Accendi'}
              </button>
              <button
                onClick={() => executeAction('pompa_aspirazione_off')}
                disabled={actionLoading.pompa_aspirazione_off}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#F44336',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: actionLoading.pompa_aspirazione_off ? 'not-allowed' : 'pointer',
                  opacity: actionLoading.pompa_aspirazione_off ? 0.6 : 1,
                  fontWeight: 'bold'
                }}
              >
                {actionLoading.pompa_aspirazione_off ? '...' : 'Spegni'}
              </button>
            </div>
          </div>

          {/* Pompa Acqua */}
          <div style={{
            backgroundColor: 'rgba(143, 1, 119, 0.3)',
            padding: '1.5rem',
            borderRadius: '12px',
            border: '2px solid #8F0177'
          }}>
            <h3 style={{ color: '#F4B342', marginTop: 0, marginBottom: '1rem' }}>
              Pompa Acqua
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => executeAction('pompa_acqua_on')}
                disabled={actionLoading.pompa_acqua_on}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#4CAF50',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: actionLoading.pompa_acqua_on ? 'not-allowed' : 'pointer',
                  opacity: actionLoading.pompa_acqua_on ? 0.6 : 1,
                  fontWeight: 'bold'
                }}
              >
                {actionLoading.pompa_acqua_on ? '...' : 'Accendi'}
              </button>
              <button
                onClick={() => executeAction('pompa_acqua_off')}
                disabled={actionLoading.pompa_acqua_off}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#F44336',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: actionLoading.pompa_acqua_off ? 'not-allowed' : 'pointer',
                  opacity: actionLoading.pompa_acqua_off ? 0.6 : 1,
                  fontWeight: 'bold'
                }}
              >
                {actionLoading.pompa_acqua_off ? '...' : 'Spegni'}
              </button>
            </div>
          </div>

          {/* Resistenza Scaldante */}
          <div style={{
            backgroundColor: 'rgba(143, 1, 119, 0.3)',
            padding: '1.5rem',
            borderRadius: '12px',
            border: '2px solid #8F0177'
          }}>
            <h3 style={{ color: '#F4B342', marginTop: 0, marginBottom: '1rem' }}>
              Resistenza Scaldante
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => executeAction('resistenza_on')}
                disabled={actionLoading.resistenza_on}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#4CAF50',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: actionLoading.resistenza_on ? 'not-allowed' : 'pointer',
                  opacity: actionLoading.resistenza_on ? 0.6 : 1,
                  fontWeight: 'bold'
                }}
              >
                {actionLoading.resistenza_on ? '...' : 'Accendi'}
              </button>
              <button
                onClick={() => executeAction('resistenza_off')}
                disabled={actionLoading.resistenza_off}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#F44336',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: actionLoading.resistenza_off ? 'not-allowed' : 'pointer',
                  opacity: actionLoading.resistenza_off ? 0.6 : 1,
                  fontWeight: 'bold'
                }}
              >
                {actionLoading.resistenza_off ? '...' : 'Spegni'}
              </button>
            </div>
          </div>

          {/* Luce LED */}
          <div style={{
            backgroundColor: 'rgba(143, 1, 119, 0.3)',
            padding: '1.5rem',
            borderRadius: '12px',
            border: '2px solid #8F0177'
          }}>
            <h3 style={{ color: '#F4B342', marginTop: 0, marginBottom: '1rem' }}>
              Luce LED
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => executeAction('luce_led_on')}
                disabled={actionLoading.luce_led_on}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#4CAF50',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: actionLoading.luce_led_on ? 'not-allowed' : 'pointer',
                  opacity: actionLoading.luce_led_on ? 0.6 : 1,
                  fontWeight: 'bold'
                }}
              >
                {actionLoading.luce_led_on ? '...' : 'Accendi'}
              </button>
              <button
                onClick={() => executeAction('luce_led_off')}
                disabled={actionLoading.luce_led_off}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#F44336',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: actionLoading.luce_led_off ? 'not-allowed' : 'pointer',
                  opacity: actionLoading.luce_led_off ? 0.6 : 1,
                  fontWeight: 'bold'
                }}
              >
                {actionLoading.luce_led_off ? '...' : 'Spegni'}
              </button>
            </div>
          </div>

          {/* Ventola */}
          <div style={{
            backgroundColor: 'rgba(143, 1, 119, 0.3)',
            padding: '1.5rem',
            borderRadius: '12px',
            border: '2px solid #8F0177'
          }}>
            <h3 style={{ color: '#F4B342', marginTop: 0, marginBottom: '1rem' }}>
              Ventola
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => executeAction('ventola_on')}
                disabled={actionLoading.ventola_on}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#4CAF50',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: actionLoading.ventola_on ? 'not-allowed' : 'pointer',
                  opacity: actionLoading.ventola_on ? 0.6 : 1,
                  fontWeight: 'bold'
                }}
              >
                {actionLoading.ventola_on ? '...' : 'Accendi'}
              </button>
              <button
                onClick={() => executeAction('ventola_off')}
                disabled={actionLoading.ventola_off}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#F44336',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: actionLoading.ventola_off ? 'not-allowed' : 'pointer',
                  opacity: actionLoading.ventola_off ? 0.6 : 1,
                  fontWeight: 'bold'
                }}
              >
                {actionLoading.ventola_off ? '...' : 'Spegni'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ArduinoGrowBoxControl