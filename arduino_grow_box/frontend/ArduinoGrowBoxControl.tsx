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

interface PowerButtonProps {
  label: string
  isOn: boolean
  loading: boolean
  onToggle: () => void | Promise<void>
}

const PowerButton: React.FC<PowerButtonProps> = ({ label, isOn, loading, onToggle }) => {
  return (
    <div style={{ textAlign: 'center' }}>
      <button
        type="button"
        onClick={onToggle}
        disabled={loading}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '82px',
          height: '82px',
          borderRadius: '50%',
          border: '2px solid #0d6efd',
          backgroundColor: isOn ? '#0d6efd' : '#0b3d91',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.3s ease-in-out, box-shadow 0.3s ease-in-out, transform 0.1s ease-out',
          boxShadow: isOn
            ? '0 0 18px rgba(13, 110, 253, 0.9), 0 0 35px rgba(13, 110, 253, 0.7)'
            : '0 0 8px rgba(0, 0, 0, 0.5)',
          transform: isOn ? 'scale(1.03)' : 'scale(1)',
          opacity: loading ? 0.7 : 1
        }}
      >
        {/* Icona power disegnata in puro CSS, senza font esterni */}
        <div
          style={{
            position: 'relative',
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            border: '3px solid #ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isOn
              ? '0 0 12px rgba(255,255,255,0.95)'
              : '0 0 4px rgba(0,0,0,0.6)',
            transition: 'all 0.3s ease-in-out'
          }}
        >
          {/* asta centrale */}
          <div
            style={{
              position: 'absolute',
              top: '4px',
              width: '4px',
              height: '16px',
              borderRadius: '2px',
              backgroundColor: '#ffffff',
              boxShadow: isOn ? '0 0 6px rgba(255,255,255,0.9)' : 'none',
              transition: 'all 0.3s ease-in-out'
            }}
          />
          {/* arco circolare */}
          <div
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              borderWidth: '3px',
              borderStyle: 'solid',
              borderColor: '#ffffff',
              borderTopColor: 'transparent',
              opacity: isOn ? 1 : 0.7,
              transform: isOn ? 'rotate(0deg)' : 'rotate(-18deg)',
              boxShadow: isOn ? '0 0 8px rgba(255,255,255,0.9)' : 'none',
              transition: 'all 0.3s ease-in-out'
            }}
          />
        </div>
      </button>
      <div
        style={{
          marginTop: '0.5rem',
          fontSize: '0.85rem',
          color: isOn ? '#51CBEE' : '#ffffff'
        }}
      >
        {label} {loading ? '...' : isOn ? '(ON)' : '(OFF)'}
      </div>
    </div>
  )
}

const ArduinoGrowBoxControl: React.FC<SensorControlProps> = ({ sensorName }) => {
  const [data, setData] = useState<ArduinoGrowBoxData>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  // stato locale per i 5 attuatori
  const [pompaAspirazioneOn, setPompaAspirazioneOn] = useState(false)
  const [pompaAcquaOn, setPompaAcquaOn] = useState(false)
  const [resistenzaOn, setResistenzaOn] = useState(false)
  const [luceLedOn, setLuceLedOn] = useState(false)
  const [ventolaOn, setVentolaOn] = useState(false)

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
        const errorResp = await response.json()
        throw new Error(errorResp.detail || 'Errore nella richiesta')
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
          type="button"
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
            <PowerButton
              label="Pompa Aspirazione"
              isOn={pompaAspirazioneOn}
              loading={
                !!(
                  actionLoading.pompa_aspirazione_on ||
                  actionLoading.pompa_aspirazione_off
                )
              }
              onToggle={async () => {
                if (pompaAspirazioneOn) {
                  await executeAction('pompa_aspirazione_off')
                  setPompaAspirazioneOn(false)
                } else {
                  await executeAction('pompa_aspirazione_on')
                  setPompaAspirazioneOn(true)
                }
              }}
            />
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
            <PowerButton
              label="Pompa Acqua"
              isOn={pompaAcquaOn}
              loading={
                !!(
                  actionLoading.pompa_acqua_on ||
                  actionLoading.pompa_acqua_off
                )
              }
              onToggle={async () => {
                if (pompaAcquaOn) {
                  await executeAction('pompa_acqua_off')
                  setPompaAcquaOn(false)
                } else {
                  await executeAction('pompa_acqua_on')
                  setPompaAcquaOn(true)
                }
              }}
            />
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
            <PowerButton
              label="Resistenza"
              isOn={resistenzaOn}
              loading={
                !!(
                  actionLoading.resistenza_on ||
                  actionLoading.resistenza_off
                )
              }
              onToggle={async () => {
                if (resistenzaOn) {
                  await executeAction('resistenza_off')
                  setResistenzaOn(false)
                } else {
                  await executeAction('resistenza_on')
                  setResistenzaOn(true)
                }
              }}
            />
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
            <PowerButton
              label="Luce LED"
              isOn={luceLedOn}
              loading={
                !!(
                  actionLoading.luce_led_on ||
                  actionLoading.luce_led_off
                )
              }
              onToggle={async () => {
                if (luceLedOn) {
                  await executeAction('luce_led_off')
                  setLuceLedOn(false)
                } else {
                  await executeAction('luce_led_on')
                  setLuceLedOn(true)
                }
              }}
            />
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
            <PowerButton
              label="Ventola"
              isOn={ventolaOn}
              loading={
                !!(
                  actionLoading.ventola_on ||
                  actionLoading.ventola_off
                )
              }
              onToggle={async () => {
                if (ventolaOn) {
                  await executeAction('ventola_off')
                  setVentolaOn(false)
                } else {
                  await executeAction('ventola_on')
                  setVentolaOn(true)
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ArduinoGrowBoxControl