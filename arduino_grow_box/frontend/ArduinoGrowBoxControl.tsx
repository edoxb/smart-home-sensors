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
            boxShadow: isOn ? '0 0 12px rgba(255,255,255,0.95)' : '0 0 4px rgba(0,0,0,0.6)',
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

  const lastUpdateRef = useRef<number>(Date.now())
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const formatMinutes = (m?: number | null) => {
    if (m === null || m === undefined) return 'N/A'
    const h = Math.floor(m / 60)
    const mm = m % 60
    return `${h}h ${mm}m`
  }

  const formatDateTime = (value?: string | null) => {
    if (!value) return 'N/A'
    return new Date(value).toLocaleString()
  }

  const fetchAllData = useCallback(async () => {
    try {
      const response = await fetch(`/sensors/arduino-grow-box/${sensorName}/stato-coltivazione`)
      if (!response.ok) throw new Error(`Errore ${response.status}`)
      const result = await response.json()

      setCultivationActive(result.cultivation_active || false)
      if (result.growth_phase) setFase(result.growth_phase)
      if (result.targets) setTargets(result.targets)
      if (result.current_values) setCurrentValues(result.current_values)
      if (result.sensor_data) setData(result.sensor_data)
      if (result.led_status) setLedStatus(result.led_status)

      if (result.actuator_states) {
        setLuceLedOn(result.actuator_states.luce_led || false)
        setVentolaOn(result.actuator_states.ventola || false)
        setResistenzaOn(result.actuator_states.resistenza || false)
        setPompaAspirazioneOn(result.actuator_states.pompa_aspirazione || false)
        setPompaAcquaOn(result.actuator_states.pompa_acqua || false)
      }

      lastUpdateRef.current = Date.now()
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
        if (result.targets) setTargets(result.targets)
        if (result.current_values) setCurrentValues(result.current_values)
        if (result.sensor_data) setData(result.sensor_data)
        if (result.led_status) setLedStatus(result.led_status)
        if (result.actuator_states) {
          setLuceLedOn(result.actuator_states.luce_led || false)
          setVentolaOn(result.actuator_states.ventola || false)
          setResistenzaOn(result.actuator_states.resistenza || false)
          setPompaAspirazioneOn(result.actuator_states.pompa_aspirazione || false)
          setPompaAcquaOn(result.actuator_states.pompa_acqua || false)
        }
      }
    } catch (err) {
      console.error('Errore caricamento stato coltivazione:', err)
    }
  }, [sensorName])

  const toggleAction = async (
    endpoint: string,
    desiredState: boolean,
    setState: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    const key = `${endpoint}-${desiredState}`
    setActionLoading(prev => ({ ...prev, [key]: true }))
    try {
      const response = await fetch(
        `/sensors/arduino-grow-box/${sensorName}/${endpoint}?action=${desiredState ? 'on' : 'off'}`,
        { method: 'POST' }
      )
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}))
        throw new Error(errJson.detail || `Errore ${response.status}`)
      }
      setState(desiredState)
      await fetchCultivationStatus()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  const iniziaColtivazione = async () => {
    if (!window.confirm('Vuoi iniziare un nuovo ciclo di coltivazione?')) return
    setCultivationLoading(true)
    try {
      const response = await fetch(`/sensors/arduino-grow-box/${sensorName}/inizia-coltivazione`, { method: 'POST' })
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}))
        throw new Error(errJson.detail || `Errore ${response.status}`)
      }
      await fetchCultivationStatus()
      alert('Coltivazione iniziata')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setCultivationLoading(false)
    }
  }

  const fineColtivazione = async () => {
    if (!window.confirm('Vuoi terminare il ciclo di coltivazione corrente?')) return
    setCultivationLoading(true)
    try {
      const response = await fetch(`/sensors/arduino-grow-box/${sensorName}/fine-coltivazione`, { method: 'POST' })
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}))
        throw new Error(errJson.detail || `Errore ${response.status}`)
      }
      await fetchCultivationStatus()
      alert('Coltivazione terminata')
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
        const errJson = await response.json().catch(() => ({}))
        throw new Error(errJson.detail || `Errore ${response.status}`)
      }
      const result = await response.json()
      setFase(result.fase)
      await fetchCultivationStatus()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setFaseLoading(false)
    }
  }

  useEffect(() => {
    fetchFase()
    fetchAllData()
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(() => {
      fetchAllData()
    }, 5000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchAllData, fetchFase])

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

  const tempMin = targets.temp_target_min ?? null
  const tempMax = targets.temp_target_max ?? null
  const humMin = targets.hum_target_min ?? null
  const humMax = targets.hum_target_max ?? null

  const renderTemperatureSensor = (index: number) => {
    const tempKey = `temperature_${index}` as keyof ArduinoGrowBoxData
    const value = data[tempKey]
    return (
      <div key={`temp-${index}`} style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.75rem', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px'
      }}>
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
      <h1 style={{ color: '#F4B342', fontSize: '2rem', marginBottom: '1.5rem' }}>
        Arduino Grow Box - {sensorName}
      </h1>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={iniziaColtivazione}
          disabled={cultivationLoading}
          style={{ padding: '0.75rem 1.25rem', background: '#4CAF50', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}
        >
          Avvia coltivazione
        </button>
        <button
          type="button"
          onClick={fineColtivazione}
          disabled={cultivationLoading}
          style={{ padding: '0.75rem 1.25rem', background: '#F44336', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}
        >
          Termina coltivazione
        </button>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Fase:</span>
          {['piantina', 'vegetativa', 'fioritura'].map(opt => (
            <button
              key={opt}
              type="button"
              disabled={faseLoading}
              onClick={() => setFaseHandler(opt)}
              style={{
                padding: '0.5rem 0.9rem',
                background: fase === opt ? '#8F0177' : '#4b2c7a',
                color: '#fff',
                border: '1px solid #8F0177',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {cultivationActive && fase && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#F4B342', marginBottom: '1rem', fontSize: '1.3rem' }}>
            Target e Valori Correnti
          </h2>
          <div style={{
            backgroundColor: 'rgba(143, 1, 119, 0.3)',
            padding: '1.2rem',
            borderRadius: '12px',
            border: '2px solid #8F0177',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            <div style={{ padding: '1rem', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ color: '#F4B342', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Temperatura Target</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#4CAF50' }}>
                {tempMin !== null && tempMax !== null
                  ? `${tempMin}°C - ${tempMax}°C`
                  : 'N/A'}
              </div>
            </div>
            <div style={{ padding: '1rem', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ color: '#F4B342', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Temperatura Media</div>
              <div style={{
                fontSize: '1.4rem',
                fontWeight: 'bold',
                color: currentValues.avg_temperature !== null && currentValues.avg_temperature !== undefined
                  ? (tempMin !== null && tempMax !== null &&
                     currentValues.avg_temperature >= tempMin &&
                     currentValues.avg_temperature <= tempMax
                    ? '#4CAF50' : '#F44336')
                  : '#9E9E9E'
              }}>
                {currentValues.avg_temperature !== null && currentValues.avg_temperature !== undefined
                  ? `${currentValues.avg_temperature.toFixed(1)}°C`
                  : 'N/A'}
              </div>
            </div>
            <div style={{ padding: '1rem', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ color: '#F4B342', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Umidità Target</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#2196F3' }}>
                {humMin !== null && humMax !== null
                  ? `${humMin}% - ${humMax}%`
                  : 'N/A'}
              </div>
            </div>
            <div style={{ padding: '1rem', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ color: '#F4B342', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Umidità Media</div>
              <div style={{
                fontSize: '1.4rem',
                fontWeight: 'bold',
                color: currentValues.avg_humidity !== null && currentValues.avg_humidity !== undefined
                  ? (humMin !== null && humMax !== null &&
                     currentValues.avg_humidity >= humMin &&
                     currentValues.avg_humidity <= humMax
                    ? '#4CAF50' : '#F44336')
                  : '#9E9E9E'
              }}>
                {currentValues.avg_humidity !== null && currentValues.avg_humidity !== undefined
                  ? `${currentValues.avg_humidity.toFixed(1)}%`
                  : 'N/A'}
              </div>
            </div>
            <div style={{ padding: '1rem', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ color: '#F4B342', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Luce LED</div>
              <div style={{ color: '#FFFFFF', marginTop: '0.5rem' }}>
                Accesa oggi: {formatMinutes(ledStatus.minutes_on_today)}
              </div>
              <div style={{ color: '#FFFFFF', marginTop: '0.25rem' }}>
                {ledStatus.is_on
                  ? `Spegne tra: ${formatMinutes(ledStatus.minutes_until_off)}`
                  : `Si accende tra: ${formatMinutes(ledStatus.minutes_until_on)}`}
              </div>
              <div style={{ color: '#BBBBBB', marginTop: '0.25rem', fontSize: '0.85rem' }}>
                Ultimo toggle: {formatDateTime(ledStatus.last_toggle)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#F4B342', marginBottom: '1rem', fontSize: '1.3rem' }}>Attuatori</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
          <PowerButton
            label="Luce LED"
            isOn={luceLedOn}
            loading={!!actionLoading['luce-led']}
            onToggle={() => toggleAction('luce-led', !luceLedOn, setLuceLedOn)}
          />
          <PowerButton
            label="Ventola"
            isOn={ventolaOn}
            loading={!!actionLoading['ventola']}
            onToggle={() => toggleAction('ventola', !ventolaOn, setVentolaOn)}
          />
          <PowerButton
            label="Resistenza"
            isOn={resistenzaOn}
            loading={!!actionLoading['resistenza']}
            onToggle={() => toggleAction('resistenza', !resistenzaOn, setResistenzaOn)}
          />
          <PowerButton
            label="Pompa Aspirazione"
            isOn={pompaAspirazioneOn}
            loading={!!actionLoading['pompa-aspirazione']}
            onToggle={() => toggleAction('pompa-aspirazione', !pompaAspirazioneOn, setPompaAspirazioneOn)}
          />
          <PowerButton
            label="Pompa Acqua"
            isOn={pompaAcquaOn}
            loading={!!actionLoading['pompa-acqua']}
            onToggle={() => toggleAction('pompa-acqua', !pompaAcquaOn, setPompaAcquaOn)}
          />
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#F4B342', marginBottom: '1rem', fontSize: '1.3rem' }}>Sensori</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          {[1, 2, 3, 4].map(renderTemperatureSensor)}
          {[1, 2, 3, 4].map(renderHumiditySensor)}
        </div>
      </div>
    </div>
  )
}

export default ArduinoGrowBoxControl
 
