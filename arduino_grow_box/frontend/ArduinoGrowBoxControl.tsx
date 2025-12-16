import React, { useState, useEffect } from 'react'

interface SensorControlProps {
  sensorName: string
}

interface ArduinoGrowBoxData {
  temperature_1?: number
  temperature_2?: number
  temperature_3?: number
  temperature_4?: number
  humidity_1?: number
  humidity_2?: number
  humidity_3?: number
  humidity_4?: number
  water_level?: number
}

interface PowerButtonProps {
  label: string
  isOn: boolean
  loading: boolean
  onToggle: () => void | Promise<void>
}

const PowerButton: React.FC<PowerButtonProps> = ({ label, isOn, loading, onToggle }) => {
  return (
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
          transition: 'background-color 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
          boxShadow: isOn
            ? '0 0 18px rgba(13, 110, 253, 0.9), 0 0 35px rgba(13, 110, 253, 0.7)'
            : '0 0 8px rgba(0, 0, 0, 0.5)',
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
            transition: 'box-shadow 0.3s ease-in-out'
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
              transition: 'box-shadow 0.3s ease-in-out'
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
              boxShadow: isOn ? '0 0 8px rgba(255,255,255,0.9)' : 'none',
              transition: 'opacity 0.3s ease-in-out, box-shadow 0.3s ease-in-out'
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

  // Funzione helper per renderizzare un sensore di temperatura
  const renderTemperatureSensor = (index: number) => {
    const tempKey = `temperature_${index}` as keyof ArduinoGrowBoxData
    const value = data[tempKey]
    return (
      <div key={`temp-${index}`} style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '8px'
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <path d="M12 2C10.34 2 9 3.34 9 5V11C9 12.66 10.34 14 12 14C13.66 14 15 12.66 15 11V5C15 3.34 13.66 2 12 2Z" stroke="#4CAF50" strokeWidth="2" fill="none"/>
          <path d="M12 14V18" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round"/>
          <path d="M12 18C13.1046 18 14 18.8954 14 20C14 21.1046 13.1046 22 12 22C10.8954 22 10 21.1046 10 20C10 18.8954 10.8954 18 12 18Z" stroke="#4CAF50" strokeWidth="2" fill="none"/>
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#F4B342', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
            Temp {index}
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#4CAF50' }}>
            {value !== undefined ? `${value.toFixed(1)}°C` : 'N/A'}
          </div>
        </div>
      </div>
    )
  }

  // Funzione helper per renderizzare un sensore di umidità
  const renderHumiditySensor = (index: number) => {
    const humKey = `humidity_${index}` as keyof ArduinoGrowBoxData
    const value = data[humKey]
    return (
      <div key={`hum-${index}`} style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '8px'
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <path d="M12 2.69L5 6.69V11C5 15.97 9.03 20 14 20C18.97 20 23 15.97 23 11V6.69L16 2.69C15.38 2.31 14.62 2.31 14 2.69Z" stroke="#2196F3" strokeWidth="2" fill="none"/>
          <path d="M12 2.69V8" stroke="#2196F3" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="14" cy="11" r="2" fill="#2196F3" opacity="0.3"/>
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#F4B342', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
            Umidità {index}
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#2196F3' }}>
            {value !== undefined ? `${value}%` : 'N/A'}
          </div>
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
      <h1 style={{ color: '#F4B342', fontSize: '2rem', marginBottom: '2rem' }}>
        Arduino Grow Box - {sensorName}
      </h1>

      {/* Sezione Sensori */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ color: '#F4B342', marginBottom: '1.5rem', fontSize: '1.5rem' }}>
          Sensori
        </h2>

        <div style={{
          backgroundColor: 'rgba(143, 1, 119, 0.3)',
          padding: '1.5rem',
          borderRadius: '12px',
          border: '2px solid #8F0177'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '1rem'
          }}>
            {/* 4 Sensori di Temperatura */}
            {[1, 2, 3, 4].map(index => renderTemperatureSensor(index))}

            {/* 4 Sensori di Umidità */}
            {[1, 2, 3, 4].map(index => renderHumiditySensor(index))}

            {/* Livello Acqua */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '8px'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <rect x="4" y="6" width="16" height="14" rx="2" stroke="#00BCD4" strokeWidth="2" fill="none"/>
                <rect x="6" y="16" width="12" height="2" fill="#00BCD4" opacity="0.6"/>
                <rect x="6" y="12" width="12" height="2" fill="#00BCD4" opacity="0.4"/>
                <rect x="6" y="8" width="12" height="2" fill="#00BCD4" opacity="0.2"/>
                <path d="M8 4V6" stroke="#00BCD4" strokeWidth="2" strokeLinecap="round"/>
                <path d="M16 4V6" stroke="#00BCD4" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#F4B342', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                  Livello Acqua
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#00BCD4' }}>
                  {data.water_level !== undefined ? `${data.water_level}%` : 'N/A'}
                </div>
              </div>
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
            border: '2px solid #8F0177',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="8" stroke="#F4B342" strokeWidth="2" fill="none"/>
                <path d="M8 12L12 8L16 12" stroke="#F4B342" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 8V16" stroke="#F4B342" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <h3 style={{ color: '#F4B342', margin: 0 }}>
                Pompa Aspirazione
              </h3>
            </div>
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
            border: '2px solid #8F0177',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C10.34 2 9 3.34 9 5V11C9 12.66 10.34 14 12 14C13.66 14 15 12.66 15 11V5C15 3.34 13.66 2 12 2Z" stroke="#F4B342" strokeWidth="2" fill="none"/>
                <path d="M12 14V20" stroke="#F4B342" strokeWidth="2" strokeLinecap="round"/>
                <path d="M8 20H16" stroke="#F4B342" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="12" cy="11" r="1.5" fill="#F4B342"/>
              </svg>
              <h3 style={{ color: '#F4B342', margin: 0 }}>
                Pompa Acqua
              </h3>
            </div>
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
            border: '2px solid #8F0177',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" stroke="#F4B342" strokeWidth="2" fill="none"/>
                <path d="M12 16V22" stroke="#F4B342" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <h3 style={{ color: '#F4B342', margin: 0 }}>
                Resistenza Scaldante
              </h3>
            </div>
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
            border: '2px solid #8F0177',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 21H15" stroke="#F4B342" strokeWidth="2" strokeLinecap="round"/>
                <path d="M12 3V9" stroke="#F4B342" strokeWidth="2" strokeLinecap="round"/>
                <path d="M12 9C15.3137 9 18 11.6863 18 15C18 18.3137 15.3137 21 12 21C8.68629 21 6 18.3137 6 15C6 11.6863 8.68629 9 12 9Z" stroke="#F4B342" strokeWidth="2" fill="none"/>
                <path d="M12 9L14 7L12 5L10 7L12 9Z" stroke="#F4B342" strokeWidth="2" strokeLinejoin="round"/>
              </svg>
              <h3 style={{ color: '#F4B342', margin: 0 }}>
                Luce LED
              </h3>
            </div>
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
            border: '2px solid #8F0177',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="8" stroke="#F4B342" strokeWidth="2" fill="none"/>
                <path d="M12 4V8" stroke="#F4B342" strokeWidth="2" strokeLinecap="round"/>
                <path d="M12 16V20" stroke="#F4B342" strokeWidth="2" strokeLinecap="round"/>
                <path d="M4 12H8" stroke="#F4B342" strokeWidth="2" strokeLinecap="round"/>
                <path d="M16 12H20" stroke="#F4B342" strokeWidth="2" strokeLinecap="round"/>
                <path d="M6.34314 6.34314L9.17157 9.17157" stroke="#F4B342" strokeWidth="2" strokeLinecap="round"/>
                <path d="M14.8284 14.8284L17.6569 17.6569" stroke="#F4B342" strokeWidth="2" strokeLinecap="round"/>
                <path d="M17.6569 6.34314L14.8284 9.17157" stroke="#F4B342" strokeWidth="2" strokeLinecap="round"/>
                <path d="M9.17157 14.8284L6.34314 17.6569" stroke="#F4B342" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <h3 style={{ color: '#F4B342', margin: 0 }}>
                Ventola
              </h3>
            </div>
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