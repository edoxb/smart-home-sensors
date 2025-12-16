import React, { useState, useEffect, useRef, useCallback } from 'react'

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
  
  const lastUpdateRef = useRef<number>(Date.now())
  const lastDataRef = useRef<ArduinoGrowBoxData>({})
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [pompaAspirazioneOn, setPompaAspirazioneOn] = useState(false)
  const [pompaAcquaOn, setPompaAcquaOn] = useState(false)
  const [resistenzaOn, setResistenzaOn] = useState(false)
  const [luceLedOn, setLuceLedOn] = useState(false)
  const [ventolaOn, setVentolaOn] = useState(false)
  
  const [fase, setFase] = useState<string | null>(null)
  const [faseLoading, setFaseLoading] = useState(false)
  const [cultivationActive, setCultivationActive] = useState(false)
  const [cultivationLoading, setCultivationLoading] = useState(false)
  
  const [targets, setTargets] = useState<{
    temp_target_min?: number | null
    temp_target_max?: number | null
    hum_target_min?: number | null
    hum_target_max?: number | null
  }>({})
  const [currentValues, setCurrentValues] = useState<{
    avg_temperature?: number | null
    avg_humidity?: number | null
  }>({})

  const [ledStatus, setLedStatus] = useState<{
    is_on?: boolean
    minutes_on_today?: number | null
    minutes_until_on?: number | null
    minutes_until_off?: number | null
    last_toggle?: string | null
  }>({})

  const formatMinutes = (m?: number | null) => {
    if (m === null || m === undefined) return 'N/A'
    const h = Math.floor(m / 60)
    const mm = m % 60
    return `${h}h ${mm}m`
  }

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/sensors/arduino-grow-box/${sensorName}/stato-coltivazione`)
      if (!response.ok) throw new Error(`Errore ${response.status}`)
      const result = await response.json()
      const newData = result.sensor_data || {}
      const dataChanged = JSON.stringify(newData) !== JSON.stringify(lastDataRef.current)
      if (dataChanged) {
        lastUpdateRef.current = Date.now()
        lastDataRef.current = newData
      }
      setData(newData)
      setCultivationActive(result.cultivation_active || false)
      if (result.growth_phase) setFase(result.growth_phase)
      if (result.actuator_states) {
        setLuceLedOn(result.actuator_states.luce_led || false)
        setVentolaOn(result.actuator_states.ventola || false)
        setResistenzaOn(result.actuator_states.resistenza || false)
        setPompaAspirazioneOn(result.actuator_states.pompa_aspirazione || false)
        setPompaAcquaOn(result.actuator_states.pompa_acqua || false)
      }
      if (result.targets) setTargets(result.targets)
      if (result.current_values) setCurrentValues(result.current_values)
      if (result.led_status) setLedStatus(result.led_status)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setLoading(false)
    }
  }, [sensorName])

  const fetchFase = useCallback(async () => {
    try {
      const response = await fetch(`/sensors/arduino-grow-box/${sensorName}/fase`)
      if (response.ok) {
        const result = await response.json()
        setFase(result.fase || null)
      }
    } catch (err) {
      console.error('Errore caricamento fase:', err)
    }
  }, [sensorName])

  const fetchCultivationStatus = useCallback(async () => {
    try {
      const response = await fetch(`/sensors/arduino-grow-box/${sensorName}/stato-coltivazione`)
      if (response.ok) {
        const result = await response.json()
        setCultivationActive(result.cultivation_active || false)
        if (result.growth_phase) setFase(result.growth_phase)
        if (result.actuator_states) {
          setLuceLedOn(result.actuator_states.luce_led || false)
          setVentolaOn(result.actuator_states.ventola || false)
          setResistenzaOn(result.actuator_states.resistenza || false)
          setPompaAspirazioneOn(result.actuator_states.pompa_aspirazione || false)
          setPompaAcquaOn(result.actuator_states.pompa_acqua || false)
        }
        if (result.targets) setTargets(result.targets)
        if (result.current_values) setCurrentValues(result.current_values)
        if (result.sensor_data) setData(result.sensor_data)
        if (result.led_status) setLedStatus(result.led_status)
      }
    } catch (err) {
      console.error('Errore caricamento stato coltivazione:', err)
    }
  }, [sensorName])

  const iniziaColtivazione = async () => {
    if (!window.confirm('Vuoi iniziare un nuovo ciclo di coltivazione? Questo imposterà la fase a "piantina".')) return
    setCultivationLoading(true)
    try {
      const response = await fetch(`/sensors/arduino-grow-box/${sensorName}/inizia-coltivazione`, { method: 'POST' })
      if (!response.ok) {
        const errorResp = await response.json()
        throw new Error(errorResp.detail || 'Errore nell\'avvio della coltivazione')
      }
      const result = await response.json()
      setCultivationActive(true)
      setFase(result.fase)
      alert('Coltivazione iniziata con successo!')
      await fetchCultivationStatus()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setCultivationLoading(false)
    }
  }

  const fineColtivazione = async () => {
    if (!window.confirm('Vuoi terminare il ciclo di coltivazione corrente? Tutti i dati relativi a questo ciclo verranno cancellati e tutti gli attuatori verranno spenti.')) return
    setCultivationLoading(true)
    try {
      const response = await fetch(`/sensors/arduino-grow-box/${sensorName}/fine-coltivazione`, { method: 'POST' })
      if (!response.ok) {
        const errorResp = await response.json()
        throw new Error(errorResp.detail || 'Errore nella terminazione della coltivazione')
      }
      setCultivationActive(false)
      setFase(null)
      alert('Coltivazione terminata. Tutti i dati del ciclo sono stati cancellati.')
      await fetchCultivationStatus()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setCultivationLoading(false)
    }
  }

  const setFaseHandler = async (nuovaFase: string) => {
    setFaseLoading(true)
    try {
      const response = await fetch(`/sensors/arduino-grow-box/${sensorName}/fase?fase=${nuovaFase}`, { method: 'POST' })
      if (!response.ok) {
        const errorResp = await response.json()
        throw new Error(errorResp.detail || 'Errore nel salvataggio della fase')
      }
      const result = await response.json()
      setFase(result.fase)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setFaseLoading(false)
    }
  }

  useEffect(() => {
    fetchFase()
    fetchCultivationStatus()
  }, [fetchFase, fetchCultivationStatus])

  useEffect(() => {
    if (cultivationActive) fetchCultivationStatus()
  }, [cultivationActive, fetchCultivationStatus])

  useEffect(() => {
    let isMounted = true
    const scheduleNextFetch = async () => {
      if (!isMounted) return
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      const now = Date.now()
      const timeSinceLastUpdate = now - lastUpdateRef.current
      const interval = timeSinceLastUpdate < 10000 ? 1000 : 5000
      timeoutRef.current = setTimeout(async () => {
        if (!isMounted) return
        try {
          await fetchAllData()
          if (isMounted) scheduleNextFetch()
        } catch {
          if (isMounted) scheduleNextFetch()
        }
      }, interval)
    }
    fetchAllData().then(() => {
      if (isMounted) scheduleNextFetch()
    })
    return () => {
      isMounted = false
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [sensorName, fetchAllData])

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
          onClick={fetchAllData}
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

  const renderTemperatureSensor = (index: number) => {
    const tempKey = `temperature_${index}` as keyof ArduinoGrowBoxData
    const value = data[tempKey]
    return (
      <div key={`temp-${index}`} style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.75rem', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px'
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <path d="M12 2C10.34 2 9 3.34 9 5V11C9 12.66 10.34 14 12 14C13.66 14 15 12.66 15 11V5C15 3.34 13.66 2 12 2Z" stroke="#4CAF50" strokeWidth="2" fill="none"/>
          <path d="M12 14V18" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round"/>
          <path d="M12 18C13.1046 18 14 18.8954 14 20C14 21.1046 13.1046 22 12 22C10.8954 22 10 21.1046 10 20C10 18.8954 10.8954 18 12 18Z" stroke="#4CAF50" strokeWidth="2" fill="none"/>
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#F4B342', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Temp {index}</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#4CAF50' }}>
            {value !== undefined ? `${value.toFixed(1)}°C` : 'N/A'}
          </div>
        </div>
      </div>
    )
  }

  const renderHumiditySensor = (index: number) => {
    const humKey = `humidity_${index}` as keyof ArduinoGrowBoxData
    const value = data[humKey]
    return (
      <div key={`hum-${index}`} style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.75rem', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px'
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <path d="M12 2.69L5 6.69V11C5 15.97 9.03 20 14 20C18.97 20 23 15.97 23 11V6.69L16 2.69C15.38 2.31 14.62 2.31 14 2.69Z" stroke="#2196F3" strokeWidth="2" fill="none"/>
          <path d="M12 2.69V8" stroke="#2196F3" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="14" cy="11" r="2" fill="#2196F3" opacity="0.3"/>
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#F4B342', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Umidità {index}</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#2196F3' }}>
            {value !== undefined ? `${value}%` : 'N/A'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', padding: '2rem', backgroundColor: '#360185', color: '#FFFFFF' }}>
      <h1 style={{ color: '#F4B342', fontSize: '2rem', marginBottom: '2rem' }}>
        Arduino Grow Box - {sensorName}
      </h1>

      {/* Gestione Coltivazione */}
      {/* ... (sezioni gestione e fase come sopra, invariate) ... */}

      {/* Target e Valori Correnti */}
      {cultivationActive && fase && (
        <div style={{ marginBottom: '3rem' }}>
          <h2 style={{ color: '#F4B342', marginBottom: '1.5rem', fontSize: '1.5rem' }}>
            Target e Valori Correnti
          </h2>
          <div style={{
            backgroundColor: 'rgba(143, 1, 119, 0.3)',
            padding: '1.5rem',
            borderRadius: '12px',
            border: '2px solid #8F0177',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1.5rem'
          }}>
            <div style={{ padding: '1rem', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ color: '#F4B342', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Temperatura Target</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4CAF50' }}>
                {targets.temp_target_min !== null && targets.temp_target_max !== null ? `${targets.temp_target_min}°C - ${targets.temp_target_max}°C` : 'N/A'}
              </div>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ color: '#F4B342', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Temperatura Media</div>
              <div style={{
                fontSize: '1.5rem', fontWeight: 'bold',
                color: currentValues.avg_temperature !== null && currentValues.avg_temperature !== undefined
                  ? (targets.temp_target_min !== null && targets.temp_target_max !== null &&
                     currentValues.avg_temperature >= targets.temp_target_min &&
                     currentValues.avg_temperature <= targets.temp_target_max
                    ? '#4CAF50' : '#F44336')
                  : '#9E9E9E'
              }}>
                {currentValues.avg_temperature !== null && currentValues.avg_temperature !== undefined ? `${currentValues.avg_temperature.toFixed(1)}°C` : 'N/A'}
              </div>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ color: '#F4B342', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Umidità Target</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2196F3' }}>
                {targets.hum_target_min !== null && targets.hum_target_max !== null ? `${targets.hum_target_min}% - ${targets.hum_target_max}%` : 'N/A'}
              </div>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ color: '#F4B342', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Umidità Media</div>
              <div style={{
                fontSize: '1.5rem', fontWeight: 'bold',
                color: currentValues.avg_humidity !== null && currentValues.avg_humidity !== undefined
                  ? (targets.hum_target_min !== null && targets.hum_target_max !== null &&
                     currentValues.avg_humidity >= targets.hum_target_min &&
                     currentValues.avg_humidity <= targets.hum_target_max
                    ? '#4CAF50' : '#F44336')
                  : '#9E9E9E'
              }}>
                {currentValues.avg_humidity !== null && currentValues.avg_humidity !== undefined ? `${currentValues.avg_humidity.toFixed(1)}%` : 'N/A'}
              </div>
            </div>

            {/* Stato Luce LED (mostra tempi, usa is_on per countdown) */}
            <div style={{ padding: '1rem', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ color: '#F4B342', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                Luce LED
              </div>
              <div style={{ color: '#FFFFFF', marginTop: '0.5rem' }}>
                Accesa oggi: {formatMinutes(ledStatus.minutes_on_today)}
              </div>
              <div style={{ color: '#FFFFFF', marginTop: '0.25rem' }}>
                {ledStatus.is_on
                  ? `Spegne tra: ${formatMinutes(ledStatus.minutes_until_off)}`
                  : `Si accende tra: ${formatMinutes(ledStatus.minutes_until_on)}`}
              </div>
              <div style={{ color: '#BBBBBB', marginTop: '0.25rem', fontSize: '0.85rem' }}>
                Ultimo toggle: {ledStatus.last_toggle ? new Date(ledStatus.last_toggle).toLocaleString() : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sensori */}
      {/* ... (resto invariato: sensori e attuatori) ... */}
    </div>
  )
}

export default ArduinoGrowBoxControl