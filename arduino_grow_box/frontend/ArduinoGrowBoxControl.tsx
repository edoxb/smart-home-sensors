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
  
  // Polling adattivo: traccia l'ultimo aggiornamento
  const lastUpdateRef = useRef<number>(Date.now())
  const lastDataRef = useRef<ArduinoGrowBoxData>({})
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // stato locale per i 5 attuatori (sincronizzato con DB)
  const [pompaAspirazioneOn, setPompaAspirazioneOn] = useState(false)
  const [pompaAcquaOn, setPompaAcquaOn] = useState(false)
  const [resistenzaOn, setResistenzaOn] = useState(false)
  const [luceLedOn, setLuceLedOn] = useState(false)
  const [ventolaOn, setVentolaOn] = useState(false)
  
  // stato per la fase di crescita
  const [fase, setFase] = useState<string | null>(null)
  const [faseLoading, setFaseLoading] = useState(false)
  
  // stato per la coltivazione
  const [cultivationActive, setCultivationActive] = useState(false)
  const [cultivationLoading, setCultivationLoading] = useState(false)
  
  // stato attuatori, target e valori medi
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

  // Funzione unificata per caricare tutti i dati (sensori + stato coltivazione)
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/sensors/arduino-grow-box/${sensorName}/stato-coltivazione`)
      if (!response.ok) {
        throw new Error(`Errore ${response.status}`)
      }
      const result = await response.json()
      
      // Aggiorna dati sensore
      const newData = result.sensor_data || {}
      const dataChanged = JSON.stringify(newData) !== JSON.stringify(lastDataRef.current)
      
      if (dataChanged) {
        lastUpdateRef.current = Date.now()
        lastDataRef.current = newData
      }
      
      setData(newData)
      
      // Aggiorna stato coltivazione
      setCultivationActive(result.cultivation_active || false)
      if (result.growth_phase) {
        setFase(result.growth_phase)
      }
      
      // Aggiorna stato attuatori
      if (result.actuator_states) {
        setLuceLedOn(result.actuator_states.luce_led || false)
        setVentolaOn(result.actuator_states.ventola || false)
        setResistenzaOn(result.actuator_states.resistenza || false)
        setPompaAspirazioneOn(result.actuator_states.pompa_aspirazione || false)
        setPompaAcquaOn(result.actuator_states.pompa_acqua || false)
      }
      
      // Aggiorna target
      if (result.targets) {
        setTargets(result.targets)
      }
      
      // Aggiorna valori correnti
      if (result.current_values) {
        setCurrentValues(result.current_values)
      }
      
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setLoading(false)
    }
  }, [sensorName])

  // Carica la fase corrente all'avvio
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

  // Carica solo lo stato della coltivazione (usato dopo azioni per aggiornare velocemente)
  const fetchCultivationStatus = useCallback(async () => {
    try {
      const response = await fetch(`/sensors/arduino-grow-box/${sensorName}/stato-coltivazione`)
      if (response.ok) {
        const result = await response.json()
        setCultivationActive(result.cultivation_active || false)
        if (result.growth_phase) {
          setFase(result.growth_phase)
        }
        // Aggiorna stato attuatori
        if (result.actuator_states) {
          setLuceLedOn(result.actuator_states.luce_led || false)
          setVentolaOn(result.actuator_states.ventola || false)
          setResistenzaOn(result.actuator_states.resistenza || false)
          setPompaAspirazioneOn(result.actuator_states.pompa_aspirazione || false)
          setPompaAcquaOn(result.actuator_states.pompa_acqua || false)
        }
        // Aggiorna target
        if (result.targets) {
          setTargets(result.targets)
        }
        // Aggiorna valori correnti
        if (result.current_values) {
          setCurrentValues(result.current_values)
        }
        // Aggiorna anche i dati del sensore se presenti
        if (result.sensor_data) {
          setData(result.sensor_data)
        }
      }
    } catch (err) {
      console.error('Errore caricamento stato coltivazione:', err)
    }
  }, [sensorName])

  // Inizia coltivazione
  const iniziaColtivazione = async () => {
    if (!window.confirm('Vuoi iniziare un nuovo ciclo di coltivazione? Questo imposterà la fase a "piantina".')) {
      return
    }
    
    setCultivationLoading(true)
    try {
      const response = await fetch(`/sensors/arduino-grow-box/${sensorName}/inizia-coltivazione`, {
        method: 'POST'
      })
      if (!response.ok) {
        const errorResp = await response.json()
        throw new Error(errorResp.detail || 'Errore nell\'avvio della coltivazione')
      }
      const result = await response.json()
      setCultivationActive(true)
      setFase(result.fase)
      alert('Coltivazione iniziata con successo!')
      // Ricarica lo stato
      await fetchCultivationStatus()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setCultivationLoading(false)
    }
  }

  // Fine coltivazione
  const fineColtivazione = async () => {
    if (!window.confirm('Vuoi terminare il ciclo di coltivazione corrente? Tutti i dati relativi a questo ciclo verranno cancellati e tutti gli attuatori verranno spenti.')) {
      return
    }
    
    setCultivationLoading(true)
    try {
      const response = await fetch(`/sensors/arduino-grow-box/${sensorName}/fine-coltivazione`, {
        method: 'POST'
      })
      if (!response.ok) {
        const errorResp = await response.json()
        throw new Error(errorResp.detail || 'Errore nella terminazione della coltivazione')
      }
      setCultivationActive(false)
      setFase(null)
      alert('Coltivazione terminata. Tutti i dati del ciclo sono stati cancellati.')
      // Ricarica lo stato
      await fetchCultivationStatus()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setCultivationLoading(false)
    }
  }

  // Salva la fase
  const setFaseHandler = async (nuovaFase: string) => {
    setFaseLoading(true)
    try {
      const response = await fetch(`/sensors/arduino-grow-box/${sensorName}/fase?fase=${nuovaFase}`, {
        method: 'POST'
      })
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

  // Carica la fase e lo stato coltivazione all'avvio
  useEffect(() => {
    fetchFase()
    fetchCultivationStatus()
  }, [fetchFase, fetchCultivationStatus])

  // Aggiorna lo stato coltivazione quando cambia cultivationActive
  useEffect(() => {
    if (cultivationActive) {
      fetchCultivationStatus()
    }
  }, [cultivationActive, fetchCultivationStatus])

  // Polling adattivo: più veloce se ci sono aggiornamenti recenti
  useEffect(() => {
    let isMounted = true
    
    const scheduleNextFetch = async () => {
      if (!isMounted) return
      
      // Cancella il timeout precedente se esiste
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      const now = Date.now()
      const timeSinceLastUpdate = now - lastUpdateRef.current
      
      // Se ci sono stati aggiornamenti negli ultimi 10 secondi, usa polling veloce (1s)
      // Altrimenti usa polling lento (5s)
      const interval = timeSinceLastUpdate < 10000 ? 1000 : 5000
      
      timeoutRef.current = setTimeout(async () => {
        if (!isMounted) return
        try {
          // Usa fetchAllData che carica tutto in una singola richiesta
          await fetchAllData()
          if (isMounted) {
            scheduleNextFetch()
          }
        } catch (err) {
          // In caso di errore, riprova comunque dopo l'intervallo
          if (isMounted) {
            scheduleNextFetch()
          }
        }
      }, interval)
    }
    
    // Prima chiamata immediata
    fetchAllData().then(() => {
      if (isMounted) {
        scheduleNextFetch()
      }
    })
    
    return () => {
      isMounted = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
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

      {/* Sezione Gestione Coltivazione */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ color: '#F4B342', marginBottom: '1.5rem', fontSize: '1.5rem' }}>
          Gestione Coltivazione
        </h2>
        <div style={{
          backgroundColor: 'rgba(143, 1, 119, 0.3)',
          padding: '1.5rem',
          borderRadius: '12px',
          border: '2px solid #8F0177',
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            type="button"
            onClick={iniziaColtivazione}
            disabled={cultivationLoading || cultivationActive}
            style={{
              padding: '1rem 2rem',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              borderRadius: '8px',
              border: '2px solid #4CAF50',
              backgroundColor: cultivationActive ? 'rgba(76, 175, 80, 0.3)' : '#4CAF50',
              color: '#FFFFFF',
              cursor: (cultivationLoading || cultivationActive) ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease-in-out',
              opacity: (cultivationLoading || cultivationActive) ? 0.7 : 1,
              boxShadow: cultivationActive ? 'none' : '0 0 10px rgba(76, 175, 80, 0.5)'
            }}
          >
            {cultivationLoading ? 'Caricamento...' : '🌱 Inizia Coltivazione'}
          </button>
          <button
            type="button"
            onClick={fineColtivazione}
            disabled={cultivationLoading || !cultivationActive}
            style={{
              padding: '1rem 2rem',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              borderRadius: '8px',
              border: '2px solid #F44336',
              backgroundColor: !cultivationActive ? 'rgba(244, 67, 54, 0.3)' : '#F44336',
              color: '#FFFFFF',
              cursor: (cultivationLoading || !cultivationActive) ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease-in-out',
              opacity: (cultivationLoading || !cultivationActive) ? 0.7 : 1,
              boxShadow: !cultivationActive ? 'none' : '0 0 10px rgba(244, 67, 54, 0.5)'
            }}
          >
            {cultivationLoading ? 'Caricamento...' : '🛑 Fine Coltivazione'}
          </button>
        </div>
        {cultivationActive && (
          <div style={{
            marginTop: '1rem',
            textAlign: 'center',
            color: '#4CAF50',
            fontSize: '0.9rem'
          }}>
            ✓ Coltivazione attiva
          </div>
        )}
        {!cultivationActive && (
          <div style={{
            marginTop: '1rem',
            textAlign: 'center',
            color: '#F4B342',
            fontSize: '0.9rem'
          }}>
            ⚠ Nessuna coltivazione attiva
          </div>
        )}
      </div>

      {/* Sezione Fase di Crescita */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ color: '#F4B342', marginBottom: '1.5rem', fontSize: '1.5rem' }}>
          Fase di Crescita
        </h2>
        <div style={{
          backgroundColor: 'rgba(143, 1, 119, 0.3)',
          padding: '1.5rem',
          borderRadius: '12px',
          border: '2px solid #8F0177',
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          {(['piantina', 'vegetativa', 'fioritura'] as const).map((faseOption) => (
            <button
              key={faseOption}
              type="button"
              onClick={() => setFaseHandler(faseOption)}
              disabled={faseLoading}
              style={{
                padding: '1rem 2rem',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: fase === faseOption ? '3px solid #F4B342' : '2px solid #8F0177',
                backgroundColor: fase === faseOption ? '#F4B342' : 'rgba(143, 1, 119, 0.5)',
                color: fase === faseOption ? '#1A1A1A' : '#FFFFFF',
                cursor: faseLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease-in-out',
                opacity: faseLoading ? 0.7 : 1,
                textTransform: 'capitalize',
                boxShadow: fase === faseOption
                  ? '0 0 15px rgba(244, 179, 66, 0.8)'
                  : '0 0 5px rgba(0, 0, 0, 0.3)'
              }}
            >
              {faseOption}
            </button>
          ))}
        </div>
        {fase && (
          <div style={{
            marginTop: '1rem',
            textAlign: 'center',
            color: '#F4B342',
            fontSize: '0.9rem'
          }}>
            Fase attiva: <strong style={{ textTransform: 'capitalize' }}>{fase}</strong>
          </div>
        )}
      </div>

      {/* Sezione Target e Valori Correnti */}
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
            {/* Temperatura Target */}
            <div style={{
              padding: '1rem',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ color: '#F4B342', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                Temperatura Target
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4CAF50' }}>
                {targets.temp_target_min !== null && targets.temp_target_max !== null
                  ? `${targets.temp_target_min}°C - ${targets.temp_target_max}°C`
                  : 'N/A'}
              </div>
            </div>

            {/* Temperatura Media Corrente */}
            <div style={{
              padding: '1rem',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ color: '#F4B342', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                Temperatura Media
              </div>
              <div style={{ 
                fontSize: '1.5rem', 
                fontWeight: 'bold', 
                color: currentValues.avg_temperature !== null && currentValues.avg_temperature !== undefined
                  ? (targets.temp_target_min !== null && targets.temp_target_min !== undefined &&
                     targets.temp_target_max !== null && targets.temp_target_max !== undefined &&
                     currentValues.avg_temperature >= targets.temp_target_min &&
                     currentValues.avg_temperature <= targets.temp_target_max
                    ? '#4CAF50' : '#F44336')
                  : '#9E9E9E'
              }}>
                {currentValues.avg_temperature !== null && currentValues.avg_temperature !== undefined
                  ? `${currentValues.avg_temperature.toFixed(1)}°C`
                  : 'N/A'}
              </div>
            </div>

            {/* Umidità Target */}
            <div style={{
              padding: '1rem',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ color: '#F4B342', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                Umidità Target
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2196F3' }}>
                {targets.hum_target_min !== null && targets.hum_target_max !== null
                  ? `${targets.hum_target_min}% - ${targets.hum_target_max}%`
                  : 'N/A'}
              </div>
            </div>

            {/* Umidità Media Corrente */}
            <div style={{
              padding: '1rem',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ color: '#F4B342', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                Umidità Media
              </div>
              <div style={{ 
                fontSize: '1.5rem', 
                fontWeight: 'bold', 
                color: currentValues.avg_humidity !== null && currentValues.avg_humidity !== undefined
                  ? (targets.hum_target_min !== null && targets.hum_target_min !== undefined &&
                     targets.hum_target_max !== null && targets.hum_target_max !== undefined &&
                     currentValues.avg_humidity >= targets.hum_target_min &&
                     currentValues.avg_humidity <= targets.hum_target_max
                    ? '#4CAF50' : '#F44336')
                  : '#9E9E9E'
              }}>
                {currentValues.avg_humidity !== null && currentValues.avg_humidity !== undefined
                  ? `${currentValues.avg_humidity.toFixed(1)}%`
                  : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      )}

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
                const action = pompaAspirazioneOn ? 'off' : 'on'
                setActionLoading(prev => ({ ...prev, [`pompa_aspirazione_${action}`]: true }))
                try {
                  const response = await fetch(`/sensors/arduino-grow-box/${sensorName}/pompa-aspirazione?action=${action}`, {
                    method: 'POST'
                  })
                  if (!response.ok) {
                    const errorResp = await response.json()
                    throw new Error(errorResp.detail || 'Errore nella richiesta')
                  }
                  // Ricarica lo stato coltivazione per aggiornare stato attuatori
                  await fetchCultivationStatus()
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Errore sconosciuto')
                } finally {
                  setActionLoading(prev => ({ ...prev, [`pompa_aspirazione_${action}`]: false }))
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
                const action = pompaAcquaOn ? 'off' : 'on'
                setActionLoading(prev => ({ ...prev, [`pompa_acqua_${action}`]: true }))
                try {
                  const response = await fetch(`/sensors/arduino-grow-box/${sensorName}/pompa-acqua?action=${action}`, {
                    method: 'POST'
                  })
                  if (!response.ok) {
                    const errorResp = await response.json()
                    throw new Error(errorResp.detail || 'Errore nella richiesta')
                  }
                  await fetchCultivationStatus()
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Errore sconosciuto')
                } finally {
                  setActionLoading(prev => ({ ...prev, [`pompa_acqua_${action}`]: false }))
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
                const action = resistenzaOn ? 'off' : 'on'
                setActionLoading(prev => ({ ...prev, [`resistenza_${action}`]: true }))
                try {
                  const response = await fetch(`/sensors/arduino-grow-box/${sensorName}/resistenza?action=${action}`, {
                    method: 'POST'
                  })
                  if (!response.ok) {
                    const errorResp = await response.json()
                    throw new Error(errorResp.detail || 'Errore nella richiesta')
                  }
                  await fetchCultivationStatus()
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Errore sconosciuto')
                } finally {
                  setActionLoading(prev => ({ ...prev, [`resistenza_${action}`]: false }))
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
                const action = luceLedOn ? 'off' : 'on'
                setActionLoading(prev => ({ ...prev, [`luce_led_${action}`]: true }))
                try {
                  const response = await fetch(`/sensors/arduino-grow-box/${sensorName}/luce-led?action=${action}`, {
                    method: 'POST'
                  })
                  if (!response.ok) {
                    const errorResp = await response.json()
                    throw new Error(errorResp.detail || 'Errore nella richiesta')
                  }
                  await fetchCultivationStatus()
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Errore sconosciuto')
                } finally {
                  setActionLoading(prev => ({ ...prev, [`luce_led_${action}`]: false }))
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
                const action = ventolaOn ? 'off' : 'on'
                setActionLoading(prev => ({ ...prev, [`ventola_${action}`]: true }))
                try {
                  const response = await fetch(`/sensors/arduino-grow-box/${sensorName}/ventola?action=${action}`, {
                    method: 'POST'
                  })
                  if (!response.ok) {
                    const errorResp = await response.json()
                    throw new Error(errorResp.detail || 'Errore nella richiesta')
                  }
                  await fetchCultivationStatus()
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Errore sconosciuto')
                } finally {
                  setActionLoading(prev => ({ ...prev, [`ventola_${action}`]: false }))
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
